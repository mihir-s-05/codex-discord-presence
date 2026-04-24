#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { runDaemon } from "./daemon.js";
import { printDoctor, runDoctor } from "./doctor.js";
import { installUserHooks } from "./install.js";
import { normalizeHookPayload, parseHookPayload } from "./hookPayload.js";
import { sendDaemonRequest, sendPresenceUpdate } from "./ipc.js";
import { readRuntimeConfig } from "./env.js";
import { DiscordPresenceClient } from "./discord.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
  switch (command) {
    case "install": {
      const result = installUserHooks();
      await sendDaemonRequest({ type: "shutdown" }).catch(() => undefined);
      console.log(`Installed Codex Discord hooks:`);
      console.log(`  config: ${result.configPath}`);
      console.log(`  hooks:  ${result.hooksPath}`);
      console.log(`  command: ${result.hookCommand}`);
      console.log(`  daemon: restarted on next hook`);
      return;
    }
    case "hook": {
      await runHookCommand();
      return;
    }
    case "daemon": {
      await runDaemon();
      return;
    }
    case "doctor": {
      printDoctor(await runDoctor());
      return;
    }
    case "test-activity": {
      await runTestActivity();
      return;
    }
    case "test-idle": {
      await sendPresenceUpdate(normalizeHookPayload({
        hook_event_name: "Stop",
        cwd: process.cwd(),
        session_id: "manual-test"
      }), true);
      console.log("Sent Codex idle activity to Discord.");
      return;
    }
    case "restart-daemon": {
      await sendDaemonRequest({ type: "shutdown" }).catch(() => undefined);
      console.log("Daemon will restart on the next hook update.");
      return;
    }
    case "help":
    case "--help":
    case "-h": {
      printHelp();
      return;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 2;
  }
}

async function runHookCommand(): Promise<void> {
  try {
    const stdin = readFileSync(0, "utf8");
    const payload = parseHookPayload(stdin);
    const update = normalizeHookPayload(payload);
    await sendPresenceUpdate(update, true);
  } catch {
    // Hooks must fail open. Codex should never be blocked by Discord status.
  }
}

function printHelp(): void {
  console.log(`codex-discord <command>

Commands:
  install   Install user-wide Codex hooks
  hook      Receive one Codex hook payload on stdin
  daemon    Run the Discord Rich Presence daemon
  doctor    Check local setup
  test-activity  Show a direct Discord activity for 60 seconds
  test-idle  Send the Codex idle activity through the daemon
  restart-daemon  Stop the current daemon so the next hook starts a fresh one`);
}

async function runTestActivity(): Promise<void> {
  const config = readRuntimeConfig();
  const client = new DiscordPresenceClient(config);
  const sent = await client.setActivity({
    details: "Direct Discord test",
    state: "Project: manual test",
    largeImageKey: config.largeImageKey,
    largeImageText: "Codex",
    instance: false,
    startTimestamp: Math.floor(Date.now() / 1000)
  });
  if (!sent) {
    console.log("Discord was not detected or RPC could not connect.");
    return;
  }
  console.log("Discord activity set for 60 seconds. Check your Discord profile/activity area now.");
  await new Promise((resolve) => setTimeout(resolve, 60_000));
  await client.clearActivity();
  client.destroy();
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
