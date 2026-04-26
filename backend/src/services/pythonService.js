import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..", "..");
const mlRoot = path.join(repoRoot, "ml");
const pythonBinary = path.join(mlRoot, "venv", "bin", "python");
const predictScript = path.join(mlRoot, "src", "predict.py");
const trainScript = path.join(mlRoot, "src", "train_model.py");
const uploadsDir = path.join(backendRoot, "uploads");

async function runPython(scriptPath, payload) {
  await fs.mkdir(uploadsDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary, [scriptPath], {
      cwd: repoRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse Python response: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function trainModel() {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary, [trainScript], {
      cwd: repoRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Training failed with code ${code}`));
        return;
      }

      resolve(JSON.parse(stdout));
    });
  });
}

export async function scoreRecords(records) {
  return runPython(predictScript, { mode: "records", records });
}

export async function scoreCsv(csvPath) {
  return runPython(predictScript, { mode: "csv", csvPath });
}
