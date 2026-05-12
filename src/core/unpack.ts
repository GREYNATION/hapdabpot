/**
 * 🛡️ UNPACK SHIELD: Extract a plain string from any agent response shape.
 * Handles: string | { content: string } | { text: string } | { content: { text: string } } | nested objects
 */
export function unpackContent(result: any): string {
    if (!result) return "";
    if (typeof result === 'string') return result;

    // Primary: AIResponse.content
    const content = result.content ?? result.text ?? result.message ?? "";
    
    if (typeof content === 'string') return content;
    
    // Nested: content might be an object or array (e.g., Anthropic content blocks)
    if (Array.isArray(content)) {
        return content.map((b: any) => (typeof b === 'string' ? b : b?.text || '')).join('\n');
    }
    
    if (typeof content === 'object' && content !== null) {
        return content.text || content.content || JSON.stringify(content);
    }
    
    return String(content);
}

/**
 * Ensures the input is a string, preventing [object Object] leaks.
 */
export function safeString(input: any): string {
    if (typeof input === 'string') return input;
    if (input === null || input === undefined) return "";
    
    // If it looks like an AI response object, unpack it
    if (typeof input === 'object' && (input.content || input.text || input.message)) {
        return unpackContent(input);
    }
    
    // Fallback to stringification
    return String(input);
}
