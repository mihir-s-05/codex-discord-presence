import { existsSync, readFileSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { DEFAULT_CLIENT_ID, SUPPORTED_HOOK_EVENTS } from "./constants.js";
import { codexHome, ipcPath, isSupportedPlatform, readRuntimeConfig } from "./env.js";
import { isDiscordRunning } from "./discord.js";
import { normalizeHookPayload } from "./hookPayload.js";
import { sendDaemonRequest, sendPresenceUpdate } from "./ipc.js";
import { logPath } from "./log.js";

const execAsync = promisify(exec);

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

export async function runDoctor(): Promise<DoctorCheck[]> {
  const home = codexHome();
  const configPath = join(home, "config.toml");
  const hooksPath = join(home, "hooks.json");
  const checks: DoctorCheck[] = [];
  const runtimeConfig = readRuntimeConfig();
  const platformSupported = isSupportedPlatform();
  const hooksEnabled = fileContains(configPath, /codex_hooks\s*=\s*true/);
  const hooksInstalled = hooksJsonLooksInstalled(hooksPath);
  const discordRunning = await isDiscordRunning();

  checks.push({
    name: "platform",
    ok: platformSupported,
    message: platformSupported
      ? `${process.platform} is supported`
      : `${process.platform} is not supported; this extension targets Windows and macOS`
  });

  checks.push(await codexVersionCheck());
  checks.push({
    name: "client-id",
    ok: /^\d{17,20}$/.test(runtimeConfig.clientId),
    message: runtimeConfig.clientId === DEFAULT_CLIENT_ID
      ? `using bundled Discord client ID ${runtimeConfig.clientId}`
      : `using override Discord client ID ${runtimeConfig.clientId}`
  });
  checks.push({
    name: "config.toml",
    ok: hooksEnabled,
    message: `${configPath} ${hooksEnabled ? "enables" : "does not enable"} codex hooks`
  });
  checks.push({
    name: "hooks.json",
    ok: hooksInstalled,
    message: `${hooksPath} ${hooksInstalled ? "contains" : "does not contain"} codex-discord hooks`
  });
  checks.push({
    name: "discord-process",
    ok: discordRunning,
    message: discordRunning ? "Discord process is running" : "Discord process was not detected"
  });
  checks.push({
    name: "ipc-path",
    ok: true,
    message: ipcPath()
  });
  checks.push({
    name: "log",
    ok: true,
    message: logPath()
  });

  const hadDaemon = (await sendDaemonRequest({ type: "ping" })).ok;
  const syntheticUpdate = normalizeHookPayload({
    hook_event_name: "SessionStart",
    cwd: process.cwd(),
    session_id: "doctor"
  });
  const hookBridge = await sendPresenceUpdate(syntheticUpdate, true);
  if (!hadDaemon) {
    await sendDaemonRequest({ type: "shutdown" }).catch(() => undefined);
  }
  checks.push({
    name: "hook-bridge",
    ok: hookBridge.ok,
    message: hookBridge.message ?? "synthetic hook payload accepted"
  });

  if (process.platform === "win32") {
    checks.push({
      name: "windows-hooks",
      ok: true,
      message: "Codex docs have recently reported Windows hooks as version-sensitive; verify with one real Codex turn after install"
    });
  }

  return checks;
}

export function printDoctor(checks: DoctorCheck[]): void {
  for (const check of checks) {
    const marker = check.ok ? "ok" : "warn";
    console.log(`[${marker}] ${check.name}: ${check.message}`);
  }
}

async function codexVersionCheck(): Promise<DoctorCheck> {
  try {
    const { stdout, stderr } = await execAsync("codex --version", { timeout: 5_000 });
    const output = (stdout || stderr).trim();
    return { name: "codex", ok: true, message: output || "codex executable found" };
  } catch (error) {
    return {
      name: "codex",
      ok: false,
      message: error instanceof Error ? error.message : "codex executable was not found"
    };
  }
}

function fileContains(path: string, pattern: RegExp): boolean {
  try {
    return pattern.test(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
}

function hooksJsonLooksInstalled(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as HooksFile;
    return SUPPORTED_HOOK_EVENTS.every((eventName) =>
      (parsed.hooks?.[eventName] ?? []).some((group) =>
        group.hooks?.some((hook) => hook.command?.includes("codex-discord"))
      )
    );
  } catch {
    return false;
  }
}

interface HooksFile {
  hooks?: Record<string, HookGroup[]>;
}

interface HookGroup {
  hooks?: HookCommand[];
}

interface HookCommand {
  command?: string;
}
