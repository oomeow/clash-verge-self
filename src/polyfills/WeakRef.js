(() => {
  if (typeof window.WeakRef !== "undefined") {
    return;
  }

  window.WeakRef = ((weakMap) => {
    function WeakRefPolyfill(target) {
      weakMap.set(this, target);
    }
    WeakRefPolyfill.prototype.deref = function () {
      return weakMap.get(this);
    };

    return WeakRefPolyfill;
  })(new WeakMap());
})();
