export default function isAsyncFunction(
  fn: (...args: any[]) => unknown,
): boolean {
  return fn.constructor.name === "AsyncFunction";
}
