export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

export function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function safeToLower(v: unknown): string {
  return safeStr(v).toLowerCase();
}

export function safeIncludes(haystack: unknown, needle: unknown): boolean {
  return safeToLower(haystack)?.includes(safeToLower(needle));
}

