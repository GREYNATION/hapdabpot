import { comfyClient } from "./ComfyClient.js";
import { log } from "../../core/config.js";

async function main() {
    log("Checking ComfyUI node info...");
    try {
        const info = await comfyClient.getObjectInfo();
        const nodeName = "LtxvApiTextToVideo";
        
        if (info[nodeName]) {
            log(`âœ… Node [${nodeName}] found!`);
            log(`Parameters: ${JSON.stringify(info[nodeName].input, null, 2)}`);
        } else {
            log(`âŒ Node [${nodeName}] NOT found.`);
            log("Available LTXV nodes: " + Object.keys(info).filter(k => k.toLowerCase()?.includes("ltx")).join(", "));
        }
        
        const vhsNode = "VHS_VideoCombine";
        if (info[vhsNode]) {
            log(`âœ… Node [${vhsNode}] found!`);
        } else {
            log(`âŒ Node [${vhsNode}] NOT found.`);
        }
        
    } catch (err: any) {
        log(`Error: ${err.message}`, "error");
    }
}

main();

