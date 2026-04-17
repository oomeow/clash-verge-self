import { DialogRef, SwitchLovely } from "@/components/base";
import { useVerge } from "@/hooks/use-verge";
import InfoRounded from "@mui/icons-material/InfoRounded";
import Settings from "@mui/icons-material/Settings";
import { Button, ButtonGroup, IconButton, Tooltip } from "@mui/material";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { GuardState } from "./mods/guard-state";
import { SettingItem, SettingList } from "./mods/setting-comp";
import { SysproxyViewer } from "./mods/sysproxy-viewer";

interface Props {
  onError?: (err: Error) => void;
}

const SettingSystem = ({ onError }: Props) => {
  const { t } = useTranslation();

  const { verge, mutateVerge, patchVerge } = useVerge();

  const sysproxyRef = useRef<DialogRef>(null);

  const {
    enable_auto_launch,
    // enable_silent_start,
    silent_start_mode,
    enable_system_proxy,
  } = verge;

  const onSwitchFormat = (_e: any, value: boolean) => value;
  const onChangeVerge = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false);
  };

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
          value={enable_system_proxy ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onChange={(e) => onChangeVerge({ enable_system_proxy: e })}
          onGuard={(e) => patchVerge({ enable_system_proxy: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.system.autoLaunch")}>
        <GuardState
          value={enable_auto_launch ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onChange={(e) => onChangeVerge({ enable_auto_launch: e })}
          onGuard={(e) => patchVerge({ enable_auto_launch: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.system.silentStart.label")}>
        <ButtonGroup size="small" sx={{ my: "4px" }}>
          {(["bootup", "global", "off"] as const).map((mode) => (
            <Button
              key={mode}
              variant={mode === silent_start_mode ? "contained" : "outlined"}
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
