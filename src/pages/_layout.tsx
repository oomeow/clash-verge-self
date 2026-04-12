import { TailwindIndicator } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { LayoutControl } from "@/components/layout/layout-control";
import { Sidebar } from "@/components/layout/sidebar";
import {
  useCustomTheme,
  useSyncThemeSettings,
} from "@/components/layout/use-custom-theme";
import { usePortable } from "@/hooks/use-portable";
import { useVerge } from "@/hooks/use-verge";
import { useVisibility } from "@/hooks/use-visibility";
import LoadingPage from "@/pages/loading";
import { translateDynamicKey } from "@/services/i18n";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";
import { Paper, ThemeProvider } from "@mui/material";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Event, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import "dayjs/locale/zh-cn";
import relativeTime from "dayjs/plugin/relativeTime";
import i18next from "i18next";
import { debounce } from "lodash-es";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SWRConfig, mutate } from "swr";

dayjs.extend(relativeTime);
const OS = getSystem();
let keepUIActive = false;

interface NoticePayload {
  status: "success" | "info" | "warning" | "error";
  msg: string;
}

const Layout = () => {
  usePortable();
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showRouteLoading, setShowRouteLoading] = useState(false);
  const visitedPathsRef = useRef(new Set<string>());
  const { t } = useTranslation();
  const { notice } = useNotice();
  useSyncThemeSettings();
  const { theme } = useCustomTheme();
  const visible = useVisibility();
  const { verge } = useVerge();
  const { language, enable_system_title_bar, enable_keep_ui_active } = verge;
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  keepUIActive = enable_keep_ui_active || false;

  useEffect(() => {
    visitedPathsRef.current.add(pathname);
  }, [pathname]);

  const handleClose = (keepUIActive: boolean) => {
    const appWindow = getCurrentWebviewWindow();
    if (keepUIActive) {
      appWindow.hide();
    } else {
      appWindow.close();
    }
  };

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    appWindow.isMaximized().then((maximized) => {
      setIsMaximized(maximized);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && OS !== "macos") {
        handleClose(keepUIActive);
      }
    });

    const unlistenRefreshProfiles = listen("verge://refresh-profiles", () => {
      mutate("getProfiles");
    });

    const unlistenRefreshClash = listen("verge://refresh-clash-config", () => {
      // the clash info may be updated
      mutate("getProxies");
      mutate("getRules");
      mutate("getVersion");
      mutate("getClashConfig");
      mutate("getClashInfo");
      mutate("getRuntimeConfig");
      mutate("getProxyProviders");
    });

    // update the verge config
    const unlistenRefreshVerge = listen("verge://refresh-verge-config", () => {
      mutate("getVergeConfig");
    });

    // 设置提示监听
    const unlistenNotice = listen(
      "verge://notice-message",
      (e: Event<NoticePayload>) => {
        const {
          payload: { status, msg },
        } = e;
        notice(status, t(msg));
      },
    );

    setTimeout(async () => {
      await appWindow.unminimize();
      await appWindow.show();
      await appWindow.setFocus();
    }, 50);

    return () => {
      unlistenRefreshProfiles.then((fn) => fn());
      unlistenRefreshClash.then((fn) => fn());
      unlistenRefreshVerge.then((fn) => fn());
      unlistenNotice.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    const checkMaximized = debounce(async () => {
      const value = await appWindow.isMaximized();
      if (isMaximized !== value) {
        setIsMaximized(value);
      }
    }, 100);
    const unlistenResize = appWindow.onResized(checkMaximized);

    return () => {
      unlistenResize.then((fn) => fn());
    };
  }, [isMaximized]);

  useEffect(() => {
    if (language) {
      dayjs.locale(language === "zh" ? "zh-cn" : language);
      i18next.changeLanguage(language);
    }
  }, [language, visible]);

  useEffect(() => {
    if (!pendingPath) return;

    const stopRouteLoading = () => {
      setShowRouteLoading(false);
      setPendingPath(null);
    };

    const timeoutId = globalThis.setTimeout(
      stopRouteLoading,
      pathname === pendingPath ? 180 : 4000,
    );

    return () => globalThis.clearTimeout(timeoutId);
  }, [pathname, pendingPath]);

  return (
    <SWRConfig
      value={{
        errorRetryCount: 10,
        errorRetryInterval: 1000,
        revalidateOnFocus: true,
        revalidateOnMount: true,
      }}>
      <ThemeProvider theme={theme}>
        <Paper
          square
          elevation={0}
          className={cn("relative flex h-screen w-screen overflow-hidden", {
            "rounded-md border-2 border-solid border-(--divider-color)":
              OS === "linux" && !enable_system_title_bar,
            "rounded-none": isMaximized,
          })}
          onContextMenu={(e) => {
            // only prevent it on Windows
            const validList = ["input", "textarea"];
            const target = e.currentTarget;
            if (
              OS === "windows" &&
              !(
                validList.includes(target.tagName.toLowerCase()) ||
                target.isContentEditable
              )
            ) {
              e.preventDefault();
            }
          }}>
          <Sidebar
            enableSystemTitleBar={!!enable_system_title_bar}
            onNavigateStart={(to) => {
              if (to === pathname) return;
              if (visitedPathsRef.current.has(to)) return;
              setPendingPath(to);
              setShowRouteLoading(true);
            }}
          />

          <div className="flex h-full w-full flex-col overflow-hidden">
            {!enable_system_title_bar && (
              <div className="z-10 box-border flex shrink-0 grow-0 basis-8 justify-end">
                <div className="mt-1 w-full" data-tauri-drag-region="true" />
                {OS !== "macos" && (
                  <LayoutControl
                    maximized={isMaximized}
                    onClose={() => handleClose(keepUIActive)}
                  />
                )}
              </div>
            )}

            <div className="bg-comment relative flex-auto overflow-auto py-1 pr-1 dark:bg-[#1e1f27]">
              <Suspense fallback={<LoadingPage />}>
                <Outlet />
              </Suspense>
              {showRouteLoading && (
                <div className="absolute inset-0 z-20 transition-opacity duration-150">
                  <LoadingPage />
                </div>
              )}
            </div>
            <TailwindIndicator />
          </div>
        </Paper>
      </ThemeProvider>
    </SWRConfig>
  );
};

export default Layout;
