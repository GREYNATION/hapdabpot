import { startApp } from "../core/processManager.js";

/**
 * Starts the Node.js server in the specified directory using the App Manager.
 */
export async function startServer(cwd: string) {
    const result = await startApp("project-server", cwd);
    // Wait for stabilization
    await new Promise(r => setTimeout(r, 3000));
    return result;
}

/**
 * Tests an HTTP endpoint and returns the response text.
 */
export async function testEndpoint(url: string) {
  try {
    const res = await fetch(url);
    const text = await res.text();

    return `âœ… Endpoint working:\n${text}`;
  } catch (err: any) {
    return `âŒ Endpoint failed: ${err.message}`;
  }
}

