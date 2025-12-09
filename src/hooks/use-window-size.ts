import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useLocalStorage } from "foxact/use-local-storage";
import debounce from "lodash-es/debounce";
import { useEffect } from "react";

export const useWindowSize = () => {
  const [size, setSize] = useLocalStorage(
    "window-size",
    { height: document.body.clientWidth, width: document.body.clientHeight },
    {
      serializer: JSON.stringify,
      deserializer: JSON.parse,
    },
  );

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: document.body.clientWidth,
        height: document.body.clientHeight,
      });
    };

    window.addEventListener("resize", debounce(handleResize, 100));
    return () => {
      window.removeEventListener("resize", debounce(handleResize, 100));
    };
  }, []);

  return { size };
};
