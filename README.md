# Codex Discord Rich Presence

Shows what Codex is doing in Discord Rich Presence using Codex hooks.

It works with Codex CLI and the Codex app because it installs user-wide hooks in `~/.codex`.

## Install Or Reinstall

Reinstalling is the same as installing. Rerun the script for your platform.

### Windows

From this project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

### macOS

From this project folder:

```sh
sh ./scripts/install-macos.sh
```

After install, restart Codex and start a new Codex turn.

The installer also stops any old daemon. The next Codex hook starts a fresh daemon from the current build.

## Check Setup

```sh
node dist/cli.js doctor
```

To force a visible Discord activity test:

```sh
node dist/cli.js test-activity
```

To force the idle activity:

```sh
node dist/cli.js test-idle
```

To clear a stale activity immediately:

```sh
node dist/cli.js clear
```

## What It Shows

- Session start: `Ready` / `Project: your-project`
- Prompt submitted: `Thinking` / `Project: your-project`
- Before a tool runs: `Starting Bash` / `Project: your-project`
- After a tool runs: `Finished Bash` / `Project: your-project`
- Approval request: `Awaiting approval` / `Project: your-project`
- Turn stop: `Idle` / `Project: your-project`

Idle stays visible by default.

The elapsed timer starts when a Codex turn begins and stays the same across tool updates. It ends when Codex emits the `Stop` hook.

When Codex is no longer running, the daemon clears Discord activity and exits after a short grace period.

The hook process and daemon compare build IDs on every update. If the project has been rebuilt while an old daemon is still running, the old daemon exits and the hook starts a fresh one automatically.

## Privacy

The Discord activity does not include prompts, shell commands, transcript paths, or full file paths. By default it shows only the project folder name and a coarse Codex phase.

Set `CODEX_DISCORD_PRIVACY=generic` to hide the project folder name too.

## Project Structure

```text
.
├── src/                         TypeScript source for the CLI and daemon
│   ├── cli.ts                   Command entrypoint: install, doctor, daemon, hook, tests
│   ├── install.ts               Writes ~/.codex config, hooks.json, and hook shim
│   ├── daemon.ts                Long-running process that owns Discord RPC
│   ├── ipc.ts                   Local pipe/socket bridge between hooks and daemon
│   ├── buildId.ts               Detects rebuilt code so the daemon can restart itself
│   ├── discord.ts               Discord process detection and Rich Presence client
│   ├── hookPayload.ts           Converts Codex hook payloads into status updates
│   ├── presence.ts              Formats Discord activity text
│   └── *.test.ts                Unit tests
├── scripts/
│   ├── install-windows.ps1      One-command Windows install/reinstall
│   └── install-macos.sh         One-command macOS install/reinstall
├── dist/                        Compiled JavaScript created by npm run build
├── reference/openai-codex/      Shallow clone used only as implementation reference
├── package.json                 npm scripts, dependencies, and package metadata
├── README.md                    User documentation
└── LICENSE                      MIT license
```

Runtime flow:

1. Codex fires a hook such as `PreToolUse`, `PostToolUse`, or `Stop`.
2. The hook runs `~/.codex/codex-discord-hook.cmd` on Windows or `~/.codex/codex-discord-hook` on macOS.
3. The shim calls `node dist/cli.js hook`.
4. The hook command sends a small status update to the daemon over a local pipe/socket.
5. The daemon updates Discord Rich Presence through Discord RPC.

## Configuration

- `CODEX_DISCORD_CLIENT_ID`: defaults to `1465420195911831593`
- `CODEX_DISCORD_PRIVACY`: `project` or `generic`, defaults to `project`
- `CODEX_DISCORD_CLEAR_AFTER_MS`: defaults to `0`, which keeps idle visible
- `CODEX_DISCORD_LARGE_IMAGE_KEY`: defaults to `codex`
- `CODEX_DISCORD_EXIT_AFTER_NO_CODEX_MS`: defaults to `30000`; set to `0` to keep the daemon alive even after Codex exits

## Troubleshooting

- Make sure Discord is open.
- In Discord, enable activity status.
- Run `node dist/cli.js doctor`.
- If Discord is still showing an old activity after Codex exits, run `node dist/cli.js clear`.
- If you changed code and want to force a daemon restart, run `node dist/cli.js restart-daemon`.
- If hooks fail on Windows, rerun `scripts/install-windows.ps1`; it creates `~/.codex/codex-discord-hook.cmd`, which avoids PowerShell quoting problems.
- Log file: `%TEMP%\codex-discord-rich-presence.log` on Windows, `/tmp/codex-discord-rich-presence.log` on macOS.
