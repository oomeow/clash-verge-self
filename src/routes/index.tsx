import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const ProxyPage = lazy(() => import("@/pages/proxies"));

function IndexRouteComponent() {
  return <ProxyPage />;
}

export const Route = createFileRoute("/")({
  component: IndexRouteComponent,
});
