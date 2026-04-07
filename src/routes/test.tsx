import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const TestPage = lazy(() => import("@/pages/test"));

function TestRouteComponent() {
  return <TestPage />;
}

export const Route = createFileRoute("/test")({
  component: TestRouteComponent,
});
