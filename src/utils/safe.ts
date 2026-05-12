export function safeIncludes(value: unknown, text: string): boolean {
  return typeof value === "string" ? value?.includes(text) : false;
}

export function safeToLower(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

export function safeStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function validateQuery(query: unknown): string {
  if (typeof query !== "string" || query.trim().length < 3) {
    throw new Error("Invalid query");
  }
  return query.trim();
}

