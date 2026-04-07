import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const ProxyPage = lazy(() => import("@/pages/proxies"));

function ProxiesRouteComponent() {
  return <ProxyPage />;
}

export const Route = createFileRoute("/proxies")({
  component: ProxiesRouteComponent,
});
