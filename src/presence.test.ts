import { describe, expect, it } from "vitest";
import { toDiscordActivity } from "./presence.js";
import type { RuntimeConfig } from "./env.js";

const baseConfig: RuntimeConfig = {
  clientId: "1465420195911831593",
  privacy: "project",
  clearAfterMs: 30_000,
  largeImageKey: "codex",
  exitAfterNoCodexMs: 30_000
};

describe("presence privacy", () => {
  it("does not include prompt, command, transcript path, or full cwd", () => {
    const activity = toDiscordActivity({
      eventName: "PreToolUse",
      phase: "tool",
      sessionId: "session",
      turnId: "turn",
      projectName: "SecretProject",
      toolName: "Bash",
      model: "gpt-5.4",
      timestamp: 1_700_000_000_000
    }, baseConfig);

    const serialized = JSON.stringify(activity);
    expect(serialized).toContain("SecretProject");
    expect(serialized).toContain("Bash");
    expect(serialized).not.toContain("rm -rf");
    expect(serialized).not.toContain("C:\\Users\\mihir");
    expect(serialized).not.toContain("transcript");
  });

  it("hides project name in generic privacy mode", () => {
    const activity = toDiscordActivity({
      eventName: "UserPromptSubmit",
      phase: "running",
      projectName: "PrivateRepo",
      timestamp: 1
    }, { ...baseConfig, privacy: "generic" });

    expect(JSON.stringify(activity)).not.toContain("PrivateRepo");
    expect(activity.state).toContain("a project");
  });
});
