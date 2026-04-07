import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const LogPage = lazy(() => import("@/pages/logs"));

function LogsRouteComponent() {
  return <LogPage />;
}

export const Route = createFileRoute("/logs")({
  component: LogsRouteComponent,
});
