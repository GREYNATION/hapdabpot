import { openrouter } from "./src/core/config.js";
import "dotenv/config";

async function listModels() {
    try {
        console.log("Listing models...");
        const response = await openrouter.models.list();
        console.log("TEST_RESULT_START");
        if (response && response.data) {
             console.log("Models found: " + response.data.length);
             const first5 = response.data.slice(0, 5).map((m: any) => m.id).join(", ");
             console.log("First 5 models: " + first5);
             
             // Check if glm-5-turbo exists
             const glm = response.data.find((m: any) => m.id.includes("glm-5"));
             if (glm) {
                 console.log("Found GLM model: " + glm.id);
             } else {
                 console.log("GLM model not found in the list.");
             }
        } else {
             console.log("Unexpected response structure.");
             console.log(JSON.stringify(response, null, 2));
        }
        console.log("TEST_RESULT_END");
    } catch (error: any) {
        console.log("TEST_ERROR_START");
        console.error(error);
        console.log("TEST_ERROR_END");
    }
}

listModels();
