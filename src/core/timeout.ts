export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[Timeout] "${label}" exceeded ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps any promise with a timeout.
 * If the promise doesn't resolve in time, it rejects with TimeoutError.
 *
 * Usage:
 *   const result = await withTimeout(runAutonomousPipeline(...), 30_000, "marketScan");
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    if (timer!) clearTimeout(timer);
    throw err;
  }
}

/**
 * Safe error message extractor — fixes ts(1343).
 * Use this everywhere you have a catch block.
 *
 * Instead of: (err instanceof Error ? err.message : String(err))
 * Just use:   getErrorMessage(err)
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
