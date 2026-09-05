import DarkMode from "@mui/icons-material/DarkMode";
import LightMode from "@mui/icons-material/LightMode";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useLongPress } from "ahooks";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";

import AppNameSvg from "@/assets/image/clash_verge.svg?react";
import LogoSvg from "@/assets/image/logo.svg?react";
import { UpdateButton } from "@/components/layout/update-button";
import { useCustomTheme } from "@/components/layout/use-custom-theme";
import { useThemeModeStore } from "@/stores";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";

const OS = getSystem();

export const LogoTitle = ({
  sidebarCollapsed,
  enableSystemTitleBar,
}: {
  sidebarCollapsed: boolean;
  enableSystemTitleBar: boolean;
}) => {
  const { toggleTheme } = useCustomTheme();
  const mode = useThemeModeStore((s) => s.themeMode);
  const isDark = mode === "dark";
  const isMacOS = OS === "macos";
  const dragRegionRef = useRef<HTMLDivElement>(null);

  useLongPress(
    () => {
      getCurrentWebviewWindow().setCursorIcon("move");
      getCurrentWebviewWindow().startDragging();
    },
    dragRegionRef,
    { moveThreshold: { x: 3 }, delay: 100 },
  );

  return (
    <div
      className={cn("relative box-border flex w-full shrink-0 grow-0 pt-2", {
        "pb-2": sidebarCollapsed,
        "pt-4": isMacOS,
      })}>
      <div
        ref={dragRegionRef}
        className={cn("flex items-center justify-around px-5", {
          "px-2": sidebarCollapsed,
        })}>
        <div id="logo-title" className="relative">
          <LogoSvg
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              toggleTheme(isDark ? "light" : "dark");
            }}
            className={cn(
              "fill-primary! z-10 mr-1 h-full w-12 cursor-pointer transition-all duration-200",
              {
                "mt-2 mr-0": sidebarCollapsed,
                "mt-6": isMacOS && sidebarCollapsed,
              },
            )}
          />
          <UpdateButton
            className={cn("absolute z-10 scale-75 cursor-pointer", {
              "top-11 left-0": sidebarCollapsed,
              "top-17": isMacOS && sidebarCollapsed,
              "-top-2 left-12": !sidebarCollapsed,
            })}
          />
        </div>
        <div>
          <AppNameSvg
            className={cn("fill-primary! h-full w-full", {
              hidden: sidebarCollapsed,
            })}
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        <motion.button
          key={isDark ? "dark" : "light"}
          initial={{ x: -25, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={cn(
            "absolute top-0 right-4 z-10 h-4 w-4 cursor-pointer border-none bg-transparent",
            {
              "top-2": isMacOS,
              "top-2 right-5.5": sidebarCollapsed,
              "-top-1": sidebarCollapsed && enableSystemTitleBar,
              "top-5": sidebarCollapsed && isMacOS,
            },
          )}
          onClick={() => toggleTheme(isDark ? "light" : "dark")}>
          {isDark ? (
            <DarkMode
              fontSize="inherit"
              className="fill-primary! h-full w-full"
            />
          ) : (
            <LightMode
              fontSize="inherit"
              className="fill-primary! h-full w-full"
            />
          )}
        </motion.button>
      </AnimatePresence>
    </div>
  );
};
