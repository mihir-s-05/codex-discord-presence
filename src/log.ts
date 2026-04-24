import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function logPath(): string {
  return join(tmpdir(), "codex-discord-rich-presence.log");
}

export function logLine(message: string): void {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    appendFileSync(logPath(), `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // Logging must never affect hooks.
  }
}
