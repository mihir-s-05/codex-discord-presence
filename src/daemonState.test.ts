import { describe, expect, it } from "vitest";
import { toDiscordActivity } from "./presence.js";
import type { RuntimeConfig } from "./env.js";
import type { PresenceUpdate } from "./hookPayload.js";

const config: RuntimeConfig = {
  clientId: "1465420195911831593",
  privacy: "project",
  clearAfterMs: 0,
  largeImageKey: "codex",
  exitAfterNoCodexMs: 30_000
};

describe("daemon presence states", () => {
  it.each([
    ["ready", "SessionStart", "Ready"],
    ["running", "UserPromptSubmit", "Thinking"],
    ["tool", "PreToolUse", "Starting Bash"],
    ["tool", "PostToolUse", "Finished Bash"],
    ["approval", "PermissionRequest", "Awaiting approval"],
    ["idle", "Stop", "Idle"]
  ] as const)("maps %s/%s to Discord activity", (phase, eventName, details) => {
    const update: PresenceUpdate = {
      eventName,
      phase,
      projectName: "Repo",
      toolName: "Bash",
      timestamp: 1_700_000_000_000
    };

    const activity = toDiscordActivity(update, config);
    expect(activity.details).toBe(details);
    expect(activity.state).toBe("Project: Repo");
  });

  it("uses the supplied run start timestamp instead of each hook timestamp", () => {
    const activity = toDiscordActivity({
      eventName: "PreToolUse",
      phase: "tool",
      projectName: "Repo",
      toolName: "Bash",
      timestamp: 2_000
    }, config, 1_000);

    expect(activity.startTimestamp).toBe(1);
  });

  it("omits timer for idle", () => {
    const activity = toDiscordActivity({
      eventName: "Stop",
      phase: "idle",
      projectName: "Repo",
      timestamp: 2_000
    }, config);

    expect(activity.startTimestamp).toBeUndefined();
  });
});
