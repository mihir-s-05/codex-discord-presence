import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD_FILES = [
  "cli.js",
  "daemon.js",
  "discord.js",
  "hookPayload.js",
  "ipc.js",
  "presence.js"
];

export function currentBuildId(): string {
  const distDir = dirname(fileURLToPath(import.meta.url));
  return BUILD_FILES.map((file) => {
    const stat = statSync(join(distDir, file));
    return `${file}:${stat.mtimeMs}:${stat.size}`;
  }).join("|");
}
