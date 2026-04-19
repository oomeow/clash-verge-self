import {
  checkPermissionsGranted,
  refreshPermissionsGranted,
} from "@/services/cmds";
import getSystem from "@/utils/get-system";
import { Command } from "@tauri-apps/plugin-shell";
import { useCallback, useEffect } from "react";
import useSWR from "swr";
import { usePortable } from "./use-portable";
import { useService } from "./use-service";
import { useVergeStore } from "@/stores";

type MihomoCoreInfo = {
  name: string;
  core: string;
  version: string;
  permissionsGranted: boolean;
};

const defaultValue: MihomoCoreInfo[] = [
  {
    name: "Mihomo",
    core: "self-mihomo",
    version: "",
    permissionsGranted: false,
  },
  {
    name: "Mihomo Alpha",
    core: "self-mihomo-alpha",
    version: "",
    permissionsGranted: false,
  },
];

const MIHOMO_CORES = ["self-mihomo", "self-mihomo-alpha"];
const OS = getSystem();

export const useMihomoCoresInfo = () => {
  const { serviceStatus } = useService();
  const clash_core = useVergeStore((s) => s.verge?.clash_core ?? "self-mihomo");
  const serviceUnavailable =
    serviceStatus === "uninstall" || serviceStatus === "unknown";

  const { portable } = usePortable();
  const isLinuxPortable = portable && OS === "linux";

  const enableGrantPermissions = isLinuxPortable && serviceUnavailable;

  const { data: mihomoCoresInfo, mutate: muteMihomoCoresInfo } = useSWR(
    "getMihomoCoresInfo",
    async () => {
      let res = defaultValue;
      res = await refreshMihomoVersion(res);
      res = await refreshMihomoPermissions(res);
      return res;
    },
    { fallbackData: defaultValue },
  );

  useEffect(() => {
    muteMihomoCoresInfo();
  }, [enableGrantPermissions, clash_core, portable]);

  const refreshMihomoVersion = useCallback(
    async (coresInfo: MihomoCoreInfo[]) => {
      for (const core of MIHOMO_CORES) {
        const output = await Command.sidecar(`sidecar/${core}`, [
          "-v",
        ]).execute();
        if (output.code === 0) {
          const regex = /(alpha-\w+|v\d+(?:\.\d+)*)/gm;
          const version = output.stdout.match(regex)?.[0];
          if (version) {
            coresInfo = coresInfo.map((c) =>
              c.core === core ? { ...c, version } : c,
            );
          }
        }
      }
      return coresInfo;
    },
    [],
  );

  const refreshMihomoPermissions = useCallback(
    async (coresInfo: MihomoCoreInfo[]) => {
      if (enableGrantPermissions) {
        await refreshPermissionsGranted();
        for (const core of MIHOMO_CORES) {
          const granted = await checkPermissionsGranted(core);
          coresInfo = coresInfo.map((c) =>
            c.core === core ? { ...c, permissionsGranted: granted } : c,
          );
        }
      }
      return coresInfo;
    },
    [],
  );

  return {
    mihomoCoresInfo,
    enableGrantPermissions,
    muteMihomoCoresInfo,
  };
};
