import { askAI } from "../core/ai.js";
import { config } from "../core/config.js";

/**
 * Developer agent that returns a structured project as JSON.
 */
export async function developerAgent(task: string) {
  const systemPrompt = `
You are a senior full-stack engineer.

Return a JSON object ONLY.

FORMAT:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "src/index.js", "content": "..." },
    { "path": "README.md", "content": "..." }
  ]
}

RULES:
- No explanations
- No markdown
- Generate a COMPLETE working project
- All Node.js projects MUST use CommonJS (require/module.exports syntax)
- Projects MUST follow this structure: root package.json, src/index.js, src/routes/, src/controllers/, src/middleware/
- Always include a README.md with launch instructions
- The project MUST include an Express server.
- The projects main entry point (src/index.js) MUST include this exact code:
    const express = require("express");
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.get("/", (req, res) => {
      res.send("API is running");
    });

    app.listen(PORT, () => {
      console.log("Server running on port " + PORT);
    });
- The project MUST include a package.json with the 'express' dependency.
- Use clean folder structure
        `;

  const response = await askAI(task, systemPrompt, {
    jsonMode: true,
    model: config.openaiModel || "google/gemini-2.0-flash-001"
  });

  // 🔥 FAIL-SAFE BOILERPLATE: If AI fails to return files, provide a minimal working API
  if (!response || !response.content) { // Check response.content as the AI returns a string that needs parsing
    return {
      files: {
        "src/index.js": `const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("API is running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});`,
        "package.json": JSON.stringify({
          name: "app",
          version: "1.0.0",
          dependencies: { express: "^4.18.2" }
        }, null, 2)
      }
    };
  }

  try {
    const parsedResponse = JSON.parse(response.content);
    if (!parsedResponse.files) { // Also check if the parsed object is missing 'files'
      return {
        files: {
          "src/index.js": `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('API is running');
});

app.listen(PORT, () => {
  console.log('Server running');
});`,
          "package.json": JSON.stringify({
            name: "app",
            version: "1.0.0",
            dependencies: { express: "^4.18.2" }
          }, null, 2)
        }
      };
    }
    return parsedResponse;
  } catch (err) {
    console.error("❌ JSON PARSE FAILED:", response.content);
    throw new Error("Developer agent did not return valid JSON");
  }
}
