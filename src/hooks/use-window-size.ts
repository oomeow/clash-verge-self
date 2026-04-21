import debounce from "lodash-es/debounce";
import { useEffect } from "react";

import { useWindowSizeStore } from "@/stores";

export const useWindowSize = () => {
  const size = useWindowSizeStore((s) => s.windowSize);
  const setWindowSize = useWindowSizeStore((s) => s.setWindowSize);

  useEffect(() => {
    const handleResize = debounce(() => {
      setWindowSize({
        width: document.body.clientWidth,
        height: document.body.clientHeight,
      });
    }, 100);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setWindowSize]);

  return { size };
};
