import type { WebSocketServer } from "ws";
import { WebSocketServer as WSServer } from "ws";
import { log } from "./config.js";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: any) {
  wss = new WSServer({ server });
  log("[WS] WebSocket server initialized on shared port");

  wss?.on("connection", (ws: any) => {
    log("[WS] Client connected");
  });
}