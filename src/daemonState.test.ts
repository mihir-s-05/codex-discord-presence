import { describe, expect, it } from "vitest";
import { PresenceSessions } from "./presenceSessions.js";
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
    ["compacting", "PreCompact", "Compacting context"],
    ["compacting", "PostCompact", "Compacted context"],
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

  it("uses the supplied Codex start timestamp instead of each hook timestamp", () => {
    const activity = toDiscordActivity({
      eventName: "PreToolUse",
      phase: "tool",
      projectName: "Repo",
      toolName: "Bash",
      timestamp: 2_000
    }, config, 1_000);

    expect(activity.startTimestamp).toBe(1);
  });

  it("keeps the timer visible for idle", () => {
    const activity = toDiscordActivity({
      eventName: "Stop",
      phase: "idle",
      projectName: "Repo",
      timestamp: 2_000
    }, config, 1_000);

    expect(activity.startTimestamp).toBe(1);
  });

  it("tracks Codex session start across turns and idle updates", () => {
    const sessions = new PresenceSessions();
    const sessionStart = sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session",
      timestamp: 1_000
    }).startedAt;
    const promptStart = sessions.update({
      eventName: "UserPromptSubmit",
      phase: "running",
      sessionId: "session",
      timestamp: 2_000
    }).startedAt;
    const idle = sessions.update({
      eventName: "Stop",
      phase: "idle",
      sessionId: "session",
      timestamp: 3_000
    }).startedAt;
    const nextPrompt = sessions.update({
      eventName: "UserPromptSubmit",
      phase: "running",
      sessionId: "session",
      timestamp: 4_000
    }).startedAt;

    expect([sessionStart, promptStart, idle, nextPrompt]).toEqual([1_000, 1_000, 1_000, 1_000]);
  });

  it("falls back to the first hook timestamp when SessionStart was missed", () => {
    const sessions = new PresenceSessions();
    const firstSeen = sessions.update({
      eventName: "PreToolUse",
      phase: "tool",
      sessionId: "session",
      timestamp: 2_000
    }).startedAt;
    const later = sessions.update({
      eventName: "PostToolUse",
      phase: "tool",
      sessionId: "session",
      timestamp: 3_000
    }).startedAt;

    expect([firstSeen, later]).toEqual([2_000, 2_000]);
  });

  it("displays the newest active session when multiple Codex sessions are running", () => {
    const sessions = new PresenceSessions();
    sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session-a",
      projectName: "RepoA",
      timestamp: 1_000
    });
    const selected = sessions.update({
      eventName: "UserPromptSubmit",
      phase: "running",
      sessionId: "session-b",
      projectName: "RepoB",
      timestamp: 2_000
    });

    expect(selected.update.projectName).toBe("RepoB");
    expect(selected.startedAt).toBe(2_000);
  });

  it("does not let an idle session replace another active session", () => {
    const sessions = new PresenceSessions();
    sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session-a",
      projectName: "RepoA",
      timestamp: 1_000
    });
    sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session-b",
      projectName: "RepoB",
      timestamp: 2_000
    });
    const selected = sessions.update({
      eventName: "Stop",
      phase: "idle",
      sessionId: "session-b",
      projectName: "RepoB",
      timestamp: 3_000
    });

    expect(selected.update.projectName).toBe("RepoA");
    expect(selected.update.phase).toBe("ready");
    expect(sessions.displayedPhase()).toBe("ready");
  });

  it("keeps a separate timer per Codex session", () => {
    const sessions = new PresenceSessions();
    sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session-a",
      projectName: "RepoA",
      timestamp: 1_000
    });
    sessions.update({
      eventName: "SessionStart",
      phase: "ready",
      sessionId: "session-b",
      projectName: "RepoB",
      timestamp: 5_000
    });
    sessions.update({
      eventName: "UserPromptSubmit",
      phase: "running",
      sessionId: "session-b",
      projectName: "RepoB",
      timestamp: 6_000
    });
    const selected = sessions.update({
      eventName: "PreToolUse",
      phase: "tool",
      sessionId: "session-a",
      projectName: "RepoA",
      toolName: "Bash",
      timestamp: 7_000
    });

    expect(selected.update.projectName).toBe("RepoA");
    expect(selected.startedAt).toBe(1_000);
  });
});
