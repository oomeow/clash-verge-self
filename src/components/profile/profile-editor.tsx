import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutline from "@mui/icons-material/ErrorOutlined";
import RadioButtonUnchecked from "@mui/icons-material/RadioButtonUnchecked";
import Restore from "@mui/icons-material/Restore";
import Save from "@mui/icons-material/Save";
import Terminal from "@mui/icons-material/Terminal";
import {
  Badge,
  type BadgeProps,
  IconButton,
  styled,
  Tooltip,
} from "@mui/material";
import type { editor, IDisposable } from "monaco-editor";
import { nanoid } from "nanoid";
import {
  type ForwardedRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { LogViewer } from "@/components/profile/log-viewer";
import type { LogMessage } from "@/components/profile/profile-more";
import { useWindowSize } from "@/hooks/use-window-size";
import {
  readProfileFile,
  saveProfileFile,
  testMergeChain,
} from "@/services/cmds";
import {
  configureYaml,
  defaultOptions,
  generateTemplate,
  loadMonaco,
} from "@/services/monaco";
import { useThemeModeStore } from "@/stores";
import { getErrorMessage, sleep } from "@/utils";
import getSystem from "@/utils/get-system";

import { useNotice } from "../base/notifies";

const OS = getSystem();

export type ProfileEditorHandle = {
  save: () => Promise<boolean>;
  reset: () => void;
};

interface Props {
  ref: ForwardedRef<ProfileEditorHandle>;
  parentUid: string | null | undefined;
  profileItem: IProfileItem;
  chainLogs?: Record<string, LogMessage[]>;
  onChange?: (content: string) => void;
  onReset?: () => void;
  onSave?: () => void;
}

export const ProfileEditor = (props: Props) => {
  const {
    ref,
    parentUid,
    profileItem,
    chainLogs = {},
    onChange,
    onReset,
    onSave,
  } = props;

  useImperativeHandle(ref, () => ({
    save: async () => {
      try {
        return await handleSave();
      } catch (ignore) {
        return false;
      }
    },
    reset: () => {
      if (originContentRef.current) {
        instanceRef.current?.setValue(originContentRef.current);
      }
    },
  }));

  const { t } = useTranslation();
  const { size } = useWindowSize();
  const { notice } = useNotice();
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const language = profileItem.type === "script" ? "javascript" : "yaml";
  const type =
    profileItem.type === "merge"
      ? "merge"
      : profileItem.type === "script"
        ? "script"
        : "clash";

  // 原始内容
  const originContentRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  // monaco
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null,
  );
  const editorDomRef = useRef<any>(null);
  const instanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  // const codeLensRef = useRef<IDisposable | null>(null);
  const editChainCondition =
    useRef<editor.IContextKey<boolean | undefined>>(null);
  const saveChainCondition =
    useRef<editor.IContextKey<boolean | undefined>>(null);

  // chain
  const [chainChecked, setChainChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  // script chain
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>(
    chainLogs[profileItem.uid] || [],
  );
  const hasError = type === "script" && !!logs?.find((item) => item.exception);

  // 初始化创建 monaco
  useEffect(() => {
    loadMonaco().then((instance) => {
      setMonaco(instance);
      configureYaml();
    });
    const dom = editorDomRef.current;
    if (!dom || !monaco) return;

    // 创建 monaco
    const model = monaco.editor.createModel("", language);
    instanceRef.current = monaco.editor.create(dom, {
      ...defaultOptions,
      model: model,
      theme: themeMode === "dark" ? "vs-dark" : "light",
      minimap: { enabled: size.width >= 1000 },
    });

    // 用于判断当前编辑的是否为脚本文件
    editChainCondition.current = instanceRef.current.createContextKey(
      "editChain",
      type && ["merge", "script"].includes(type),
    );

    // 用于判断当前编辑的脚本是否通过运行检测, 并且可以保存
    saveChainCondition.current = instanceRef.current.createContextKey(
      "saveChain",
      false,
    );

    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [monaco]);

  // 读取并显示脚本内容
  useEffect(() => {
    if (!instanceRef.current || !monaco) return;

    readProfileFile(profileItem.uid)
      .then(async (data) => {
        originContentRef.current = data;
        // create uri to use schemas
        const id = nanoid();
        const uri = monaco.Uri.parse(`${id}.${type}.${language}`);
        const model = monaco.editor.createModel(data, language, uri);
        const oldModel = instanceRef.current!.getModel();
        instanceRef.current!.setModel(model);
        editChainCondition.current?.set(
          type && ["merge", "script"].includes(type),
        );
        oldModel?.dispose();

        setLogs(chainLogs[profileItem.uid] ?? []);
        saveChainCondition.current?.set(false);
        setChainChecked(false);
        setSaved(true);
      })
      .catch((e) => {
        console.error(e);
      });

    // Model 内容改变
    const modelChange = instanceRef.current?.onDidChangeModelContent(() => {
      setChainChecked(false);
      let isReset = false;
      if (originContentRef.current) {
        const content = instanceRef.current?.getValue() ?? "";
        if (originContentRef.current === content) {
          setSaved(true);
          saveChainCondition.current?.set(true);
          isReset = true;
        } else {
          setSaved(false);
          saveChainCondition.current?.set(false);
        }
      } else {
        setSaved(false);
        saveChainCondition.current?.set(false);
      }
      const content = instanceRef.current?.getValue() ?? "";
      onChange?.(content);
      if (isReset) {
        onReset?.();
      }
    });

    // [F5] 快速执行脚本运行检测
    const runCheckAction = instanceRef.current.addAction({
      id: "runChainCheck",
      label: "check run",
      keybindings: [monaco.KeyCode.F5],
      keybindingContext: "textInputFocus && editChain",
      run: async (_ed) => {
        await handleRunCheck(profileItem.uid);
      },
    });

    // [Ctrl + s] 保存当前编辑的配置内容
    const saveAction = instanceRef.current.addAction({
      id: "saveProfile",
      label: "save profile",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      keybindingContext: "textInputFocus",
      run: async (_ed) => {
        await handleSave();
      },
    });

    let codeLensRef: IDisposable | undefined;
    if (type !== "clash") {
      generateTemplate({
        monacoInstance: instanceRef.current,
        languageSelector: ["yaml", "javascript"],
        generateType: type,
        generateLanguage: language,
        showCondition: true,
        onGenerateSuccess: () => setChainChecked(false),
      }).then((disposable) => {
        codeLensRef = disposable;
      });
    }

    return () => {
      modelChange.dispose();
      runCheckAction.dispose();
      saveAction.dispose();
      codeLensRef?.dispose();
    };
  }, [profileItem, monaco]);

  // 更新 monaco 显示小地图
  useEffect(() => {
    if (!instanceRef.current || !monaco) return;

    const minimap = instanceRef.current.getOption(
      monaco.editor.EditorOption.minimap,
    );
    if (!minimap.enabled && size.width >= 1000) {
      console.log("show mini map");
      instanceRef.current.updateOptions({
        minimap: { enabled: true },
      });
    }
    if (minimap.enabled && size.width < 1000) {
      console.log("disable mini map");
      instanceRef.current.updateOptions({
        minimap: { enabled: false },
      });
    }
  }, [size, monaco]);

  const handleRunCheck = async (currentProfileUid: string) => {
    try {
      const value = instanceRef.current?.getValue();
      if (value === undefined) return false;

      setChecking(true);
      const result = await testMergeChain(
        parentUid ?? null,
        currentProfileUid,
        value,
      );
      setChecking(false);
      setChainChecked(true);
      const currentLogs = result.logs[currentProfileUid] || [];
      setLogs(currentLogs);
      if (currentLogs) {
        if (currentLogs[0]?.exception) {
          notice("error", t("messages.profiles.scriptRunCheckFailed"));
          saveChainCondition.current?.set(false);
          return false;
        }
      }
      notice("success", t("messages.profiles.scriptRunCheckSuccessful"));
      saveChainCondition.current?.set(true);
      return true;
    } catch (error: unknown) {
      saveChainCondition.current?.set(false);
      notice("error", getErrorMessage(error));
      return false;
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const uid = profileItem.uid;
    const val = instanceRef.current?.getValue();
    if (!val) {
      notice("error", t("messages.editor.readMonacoContentFailed"));
      setSaving(false);
      return false;
    }
    const originContent = originContentRef.current;
    if (originContent === val) {
      notice("info", t("messages.profiles.contentUnchanged"));
      setSaving(false);
      return false;
    }
    if (editChainCondition.current?.get()) {
      let checkSuccess = saveChainCondition.current?.get() ?? false;
      if (!checkSuccess) {
        checkSuccess = await handleRunCheck(uid);
      }
      if (!checkSuccess) {
        setSaving(false);
        return false;
      }
    }
    await saveProfileFile(uid, val);
    originContentRef.current = val;
    await sleep(1000);
    notice("success", t("messages.profiles.contentSaved"), 1000);
    setSaving(false);
    setSaved(true);
    onSave?.();
    return true;
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="h-full w-full overflow-hidden" ref={editorDomRef} />
      <div className="flex w-14 flex-col items-center justify-end space-y-2! px-1 pb-4">
        <Tooltip
          title={t("pages.profiles.editor.restoreChanges")}
          placement="left">
          <span>
            <IconButton
              aria-label="rollback"
              size="medium"
              disabled={saved}
              color="primary"
              onClick={() => {
                if (originContentRef.current) {
                  instanceRef.current?.setValue(originContentRef.current);
                  onReset?.();
                  setSaved(true);
                }
              }}>
              <Restore fontSize="medium" />
            </IconButton>
          </span>
        </Tooltip>
        {type !== "clash" && (
          <>
            {type === "script" && (
              <Tooltip
                title={t("pages.profiles.editor.console")}
                placement="left">
                <span>
                  <IconButton
                    aria-label="terminal"
                    size="medium"
                    color="primary"
                    onClick={() => setLogOpen(true)}>
                    {hasError ? (
                      <Badge color="error" variant="dot">
                        <Terminal color="error" fontSize="medium" />
                      </Badge>
                    ) : (
                      <StyledBadge badgeContent={logs?.length} color="primary">
                        <Terminal color="primary" fontSize="medium" />
                      </StyledBadge>
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip
              title={t("pages.profiles.editor.runCheck", { keymap: " F5 " })}
              placement="left">
              <span>
                <IconButton
                  loading={checking}
                  aria-label="test"
                  color={
                    chainChecked ? (hasError ? "error" : "success") : "primary"
                  }
                  size="medium"
                  onClick={async () => await handleRunCheck(profileItem.uid!)}>
                  {chainChecked ? (
                    hasError ? (
                      <ErrorOutline fontSize="medium" />
                    ) : (
                      <CheckCircleOutline fontSize="medium" />
                    )
                  ) : (
                    <RadioButtonUnchecked fontSize="medium" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
        <Tooltip
          title={t("messages.profiles.saveContent", {
            keymap: OS === "macos" ? " Cmd+S" : " Ctrl+S ",
          })}
          placement="left">
          <span>
            <IconButton
              loading={saving}
              aria-label="save"
              size="medium"
              disabled={saved}
              color="primary"
              onClick={async () => {
                await handleSave();
              }}>
              <Save fontSize="medium" color="inherit" />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      {type === "script" && (
        <LogViewer
          open={logOpen}
          logInfo={logs || []}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
  );
};

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  "& .MuiBadge-badge": {
    right: 0,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: "0 4px",
  },
}));
