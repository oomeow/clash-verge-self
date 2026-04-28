import { useLockFn } from "ahooks";

import { patchClashConfig } from "@/services/cmds";
import { useClashInfoSWR, useRuntimeConfigSWR } from "@/services/swr";

export const useClash = () => {
  const { data: clash, mutate: mutateClash } = useRuntimeConfigSWR();

  const patchClash = useLockFn(async (patch: Partial<IConfigData>) => {
    await patchClashConfig(patch);
    mutateClash();
  });

  return {
    clash,
    mutateClash,
    patchClash,
  };
};

export const useClashInfo = () => {
  const { data: clashInfo, mutate: mutateInfo } = useClashInfoSWR();

  const patchInfo = async (
    patch: Partial<
      Pick<
        IConfigData,
        | "mode"
        | "port"
        | "socks-port"
        | "mixed-port"
        | "redir-port"
        | "tproxy-port"
        | "external-controller"
        | "external-controller-cors"
        | "secret"
      >
    >,
  ) => {
    if (patch["redir-port"]) {
      const port = patch["redir-port"];
      if (port < 1000) {
        throw new Error("The port should not < 1000");
      }
      if (port > 65536) {
        throw new Error("The port should not > 65536");
      }
    }

    if (patch["tproxy-port"]) {
      const port = patch["tproxy-port"];
      if (port < 1000) {
        throw new Error("The port should not < 1000");
      }
      if (port > 65536) {
        throw new Error("The port should not > 65536");
      }
    }

    if (patch["mixed-port"]) {
      const port = patch["mixed-port"];
      if (port < 1000) {
        throw new Error("The port should not < 1000");
      }
      if (port > 65536) {
        throw new Error("The port should not > 65536");
      }
    }

    if (patch["socks-port"]) {
      const port = patch["socks-port"];
      if (port < 1000) {
        throw new Error("The port should not < 1000");
      }
      if (port > 65536) {
        throw new Error("The port should not > 65536");
      }
    }

    if (patch.port) {
      const port = patch.port;
      if (port < 1000) {
        throw new Error("The port should not < 1000");
      }
      if (port > 65536) {
        throw new Error("The port should not > 65536");
      }
    }

    await patchClashConfig(patch);
    mutateInfo();
  };

  return {
    clashInfo,
    mutateInfo,
    patchInfo,
  };
};
