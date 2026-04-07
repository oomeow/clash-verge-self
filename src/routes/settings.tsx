import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const SettingPage = lazy(() => import("@/pages/settings"));

function SettingsRouteComponent() {
  return <SettingPage />;
}

export const Route = createFileRoute("/settings")({
  component: SettingsRouteComponent,
});
