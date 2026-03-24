import { startApp } from "../core/processManager.js";

/**
 * Starts the Node.js server in the specified directory using the App Manager.
 */
export async function startServer(cwd: string) {
  return new Promise((resolve) => {
    const result = startApp("project-server", cwd);

    setTimeout(() => {
      resolve(result);
    }, 3000);
  });
}

/**
 * Tests an HTTP endpoint and returns the response text.
 */
export async function testEndpoint(url: string) {
  try {
    const res = await fetch(url);
    const text = await res.text();

    return `✅ Endpoint working:\n${text}`;
  } catch (err: any) {
    return `❌ Endpoint failed: ${err.message}`;
  }
}
