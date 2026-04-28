import "dayjs/locale/ru";
import "dayjs/locale/zh-cn";

import { Paper } from "@mui/material";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Event, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18next from "i18next";
import { debounce } from "lodash-es";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { TailwindIndicator } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { LayoutControl } from "@/components/layout/layout-control";
import { Sidebar } from "@/components/layout/sidebar";
import { useAppHotkeys } from "@/hooks/use-app-hotkeys";
import { usePortable } from "@/hooks/use-portable";
import { useVisibility } from "@/hooks/use-visibility";
import LoadingPage from "@/pages/loading";
import { appSWRConfig, refreshClashSWR, SWRConfig } from "@/services/swr";
import { useProfilesStore, useRulesStateStore, useVergeStore } from "@/stores";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";

dayjs.extend(relativeTime);
const OS = getSystem();

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
  const visible = useVisibility();
  const language = useVergeStore((s) => s.verge.language);
  const enableSystemTitleBar = useVergeStore(
    (s) => s.verge.enable_system_title_bar ?? false,
  );
  const enableKeepUiActive = useVergeStore(
    (s) => s.verge.enable_keep_ui_active ?? false,
  );
  const appHotkeys = useVergeStore((s) => s.verge.app_hotkeys);
  const hotkeys = useVergeStore((s) => s.verge.hotkeys);
  const refreshVerge = useVergeStore((s) => s.refreshVerge);
  const refreshProfilesConfig = useProfilesStore((s) => s.refreshConfig);
  const fetchRules = useRulesStateStore((s) => s.fetchRules);

  useAppHotkeys(appHotkeys, hotkeys);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

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
    refreshProfilesConfig();

    const unlistenRefreshProfiles = listen("verge://refresh-profiles", () => {
      refreshProfilesConfig();
    });

    const unlistenRefreshClash = listen("verge://refresh-clash-config", () => {
      // the clash info may be updated
      refreshClashSWR();
      fetchRules();
    });

    // update the verge config
    const unlistenRefreshVerge = listen("verge://refresh-verge-config", () => {
      refreshVerge();
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
      const locale = language.replace("_", "-").toLowerCase();
      dayjs.locale(locale);
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
    <SWRConfig value={appSWRConfig}>
      <Paper
        square
        elevation={0}
        className={cn("relative flex h-screen w-screen overflow-hidden", {
          "rounded-md border-2 border-solid border-(--divider-color)":
            OS === "linux" && !enableSystemTitleBar,
          "rounded-none": isMaximized,
        })}
        onContextMenu={(e) => {
          if (process.env.NODE_ENV === "production") {
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
          }
        }}>
        <Sidebar
          enableSystemTitleBar={enableSystemTitleBar}
          onNavigateStart={(to) => {
            if (to === pathname) return;
            if (visitedPathsRef.current.has(to)) return;
            setPendingPath(to);
            setShowRouteLoading(true);
          }}
        />

        <div className="flex h-full w-full flex-col overflow-hidden">
          {!enableSystemTitleBar && (
            <div className="z-10 box-border flex shrink-0 grow-0 basis-8 justify-end">
              <div className="mt-1 w-full" data-tauri-drag-region="true" />
              {OS !== "macos" && (
                <LayoutControl
                  maximized={isMaximized}
                  onClose={() => handleClose(enableKeepUiActive)}
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
    </SWRConfig>
  );
};

export default Layout;
