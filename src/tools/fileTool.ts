import fs from "fs";
import path from "path";

/**
 * Ensures a directory exists and writes content to a file.
 */
export async function writeFile(filePath: string, content: string): Promise<string> {
    const fullPath = path.resolve(process.cwd(), filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
    console.log(`[file] Content written to: ${filePath}`);
    return `Content saved to ${filePath}`;
}

/**
 * Writes a list of files to the workspace output directory.
 */
export function writeProject(files: { path: string; content: string }[]): string[] {
  const createdFiles: string[] = [];
  const BASE_DIR = path.join(process.cwd(), "workspace", "output");

  for (const file of files) {
    const fullPath = path.join(BASE_DIR, file.path);

    if (!fs.existsSync(path.dirname(fullPath))) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    
    fs.writeFileSync(fullPath, file.content);
    createdFiles.push(file.path);
  }

  return createdFiles;
}

