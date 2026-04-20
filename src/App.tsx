import { StyledEngineProvider, ThemeProvider } from "@mui/material";
import { useCustomTheme } from "./components/layout/use-custom-theme";
import {
  BaseErrorBoundary,
  MyNoticeContainer,
  NoticeProvider,
} from "./components/base";
import { SnackbarProvider } from "notistack";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });
// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const { theme } = useCustomTheme();
  // const theme = createTheme({ cssVariables: true });
  return (
    <ThemeProvider theme={theme}>
      <StyledEngineProvider injectFirst>
        <BaseErrorBoundary>
          <SnackbarProvider
            maxSnack={3}
            Components={{
              default: MyNoticeContainer,
              success: MyNoticeContainer,
              info: MyNoticeContainer,
              warning: MyNoticeContainer,
              error: MyNoticeContainer,
            }}>
            <NoticeProvider>
              <RouterProvider router={router} />
            </NoticeProvider>
          </SnackbarProvider>
        </BaseErrorBoundary>
      </StyledEngineProvider>
    </ThemeProvider>
  );
}

export default App;
