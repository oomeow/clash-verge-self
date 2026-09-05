import type { editor } from "monaco-editor";
import { type RefObject, useEffect, useRef, useState } from "react";

import { configureYaml, defaultOptions, loadMonaco } from "@/services/monaco";
import { useThemeModeStore } from "@/stores";

import { useWindowSize } from "./use-window-size";

type Monaco = typeof import("monaco-editor");

/** 宽度大于等于该值时显示小地图 */
const MINIMAP_BREAKPOINT = 1000;

export interface UseMonacoEditorOptions {
  /** 是否激活(创建)编辑器，例如对话框打开后才激活，默认 true */
  active?: boolean;
  /** 创建 model 时使用的语言 */
  language?: string;
  /** 只读模式，运行时变化会通过 updateOptions 生效 */
  readOnly?: boolean;
  /** 额外的编辑器创建选项（仅在创建时生效） */
  constructionOptions?: editor.IStandaloneEditorConstructionOptions;
}

export interface UseMonacoEditorResult {
  monaco: Monaco | null;
  /** 编辑器实例，monaco 加载完成且 active 后非空 */
  editor: editor.IStandaloneCodeEditor | null;
  /** 编辑器容器 DOM ref，需要挂载到一个 `<div ref={domRef} />` 上 */
  domRef: RefObject<HTMLDivElement | null>;
  /**
   * 用新内容替换当前 model（旧的 model 会被 dispose）。
   * 适合切换文件后重新加载内容时使用。
   */
  setModel: (
    value: string,
    model?: { language?: string; uri?: string },
  ) => void;
}

/**
 * Monaco Editor 生命周期 hook：负责 monaco 延迟加载、编辑器创建/销毁、
 * model 替换、主题跟随与小地图自适应，避免在组件中重复实现。
 */
export const useMonacoEditor = (
  options: UseMonacoEditorOptions = {},
): UseMonacoEditorResult => {
  const { active = true, language, readOnly, constructionOptions } = options;
  const themeMode = useThemeModeStore((s) => s.themeMode);
  const {
    size: { width },
  } = useWindowSize();

  const domRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<editor.ITextModel | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const minimapRef = useRef(true);

  const [monaco, setMonaco] = useState<Monaco | null>(null);
  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor | null>(
    null,
  );

  // 缓存创建时需要的可变配置，避免随每次渲染重建编辑器
  const configRef = useRef({ language, readOnly, constructionOptions });
  useEffect(() => {
    configRef.current = { language, readOnly, constructionOptions };
  });

  // 延迟加载 monaco（仅在 active 时）
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    loadMonaco().then((instance) => {
      if (cancelled) return;
      monacoRef.current = instance;
      configureYaml();
      setMonaco(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  // 创建 / 销毁编辑器实例
  useEffect(() => {
    const instance = monacoRef.current;
    const dom = domRef.current;
    if (!active || !instance || !dom) return;

    const {
      language: lang,
      readOnly: read,
      constructionOptions: extra,
    } = configRef.current;
    const minimapEnabled = width >= MINIMAP_BREAKPOINT;
    const model = instance.editor.createModel("", lang);
    const ed = instance.editor.create(dom, {
      ...defaultOptions,
      ...extra,
      model,
      readOnly: read,
      theme: themeMode === "dark" ? "vs-dark" : "light",
      minimap: { enabled: minimapEnabled },
    });
    modelRef.current = model;
    minimapRef.current = minimapEnabled;
    editorRef.current = ed;
    setEditor(ed);

    return () => {
      setEditor(null);
      editorRef.current = null;
      ed.dispose();
      const current = modelRef.current;
      modelRef.current = null;
      current?.dispose();
    };
  }, [active, monaco]);

  // 主题 / 只读模式运行时同步
  useEffect(() => {
    editorRef.current?.updateOptions({
      theme: themeMode === "dark" ? "vs-dark" : "light",
      readOnly,
    });
  }, [editor, themeMode, readOnly]);

  // 窗口宽度跨过阈值时切换小地图
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;

    const enabled = width >= MINIMAP_BREAKPOINT;
    if (enabled === minimapRef.current) return;
    minimapRef.current = enabled;
    ed.updateOptions({ minimap: { enabled } });
  }, [editor, width]);

  const setModel: UseMonacoEditorResult["setModel"] = (value, modelOptions) => {
    const instance = monacoRef.current;
    const ed = editorRef.current;
    if (!instance || !ed) return;

    const lang = modelOptions?.language ?? configRef.current.language;
    const uri = modelOptions?.uri
      ? instance.Uri.parse(modelOptions.uri)
      : undefined;
    const next = instance.editor.createModel(value, lang, uri);
    const prev = modelRef.current;
    modelRef.current = next;
    ed.setModel(next);
    prev?.dispose();
  };

  return { monaco, editor, domRef, setModel };
};
