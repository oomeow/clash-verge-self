import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// find element and highlight
export function findAndHighlightElement(elementId: string, retry = 10) {
  const ele = document.getElementById(elementId);
  if (!ele) {
    if (retry > 0) {
      requestAnimationFrame(() =>
        findAndHighlightElement(elementId, retry - 1),
      );
    }
  } else {
    ele.classList.add("animate-highlight");
    setTimeout(() => {
      ele?.classList.remove("animate-highlight");
    }, 1000);
  }
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
