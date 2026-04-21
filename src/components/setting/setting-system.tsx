import InfoRounded from "@mui/icons-material/InfoRounded";
import Settings from "@mui/icons-material/Settings";
import { Button, ButtonGroup, IconButton, Tooltip } from "@mui/material";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { DialogRef, SwitchLovely } from "@/components/base";
import { useVergeStore } from "@/stores";

import { GuardState } from "./mods/guard-state";
import { SettingItem, SettingList } from "./mods/setting-comp";
import { SysproxyViewer } from "./mods/sysproxy-viewer";

interface Props {
  onError?: (err: Error) => void;
}

const SettingSystem = ({ onError }: Props) => {
  const { t } = useTranslation();

  const enableAutoLaunch = useVergeStore(
    (s) => s.verge.enable_auto_launch ?? false,
  );
  const silentStartMode = useVergeStore(
    (s) => s.verge.silent_start_mode ?? false,
  );
  const enableSystemProxy = useVergeStore(
    (s) => s.verge.enable_system_proxy ?? false,
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);

  const sysproxyRef = useRef<DialogRef>(null);

  const onSwitchFormat = (_e: any, value: boolean) => value;

  return (
    <SettingList title={t("pages.settings.system.title")}>
      <SysproxyViewer ref={sysproxyRef} />

      <SettingItem
        label={t("pages.settings.system.proxy.label")}
        extra={
          <>
            <Tooltip
              title={t("pages.settings.system.proxy.info")}
              placement="top">
              <IconButton color="inherit" size="small">
                <InfoRounded
                  fontSize="inherit"
                  style={{ cursor: "pointer", opacity: 0.75 }}
                />
              </IconButton>
            </Tooltip>
            <IconButton
              color="inherit"
              size="small"
              onClick={() => sysproxyRef.current?.open()}>
              <Settings
                fontSize="inherit"
                style={{ cursor: "pointer", opacity: 0.75 }}
              />
            </IconButton>
          </>
        }>
        <GuardState
          value={enableSystemProxy}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onGuard={(e) => patchVerge({ enable_system_proxy: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.system.autoLaunch")}>
        <GuardState
          value={enableAutoLaunch}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onGuard={(e) => patchVerge({ enable_auto_launch: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.system.silentStart.label")}>
        <ButtonGroup size="small" sx={{ my: "4px" }}>
          {(["bootup", "global", "off"] as const).map((mode) => (
            <Button
              key={mode}
              variant={mode === silentStartMode ? "contained" : "outlined"}
              onClick={() => patchVerge({ silent_start_mode: mode })}
              sx={{ textTransform: "capitalize" }}>
              {t(`pages.settings.system.silentStart.options.${mode}`)}
            </Button>
          ))}
        </ButtonGroup>
      </SettingItem>
    </SettingList>
  );
};

export default SettingSystem;
