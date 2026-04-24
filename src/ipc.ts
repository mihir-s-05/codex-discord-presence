import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ipcPath } from "./env.js";
import type { PresenceUpdate } from "./hookPayload.js";
import { currentBuildId } from "./buildId.js";

export interface DaemonRequest {
  type: "presence" | "ping" | "shutdown";
  buildId?: string;
  update?: PresenceUpdate;
}

export interface DaemonResponse {
  ok: boolean;
  message?: string;
  restart?: boolean;
}

export async function sendPresenceUpdate(update: PresenceUpdate, startDaemon = true): Promise<DaemonResponse> {
  let result = await sendOnce(presenceRequest(update));
  if (result.ok || !startDaemon) {
    return result;
  }
  if (result.restart) {
    await delay(250);
  }

  spawnDaemon();
  const deadline = Date.now() + 1_500;
  while (Date.now() < deadline) {
    await delay(100);
    result = await sendOnce(presenceRequest(update));
    if (result.ok) {
      return result;
    }
  }
  return { ok: false, message: "daemon unavailable" };
}

export function sendDaemonRequest(request: DaemonRequest): Promise<DaemonResponse> {
  return sendOnce(request);
}

function presenceRequest(update: PresenceUpdate): DaemonRequest {
  return { type: "presence", buildId: currentBuildId(), update };
}

export function spawnDaemon(): void {
  const cliPath = join(dirname(fileURLToPath(import.meta.url)), "cli.js");
  const child = spawn(process.execPath, [cliPath, "daemon"], {
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
}

export function createIpcServer(handler: (request: DaemonRequest) => Promise<DaemonResponse>): net.Server {
  const path = ipcPath();
  if (process.platform !== "win32" && existsSync(path)) {
    rmSync(path, { force: true });
  }

  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (!buffer.includes("\n")) {
        return;
      }
      const [line] = buffer.split("\n", 1);
      void handleLine(line, handler, socket);
    });
  });
  server.listen(path);
  return server;
}

async function handleLine(
  line: string,
  handler: (request: DaemonRequest) => Promise<DaemonResponse>,
  socket: net.Socket
): Promise<void> {
  try {
    const request = JSON.parse(line) as DaemonRequest;
    const response = await handler(request);
    socket.end(`${JSON.stringify(response)}\n`);
  } catch (error) {
    socket.end(`${JSON.stringify({ ok: false, message: errorMessage(error) })}\n`);
  }
}

function sendOnce(request: DaemonRequest): Promise<DaemonResponse> {
  return new Promise((resolve) => {
    const socket = net.createConnection(ipcPath());
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, message: "IPC timeout" });
    }, 750);
    let response = "";

    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, message: error.message });
    });
    socket.on("end", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(response.trim()) as DaemonResponse);
      } catch {
        resolve({ ok: false, message: "Invalid daemon response" });
      }
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
