import { describe, expect, it } from "vitest";
import { isCodexProcess } from "./codexProcess.js";

describe("Codex process detection", () => {
  it("detects the Codex app main process", () => {
    expect(isCodexProcess({
      pid: 10,
      name: "Codex.exe",
      cmd: "\"C:\\Program Files\\WindowsApps\\OpenAI.Codex\\app\\Codex.exe\""
    })).toBe(true);
  });

  it("ignores Electron helper processes", () => {
    expect(isCodexProcess({
      pid: 11,
      name: "Codex.exe",
      cmd: "Codex.exe --type=crashpad-handler --user-data-dir=C:\\Users\\mihir\\AppData\\Roaming\\Codex"
    })).toBe(false);
  });

  it("detects Codex CLI launched through node", () => {
    expect(isCodexProcess({
      pid: 12,
      name: "node.exe",
      cmd: "node C:\\Users\\mihir\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"
    })).toBe(true);
  });

  it("ignores this extension and hook shims", () => {
    expect(isCodexProcess({
      pid: 13,
      name: "node.exe",
      cmd: "node C:\\repo\\codex-discord-rich-presence\\dist\\cli.js daemon"
    })).toBe(false);
    expect(isCodexProcess({
      pid: 14,
      name: "pwsh.exe",
      cmd: "C:\\Users\\mihir\\.codex\\codex-discord-hook.cmd"
    })).toBe(false);
  });
});
