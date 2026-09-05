(() => {
  if (typeof window.RegExp === "undefined") {
    return;
  }

  const originalRegExp = window.RegExp;
  function hasOwn(object, key) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: 需兼容缺少 Object.hasOwn 的旧内核
    return Object.prototype.hasOwnProperty.call(object, key);
  }

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
