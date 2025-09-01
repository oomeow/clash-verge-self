import {
  checkPermissionsGranted,
  refreshPermissionsGranted,
} from "@/services/cmds";
import { useEffect, useState } from "react";
import { isPortable } from "@/pages/_layout";
import getSystem from "@/utils/get-system";
import { useService } from "./use-service";
import { useLocalStorageState } from "ahooks";

type MihomoPermissionsGranted = {
  name: string;
  core: string;
  permissions_granted: boolean;
};

const defaultValue: MihomoPermissionsGranted[] = [
  { name: "Mihomo", core: "verge-mihomo", permissions_granted: false },
  {
    name: "Mihomo Alpha",
    core: "verge-mihomo-alpha",
    permissions_granted: false,
  },
];

export const usePermissionsGranted = () => {
  const OS = getSystem();
  const { serviceStatus } = useService();
  const showGrantPermissions =
    isPortable &&
    OS === "linux" &&
    (serviceStatus === "uninstall" || serviceStatus === "unknown");
  const [mihomoCores, setMihomoCores] = useLocalStorageState<
    MihomoPermissionsGranted[]
  >("mihomo-cores", { defaultValue, listenStorageChange: true });

  useEffect(() => {
    for (let core of mihomoCores) {
      checkMihomoPermissionsGranted(core.core);
    }
  }, []);

  const checkMihomoPermissionsGranted = async (core: string) => {
    if (showGrantPermissions) {
      const granted = await checkPermissionsGranted(core);
      setMihomoCores((prev) => {
        if (prev) {
          return prev.map((c) =>
            c.core === core ? { ...c, permissions_granted: granted } : c,
          );
        } else {
          return defaultValue.map((c) =>
            c.core === core ? { ...c, permissions_granted: granted } : c,
          );
        }
      });
    }
  };

  const refreshMihomoPermissions = async () => {
    if (showGrantPermissions) {
      await refreshPermissionsGranted();
      for (let core of mihomoCores) {
        await checkMihomoPermissionsGranted(core.core);
      }
    }
  };

  return {
    mihomoCores,
    checkMihomoPermissionsGranted,
    refreshMihomoPermissions,
  };
};
