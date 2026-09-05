(() => {
  if (typeof window.RegExp === "undefined") {
    return;
  }

  const originalRegExp = window.RegExp;
  const hasOwn = Object.prototype.hasOwnProperty.call;

  // biome-ignore lint/complexity/useArrowFunction: polyfill 出的 RegExp 仍需可用作构造器（new RegExp(...)）
  window.RegExp = function (pattern, flags) {
    if (pattern instanceof originalRegExp && flags === undefined) {
      flags = pattern.flags;
    }

    if (flags) {
      if (!hasOwn(originalRegExp.prototype, "unicodeSets")) {
        if (flags.includes("v")) {
          flags = flags.replace("v", "u");
        }
      }

      if (!hasOwn(originalRegExp.prototype, "hasIndices")) {
        if (flags.includes("d")) {
          flags = flags.replace("d", "");
        }
      }
    }

    return new originalRegExp(pattern, flags);
  };
  window.RegExp.prototype = originalRegExp.prototype;
})();
