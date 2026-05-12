# PMMPCore - ScoreHud Documentation

Language: **English** | [Español](SCOREHUD_DOCUMENTATION.es.md)

## 1. Purpose

ScoreHud shows a **sidebar scoreboard** with lines resolved through **PlaceholderAPI** (same `%identifier_key%` syntax as other PMMPCore plugins). It is inspired by the PocketMine-MP **ScoreHud** ecosystem (for example [ScoreHud / ScoreHub-Original](https://github.com/Ifera/ScoreHud)), adapted to Bedrock Script API constraints.

## 1.1 Bedrock limitations (important)

- The **sidebar display slot is global** for the world: every player sees the **same** objective and the same lines. This is a platform limitation, not a pack bug.
- **`%player_*%` placeholders** are parsed using a **single context player**: the first online player (by name) who has not turned the HUD off. Prefer **`%server_*%`**, **`%time_*%`**, and **`%general_*%`** in default templates for predictable results with multiple players.
- Toggling the HUD saves a **per-player preference** in KV; when **no** online player wants the HUD, the plugin clears the sidebar slot. While any player keeps it on, the sidebar remains visible to everyone.

## 2. Lifecycle

- `onEnable`: creates `ScoreHudService`, registers migration **v1**, exposes `runtime` (`hasPermissionNode`, `onReloaded`).
- `onStartup`: registers `pmmpcore:scorehud` and `pmmpcore:scorehudreload`.
- `onWorldReady`: runs migrations, `initialize()`, starts the refresh interval, subscribes to `playerLeave` for a refresh tick, emits `scorehud.ready`.
- `onDisable`: clears interval and subscription, `shutdownCleanup()` (clears sidebar slot and removes the plugin objective), DB flush.

## 3. Commands

| Command | Permission | Description |
|---------|------------|-------------|
| `/pmmpcore:scorehud` (alias `/scorehud`) | `scorehud.use` | Toggle stored preference (enabled/disabled). |
| `/pmmpcore:scorehudreload` (alias `/scorehudreload`) | `scorehud.admin.reload` | Reload merged config from `plugin:ScoreHud` and restart the tick interval. |

## 4. Configuration

Stored under **`plugin:ScoreHud`** (`meta`, `config`). Defaults are defined in [`scripts/plugins/ScoreHud/config.js`](../../scripts/plugins/ScoreHud/config.js) and merged on read.

Relevant fields:

| Field | Description |
|-------|-------------|
| `enabled` | Master switch; when `false`, sidebar is cleared. |
| `updateIntervalTicks` | Ticks between refreshes (minimum 1). |
| `objectiveId` | Scoreboard objective id (alphanumeric + underscore, lowercased, max 32 chars). |
| `title` | Objective display title (sidebar header). |
| `maxLineLength` | Truncate each line (8–128). |
| `maxLines` | Max template lines (1–15). |
| `lines` | Array of strings with placeholders. |
| `messaging.prefix` | Prefix for chat feedback. |

## 5. Permissions

- `scorehud.use` — use `/scorehud` toggle.
- `scorehud.admin.reload` — use `/scorehudreload`.

## 6. Events

- `scorehud.ready` — payload `{ provider: "ScoreHud" }` after the interval and listeners are active.

## 7. Integrations

- **PlaceholderAPI** (soft dependency): if absent, `%...%` tokens are stripped from lines.
- **PurePerms** (soft dependency): optional permission checks via `PermissionService`.

## 8. Manual test checklist

1. Load world with PMMPCore + PlaceholderAPI + ScoreHud; confirm sidebar shows default lines and updates.
2. Run `/scorehud` twice; confirm message and that when all players disable, sidebar clears (with multiple clients if possible).
3. Run `/scorehudreload` with permission; change `lines` in DB or defaults and confirm refresh.
4. Disable PlaceholderAPI pack (if modular) or block load order; confirm lines still render without crashing (tokens stripped).
