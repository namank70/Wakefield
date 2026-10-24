import { existsSync, mkdirSync, createWriteStream, openSync, closeSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile?.(join(root, ".env.local")); } catch { /* Optional local settings. */ }
const model = process.env.OLLAMA_MODEL || "qwen3-vl:2b-instruct";
const base = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const install = process.argv.includes("--install");
const statusOnly = process.argv.includes("--status");
const localDirectory = join(root, ".data", "local-ai");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tags() {
  try {
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

function findOllama() {
  if (process.platform === "win32") {
    const local = join(process.env.LOCALAPPDATA || "", "Programs", "Ollama", "ollama.exe");
    if (existsSync(local)) return local;
  }
  try {
    const found = execFileSync(process.platform === "win32" ? "where.exe" : "which", ["ollama"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/)[0];
    return found || null;
  } catch { return null; }
}

async function installWindows() {
  if (process.platform !== "win32") throw new Error("Install Ollama from https://ollama.com/download, then rerun npm run setup:ai.");
  mkdirSync(localDirectory, { recursive: true });
  const installer = join(localDirectory, "OllamaSetup.exe");
  if (!existsSync(installer)) {
    console.log("Downloading Ollama's official Windows installer...");
    const response = await fetch("https://ollama.com/download/OllamaSetup.exe");
    if (!response.ok || !response.body) throw new Error(`Ollama download failed (${response.status}).`);
    const partial = `${installer}.partial`;
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    renameSync(partial, installer);
  } else console.log("Checking the previously downloaded Ollama installer...");
  const signatureEnvironment = { ...process.env, WAKEFIELD_AI_INSTALLER: installer };
  // Windows PowerShell must discover its own modules rather than inherit PowerShell 7's module path.
  delete signatureEnvironment.PSModulePath;
  const check = execFileSync("powershell.exe", ["-NoProfile", "-Command", "$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -FilePath $env:WAKEFIELD_AI_INSTALLER; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch '(^|, )O=Ollama Inc[.](,|$)') { exit 1 }; Write-Output 'Verified Ollama Inc. signature'"], { env: signatureEnvironment, encoding: "utf8", windowsHide: true });
  console.log(check.trim());
  // The official installer uses this marker to launch its application hidden.
  const markerDirectory = join(process.env.LOCALAPPDATA, "Ollama");
  mkdirSync(markerDirectory, { recursive: true });
  writeFileSync(join(markerDirectory, "upgraded"), "");
  console.log("Installing Ollama in this Windows account...");
  await new Promise((resolve, reject) => {
    const child = spawn(installer, ["/VERYSILENT", "/NORESTART", "/SUPPRESSMSGBOXES"], { windowsHide: true, stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Ollama installation failed (${code}).`)));
  });
  return findOllama();
}

async function startRuntime(executable) {
  const url = new URL(base);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Start the configured Ollama service on its host, then retry.");
  mkdirSync(localDirectory, { recursive: true });
  const log = openSync(join(localDirectory, "ollama.log"), "a");
  const child = spawn(executable, ["serve"], { detached: true, windowsHide: true, env: { ...process.env, OLLAMA_HOST: url.host, OLLAMA_NUM_PARALLEL: "1", OLLAMA_MAX_LOADED_MODELS: "1" }, stdio: ["ignore", log, log] });
  child.on("error", (error) => console.error(`Could not start Ollama: ${error.message}`));
  child.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await tags();
    if (state) return state;
    await sleep(500);
  }
  throw new Error("Ollama did not start. Check .data/local-ai/ollama.log.");
}

async function pullModel() {
  console.log(`Downloading ${model}. The first setup downloads about 1.9 GB; later starts reuse it.`);
  const response = await fetch(`${base}/api/pull`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, stream: true }) });
  if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status}).`);
  let pending = "", lastUpdate = 0;
  for await (const chunk of response.body) {
    pending += Buffer.from(chunk).toString("utf8");
    let end;
    while ((end = pending.indexOf("\n")) !== -1) {
      const line = pending.slice(0, end); pending = pending.slice(end + 1);
      if (!line.trim()) continue;
      const progress = JSON.parse(line);
      if (progress.error) throw new Error(progress.error);
      if (Date.now() - lastUpdate > 5000 || progress.status === "success") {
        const percent = progress.total ? ` ${Math.floor(100 * progress.completed / progress.total)}%` : "";
        console.log(`${progress.status}${percent}`); lastUpdate = Date.now();
      }
    }
  }
}

try {
  if (model.endsWith(":cloud")) throw new Error("Choose a local vision model; this setup does not sign in to cloud services.");
  let state = await tags();
  if (!state && statusOnly) throw new Error("Ollama is offline. Run npm run setup:ai.");
  if (!state) {
    let executable = findOllama();
    if (!executable && install) executable = await installWindows();
    if (!executable) throw new Error("Local photo AI needs setup. Run npm run setup:ai once. You can still use manual report review.");
    state = await startRuntime(executable);
  }
  if (!state.models?.some((item) => [item.name, item.model].includes(model))) {
    if (!install) throw new Error(`The vision model is missing. Run npm run setup:ai once to download ${model}.`);
    await pullModel();
    state = await tags();
  }
  if (!state?.models?.some((item) => [item.name, item.model].includes(model))) throw new Error("The vision model was not available after setup. Retry npm run setup:ai.");
  console.log(`Local photo AI ready: ${model} at ${base}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
