(() => {
  if (typeof window.WeakRef !== "undefined") {
    return;
  }

  window.WeakRef = ((weakMap) => {
    // biome-ignore lint/correctness/noComponentHookFactories: WeakRef polyfill constructor, not a React component
    function WeakRefPolyfill(target) {
      weakMap.set(this, target);
    }
    WeakRefPolyfill.prototype.deref = function () {
      return weakMap.get(this);
    };

    return WeakRefPolyfill;
  })(new WeakMap());
})();
