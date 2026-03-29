import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

/**
 * Executes a terminal command in the specified directory.
 */
export async function runCommand(command: string, cwd: string) {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });

    return stdout || stderr || "Command executed";
  } catch (err: any) {
    return `âŒ Command failed: ${err.message}`;
  }
}

