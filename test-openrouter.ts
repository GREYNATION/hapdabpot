import { openrouter } from "./src/core/config.js";
import dotenv from "dotenv";

dotenv.config();

async function testOpenRouter() {
    try {
        const model = "google/gemini-2.0-flash-lite-preview-02-05:free";
        console.log("Testing OpenRouter with: " + model);
        
        const response = await openrouter.chat.send({
            chatGenerationParams: {
                model: model,
                messages: [{ role: "user", content: "Say 'Success'" }],
                temperature: 0.1,
            }
        });

        if (response && response.choices && response.choices[0]) {
            console.log("TEST_RESULT_START");
            console.log("CONTENT: " + response.choices[0].message.content);
            console.log("MODEL: " + response.model);
            console.log("TEST_RESULT_END");
        } else {
            console.log("FAILED: No choices in response");
        }
    } catch (error: any) {
        console.log("TEST_ERROR_START");
        console.log("ERROR: " + error.message);
        console.log("TEST_ERROR_END");
    }
}

testOpenRouter();
