# Codex Discord Rich Presence

Show what Codex is doing in your Discord activity.

This adds Discord Rich Presence for Codex CLI and the Codex app. It shows a simple status like `Thinking`, `Starting Bash`, or `Idle`, plus the project folder name. It does not show prompts, shell commands, transcript paths, or full file paths.

## Install

Clone or download this project, then run the installer for your platform from the project folder.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

macOS:

```sh
sh ./scripts/install-macos.sh
```

Restart Codex after installing. The next Codex activity should update Discord automatically.

If Codex asks you to trust the new hooks, approve the `codex-discord` hooks before expecting Discord updates.

## What You Will See

- `Ready` when a Codex session starts
- `Thinking` after you send a prompt
- `Starting Bash` or `Finished Bash` around tool use
- `Compacting context` during compaction
- `Awaiting approval` when Codex needs permission
- `Idle` when a turn finishes

If you have more than one Codex thread running, Discord shows the most recently active non-idle thread. An idle update from one thread will not clear another active thread.

The elapsed timer starts when that Codex session starts and stays consistent across tool calls.

## Commands

Check your setup:

```sh
node dist/cli.js doctor
```

Show a direct Discord test activity:

```sh
node dist/cli.js test-activity
```

Clear Discord activity and stop the daemon:

```sh
node dist/cli.js clear
```

Restart the daemon after rebuilding:

```sh
node dist/cli.js restart-daemon
```

## Privacy

By default, Discord sees only:

- A broad Codex status
- The project folder name
- The elapsed session timer

To hide the project folder name too, set:

```sh
CODEX_DISCORD_PRIVACY=generic
```

## Configuration

Optional environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `CODEX_DISCORD_PRIVACY` | `project` | Use `generic` to hide project names. |
| `CODEX_DISCORD_CLEAR_AFTER_MS` | `0` | How long to wait before clearing idle activity. `0` keeps idle visible. |
| `CODEX_DISCORD_EXIT_AFTER_NO_CODEX_MS` | `30000` | How long the daemon stays alive after Codex exits. |
| `CODEX_DISCORD_CLIENT_ID` | bundled app ID | Use a custom Discord application. |
| `CODEX_DISCORD_LARGE_IMAGE_KEY` | `codex` | Discord asset key for the large image. |

## Troubleshooting

Make sure Discord is open and activity status is enabled in Discord settings.

Run:

```sh
node dist/cli.js doctor
```

If Discord still shows stale activity:

```sh
node dist/cli.js clear
```

If you rebuilt the project and want Codex to use the newest version:

```sh
node dist/cli.js restart-daemon
```

Logs are written to:

- Windows: `%TEMP%\codex-discord-rich-presence.log`
- macOS: `/tmp/codex-discord-rich-presence.log`

## Development

Build and test:

```sh
npm run check
```

Re-run the installer after changing hook installation behavior. For normal code changes, rebuilding and running `restart-daemon` is enough.

## License

MIT
