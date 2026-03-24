import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });

export function sendUpdate(data: any) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN is 1
      client.send(JSON.stringify(data));
    }
  });
}

console.log("WebSocket running on ws://localhost:3001");
