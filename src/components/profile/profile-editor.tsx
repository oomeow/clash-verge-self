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
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { LogViewer } from "@/components/profile/log-viewer";
import type { LogMessage } from "@/components/profile/profile-more";
import { useMonacoEditor } from "@/hooks/use-monaco-editor";
import {
  readProfileFile,
  saveProfileFile,
  testMergeChain,
} from "@/services/cmds";
import { generateTemplate } from "@/services/monaco";
import { useProfilesStore } from "@/stores";
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
  onChange?: (content: string) => void;
  onReset?: () => void;
  onSave?: () => void;
}

export const ProfileEditor = memo(function ProfileEditor(props: Props) {
  const { ref, parentUid, profileItem, onChange, onReset, onSave } = props;

  const { t } = useTranslation();
  const { notice } = useNotice();

  const language = profileItem.type === "script" ? "javascript" : "yaml";
  const type =
    profileItem.type === "merge"
      ? "merge"
      : profileItem.type === "script"
        ? "script"
        : "clash";
  const isChain = type === "merge" || type === "script";

  const { monaco, editor, domRef, setModel } = useMonacoEditor({ language });

  // 原始内容
  const originContentRef = useRef<string | null>(null);

  // chain 相关上下文条件
  const editChainCondition =
    useRef<editor.IContextKey<boolean | undefined>>(null);
  const saveChainCondition =
    useRef<editor.IContextKey<boolean | undefined>>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  // chain
  const [chainChecked, setChainChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  // script chain：日志以当前 uid 的 store 值作初始种子，后续由 handleRunCheck 更新
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>(() => {
    const seed = useProfilesStore.getState().chainLogs[profileItem.uid];
    return seed ?? [];
  });
  const hasError = type === "script" && !!logs?.find((item) => item.exception);

  // 编辑器创建后注册上下文条件
  useEffect(() => {
    if (!editor) return;
    editChainCondition.current = editor.createContextKey("editChain", isChain);
    saveChainCondition.current = editor.createContextKey("saveChain", false);
    return () => {
      editChainCondition.current = null;
      saveChainCondition.current = null;
    };
  }, [editor]);

  // 读取并显示脚本内容
  useEffect(() => {
    const ed = editor;
    if (!ed || !monaco) return;

    // 切换编辑对象 / 卸载后忽略过期的异步结果，避免旧文件覆盖新内容
    let cancelled = false;
    readProfileFile(profileItem.uid)
      .then((data) => {
        if (cancelled) return;
        originContentRef.current = data;
        // create uri to use schemas
        const id = nanoid();
        const uri = `${id}.${type}.${language}`;
        setModel(data, { language, uri });
        editChainCondition.current?.set(isChain);
        saveChainCondition.current?.set(false);
        setChainChecked(false);
        setSaved(true);
        setLogs(useProfilesStore.getState().chainLogs[profileItem.uid] ?? []);
      })
      .catch((e) => {
        if (!cancelled) console.error(e);
      });

    // Model 内容改变
    const modelChange = ed.onDidChangeModelContent(() => {
      setChainChecked(false);
      let isReset = false;
      if (originContentRef.current) {
        const content = ed.getValue() ?? "";
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
      onChange?.(ed.getValue() ?? "");
      if (isReset) {
        onReset?.();
      }
    });

    // [F5] 快速执行脚本运行检测
    const runCheckAction = ed.addAction({
      id: "runChainCheck",
      label: "check run",
      keybindings: [monaco.KeyCode.F5],
      keybindingContext: "textInputFocus && editChain",
      run: async (_ed) => {
        await handleRunCheck(profileItem.uid);
      },
    });

    // [Ctrl + s] 保存当前编辑的配置内容
    const saveAction = ed.addAction({
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
        monacoInstance: ed,
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
      cancelled = true;
      modelChange.dispose();
      runCheckAction.dispose();
      saveAction.dispose();
      codeLensRef?.dispose();
    };
  }, [profileItem, monaco, editor]);

  const handleRunCheck = async (currentProfileUid: string) => {
    try {
      const value = editor?.getValue();
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
    const val = editor?.getValue();
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

  useImperativeHandle(ref, () => ({
    save: async () => {
      try {
        return await handleSave();
      } catch (_ignore) {
        return false;
      }
    },
    reset: () => {
      if (originContentRef.current) {
        editor?.setValue(originContentRef.current);
      }
    },
  }));

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="h-full w-full overflow-hidden" ref={domRef} />
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
                  editor?.setValue(originContentRef.current);
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
});

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  "& .MuiBadge-badge": {
    right: 0,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: "0 4px",
  },
}));
