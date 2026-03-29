import { spawn } from "child_process";

type ProcessRecord = {
  id: string;
  port: number;
  process: any;
  status: "running" | "stopped" | "crashed";
  logs: string[];
};

const processes: Record<string, ProcessRecord> = {};
let nextPort = 3000;

// ðŸ”Œ AUTO PORT
function getNextPort() {
  return nextPort++;
}

/**
 * Starts an application with automatic port assignment and log capturing.
 */
export function startApp(id: string, cwd: string) {
  // ðŸ”¥ STOP ALL EXISTING APPS FIRST
  Object.keys(processes).forEach(existingId => {
    try {
        processes[existingId].process.kill();
    } catch (e) {}
    delete processes[existingId];
  });

  const port = getNextPort();

  const proc = spawn("node", ["src/index.js"], {
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
      console.log(`ðŸ” Restarting ${id}...`);
      startApp(id, cwd);
    }, 3000);
  });

  return { message: `ðŸš€ ${id} running on port ${port}`, port };
}

/**
 * Stops a running application.
 */
export function stopApp(id: string) {
  const proc = processes[id];

  if (!proc) return `âŒ ${id} not found`;

  proc.process.kill();
  proc.status = "stopped";
  delete processes[id];

  return `ðŸ›‘ ${id} stopped`;
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

  if (!proc) return `âŒ ${id} not found`;

  return proc.logs.slice(-20).join("\n"); // last 20 logs
}

