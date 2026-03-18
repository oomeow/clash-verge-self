import { useLocalStorage } from "foxact/use-local-storage";
import debounce from "lodash-es/debounce";
import { useEffect } from "react";

export const useWindowSize = () => {
  const [size, setSize] = useLocalStorage(
    "window-size",
    { height: window.innerHeight, width: window.innerWidth },
    {
      serializer: JSON.stringify,
      deserializer: JSON.parse,
    },
  );

  useEffect(() => {
    const handleResize = debounce(() => {
      setSize({
        width: document.body.clientWidth,
        height: document.body.clientHeight,
      });
    }, 100);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return { size };
};
