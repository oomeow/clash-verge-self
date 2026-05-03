import InfoRounded from "@mui/icons-material/InfoRounded";
import Lan from "@mui/icons-material/Lan";
import PrivacyTipRounded from "@mui/icons-material/PrivacyTipRounded";
import Settings from "@mui/icons-material/Settings";
import Shuffle from "@mui/icons-material/Shuffle";
import {
  Button,
  ButtonGroup,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { flushDNS, flushFakeIp, updateGeo } from "tauri-plugin-mihomo-api";

import { DialogRef, SwitchLovely } from "@/components/base";
import { useClash } from "@/hooks/use-clash";
import { useMihomoCoresInfo } from "@/hooks/use-mihomo-cores-info";
import { usePortable } from "@/hooks/use-portable";
import { useService } from "@/hooks/use-service";
import { invoke_uwp_tool } from "@/services/cmds";
import { useVergeStore } from "@/stores";
import { useClashLogStore } from "@/stores";
import getSystem from "@/utils/get-system";

import { useNotice } from "../base/notifies";
import { GuardState } from "./mods/guard-state";
import { lazyDialogViewer } from "./mods/lazy-dialog-viewer";
import { SettingItem, SettingList } from "./mods/setting-comp";

const ClashCoreViewer = lazyDialogViewer<{ serviceActive: boolean }>(
  () => import("./mods/clash-core-viewer"),
);
const ClashPortViewer = lazyDialogViewer(
  () => import("./mods/clash-port-viewer"),
);
const ControllerViewer = lazyDialogViewer(
  () => import("./mods/controller-viewer"),
);
const NetInfoViewer = lazyDialogViewer(() => import("./mods/net-info-viewer"));
const ServiceViewer = lazyDialogViewer<{ enable: boolean }>(
  () => import("./mods/service-viewer"),
);
const TunViewer = lazyDialogViewer(() => import("./mods/tun-viewer"));
const WebUIViewer = lazyDialogViewer(() => import("./mods/web-ui-viewer"));

const OS = getSystem();

type ClashViewerKey =
  | "web"
  | "port"
  | "controller"
  | "core"
  | "tun"
  | "service"
  | "netInfo";

interface Props {
  onError: (err: Error) => void;
}

const SettingClash = ({ onError }: Props) => {
  const { t } = useTranslation();
  const { notice } = useNotice();
  const { clash, patchClash } = useClash();
  const {
    ipv6,
    "allow-lan": allowLan,
    "log-level": logLevel,
    "unified-delay": unifiedDelay,
    "find-process-mode": findProcessMode,
    tun,
  } = clash ?? {};

  const clashCore = useVergeStore((s) => s.verge.clash_core ?? "self-mihomo");
  const enableRandomPort = useVergeStore((s) => s.verge.enable_random_port);
  const enableServiceMode = useVergeStore((s) => s.verge.enable_service_mode);
  const enableExternalController = useVergeStore(
    (s) => s.verge.enable_external_controller,
  );
  const patchVerge = useVergeStore((s) => s.patchVerge);
  const { serviceStatus, mutateCheckService } = useService();

  const { mihomoCoresInfo } = useMihomoCoresInfo();
  const mihomoVersion =
    mihomoCoresInfo.find((core) => core.core === clashCore)?.version ??
    "Unknown";

  const permissionsGranted =
    mihomoCoresInfo.find((core) => core.core === clashCore)
      ?.permissionsGranted ?? false;

  const { portable } = usePortable();
  const isLinuxPortable = portable && OS === "linux";
  const disableTunSetting =
    !(isLinuxPortable && permissionsGranted) && serviceStatus !== "active";
  const setLogLevel = useClashLogStore((s) => s.setLogLevel);

  const webRef = useRef<DialogRef>(null);
  const portRef = useRef<DialogRef>(null);
  const ctrlRef = useRef<DialogRef>(null);
  const coreRef = useRef<DialogRef>(null);
  const tunRef = useRef<DialogRef>(null);
  const serviceRef = useRef<DialogRef>(null);
  const netInfoRef = useRef<DialogRef>(null);
  const pendingViewerRef = useRef<ClashViewerKey | null>(null);
  const [mountedViewers, setMountedViewers] = useState<
    Partial<Record<ClashViewerKey, boolean>>
  >({});

  const viewerRefs = {
    web: webRef,
    port: portRef,
    controller: ctrlRef,
    core: coreRef,
    tun: tunRef,
    service: serviceRef,
    netInfo: netInfoRef,
  };

  const openViewer = (viewer: ClashViewerKey) => {
    if (mountedViewers[viewer]) {
      viewerRefs[viewer].current?.open();
      return;
    }

    pendingViewerRef.current = viewer;
    setMountedViewers((prev) =>
      prev[viewer] ? prev : { ...prev, [viewer]: true },
    );
  };

  const openReadyViewer = (viewer: ClashViewerKey) => {
    if (pendingViewerRef.current !== viewer) return;

    viewerRefs[viewer].current?.open();
    pendingViewerRef.current = null;
  };

  useEffect(() => {
    if (enableServiceMode === undefined) return;
    mutateCheckService();
  }, [enableServiceMode]);

  const onSwitchFormat = (_e: any, value: boolean) => value;
  const onUpdateGeo = async () => {
    try {
      await updateGeo();
      notice("success", t("messages.clash.geoDataUpdated"));
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  const onFlushFakeip = async () => {
    try {
      await flushFakeIp();
      notice(
        "success",
        t("pages.settings.clash.cacheFlushed", {
          cache: "Fake-IP",
        }),
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  const onFlushDNS = async () => {
    try {
      await flushDNS();
      notice(
        "success",
        t("pages.settings.clash.cacheFlushed", { cache: "DNS" }),
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    }
  };

  return (
    <SettingList title={t("pages.settings.clash.title")}>
      <Suspense fallback={null}>
        {mountedViewers.tun && (
          <TunViewer ref={tunRef} onReady={() => openReadyViewer("tun")} />
        )}
        {mountedViewers.web && (
          <WebUIViewer ref={webRef} onReady={() => openReadyViewer("web")} />
        )}
        {mountedViewers.port && (
          <ClashPortViewer
            ref={portRef}
            onReady={() => openReadyViewer("port")}
          />
        )}
        {mountedViewers.controller && (
          <ControllerViewer
            ref={ctrlRef}
            onReady={() => openReadyViewer("controller")}
          />
        )}
        {mountedViewers.core && (
          <ClashCoreViewer
            ref={coreRef}
            serviceActive={serviceStatus === "active"}
            onReady={() => openReadyViewer("core")}
          />
        )}
        {mountedViewers.service && (
          <ServiceViewer
            ref={serviceRef}
            enable={!!enableServiceMode}
            onReady={() => openReadyViewer("service")}
          />
        )}
        {mountedViewers.netInfo && (
          <NetInfoViewer
            ref={netInfoRef}
            onReady={() => openReadyViewer("netInfo")}
          />
        )}
      </Suspense>

      <SettingItem
        disabled={disableTunSetting}
        label={t("pages.settings.clash.tun.label")}
        extra={
          <>
            {disableTunSetting ? (
              <Tooltip
                title={t("pages.settings.clash.tun.info")}
                placement="top">
                <IconButton color="error" size="small">
                  <InfoRounded fontSize="inherit" />
                </IconButton>
              </Tooltip>
            ) : (
              <IconButton
                color="inherit"
                size="small"
                onClick={() => openViewer("tun")}>
                <Settings fontSize="inherit" style={{ opacity: 0.75 }} />
              </IconButton>
            )}
          </>
        }>
        <GuardState
          value={tun?.enable ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          // onChange={(e) => onChangeData({ tun: { enable: e } })}
          onGuard={(e) => patchClash({ tun: { enable: e } })}>
          <SwitchLovely disabled={disableTunSetting} edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("pages.settings.clash.serviceMode.label")}
        extra={
          <IconButton
            color="inherit"
            size="small"
            onClick={() => openViewer("service")}>
            <PrivacyTipRounded
              color={
                serviceStatus === "active" || serviceStatus === "installed"
                  ? "inherit"
                  : "error"
              }
              fontSize="inherit"
              style={{ opacity: 0.75 }}
            />
          </IconButton>
        }>
        <GuardState
          value={enableServiceMode ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          // onChange={(e) => onChangeVerge({ enable_service_mode: e })}
          onGuard={(e) => patchVerge({ enable_service_mode: e })}
          onSuccess={() => mutateCheckService()}>
          <SwitchLovely
            edge="end"
            disabled={
              serviceStatus !== "active" && serviceStatus !== "installed"
            }
          />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("pages.settings.clash.unifiedDelay.label")}
        extra={
          <Tooltip
            title={t("pages.settings.clash.unifiedDelay.info")}
            placement="top">
            <IconButton color="inherit" size="small">
              <InfoRounded fontSize="inherit" sx={{ opacity: 0.75 }} />
            </IconButton>
          </Tooltip>
        }>
        <GuardState
          value={unifiedDelay ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          // onChange={(e) => onChangeData({ "unified-delay": e })}
          onGuard={(e) => patchClash({ "unified-delay": e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("pages.settings.clash.allowLan")}
        extra={
          <Tooltip
            title={t("pages.settings.clash.networkInterfaceInfo")}
            placement="top">
            <IconButton
              color="inherit"
              size="small"
              onClick={() => {
                openViewer("netInfo");
              }}>
              <Lan fontSize="inherit" sx={{ opacity: 0.75 }} />
            </IconButton>
          </Tooltip>
        }>
        <GuardState
          value={allowLan ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          // onChange={(e) => onChangeData({ "allow-lan": e })}
          onGuard={(e) => patchClash({ "allow-lan": e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.clash.ipv6")}>
        <GuardState
          value={ipv6 ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          // onChange={(e) => onChangeData({ ipv6: e })}
          onGuard={(e) => patchClash({ ipv6: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.clash.findProcessMode.label")}>
        <GuardState
          value={findProcessMode}
          valueProps="checked"
          onCatch={onError}
          onGuard={(e) => patchClash({ "find-process-mode": e })}>
          <ButtonGroup size="small" sx={{ my: "4px" }}>
            {(["always", "strict", "off"] as const).map((mode) => {
              const buttonLabelKey = {
                always: "common.actions.enable",
                strict: "common.actions.auto",
                off: "common.actions.disable",
              }[mode];
              return (
                <Tooltip
                  title={t(
                    `pages.settings.clash.findProcessMode.options.${mode}`,
                  )}
                  placement="top">
                  <Button
                    key={mode}
                    variant={
                      mode === findProcessMode ? "contained" : "outlined"
                    }
                    onClick={() => patchClash({ "find-process-mode": mode })}
                    sx={{ textTransform: "capitalize" }}>
                    {t(buttonLabelKey)}
                  </Button>
                </Tooltip>
              );
            })}
          </ButtonGroup>
        </GuardState>
      </SettingItem>

      <SettingItem label={t("pages.settings.clash.logLevel")}>
        <GuardState
          // clash premium 2022.08.26 值为warn
          value={logLevel === "warn" ? "warning" : (logLevel ?? "info")}
          onCatch={onError}
          onFormat={(e: any) => e.target.value}
          // onChange={(e) => onChangeData({ "log-level": e })}
          onGuard={(e) => {
            setLogLevel(e);
            return patchClash({ "log-level": e });
          }}>
          <Select size="small" sx={{ width: 100, "> div": { py: "7.5px" } }}>
            <MenuItem value="debug">Debug</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warn</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="silent">Silent</MenuItem>
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("pages.settings.clash.portConfig.label")}
        extra={
          <Tooltip title={t("pages.settings.clash.portConfig.randomPort")}>
            <IconButton
              color={enableRandomPort ? "primary" : "inherit"}
              size="small"
              onClick={() => {
                patchVerge({ enable_random_port: !enableRandomPort });
                patchClash({ "enable-random-port": !enableRandomPort });
              }}>
              <Shuffle
                fontSize="inherit"
                style={{ cursor: "pointer", opacity: 0.75 }}
              />
            </IconButton>
          </Tooltip>
        }>
        <TextField
          disabled={enableRandomPort ?? false}
          autoComplete="off"
          size="small"
          value={clash?.["mixed-port"] ?? 7890}
          sx={{ width: 100, input: { py: "7.5px", cursor: "pointer" } }}
          onClick={(e) => {
            openViewer("port");
            (e.target as any).blur();
          }}
        />
      </SettingItem>

      <SettingItem
        label={t("pages.settings.clash.externalController.label")}
        extra={
          <IconButton
            color="inherit"
            size="small"
            onClick={() => openViewer("controller")}>
            <Settings fontSize="inherit" style={{ opacity: 0.75 }} />
          </IconButton>
        }>
        <GuardState
          value={enableExternalController ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onGuard={(e) => patchVerge({ enable_external_controller: e })}>
          <SwitchLovely edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem
        openMoreSettings
        onClick={() => openViewer("web")}
        label={t("pages.settings.clash.webUi.label")}
      />

      <SettingItem
        label={t("pages.settings.clash.core.label")}
        extra={
          <IconButton
            color="inherit"
            size="small"
            onClick={() => openViewer("core")}>
            <Settings
              fontSize="inherit"
              style={{ cursor: "pointer", opacity: 0.75 }}
            />
          </IconButton>
        }>
        <Typography sx={{ py: "7px", pr: 1 }}>{mihomoVersion}</Typography>
      </SettingItem>

      {OS === "windows" && (
        <SettingItem
          onClick={invoke_uwp_tool}
          label={t("pages.settings.clash.openUwpTool")}
        />
      )}

      <SettingItem
        onClick={onUpdateGeo}
        label={t("pages.settings.clash.updateGeoData")}
      />
      <SettingItem
        onClick={onFlushFakeip}
        label={t("pages.settings.clash.flushCache", { cache: "Fake-IP" })}
      />
      <SettingItem
        onClick={onFlushDNS}
        label={t("pages.settings.clash.flushCache", { cache: "DNS" })}
      />
    </SettingList>
  );
};

export default SettingClash;
