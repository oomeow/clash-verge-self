import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";

const ProfilePage = lazy(() => import("@/pages/profiles"));

function ProfilesRouteComponent() {
  return <ProfilePage />;
}

export const Route = createFileRoute("/profiles")({
  component: ProfilesRouteComponent,
});
