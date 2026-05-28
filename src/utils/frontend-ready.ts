/**
 * Frontend Ready Detection
 * Emits "frontend_ready" event when the React app has fully mounted and rendered.
 * This is used by the Tauri backend to know when it's safe to perform route navigation.
 */

import { emit } from "@tauri-apps/api/event";

let isReady = false;

/**
 * Signal that the frontend has finished initial render and is ready for navigation.
 * This should be called after the main React component has mounted and initial data is loaded.
 */
export async function signalFrontendReady() {
  if (isReady) {
    return;
  }
  isReady = true;

  try {
    await emit("frontend_ready");
  } catch (err) {
    console.error("Failed to emit frontend_ready event:", err);
  }
}

/**
 * Reset the ready state (useful for testing or page reloads).
 */
export function resetReadyState() {
  isReady = false;
}

/**
 * Check if frontend is marked as ready.
 */
export function isFrontendReady() {
  return isReady;
}
