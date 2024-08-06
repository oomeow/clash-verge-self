(() => {
  if (window.matchMedia?.("all").addEventListener) {
    return;
  }

  const originalMatchMedia = window.matchMedia;

  window.matchMedia = (query) => {
    const mediaQueryList = originalMatchMedia(query);

    if (!mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener = (eventType, listener) => {
        if (eventType !== "change" || typeof listener !== "function") {
          console.error("Invalid arguments for addEventListener:", arguments);
          return;
        }
        mediaQueryList.addListener(listener);
      };
    }

    if (!mediaQueryList.removeEventListener) {
      mediaQueryList.removeEventListener = (eventType, listener) => {
        if (eventType !== "change" || typeof listener !== "function") {
          console.error(
            "Invalid arguments for removeEventListener:",
            arguments,
          );
          return;
        }
        mediaQueryList.removeListener(listener);
      };
    }

    return mediaQueryList;
  };
})();
