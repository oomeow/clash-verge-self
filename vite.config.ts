import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";
import monacoEditorPluginModule from "vite-plugin-monaco-editor";
import svgr from "vite-plugin-svgr";

const isObjectWithDefaultFunction = (
  module: unknown,
): module is { default: typeof monacoEditorPluginModule } =>
  module != null &&
  typeof module === "object" &&
  "default" in module &&
  typeof module.default === "function";

const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule;

const devtools = () => {
  return {
    name: "react-devtools",
    transformIndexHtml(html: string) {
      return html.replace(
        `<head>`,
        `<head>
    <script src="http://localhost:8097"></script>`,
      );
    },
  };
};

export default defineConfig({
  root: "src-next",
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 3000,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  plugins: [
    svgr(),
    tailwindcss(),
    react(),
    legacy({
      renderLegacyChunks: false,
      modernTargets: ["edge>=109", "safari>=13"],
      modernPolyfills: ["es.object.has-own", "web.structured-clone"],
      additionalModernPolyfills: [
        path.resolve("./src-next/polyfills/matchMedia.js"),
        path.resolve("./src-next/polyfills/WeakRef.js"),
        path.resolve("./src-next/polyfills/RegExp.js"),
      ],
    }),
    monacoEditorPlugin({
      languageWorkers: ["editorWorkerService", "css", "typescript", "css"],
      customWorkers: [
        {
          label: "yaml",
          entry: "monaco-yaml/yaml.worker",
        },
      ],
    }),
    !!process.env.TAURI_ENV_DEBUG && devtools(),
  ],
  build: {
    outDir: "../src-tauri/frontend/dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        splashscreen: path.resolve(__dirname, "src-next/splashscreen.html"),
        main: path.resolve(__dirname, "src-next/index.html"),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("monaco-editor")) {
              return "monaco-editor";
            }
            return "vendor";
          } else if (id.includes("src-next/components")) {
            return "verge-components";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve("./src-next"),
      "@root": path.resolve("."),
    },
  },
  define: {
    OS_PLATFORM: `"${process.platform}"`,
  },
});
