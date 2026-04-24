import { homedir, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  DEFAULT_CLEAR_AFTER_MS,
  DEFAULT_CLIENT_ID,
  DEFAULT_LARGE_IMAGE_KEY
} from "./constants.js";

export type PrivacyMode = "project" | "generic";

export interface RuntimeConfig {
  clientId: string;
  privacy: PrivacyMode;
  clearAfterMs: number;
  largeImageKey: string;
}

export function readRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const clearAfterMs = Number.parseInt(env.CODEX_DISCORD_CLEAR_AFTER_MS ?? "", 10);
  const privacy = env.CODEX_DISCORD_PRIVACY === "generic" ? "generic" : "project";
  return {
    clientId: env.CODEX_DISCORD_CLIENT_ID?.trim() || DEFAULT_CLIENT_ID,
    privacy,
    clearAfterMs: Number.isFinite(clearAfterMs) && clearAfterMs >= 0 ? clearAfterMs : DEFAULT_CLEAR_AFTER_MS,
    largeImageKey: env.CODEX_DISCORD_LARGE_IMAGE_KEY?.trim() || DEFAULT_LARGE_IMAGE_KEY
  };
}

export function codexHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

export function userHash(): string {
  const identity = `${userInfo().username}:${homedir()}`;
  return createHash("sha256").update(identity).digest("hex").slice(0, 12);
}

export function ipcPath(platform: NodeJS.Platform = process.platform): string {
  const suffix = userHash();
  if (platform === "win32") {
    return `\\\\.\\pipe\\codex-discord-rpc-${suffix}`;
  }
  return join(tmpdir(), `codex-discord-rpc-${process.getuid?.() ?? suffix}.sock`);
}

export function isSupportedPlatform(platform: NodeJS.Platform = process.platform): boolean {
  return platform === "win32" || platform === "darwin";
}
