import fs from "fs";
import path from "path";

const COMFY_URL = "http://127.0.0.1:8188";

/**
 * Generates an image using local ComfyUI instance.
 */
export async function generateImage(prompt: string): Promise<string> {
  // Basic ComfyUI prompt workflow
  const workflow = {
    prompt: {
      "3": {
        inputs: {
          seed: Math.floor(Math.random() * 1000000),
          steps: 20,
          cfg: 8,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          model: "sd_xl_base_1.0.safetensors",
          positive: prompt,
          negative: "blurry, bad quality",
        },
        class_type: "KSampler",
      }
    }
  };

  console.log(`[comfy] Submitting prompt to ComfyUI: ${prompt}`);
  
  try {
    const res = await fetch(`${COMFY_URL}/prompt`, {
      method: "POST",
      body: JSON.stringify(workflow),
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`ComfyUI Error: ${res.statusText}`);

    const data = await res.json();
    console.log(`[comfy] Prompt submitted: ${data.prompt_id}`);

    // Wait + fetch image (simplified pooling equivalent)
    // In a real scenario, we'd poll /history/{id}
    await new Promise(r => setTimeout(r, 8000)); // Increased to 8s for SDXL

    const imageUrl = `${COMFY_URL}/view?filename=output.png&type=output`;

    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error("Failed to fetch generated image from ComfyUI");
    
    const buffer = Buffer.from(await imageRes.arrayBuffer());

    // Ensure directory exists
    const outputDir = path.join(process.cwd(), "workspace", "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `image_${Date.now()}.png`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, buffer);

    console.log(`[comfy] Image saved to: workspace/output/${fileName}`);
    return `workspace/output/${fileName}`;
  } catch (err: any) {
    console.error(`[comfy] Error generating image: ${err.message}`);
    throw err;
  }
}

