import { describe, expect, it, vi } from "vitest";
import { mergeCodexHooksFeature, mergeHooksJson } from "./install.js";

describe("config installer", () => {
  it("adds a features section when config is empty", () => {
    expect(mergeCodexHooksFeature("")).toBe("[features]\ncodex_hooks = true\n");
  });

  it("preserves config and inserts codex_hooks into existing features", () => {
    const result = mergeCodexHooksFeature('model = "gpt-5.4"\n\n[features]\nvoice = true\n\n[notice]\nseen = true\n');
    expect(result).toContain('model = "gpt-5.4"');
    expect(result).toContain("[features]\nvoice = true\ncodex_hooks = true\n\n[notice]");
  });

  it("updates codex_hooks when it already exists", () => {
    expect(mergeCodexHooksFeature("[features]\ncodex_hooks = false\n")).toBe("[features]\ncodex_hooks = true\n");
  });

  it("merges hooks without dropping unrelated handlers", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const merged = mergeHooksJson(JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              { type: "command", command: "echo keep" },
              { type: "command", command: "node cli.js hook --codex-discord" }
            ]
          }
        ]
      }
    }), "node cli.js hook --codex-discord");

    expect(merged.hooks?.Stop).toHaveLength(2);
    expect(JSON.stringify(merged.hooks?.Stop)).toContain("echo keep");
    expect(JSON.stringify(merged.hooks?.Stop)).toContain("node cli.js hook --codex-discord");
    expect(JSON.stringify(merged.hooks?.SessionStart)).toContain("startup|resume");
  });
});
