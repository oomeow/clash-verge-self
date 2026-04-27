import { List } from "@mui/material";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { LayoutTraffic } from "@/components/layout/layout-traffic";
import { LogoTitle } from "@/components/layout/logo-title";
import { useWindowSize } from "@/hooks/use-window-size";
import { routes } from "@/routes/__root";
import { cn } from "@/utils";

import { LayoutItem } from "./layout-item";

interface Props {
  enableSystemTitleBar: boolean;
  onNavigateStart?: (to: string) => void;
}

export const Sidebar = (props: Props) => {
  const { enableSystemTitleBar, onNavigateStart } = props;
  const { size } = useWindowSize();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const open = size.width >= 650;
  const [pendingTo, setPendingTo] = useState<string | null>(null);

  useEffect(() => {
    setPendingTo(null);
  }, [pathname]);

  useEffect(() => {
    const preloadRoutes = () => {
      routes.forEach((route) => {
        void router.preloadRoute({ to: route.path });
      });
    };
    const windowWithIdleCallback = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdleCallback.requestIdleCallback) {
      const idleId = windowWithIdleCallback.requestIdleCallback(() => {
        preloadRoutes();
      });
      return () => windowWithIdleCallback.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(preloadRoutes, 300);
    return () => globalThis.clearTimeout(timeoutId);
  }, [router]);

  return (
    <div
      className={cn(
        "relative flex shrink-0 grow-0 basis-50 flex-col border-t-0 border-r border-b-0 border-l-0 border-solid border-(--divider-color) pt-2 transition-all duration-300",
        {
          "basis-14": !open,
          "pt-4": !enableSystemTitleBar,
        },
      )}>
      <LogoTitle open={open} enableSystemTitleBar={enableSystemTitleBar} />

      <List className="box-border flex-auto overflow-y-auto">
        {routes.map((route) => (
          <LayoutItem
            open={open}
            key={route.label}
            to={route.path}
            icon={route.icon}
            pending={pendingTo === route.path}
            onMouseEnter={() => {
              void router.preloadRoute({ to: route.path });
            }}
            onNavigate={() => {
              onNavigateStart?.(route.path);
              setPendingTo(route.path);
            }}>
            {t(route.label)}
          </LayoutItem>
        ))}
      </List>

      <div
        className={cn(
          "flex shrink-0 grow-0 items-center justify-center px-4 py-2",
          { hidden: !open },
        )}>
        <LayoutTraffic />
      </div>
    </div>
  );
};
