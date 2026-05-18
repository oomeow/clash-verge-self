import "dayjs/locale/ru";
import "dayjs/locale/zh-cn";

import { Box, Paper, Stack } from "@mui/material";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Event, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18next from "i18next";
import debounce from "lodash-es/debounce";
import { Suspense, useEffect, useRef, useState } from "react";

import { useNotice } from "@/components/base/notifies";
import { TailwindIndicator } from "@/components/base/tailwind-indicator";
import { LayoutControl } from "@/components/layout/layout-control";
import { Sidebar } from "@/components/layout/sidebar";
import { useAppHotkeys } from "@/hooks/use-app-hotkeys";
import { usePortable } from "@/hooks/use-portable";
import { useVisibility } from "@/hooks/use-visibility";
import LoadingPage from "@/pages/loading";
import { appSWRConfig, refreshClashSWR, SWRConfig } from "@/services/swr";
import { useProfilesStore } from "@/stores/profilesStore";
import { useRulesStateStore } from "@/stores/rulesStateStore";
import { useVergeStore } from "@/stores/vergeStore";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";

dayjs.extend(relativeTime);
const OS = getSystem();

interface NoticePayload {
  status: "success" | "info" | "warning" | "error";
  msg: string;
  args?: Record<string, string>;
}

const Layout = () => {
  usePortable();
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showRouteLoading, setShowRouteLoading] = useState(false);
  const visitedPathsRef = useRef(new Set<string>());
  const { notice } = useNotice();
  const visible = useVisibility();
  const language = useVergeStore((s) => s.verge.language);
  const enableSystemTitleBar = useVergeStore(
    (s) => s.verge.enable_system_title_bar ?? false,
  );
  const appHotkeys = useVergeStore((s) => s.verge.app_hotkeys);
  const refreshVerge = useVergeStore((s) => s.refreshVerge);
  const refreshProfilesConfig = useProfilesStore((s) => s.refreshConfig);
  const fetchRules = useRulesStateStore((s) => s.fetchRules);

  useAppHotkeys(appHotkeys);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useEffect(() => {
    visitedPathsRef.current.add(pathname);
  }, [pathname]);

  const handleClose = () => {
    const appWindow = getCurrentWebviewWindow();
    const keepUIActive =
      useVergeStore.getState().verge.enable_keep_ui_active ?? false;
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
          payload: { status, msg, args },
        } = e;
        // 直接通过 i18next 翻译，避免和界面语言不一致的问题
        notice(status, i18next.exists(msg) ? i18next.t(msg, args) : msg);
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
          "rounded-lg border border-solid border-(--divider-color)":
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

        <Stack
          className="bg-background-default h-full min-w-0 flex-1 overflow-hidden"
          direction="column">
          {!enableSystemTitleBar && (
            <Box className="z-10 box-border flex shrink-0 grow-0 basis-9 justify-end">
              <Box className="w-full" data-tauri-drag-region="true" />
              {OS !== "macos" && (
                <LayoutControl maximized={isMaximized} onClose={handleClose} />
              )}
            </Box>
          )}

          <Box className="relative min-h-0 flex-1 overflow-hidden py-1 pr-1">
            <Suspense fallback={<LoadingPage />}>
              <Outlet />
            </Suspense>
            {showRouteLoading && (
              <Box className="absolute inset-0 z-20 transition-opacity duration-150">
                <LoadingPage />
              </Box>
            )}
          </Box>
          <TailwindIndicator />
        </Stack>
      </Paper>
    </SWRConfig>
  );
};

export default Layout;
