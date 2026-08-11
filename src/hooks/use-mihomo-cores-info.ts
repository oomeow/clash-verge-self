import { Command } from "@tauri-apps/plugin-shell";
import { useCallback } from "react";

import {
  checkPermissionsGranted,
  refreshPermissionsGranted,
} from "@/services/cmds";
import { swrKeys, useSWR } from "@/services/swr";
import getSystem from "@/utils/get-system";

import { usePortable } from "./use-portable";
import { useService } from "./use-service";

type MihomoCoreInfo = {
  name: string;
  core: "self-mihomo" | "self-mihomo-alpha";
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
  const serviceUnavailable =
    serviceStatus === "uninstall" || serviceStatus === "unknown";

  const { portable } = usePortable();
  const isLinuxPortable = portable && OS === "linux";

  const enableGrantPermissions = isLinuxPortable && serviceUnavailable;

  const { data: mihomoCoresInfo, mutate: muteMihomoCoresInfo } = useSWR(
    swrKeys.mihomoCoresInfo,
    async () => {
      let res = defaultValue;
      res = await refreshMihomoVersion(res);
      res = await refreshMihomoPermissions(res);
      return res;
    },
    { fallbackData: defaultValue },
  );

  const refreshMihomoVersion = useCallback(
    async (coresInfo: MihomoCoreInfo[]) => {
      const versions = await Promise.all(
        MIHOMO_CORES.map(async (core) => {
          const output = await Command.sidecar(`sidecar/${core}`, [
            "-v",
          ]).execute();
          if (output.code === 0) {
            const regex = /(alpha-\w+|v\d+(?:\.\d+)*)/gm;
            const version = output.stdout.match(regex)?.[0];
            if (version) {
              return { core, version };
            }
          }
          return null;
        }),
      );

      return versions.reduce((nextCoresInfo, result) => {
        if (!result) return nextCoresInfo;

        return nextCoresInfo.map((coreInfo) =>
          coreInfo.core === result.core
            ? { ...coreInfo, version: result.version }
            : coreInfo,
        );
      }, coresInfo);
    },
    [],
  );

  const refreshMihomoPermissions = useCallback(
    async (coresInfo: MihomoCoreInfo[]) => {
      if (enableGrantPermissions) {
        await refreshPermissionsGranted();
        const permissions = await Promise.all(
          MIHOMO_CORES.map(async (core) => {
            const granted = await checkPermissionsGranted(core);
            return { core, granted };
          }),
        );

        return permissions.reduce(
          (nextCoresInfo, { core, granted }) =>
            nextCoresInfo.map((coreInfo) =>
              coreInfo.core === core
                ? { ...coreInfo, permissionsGranted: granted }
                : coreInfo,
            ),
          coresInfo,
        );
      }
      return coresInfo;
    },
    [enableGrantPermissions],
  );

  return {
    mihomoCoresInfo,
    enableGrantPermissions,
    muteMihomoCoresInfo,
  };
};
