import { spawn } from 'child_process';
import path from 'path';
import { log } from '../core/config.js';

export class JarvisService {
  private static instance: JarvisService;
  private pythonPath: string;
  private bridgePath: string;

  private constructor() {
    // Determine Python path (preferring the .venv if it exists)
    const venvPython = path.join(process.cwd(), 'OpenJarvis', '.venv', 'Scripts', 'python.exe');
    this.pythonPath = venvPython; // Fallback logic can be added if needed
    this.bridgePath = path.join(process.cwd(), 'OpenJarvis', 'jarvis_bridge.py');
  }

  public static getInstance(): JarvisService {
    if (!JarvisService.instance) {
      JarvisService.instance = new JarvisService();
    }
    return JarvisService.instance;
  }

  /**
   * Send a query to OpenJarvis via the Python bridge
   */
  public async ask(query: string): Promise<string> {
    return new Promise((resolve, reject) => {
      log(`[jarvis] Querying OpenJarvis: "${query}"...`, 'info');
      
      const child = spawn(this.pythonPath, [this.bridgePath, query], {
        env: {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), 'OpenJarvis', 'src')
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          log(`[jarvis] Process exited with code ${code}. Stderr: ${stderr}`, 'error');
          resolve(`Error: OpenJarvis failed with code ${code}`);
        } else {
          resolve(stdout.trim());
        }
      });

      child.on('error', (err: Error) => {
        log(`[jarvis] Failed to start process: ${err.message}`, 'error');
        reject(err);
      });
    });
  }
}

export const jarvisService = JarvisService.getInstance();
