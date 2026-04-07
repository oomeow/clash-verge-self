import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const ConnectionsPage = lazy(() => import("@/pages/connections"));

function ConnectionsRouteComponent() {
  return <ConnectionsPage />;
}

export const Route = createFileRoute("/connections")({
  component: ConnectionsRouteComponent,
});
