export type Updater<T> = T | ((prev: T) => T);

export const applyUpdater = <T>(next: Updater<T>, prev: T): T => {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
};
