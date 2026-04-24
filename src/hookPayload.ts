import { basename } from "node:path";
import { SUPPORTED_HOOK_EVENTS, type SupportedHookEvent } from "./constants.js";

export interface HookPayload {
  session_id?: string;
  turn_id?: string;
  cwd?: string;
  hook_event_name?: string;
  model?: string;
  tool_name?: string;
}

export type PresencePhase =
  | "ready"
  | "running"
  | "tool"
  | "approval"
  | "idle";

export interface PresenceUpdate {
  eventName: SupportedHookEvent;
  phase: PresencePhase;
  sessionId?: string;
  turnId?: string;
  projectName?: string;
  toolName?: string;
  model?: string;
  timestamp: number;
}

export function parseHookPayload(input: string): HookPayload {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Hook payload must be a JSON object");
  }
  return parsed as HookPayload;
}

export function normalizeHookPayload(payload: HookPayload, now = Date.now()): PresenceUpdate {
  const eventName = normalizeEventName(payload.hook_event_name);
  return {
    eventName,
    phase: phaseForEvent(eventName),
    sessionId: stringOrUndefined(payload.session_id),
    turnId: stringOrUndefined(payload.turn_id),
    projectName: projectNameFromCwd(payload.cwd),
    toolName: sanitizeToolName(payload.tool_name),
    model: stringOrUndefined(payload.model),
    timestamp: now
  };
}

export function normalizeEventName(value: unknown): SupportedHookEvent {
  if (typeof value === "string" && SUPPORTED_HOOK_EVENTS.includes(value as SupportedHookEvent)) {
    return value as SupportedHookEvent;
  }
  return "SessionStart";
}

function phaseForEvent(eventName: SupportedHookEvent): PresencePhase {
  switch (eventName) {
    case "SessionStart":
      return "ready";
    case "UserPromptSubmit":
      return "running";
    case "PreToolUse":
    case "PostToolUse":
      return "tool";
    case "PermissionRequest":
      return "approval";
    case "Stop":
      return "idle";
  }
}

function projectNameFromCwd(cwd: unknown): string | undefined {
  if (typeof cwd !== "string" || cwd.trim() === "") {
    return undefined;
  }
  return basename(cwd);
}

function sanitizeToolName(toolName: unknown): string | undefined {
  if (typeof toolName !== "string" || toolName.trim() === "") {
    return undefined;
  }
  return toolName.replace(/[^\w .:-]/g, "").slice(0, 40);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
