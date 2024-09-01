/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import "@/assets/styles/index.scss";
import { BaseErrorBoundary } from "@/components/base";
import router from "@/pages/_routers";
import "@/services/i18n";
import { ResizeObserver } from "@juggle/resize-observer";
import { WebviewWindow } from "@tauri-apps/api/window";
import { ComposeContextProvider } from "foxact/compose-context-provider";
import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import {
  LoadingCacheProvider,
  ThemeModeProvider,
  UpdateStateProvider,
} from "./services/states";

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

const mainElementId = "root";
const container = document.getElementById(mainElementId);
if (!container) {
  throw new Error(
    `No container '${mainElementId}' found to render application`,
  );
}

if (process.env.NODE_ENV !== "development") {
  // disable context menu
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

document.addEventListener("keydown", (event) => {
  // Disable WebView keyboard shortcuts
  const disabledShortcuts =
    ["F5", "F7"].includes(event.key) ||
    (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) ||
    ((event.ctrlKey || event.metaKey) &&
      ["F", "G", "H", "J", "P", "Q", "R", "U"].includes(
        event.key.toUpperCase(),
      ));
  disabledShortcuts && event.preventDefault();
});

document.addEventListener("DOMContentLoaded", async () => {
  const splashscreenWindow = WebviewWindow.getByLabel("splashscreen");
  if (splashscreenWindow) {
    setTimeout(() => {
      splashscreenWindow.close();
    }, 1000);
  }
});

const contexts = [
  <ThemeModeProvider key={"themeModeProvider"} />,
  <LoadingCacheProvider key={"loadingCacheProvider"} />,
  <UpdateStateProvider key={"updateStateProvider"} />,
];

createRoot(container).render(
  <React.StrictMode>
    <ComposeContextProvider contexts={contexts}>
      <BaseErrorBoundary>
        <RouterProvider router={router} />
      </BaseErrorBoundary>
    </ComposeContextProvider>
  </React.StrictMode>,
);
