import { readRuntimeConfig } from "./env.js";
import { createIpcServer, type DaemonRequest, type DaemonResponse } from "./ipc.js";
import { DiscordPresenceClient } from "./discord.js";
import { toDiscordActivity } from "./presence.js";
import { logLine } from "./log.js";
import { currentBuildId } from "./buildId.js";
import { isCodexRunning } from "./codexProcess.js";

export async function runDaemon(): Promise<void> {
  const config = readRuntimeConfig();
  const discord = new DiscordPresenceClient(config);
  const daemonBuildId = currentBuildId();
  let clearTimer: NodeJS.Timeout | undefined;
  let watchdogTimer: NodeJS.Timeout | undefined;
  let activeRunStartedAt: number | undefined;
  let lastCodexSeenAt = Date.now();
  let shuttingDown = false;
  logLine("daemon starting");

  const server = createIpcServer(async (request: DaemonRequest): Promise<DaemonResponse> => {
    if (request.type === "ping") {
      return { ok: true };
    }
    if (request.type === "shutdown") {
      setTimeout(shutdown, 10);
      return { ok: true };
    }
    if (request.type !== "presence") {
      return { ok: false, message: "Unsupported request" };
    }
    if (!request.update) {
      return { ok: false, message: "Missing presence update" };
    }
    lastCodexSeenAt = Date.now();
    if (request.buildId && request.buildId !== daemonBuildId) {
      logLine("daemon build changed; restarting");
      setTimeout(() => void shutdown(), 10);
      return { ok: false, restart: true, message: "daemon build changed; restarting" };
    }

    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = undefined;
    }

    const startTimestamp = updateRunTimer(request.update);
    const activity = toDiscordActivity(request.update, config, startTimestamp);
    void discord.setActivity(activity).catch((error: unknown) => {
      logLine(`activity update failed: ${error instanceof Error ? error.message : String(error)}`);
    });

    if (request.update.phase === "idle" && config.clearAfterMs > 0) {
      clearTimer = setTimeout(() => {
        void discord.clearActivity().catch(() => undefined);
      }, config.clearAfterMs);
    }

    return { ok: true, message: "activity update accepted" };
  });

  watchdogTimer = setInterval(() => {
    void stopWhenCodexIsGone();
  }, 10_000);
  watchdogTimer.unref();

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (clearTimer) {
      clearTimeout(clearTimer);
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
    }
    await discord.clearActivity().catch(() => undefined);
    await discord.destroy();
    server.close();
    logLine("daemon stopped");
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  async function stopWhenCodexIsGone(): Promise<void> {
    if (config.exitAfterNoCodexMs <= 0 || Date.now() - lastCodexSeenAt < config.exitAfterNoCodexMs) {
      return;
    }
    if (await isCodexRunning()) {
      lastCodexSeenAt = Date.now();
      return;
    }
    logLine("codex process not detected; clearing activity and stopping daemon");
    await shutdown();
  }

  function updateRunTimer(update: NonNullable<DaemonRequest["update"]>): number | undefined {
    if (update.phase === "idle") {
      activeRunStartedAt = undefined;
      return undefined;
    }
    if (update.eventName === "UserPromptSubmit" || activeRunStartedAt === undefined) {
      activeRunStartedAt = update.timestamp;
    }
    return activeRunStartedAt;
  }
}
