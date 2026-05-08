import { t } from "i18next";
import type { editor } from "monaco-editor";
import type { JSONSchema } from "monaco-yaml";

import { getTemplate } from "./cmds";

// 延迟加载 Monaco Editor
let monacoInstance: typeof import("monaco-editor") | null = null;
let monacoYamlModule: typeof import("monaco-yaml") | null = null;
let pacDefinition: string | null = null;

const resolveModuleDefault = <T>(module: T | { default: T }): T => {
  if (typeof module === "object" && module !== null && "default" in module) {
    return module.default;
  }

  return module as T;
};

export const loadMonaco = async () => {
  if (!monacoInstance) {
    monacoInstance = await import("monaco-editor");
  }
  return monacoInstance;
};

const loadMonacoYaml = async () => {
  if (!monacoYamlModule) {
    monacoYamlModule = await import("monaco-yaml");
  }

  return monacoYamlModule;
};

const loadPacDefinition = async () => {
  if (!pacDefinition) {
    const pacModule = await import("types-pac/pac.d.ts?raw");
    pacDefinition = resolveModuleDefault(pacModule);
  }

  return pacDefinition;
};

// 缓存 yaml schemas 配置
let yamlSchemasConfigured = false;

// YAML configuration editor
export const configureYaml = async () => {
  if (yamlSchemasConfigured) return;
  // 提前返回，避免多次注入 schemas 配置
  yamlSchemasConfigured = true;

  const [monaco, { configureMonacoYaml }, metaSchemaModule, mergeSchemaModule] =
    await Promise.all([
      loadMonaco(),
      loadMonacoYaml(),
      import("meta-json-schema/schemas/meta-json-schema.json"),
      import("meta-json-schema/schemas/clash-verge-merge-json-schema.json"),
    ]);

  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: "http://example.com/meta-json-schema.json",
        fileMatch: ["**/*.clash.yaml*"],
        schema: resolveModuleDefault(metaSchemaModule) as unknown as JSONSchema,
      },
      {
        uri: "http://example.com/clash-verge-merge-json-schema.json",
        fileMatch: ["**/*.merge.yaml*"],
        schema: resolveModuleDefault(
          mergeSchemaModule,
        ) as unknown as JSONSchema,
      },
    ],
  });
};

export const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
  tabSize: 2,
  theme: "light",
  minimap: { enabled: true },
  mouseWheelZoom: true,
  readOnlyMessage: { value: t("messages.editor.readOnly") },
  renderValidationDecorations: "on",
  quickSuggestions: {
    strings: true,
    comments: true,
    other: true,
  },
  automaticLayout: true,
  fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "twemoji mozilla"`,
  fontLigatures: true,
  smoothScrolling: true,
};

// PAC definition
export const registerPacFunctionLib = async () => {
  const [monaco, pac] = await Promise.all([loadMonaco(), loadPacDefinition()]);
  const disposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(
    pac,
    "pac.d.ts",
  );

  return disposable;
};

export const registerPacCompletion = async () => {
  const monaco = await loadMonaco();
  const disposable = monaco.languages.registerCompletionItemProvider(
    "javascript",
    {
      provideCompletionItems: (model, position) => ({
        suggestions: [
          {
            label: "%mixed-port%",
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: "%mixed-port%",
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: model.getWordUntilPosition(position).startColumn - 1,
              endColumn: model.getWordUntilPosition(position).endColumn - 1,
            },
          },
        ],
      }),
    },
  );

  return disposable;
};

export interface GenerateProps {
  monacoInstance: editor.IStandaloneCodeEditor;
  languageSelector: string[];
  generateType: "merge" | "script" | "pac";
  generateLanguage: "yaml" | "javascript";
  showCondition: boolean;
  onGenerateSuccess?: () => void;
}

export const generateTemplate = async (props: GenerateProps) => {
  const {
    monacoInstance,
    languageSelector,
    generateType,
    generateLanguage,
    showCondition,
    onGenerateSuccess,
  } = props;

  const monaco = await loadMonaco();

  // 生成模板的命令方法
  const generateCommand = monacoInstance.addCommand(
    0,
    (_, scope: string, language: string) => {
      getTemplate(scope, language).then((templateContent) => {
        monacoInstance.setValue(templateContent);
        onGenerateSuccess?.();
      });
    },
    "",
  );

  // 增强脚本模板生成
  return monaco.languages.registerCodeLensProvider(languageSelector, {
    provideCodeLenses(model, _token) {
      if (!showCondition || model.isDisposed()) {
        return null;
      }

      return {
        lenses: [
          {
            id: "Regenerate Template Content",
            range: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 2,
              endColumn: 1,
            },
            command: {
              id: generateCommand!,
              title: t("messages.editor.regenerateTemplateContent"),
              arguments: [generateType, generateLanguage],
            },
          },
        ],
        dispose: () => {},
      };
    },
    resolveCodeLens(_model, codeLens, _token) {
      return codeLens;
    },
  });
};
