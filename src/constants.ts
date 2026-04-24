export const DEFAULT_CLIENT_ID = "1465420195911831593";
export const DEFAULT_LARGE_IMAGE_KEY = "codex";
export const DEFAULT_CLEAR_AFTER_MS = 0;
export const HOOK_STATUS_MESSAGE = "Updating Discord status";
export const HOOK_COMMAND_SENTINEL = "codex-discord";

export const SUPPORTED_HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "Stop"
] as const;

export type SupportedHookEvent = (typeof SUPPORTED_HOOK_EVENTS)[number];
