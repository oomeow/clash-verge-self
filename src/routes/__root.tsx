import Layout from "@/pages/_layout";
import NotFountPage from "@/pages/not_found";
import { createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <Layout />,
  notFoundComponent: () => <NotFountPage />,
});
