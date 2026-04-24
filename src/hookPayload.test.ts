import { describe, expect, it } from "vitest";
import { normalizeHookPayload, parseHookPayload } from "./hookPayload.js";

describe("hook payload parsing", () => {
  it.each([
    ["SessionStart", "ready"],
    ["UserPromptSubmit", "running"],
    ["PreToolUse", "tool"],
    ["PostToolUse", "tool"],
    ["PermissionRequest", "approval"],
    ["Stop", "idle"]
  ])("maps %s to %s", (eventName, phase) => {
    const update = normalizeHookPayload({
      hook_event_name: eventName,
      cwd: "C:\\Users\\mihir\\project",
      tool_name: "Bash"
    }, 123);

    expect(update.eventName).toBe(eventName);
    expect(update.phase).toBe(phase);
    expect(update.projectName).toBe("project");
    expect(update.toolName).toBe("Bash");
    expect(update.timestamp).toBe(123);
  });

  it("parses JSON object payloads", () => {
    expect(parseHookPayload('{"hook_event_name":"Stop"}')).toEqual({ hook_event_name: "Stop" });
  });

  it("rejects non-object JSON", () => {
    expect(() => parseHookPayload('"nope"')).toThrow("Hook payload must be a JSON object");
  });
});
