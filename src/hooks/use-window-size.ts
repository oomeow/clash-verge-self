import debounce from "lodash-es/debounce";
import { useEffect } from "react";
import { useWindowSizeStore } from "@/stores";

export const useWindowSize = () => {
  const size = useWindowSizeStore((s) => s.windowSize);
  const setWindowHeight = useWindowSizeStore((s) => s.setWindowHeight);
  const setWindowWidth = useWindowSizeStore((s) => s.setWindowWidth);

  useEffect(() => {
    const handleResize = debounce(() => {
      setWindowWidth(document.body.clientWidth);
      setWindowHeight(document.body.clientHeight);
    }, 100);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setWindowHeight, setWindowWidth]);

  return { size };
};
