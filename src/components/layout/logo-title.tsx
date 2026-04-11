import AppNameSvg from "@/assets/image/clash_verge.svg?react";
import LogoSvg from "@/assets/image/logo.svg?react";
import { UpdateButton } from "@/components/layout/update-button";
import { useCustomTheme } from "@/components/layout/use-custom-theme";
import { useThemeModeStore } from "@/stores";
import { cn } from "@/utils";
import getSystem from "@/utils/get-system";
import DarkMode from "@mui/icons-material/DarkMode";
import LightMode from "@mui/icons-material/LightMode";
import { AnimatePresence, motion } from "motion/react";

export const LogoTitle = ({ open }: { open: boolean }) => {
  const { toggleTheme } = useCustomTheme();
  const mode = useThemeModeStore((s) => s.themeMode);
  const isDark = mode === "dark";
  const isMacOS = getSystem() === "macos";

  return (
    <div
      className={cn("relative box-border flex w-full shrink-0 grow-0 pt-2", {
        "pt-4": isMacOS,
      })}
      data-tauri-drag-region="true">
      <div className="flex items-center justify-around px-5">
        <div>
          <LogoSvg
            className={cn(
              "fill-primary-main! mr-1 h-full w-12 transition-all duration-200",
              { "w-16": !open },
            )}
          />
        </div>
        <div>
          <AppNameSvg
            className={cn("fill-primary-main! h-full w-full", {
              hidden: !open,
            })}
          />
        </div>
      </div>
      <UpdateButton
        className={cn("absolute top-0 left-0 z-10 scale-[0.7] cursor-pointer", {
          "top-0 left-16 scale-75": open,
        })}
      />
      <AnimatePresence initial={false}>
        <motion.button
          key={isDark ? "dark" : "light"}
          initial={{ x: -25, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute top-0 right-2 z-10 h-7.5 w-7.5 cursor-pointer border-none bg-transparent"
          onClick={(e) => toggleTheme(e, isDark ? "light" : "dark")}>
          {isDark ? (
            <DarkMode
              fontSize="inherit"
              className="fill-primary-main! h-full w-full"
            />
          ) : (
            <LightMode
              fontSize="inherit"
              className="fill-primary-main! h-full w-full"
            />
          )}
        </motion.button>
      </AnimatePresence>
    </div>
  );
};
