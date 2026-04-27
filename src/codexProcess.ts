import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd?: string;
}

export async function isCodexRunning(): Promise<boolean> {
  const processes = process.platform === "win32"
    ? await listWindowsProcesses()
    : await listUnixProcesses();
  return processes.some(isCodexProcess);
}

export function isCodexProcess(processInfo: ProcessInfo): boolean {
  if (processInfo.pid === process.pid) {
    return false;
  }

  const name = processInfo.name.toLowerCase();
  const cmd = (processInfo.cmd ?? "").toLowerCase();
  const text = `${name} ${cmd}`;

  if (text.includes("codex-discord-rich-presence") || text.includes("codex-discord-hook")) {
    return false;
  }

  if (name === "codex.exe" || name === "codex") {
    return !cmd.includes("--type=");
  }

  if (name === "node.exe" || name === "node") {
    return cmd.includes("@openai/codex") || cmd.includes("@openai\\codex");
  }

  return text.includes("openai.codex") && !cmd.includes("--type=");
}

async function listWindowsProcesses(): Promise<ProcessInfo[]> {
  const script = [
    "Get-CimInstance Win32_Process",
    "Select-Object ProcessId,Name,CommandLine",
    "ConvertTo-Json -Compress"
  ].join(" | ");

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], { maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return parseWindowsProcesses(stdout);
  } catch {
    return [];
  }
}

function parseWindowsProcesses(stdout: string): ProcessInfo[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  const parsed = JSON.parse(trimmed) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.flatMap((row) => {
    if (!isWindowsProcessRow(row)) {
      return [];
    }
    return [{
      pid: row.ProcessId,
      name: row.Name,
      cmd: row.CommandLine ?? undefined
    }];
  });
}

function isWindowsProcessRow(value: unknown): value is {
  ProcessId: number;
  Name: string;
  CommandLine?: string | null;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.ProcessId === "number" && typeof row.Name === "string";
}

async function listUnixProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execFileAsync("ps", ["-e", "-o", "pid=,comm=,args="]);
    return stdout.trim().split("\n").flatMap((line) => {
      const match = /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line);
      if (!match) {
        return [];
      }
      return [{ pid: Number(match[1]), name: match[2], cmd: match[3] }];
    });
  } catch {
    return [];
  }
}
