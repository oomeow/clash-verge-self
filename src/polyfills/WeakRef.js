(() => {
  if (typeof window.WeakRef !== "undefined") {
    return;
  }

  window.WeakRef = ((weakMap) => {
    function WeakRef(target) {
      weakMap.set(this, target);
    }
    WeakRef.prototype.deref = () => {
      return weakMap.get(this);
    };

    return WeakRef;
  })(new WeakMap());
})();
