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

/**
 * Specifically cleans queries for the Brave Search API
 * to prevent 422 Unprocessable Entity errors.
 */
export function sanitizeBraveQuery(query: string): string {
  if (!query) return "";
  
  // 1. Remove control characters and non-printable characters
  let cleaned = query.replace(/[\x00-\x1F\x7F-\x9F]/g, " ");

  // 2. Simplify complex logic that triggers 422
  cleaned = cleaned.replace(/\s+OR\s+/gi, ' ');
  cleaned = cleaned.replace(/\s+AND\s+/gi, ' ');
  cleaned = cleaned.replace(/\s+NOT\s+/gi, ' ');

  // 3. Ensure balanced quotes
  const quoteCount = (cleaned.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    cleaned = cleaned.replace(/"/g, ''); 
  }

  // 4. Robust character allowing
  cleaned = cleaned.replace(/[^\w\s\.\:\"\'\-\+]/gi, ' ');

  // 5. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 6. Truncate to Brave's recommended limits
  if (cleaned.length > 300) {
    cleaned = cleaned.slice(0, 300);
  }
  
  const words = cleaned.split(' ');
  if (words.length > 40) {
    cleaned = words.slice(0, 40).join(' ');
  }

  // 7. Final safety check
  if (!cleaned && query.trim()) {
    return query.trim().replace(/[^\w\s]/gi, '').slice(0, 50);
  }

  return cleaned;
}



