import { useLockFn } from "ahooks";
import type { editor, IDisposable } from "monaco-editor";
import { nanoid } from "nanoid";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWindowSize } from "@/hooks/use-window-size";
import {
  configureYaml,
  defaultOptions,
  generateTemplate,
  loadMonaco,
  registerPacCompletion,
  registerPacFunctionLib,
} from "@/services/monaco";
import { useThemeModeStore } from "@/stores";
import { getErrorMessage } from "@/utils";

import { BaseDialog } from "./base-dialog";
import { useNotice } from "./notifies";

interface Props {
  title?: string | ReactNode;
  property: string;
  open: boolean;
  language: "javascript" | "css" | "yaml";
  scope?: "pac" | "script" | "clash";
  readonly?: boolean;
  onClose: () => void;
  onChange?: (content: string) => void;
}

export const EditorViewer = (props: Props) => {
  const {
    title,
    property,
    open,
    language,
    scope,
    readonly,
    onClose,
    onChange,
  } = props;
  const { t } = useTranslation();
  const editorDomRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null,
  );
  const { notice } = useNotice();
  const {
    size: { width },
  } = useWindowSize();

  useEffect(() => {
    if (!open) return;

    loadMonaco().then((instance) => {
      setMonaco(instance);
      configureYaml();
    });

    if (!monaco) return;

    const fetchContent = Promise.resolve(property);
    let pacFunLib: IDisposable;
    let pacCompletion: IDisposable;
    let codeLens: IDisposable | undefined;
    fetchContent.then(async (data) => {
      const dom = editorDomRef.current;
      if (!dom) return;

      if (instanceRef.current) instanceRef.current.dispose();

      const uri = monaco.Uri.parse(`${nanoid()}.${scope}.${language}`);
      const model = monaco.editor.createModel(data, language, uri);

      instanceRef.current = monaco.editor.create(dom, {
        ...defaultOptions,
        model: model,
        language: language,
        tabSize: ["yaml", "javascript", "css"].includes(language) ? 2 : 4,
        readOnly: readonly,
        theme: themeMode === "dark" ? "vs-dark" : "light",
        minimap: { enabled: window.innerWidth >= 1000 },
      });

      if (scope && "pac" === scope) {
        pacFunLib = await registerPacFunctionLib();
        pacCompletion = await registerPacCompletion();
        codeLens = await generateTemplate({
          monacoInstance: instanceRef.current,
          languageSelector: ["javascript"],
          generateType: "pac",
          generateLanguage: "javascript",
          showCondition: true,
        });
      }
    });

    return () => {
      instanceRef.current?.dispose();
      pacFunLib?.dispose();
      pacCompletion?.dispose();
      codeLens?.dispose();
      instanceRef.current = null;
    };
  }, [open, monaco, scope, language, readonly, themeMode, property]);

  // 更新 monaco 显示小地图
  useEffect(() => {
    if (!instanceRef.current || !monaco) return;

    const minimap = instanceRef.current.getOption(
      monaco.editor.EditorOption.minimap,
    );
    if (!minimap.enabled && width >= 1000) {
      instanceRef.current.updateOptions({
        minimap: { enabled: true },
      });
    }
    if (minimap.enabled && width < 1000) {
      instanceRef.current.updateOptions({
        minimap: { enabled: false },
      });
    }
  }, [width, monaco]);

  const onSave = useLockFn(async () => {
    const value = instanceRef.current?.getValue();

    if (value === undefined) return;

    try {
      onChange?.(value);
      onClose();
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    }
  });

  return (
    <BaseDialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onClose}
      onOk={onSave}
      onCancel={onClose}
      title={title ?? t("pages.profiles.actions.editFile")}>
      <div
        className="w-full overflow-hidden select-text"
        style={{ height: "calc(100vh - 220px)" }}>
        <div className="h-full w-full overflow-hidden" ref={editorDomRef} />
      </div>
    </BaseDialog>
  );
};
