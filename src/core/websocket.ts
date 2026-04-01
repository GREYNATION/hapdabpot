import type { WebSocketServer } from 'ws';
import * as wsLib from "ws";
const wssModule = (wsLib as any).default || wsLib;
const WSServer = wssModule.WebSocketServer;
import { log } from "./config.js";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: any) {
  wss = new WSServer({ server });
  log("[WS] WebSocket server initialized on shared port");
  
  wss?.on("connection", (ws: any) => {
    log("[WS] Client connected");
  });
}

export function sendUpdate(data: any) {
  if (!wss) return;
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1) { // WebSocket.OPEN is 1
      client.send(JSON.stringify(data));
    }
  });
}

