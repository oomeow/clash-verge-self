(() => {
  if (window.matchMedia?.("all").addEventListener) {
    return;
  }

  const originalMatchMedia = window.matchMedia;

  window.matchMedia = (query) => {
    const mediaQueryList = originalMatchMedia(query);

    if (!mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener = (eventType, listener, ...rest) => {
        const args = [eventType, listener, ...rest];
        if (eventType !== "change" || typeof listener !== "function") {
          console.error("Invalid arguments for addEventListener:", args);
          return;
        }
        mediaQueryList.addListener(listener);
      };
    }

    if (!mediaQueryList.removeEventListener) {
      mediaQueryList.removeEventListener = (eventType, listener, ...rest) => {
        const args = [eventType, listener, ...rest];
        if (eventType !== "change" || typeof listener !== "function") {
          console.error("Invalid arguments for removeEventListener:", args);
          return;
        }
        mediaQueryList.removeListener(listener);
      };
    }

    return mediaQueryList;
  };
})();
