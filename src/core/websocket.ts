import WebSocket from 'ws';
const { WebSocketServer } = WebSocket;
import { log } from "./config.js";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: any) {
  wss = new WebSocketServer({ server });
  log("[WS] WebSocket server initialized on shared port");

  wss.on("connection", (ws: any) => {
    log("[WS] Client connected");
  });
}