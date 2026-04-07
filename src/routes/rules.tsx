import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const RulesPage = lazy(() => import("@/pages/rules"));

function RulesRouteComponent() {
  return <RulesPage />;
}

export const Route = createFileRoute("/rules")({
  component: RulesRouteComponent,
});
