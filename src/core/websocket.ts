import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');
import { log } from "./config.js";

let wss: any = null;

export function initWebSocket(server: any) {
  wss = new WebSocketServer({ server });
  log("[WS] WebSocket server initialized on shared port");

  wss.on("connection", (ws: any) => {
    log("[WS] Client connected");

    ws.on("message", (message: any) => {
      log(`[WS] Message received: ${message}`);
    });

    ws.on("close", () => {
      log("[WS] Client disconnected");
    });

    ws.on("error", (err: any) => {
      log(`[WS] Error: ${err.message}`);
    });
  });
}

export function broadcastToClients(data: unknown) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client: any) => {
    // 1 is WebSocket.OPEN
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}


















