import psList from "ps-list";
import { Client } from "@xhayper/discord-rpc";
import type { SetActivity } from "@xhayper/discord-rpc";
import type { RuntimeConfig } from "./env.js";
import { logLine } from "./log.js";

const DISCORD_PROCESS_NAMES = new Set([
  "Discord.exe",
  "DiscordCanary.exe",
  "DiscordPTB.exe",
  "Discord",
  "Discord Canary",
  "Discord PTB"
]);

export async function isDiscordRunning(): Promise<boolean> {
  try {
    const processes = await psList();
    return processes.some((processInfo) => DISCORD_PROCESS_NAMES.has(processInfo.name));
  } catch {
    return false;
  }
}

export class DiscordPresenceClient {
  private client?: Client;
  private connected = false;

  constructor(private readonly config: RuntimeConfig) {}

  async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }
    if (!(await isDiscordRunning())) {
      return false;
    }

    const client = new Client({ clientId: this.config.clientId });
    this.client = client;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Discord RPC login timed out")), 5_000);
      client.once("ready", () => {
        clearTimeout(timeout);
        this.connected = true;
        logLine("discord rpc ready");
        resolve();
      });
      client.once("error", (error: unknown) => {
        clearTimeout(timeout);
        logLine(`discord rpc error: ${errorMessage(error)}`);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
      client.login().catch((error: unknown) => {
        clearTimeout(timeout);
        logLine(`discord rpc login failed: ${errorMessage(error)}`);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    return true;
  }

  async setActivity(activity: SetActivity): Promise<boolean> {
    if (!(await this.connect())) {
      logLine("discord process not detected; activity skipped");
      return false;
    }
    await this.client?.user?.setActivity(activity);
    logLine(`activity set: ${activity.details} / ${activity.state ?? ""}`);
    return true;
  }

  async clearActivity(): Promise<void> {
    if (!this.connected) {
      return;
    }
    await this.client?.user?.clearActivity();
  }

  destroy(): void {
    try {
      void this.client?.destroy();
    } finally {
      this.connected = false;
      this.client = undefined;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
