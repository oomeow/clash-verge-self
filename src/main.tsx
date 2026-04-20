import "@/index.css";
import "@/services/i18n";
import { ResizeObserver } from "@juggle/resize-observer";
import React from "react";
import { createRoot } from "react-dom/client";
import { MihomoWebSocket } from "tauri-plugin-mihomo-api";

import App from "./App";

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
  if (disabledShortcuts) {
    event.preventDefault();
  }
});

// 页面关闭/刷新事件
window.addEventListener("beforeunload", async () => {
  console.log("beforeunload");
  // 强制清理所有 WebSocket 实例
  await MihomoWebSocket.cleanupAll();
});

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded");
  // 强制清理所有 WebSocket 实例
  await MihomoWebSocket.cleanupAll();
});

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
