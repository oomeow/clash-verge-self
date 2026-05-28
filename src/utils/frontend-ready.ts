const FRONTEND_READY_EVENT = "verge://frontend-ready";

let signaled = false;

export const signalFrontendReady = () => {
  if (signaled) return;
  signaled = true;

  globalThis.requestAnimationFrame(() => {
    globalThis.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(FRONTEND_READY_EVENT));
    });
  });
};
