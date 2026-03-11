import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { spawn } from "node:child_process";
import { URL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const stateDir = path.join(rootDir, ".cache");
const statePath = path.join(stateDir, "xlsx-watch-state.json");

const POLL_INTERVAL_MS = 10000;
const PB_HEALTH_URL = "http://127.0.0.1:8091/api/health";

let latestSeenKey = loadLatestSeenKey();
let refreshInFlight = false;

main().catch((error) => {
  console.error(`[xlsx-watch] fatal: ${error.message}`);
});

async function main() {
  await checkForUpdates(true);

  setInterval(() => {
    void checkForUpdates(false);
  }, POLL_INTERVAL_MS);
}

async function checkForUpdates(isInitialRun) {
  if (refreshInFlight) {
    return;
  }

  const pocketBaseReady = await isPocketBaseReady();
  if (!pocketBaseReady) {
    if (isInitialRun) {
      console.log("[xlsx-watch] waiting for PocketBase on 127.0.0.1:8091");
    }
    return;
  }

  const latest = getLatestRootXlsx();
  if (!latest) {
    if (isInitialRun) {
      console.log("[xlsx-watch] no .xlsx files found in project root");
    }
    return;
  }

  const stats = fs.statSync(latest);
  const nextKey = buildSeenKey(latest, stats.mtimeMs);
  if (isInitialRun && !latestSeenKey) {
    latestSeenKey = nextKey;
    persistLatestSeenKey(latestSeenKey);
    console.log(`[xlsx-watch] watching ${path.basename(latest)}`);
    return;
  }

  if (nextKey === latestSeenKey) {
    return;
  }

  refreshInFlight = true;

  try {
    console.log(`[xlsx-watch] refreshing from ${path.basename(latest)}`);
    await runNodeScript(path.join(rootDir, "scripts", "import-excel.mjs"));
    await runNodeScript(path.join(rootDir, "scripts", "generate-report-data.mjs"));
    latestSeenKey = nextKey;
    persistLatestSeenKey(latestSeenKey);
    console.log(`[xlsx-watch] refresh complete for ${path.basename(latest)}`);
  } catch (error) {
    console.error(`[xlsx-watch] refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    refreshInFlight = false;
  }
}

function loadLatestSeenKey() {
  try {
    if (!fs.existsSync(statePath)) {
      return "";
    }
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return typeof parsed.latestSeenKey === "string" ? parsed.latestSeenKey : "";
  } catch {
    return "";
  }
}

function persistLatestSeenKey(value) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ latestSeenKey: value }, null, 2));
}

function buildSeenKey(filePath, mtimeMs) {
  return `${filePath}:${mtimeMs}`;
}

function getLatestRootXlsx() {
  const files = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.xlsx?$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(rootDir, entry.name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return files[0]?.fullPath || "";
}

async function isPocketBaseReady() {
  const url = new URL(PB_HEALTH_URL);
  const transport = url.protocol === "https:" ? https : http;

  try {
    return await new Promise((resolve) => {
      const request = transport.request(
        url,
        {
          method: "GET",
        },
        (response) => {
          response.resume();
          resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300);
        },
      );

      request.on("error", () => resolve(false));
      request.end();
    });
  } catch {
    return false;
  }
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(prefixLines(chunk.toString(), false));
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(prefixLines(text, true));
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      const message = stderr.trim() || `${path.basename(scriptPath)} exited with code ${code ?? 1}`;
      reject(new Error(message));
    });
  });
}

function prefixLines(text, isError) {
  const color = isError ? "\u001b[31m" : "\u001b[35m";
  const reset = "\u001b[0m";

  return text
    .split(/\r?\n/)
    .map((line, index, lines) => {
      if (line === "" && index === lines.length - 1) {
        return "";
      }
      return `${color}[xlsx-watch]${reset} ${line}`;
    })
    .join("\n");
}
