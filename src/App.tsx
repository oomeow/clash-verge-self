import { StyledEngineProvider, ThemeProvider } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import { useMount } from "ahooks";
import { SnackbarProvider } from "notistack";
import { useEffect } from "react";

import {
  BaseErrorBoundary,
  MyNoticeContainer,
  NoticeProvider,
} from "./components/base";
import { DragImportOverlay } from "./components/layout/drag-import-overlay";
import { useCustomTheme } from "./components/layout/use-custom-theme";
import { router } from "./router";
import {
  useProfilesStore,
  useThemeSettingsStore,
  useVergeStore,
} from "./stores";

function App() {
  const refreshVerge = useVergeStore((s) => s.refreshVerge);
  const syncThemeSettings = useThemeSettingsStore((s) => s.syncThemeSettings);

  const refreshProfilesConfig = useProfilesStore((s) => s.refreshConfig);
  const refreshChainLogs = useProfilesStore((s) => s.refreshChainLogs);

  const { theme } = useCustomTheme();
  // const theme = createTheme({ cssVariables: true });

  useEffect(() => {
    refreshVerge().then((verge) => {
      syncThemeSettings(verge);
    });
  }, [refreshVerge, syncThemeSettings]);

  useMount(async () => {
    await refreshProfilesConfig();
    await refreshChainLogs();
  });

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
              <DragImportOverlay />
            </NoticeProvider>
          </SnackbarProvider>
        </BaseErrorBoundary>
      </StyledEngineProvider>
    </ThemeProvider>
  );
}

export default App;
