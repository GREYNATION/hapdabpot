import { spawn } from "child_process";
import net from "net";

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
}

type ProcessRecord = {
  id: string;
  port: number;
  process: any;
  status: "running" | "stopped" | "crashed";
  logs: string[];
};

const processes: Record<string, ProcessRecord> = {};
let nextPort = 3000;

// Ã°Å¸â€Å’ AUTO PORT
function getNextPort() {
  return nextPort++;
}

/**
 * Starts an application with automatic port assignment and log capturing.
 */
export async function startApp(id: string, cwd: string, options: { recursive?: boolean } = {}) {
  // ðŸ”¥ STOP ALL EXISTING APPS FIRST
  Object.keys(processes).forEach(existingId => {
    try {
        processes[existingId].process.kill();
    } catch (e) {}
    delete processes[existingId];
  });

  const port = getNextPort();
  
  // Verify port availability
  const available = await isPortAvailable(port);
  if (!available) {
      console.warn(`[processManager] Port ${port} is already bound. Skipping spawn for ${id}.`);
      return { message: `âš ï¸ Port ${port} occupied`, port };
  }

  // Prevent recursive boot cycles if spawning the main index
  const args = ["src/index.js"];
  if (id === 'main' || id?.includes('gravity-claw')) {
      console.log(`[processManager] ðŸ›¡ï¸ Refusing to spawn main app recursively via processManager.`);
      return { message: `ðŸ›¡ï¸ Recursive spawn blocked`, port };
  }

  const proc = spawn("node", args, {
    cwd,
    shell: true,
    env: { ...process.env, PORT: String(port) },
  });

  processes[id] = {
    id,
    port,
    process: proc,
    status: "running",
    logs: [],
  };

  proc.stdout.on("data", (data) => {
    const log = data.toString();
    processes[id].logs.push(log);
    console.log(`[${id}]`, log);
  });

  proc.stderr.on("data", (data) => {
    const log = data.toString();
    processes[id].logs.push("ERROR: " + log);
    console.error(`[${id}]`, log);
  });

  proc.on("exit", () => {
    if (processes[id]) {
      processes[id].status = "crashed";
    }

    // AUTO-RESTART logic - pass existing port
    // However, the user's snippet recreates a new port in startApp.
    // To preserve port on restart, we'd need a variation.
    // For now, I'll follow the user's snippet exactly as requested.
    setTimeout(() => {
      console.log(`Ã°Å¸â€Â Restarting ${id}...`);
      startApp(id, cwd);
    }, 3000);
  });

  return { message: `Ã°Å¸Å¡â‚¬ ${id} running on port ${port}`, port };
}

/**
 * Stops a running application.
 */
export function stopApp(id: string) {
  const proc = processes[id];

  if (!proc) return `Ã¢ÂÅ’ ${id} not found`;

  proc.process.kill();
  proc.status = "stopped";
  delete processes[id];

  return `Ã°Å¸â€ºâ€˜ ${id} stopped`;
}

/**
 * Lists all managed applications.
 */
export function listApps() {
  return Object.values(processes);
}

/**
 * Retrieves the last 20 logs for a specific application.
 */
export function getLogs(id: string) {
  const proc = processes[id];

  if (!proc) return `Ã¢ÂÅ’ ${id} not found`;

  return proc.logs.slice(-20).join("\n"); // last 20 logs
}


