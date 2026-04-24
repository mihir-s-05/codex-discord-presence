import type { RuntimeConfig } from "./env.js";
import type { PresenceUpdate } from "./hookPayload.js";
import type { SetActivity } from "@xhayper/discord-rpc";

export function toDiscordActivity(update: PresenceUpdate, config: RuntimeConfig, startTimestampMs?: number): SetActivity {
  const activity: SetActivity = {
    details: actionText(update),
    state: projectText(update, config),
    largeImageKey: config.largeImageKey,
    largeImageText: "Codex",
    instance: false
  };
  if (startTimestampMs !== undefined) {
    activity.startTimestamp = Math.floor(startTimestampMs / 1000);
  }
  return activity;
}

export function actionText(update: PresenceUpdate): string {
  const tool = update.toolName || "tool";
  switch (update.phase) {
    case "ready":
      return "Ready";
    case "running":
      return "Thinking";
    case "tool":
      return update.eventName === "PostToolUse" ? `Finished ${tool}` : `Starting ${tool}`;
    case "approval":
      return "Awaiting approval";
    case "idle":
      return "Idle";
  }
}

export function projectText(update: PresenceUpdate, config: RuntimeConfig): string {
  const project = config.privacy === "generic" ? "a project" : update.projectName || "a project";
  return `Project: ${project}`;
}
