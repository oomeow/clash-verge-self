import { BaseDialog, DialogRef } from "@/components/base";
import { normalizeKeyList } from "@/hooks/use-app-hotkeys";
import { useHotkeySettings } from "@/hooks/use-hotkey-settings";
import { Button, styled, Typography } from "@mui/material";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatHotkeyKey, HotkeyInput } from "./hotkey-input";

const ItemWrapper = styled("div")`
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 204px 204px;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const HeaderWrapper = styled(ItemWrapper)`
  margin-bottom: 12px;
`;

const ActionWrapper = styled("div")`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const PreviousHotkeyActions = styled("div")`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  flex: 1;
  min-width: 0;
`;

const ActionButtons = styled("div")`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviousHotkeyChip = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  minHeight: 22,
  maxWidth: "100%",
  padding: "2px 4px 2px 8px",
  borderRadius: 11,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
  fontSize: 11,
  lineHeight: 1.2,
  cursor: "pointer",
  transition: theme.transitions.create(["filter"], {
    duration: theme.transitions.duration.shortest,
  }),
  "&:hover": {
    filter: "brightness(1.08)",
  },
}));

const PreviousHotkeyKey = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 18,
  padding: "1px 5px",
  borderRadius: 9,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.primary.contrastText,
}));

const PreviousHotkeyScope = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 18,
  padding: "1px 5px",
  borderRadius: 9,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  color: theme.palette.common.white,
  '&[data-scope="global"]': {
    backgroundColor: theme.palette.warning.main,
  },
  '&[data-scope="app"]': {
    backgroundColor: theme.palette.success.main,
  },
}));

const HOTKEY_FUNC = [
  "open_or_close_dashboard",
  "clash_mode_rule",
  "clash_mode_global",
  "clash_mode_direct",
  "toggle_system_proxy",
  "toggle_tun_mode",
  "exit_app",
];

const HOTKEY_LABEL_KEY: Record<(typeof HOTKEY_FUNC)[number], string> = {
  open_or_close_dashboard:
    "pages.settings.verge.hotkeys.actions.openOrCloseDashboard",
  clash_mode_rule: "pages.settings.verge.hotkeys.actions.ruleMode",
  clash_mode_global: "pages.settings.verge.hotkeys.actions.globalMode",
  clash_mode_direct: "pages.settings.verge.hotkeys.actions.directMode",
  toggle_system_proxy: "pages.settings.verge.hotkeys.actions.toggleSystemProxy",
  toggle_tun_mode: "pages.settings.verge.hotkeys.actions.toggleTunMode",
  exit_app: "pages.settings.verge.hotkeys.actions.exitApp",
};

const formatHotkeyKeys = (keys: string[]) =>
  normalizeKeyList(keys).map(formatHotkeyKey).join(" + ");

export const HotkeyViewer = forwardRef<DialogRef>((_props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    globalHotkeyMap,
    appHotkeyMap,
    hasHotkeys,
    hasHotkeyChanges,
    restoreHotkeyItems,
    openHotkeySettings,
    applyRestoreHotkey,
    clearHotkeys,
    restoreHotkeys,
    updateHotkey,
  } = useHotkeySettings(HOTKEY_FUNC);

  useImperativeHandle(ref, () => ({
    open: () => {
      openHotkeySettings();
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  return (
    <BaseDialog
      open={open}
      title={t("pages.settings.verge.hotkeys.title")}
      hideFooter
      onClose={() => setOpen(false)}
      contentStyle={{ maxWidth: 640 }}>
      {(hasHotkeyChanges || hasHotkeys) && (
        <ActionWrapper>
          {hasHotkeyChanges ? (
            <PreviousHotkeyActions>
              {restoreHotkeyItems.map((item) => (
                <PreviousHotkeyChip
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => applyRestoreHotkey(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      applyRestoreHotkey(item);
                    }
                  }}>
                  <PreviousHotkeyScope data-scope={item.scope}>
                    {t(`pages.settings.verge.hotkeys.${item.scope}`)}
                  </PreviousHotkeyScope>
                  <span>{t(HOTKEY_LABEL_KEY[item.func])}</span>
                  <PreviousHotkeyKey>
                    {formatHotkeyKeys(item.keys)}
                  </PreviousHotkeyKey>
                </PreviousHotkeyChip>
              ))}
            </PreviousHotkeyActions>
          ) : (
            <span />
          )}
          <ActionButtons>
            {hasHotkeyChanges && (
              <Button variant="outlined" size="small" onClick={restoreHotkeys}>
                {t("pages.settings.verge.hotkeys.restore")}
              </Button>
            )}
            {hasHotkeys && (
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={clearHotkeys}>
                {t("pages.settings.verge.hotkeys.clear")}
              </Button>
            )}
          </ActionButtons>
        </ActionWrapper>
      )}
      <HeaderWrapper>
        <span />
        <Typography variant="body2" color="text.secondary">
          {t("pages.settings.verge.hotkeys.global")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("pages.settings.verge.hotkeys.app")}
        </Typography>
      </HeaderWrapper>
      {HOTKEY_FUNC.map((func) => (
        <ItemWrapper key={func}>
          <Typography>{t(HOTKEY_LABEL_KEY[func])}</Typography>
          <HotkeyInput
            value={globalHotkeyMap[func] ?? []}
            onChange={(v) => updateHotkey("global", func, v)}
            onDelete={() => updateHotkey("global", func, [])}
          />
          <HotkeyInput
            value={appHotkeyMap[func] ?? []}
            onChange={(v) => updateHotkey("app", func, v)}
            onDelete={() => updateHotkey("app", func, [])}
          />
        </ItemWrapper>
      ))}
    </BaseDialog>
  );
});

export default HotkeyViewer;
