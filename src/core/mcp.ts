import { MCPServer, createMCPServer } from "../../ruflo/v3/mcp/server.js";
import { log } from "./config.js";
import { getAllTools } from "../../ruflo/v3/mcp/tools/index.js";
import { ILogger } from "../../ruflo/v3/mcp/types.js";

let _mcpServer: MCPServer | null = null;

const mcpLogger: ILogger = {
    debug: (msg, data) => log(`[MCP-DEBUG] ${msg} ${data ? JSON.stringify(data) : ""}`),
    info: (msg, data) => log(`[MCP-INFO] ${msg} ${data ? JSON.stringify(data) : ""}`),
    warn: (msg, data) => log(`[MCP-WARN] ${msg} ${data ? JSON.stringify(data) : ""}`, "warn"),
    error: (msg, data) => log(`[MCP-ERROR] ${msg} ${data ? JSON.stringify(data) : ""}`, "error"),
};

export async function getMCPServer(): Promise<MCPServer> {
    if (!_mcpServer) {
        log("[mcp] Initializing Master MCP Server...");
        _mcpServer = createMCPServer({
            name: "Council-Master-MCP",
            version: "3.0.0",
            transport: "stdio", // Standard transport but we will also use it in-process
        }, mcpLogger);

        // Start the server (this automatically registers all built-in and MCP-first tools)
        await _mcpServer.start();
        const health = await _mcpServer.getHealthStatus();
        log(`[mcp] MCP Server active with ${health.metrics?.registeredTools || 0} tools.`);
    }
    return _mcpServer;
}

export async function callMCPTool(name: string, args: Record<string, any>): Promise<any> {
    const server = await getMCPServer();
    
    // We simulate an MCP request
    const request = {
        jsonrpc: "2.0" as const,
        id: `local-${Date.now()}`,
        method: "tools/call",
        params: {
            name,
            arguments: args
        }
    };

    const response = await (server as any).handleToolsCall(request);
    
    if (response.error) {
        throw new Error(`MCP Tool Error [${response.error.code}]: ${response.error.message}`);
    }
    
    return response.result;
}
