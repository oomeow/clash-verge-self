import { useLockFn } from "ahooks";
import type { IDisposable } from "monaco-editor";
import { nanoid } from "nanoid";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useMonacoEditor } from "@/hooks/use-monaco-editor";
import {
  generateTemplate,
  registerPacCompletion,
  registerPacFunctionLib,
} from "@/services/monaco";
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
  const { notice } = useNotice();

  const { editor, domRef, setModel } = useMonacoEditor({
    active: open,
    language,
    readOnly: readonly,
    constructionOptions: {
      tabSize: ["yaml", "javascript", "css"].includes(language) ? 2 : 4,
    },
  });

  // 内容变化时重新加载 model（保留 uri 以使用 schemas / 语言支持）
  useEffect(() => {
    const ed = editor;
    if (!ed) return;

    const uri = `${nanoid()}.${scope}.${language}`;
    setModel(property, { language, uri });
  }, [editor, property, scope, language]);

  // PAC 脚本需要注册额外的库 / 补全 / 模板
  useEffect(() => {
    const ed = editor;
    if (!ed || scope !== "pac") return;

    let disposed = false;
    let pacFunLib: IDisposable | undefined;
    let pacCompletion: IDisposable | undefined;
    let codeLens: IDisposable | undefined;

    void (async () => {
      const lib = await registerPacFunctionLib();
      if (disposed) {
        lib.dispose();
        return;
      }
      pacFunLib = lib;

      const completion = await registerPacCompletion();
      if (disposed) {
        completion.dispose();
        return;
      }
      pacCompletion = completion;

      const lens = await generateTemplate({
        monacoInstance: ed,
        languageSelector: ["javascript"],
        generateType: "pac",
        generateLanguage: "javascript",
        showCondition: true,
      });
      if (disposed) {
        lens?.dispose();
        return;
      }
      codeLens = lens;
    })();

    return () => {
      disposed = true;
      pacFunLib?.dispose();
      pacCompletion?.dispose();
      codeLens?.dispose();
    };
  }, [editor, scope]);

  const onSave = useLockFn(async () => {
    const value = editor?.getValue();

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
        <div className="h-full w-full overflow-hidden" ref={domRef} />
      </div>
    </BaseDialog>
  );
};
