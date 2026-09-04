import { useLocalStorageState } from "ahooks";
import { useEffect } from "react";

import { isPortableVersion } from "@/services/cmds";

export const usePortable = () => {
  const [portable, setPortable] = useLocalStorageState("portable", {
    defaultValue: false,
    listenStorageChange: true,
  });

  useEffect(() => {
    isPortableVersion().then((isPortable) => {
      setPortable(isPortable);
    });
  }, [setPortable]);

  return { portable };
};
