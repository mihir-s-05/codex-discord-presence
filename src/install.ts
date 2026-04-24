import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { codexHome } from "./env.js";
import { HOOK_COMMAND_SENTINEL, HOOK_STATUS_MESSAGE, SUPPORTED_HOOK_EVENTS, type SupportedHookEvent } from "./constants.js";

export interface InstallResult {
  configPath: string;
  hooksPath: string;
  hookCommand: string;
}

interface HooksFile {
  hooks?: Record<string, MatcherGroup[]>;
}

interface MatcherGroup {
  matcher?: string;
  hooks?: HookHandler[];
}

interface HookHandler {
  type: string;
  command?: string;
  timeout?: number;
  statusMessage?: string;
}

export function installUserHooks(): InstallResult {
  const home = codexHome();
  mkdirSync(home, { recursive: true });
  const configPath = join(home, "config.toml");
  const hooksPath = join(home, "hooks.json");
  const hookCommand = writeHookShim(home);

  writeFileSync(configPath, mergeCodexHooksFeature(readOptional(configPath)), "utf8");
  writeFileSync(hooksPath, `${JSON.stringify(mergeHooksJson(readOptional(hooksPath), hookCommand), null, 2)}\n`, "utf8");

  return { configPath, hooksPath, hookCommand };
}

export function mergeCodexHooksFeature(existing: string): string {
  const normalized = existing.replace(/\r\n/g, "\n");
  if (!normalized.trim()) {
    return "[features]\ncodex_hooks = true\n";
  }

  const lines = normalized.split("\n");
  const featuresStart = lines.findIndex((line) => /^\s*\[features]\s*$/.test(line));
  if (featuresStart === -1) {
    return ensureTrailingNewline(normalized) + "\n[features]\ncodex_hooks = true\n";
  }

  let sectionEnd = lines.length;
  for (let index = featuresStart + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+]\s*$/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }

  for (let index = featuresStart + 1; index < sectionEnd; index += 1) {
    if (/^\s*codex_hooks\s*=/.test(lines[index])) {
      lines[index] = "codex_hooks = true";
      return ensureTrailingNewline(lines.join("\n"));
    }
  }

  let insertAt = sectionEnd;
  while (insertAt > featuresStart + 1 && lines[insertAt - 1]?.trim() === "") {
    insertAt -= 1;
  }
  lines.splice(insertAt, 0, "codex_hooks = true");
  return ensureTrailingNewline(lines.join("\n"));
}

export function mergeHooksJson(existing: string, hookCommand: string): HooksFile {
  const parsed = parseHooksFile(existing);
  const hooks = parsed.hooks ?? {};

  for (const eventName of SUPPORTED_HOOK_EVENTS) {
    hooks[eventName] = mergeEventGroups(eventName, hooks[eventName] ?? [], hookCommand);
  }

  parsed.hooks = hooks;
  return parsed;
}

export function buildHookCommand(): string {
  return process.platform === "win32"
    ? join(codexHome(), windowsShimName())
    : `"${join(codexHome(), unixShimName())}"`;
}

function writeHookShim(home: string): string {
  const nodePath = process.execPath;
  const cliPath = process.argv[1];

  if (process.platform === "win32") {
    const shimPath = join(home, windowsShimName());
    writeFileSync(
      shimPath,
      [
        "@echo off",
        "setlocal",
        "set LOG=%TEMP%\\codex-discord-rich-presence.log",
        `"${nodePath}" "${cliPath}" hook --${HOOK_COMMAND_SENTINEL} >> "%LOG%" 2>&1`,
        "exit /b 0",
        ""
      ].join("\r\n"),
      "utf8"
    );
    return shimPath;
  }

  const shimPath = join(home, unixShimName());
  writeFileSync(
    shimPath,
    [
      "#!/bin/sh",
      'LOG="${TMPDIR:-/tmp}/codex-discord-rich-presence.log"',
      `"${nodePath}" "${cliPath}" hook --${HOOK_COMMAND_SENTINEL} >> "$LOG" 2>&1`,
      "exit 0",
      ""
    ].join("\n"),
    "utf8"
  );
  chmodSync(shimPath, 0o755);
  return `"${shimPath}"`;
}

function windowsShimName(): string {
  return "codex-discord-hook.cmd";
}

function unixShimName(): string {
  return "codex-discord-hook";
}

function mergeEventGroups(eventName: SupportedHookEvent, groups: MatcherGroup[], hookCommand: string): MatcherGroup[] {
  const matcher = matcherForEvent(eventName);
  const cleaned = groups
    .map((group) => ({
      ...group,
      hooks: (group.hooks ?? []).filter((hook) => !isOurHook(hook))
    }))
    .filter((group) => (group.hooks ?? []).length > 0);

  cleaned.push({
    ...(matcher ? { matcher } : {}),
    hooks: [
      {
        type: "command",
        command: hookCommand,
        timeout: 5,
        statusMessage: HOOK_STATUS_MESSAGE
      }
    ]
  });
  return cleaned;
}

function matcherForEvent(eventName: SupportedHookEvent): string | undefined {
  switch (eventName) {
    case "SessionStart":
      return "startup|resume";
    case "PreToolUse":
    case "PostToolUse":
    case "PermissionRequest":
      return "*";
    case "UserPromptSubmit":
    case "Stop":
      return undefined;
  }
}

function parseHooksFile(existing: string): HooksFile {
  if (!existing.trim()) {
    return { hooks: {} };
  }
  try {
    const parsed = JSON.parse(existing) as HooksFile;
    if (!parsed || typeof parsed !== "object") {
      return { hooks: {} };
    }
    return parsed;
  } catch {
    const backupPath = join(codexHome(), `hooks.invalid-${Date.now()}.json`);
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, existing, "utf8");
    return { hooks: {} };
  }
}

function isOurHook(hook: HookHandler): boolean {
  return typeof hook.command === "string" && hook.command.includes(HOOK_COMMAND_SENTINEL);
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
