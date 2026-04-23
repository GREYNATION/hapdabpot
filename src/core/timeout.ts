/**
 * Utility to wrap any promise with a timeout.
 * If the promise doesn't resolve in time, it rejects with TimeoutError.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[Timeout] "${label}" exceeded ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps any promise with a timeout.
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
    clearTimeout(timer!);
    throw err;
  }
}

/**
 * Helper to sleep for N milliseconds
 */
export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Helper to get a clean error message from any caught error.
 */
export function getErrorMessage(error: any): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error occurred";
}
