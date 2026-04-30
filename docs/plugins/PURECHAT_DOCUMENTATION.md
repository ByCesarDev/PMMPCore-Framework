# PMMPCore - PureChat Documentation

Language: **English** | [Español](PURECHAT_DOCUMENTATION.es.md)

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Installation and quick verification](#2-installation)
3. [How to test PureChat (checklist)](#3-how-to-test-purechat-checklist)
4. [Commands (`/pchat`) with examples](#4-commands)
5. [Permissions (and how to assign with PurePerms)](#5-permissions)
6. [Data model and configuration (property-by-property)](#6-configuration-model)
7. [Placeholders](#7-placeholders)
8. [Color rules and sanitization](#8-color-codes)
9. [Lifecycle behavior](#9-lifecycle-behavior)
10. [Troubleshooting (symptom-driven)](#10-troubleshooting)
11. [FAQ](#11-faq)

## 1. Purpose and Scope

PureChat is PMMPCore's chat formatting plugin. It provides:

- Group-based chat formats and nametags.
- Optional per-world overrides.
- Per-player prefix and suffix.
- Optional faction placeholders via adapter.
- Colorized message content gated by permission.

## 2. Installation

1. Ensure folder exists at `scripts/plugins/PureChat/`.
2. Ensure plugin loader imports `./plugins/PureChat/main.js`.
3. Restart world and verify load logs.
4. Run command smoke tests:
   - `/pchat preview`
   - `/pchat setprefix <player> <prefix>`

## 3. How to test PureChat (checklist)

### 3.1 Confirm plugin is ready

Run:

```text
/pchat preview
```

Expected:

- It prints your resolved group and templates.
- If PurePerms is healthy, the effective group should match your rank (e.g. `OP`).

### 3.2 Confirm PurePerms group resolution

Run:

```text
/usrinfo YourName
```

Expected:

- `Group:` should be your effective group (e.g. `OP`).

### 3.3 Confirm chat interception

1. Type “hello” in chat.
2. Expected: message uses PureChat format (not vanilla).

### 3.4 Test per-player prefix/suffix

VIP prefix:

```text
/pchat setprefix YourName &6[VIP]BLANK
```

Clear prefix:

```text
/pchat setprefix YourName BLANK
```

### 3.5 Test message color gating

1. Without `pchat.coloredMessages`: type `&cHello`
2. Expected: color code stripped.
3. With `pchat.coloredMessages`: color should be preserved.

### 3.6 Test per-world overrides (optional)

Enable multiworld chat overrides (see section 6), then set a world-specific format and confirm it changes when you switch worlds.

## 4. Commands

Use PureChat commands with this base form:

- `/pchat <subcommand> ...`

Compatibility note:

- In some runtimes, the namespaced variant may also work: `/pchat <subcommand> ...`
- Legacy one-command shortcuts (`/setprefix`, etc.) are not guaranteed in all runtimes.

### Root subcommands

- `setprefix <player> <prefix>`
- `setsuffix <player> <suffix>`
- `setformat <group> <world|global> <format>`
- `setnametag <group> <world|global> <format>`
- `preview`

Tip: use `BLANK` (without braces) in prefix/suffix to represent a single space.
Note: some Bedrock command parsers reject `{` `}`; PureChat accepts both `BLANK` and `{BLANK}` when supported.

### 4.1 Copy-paste examples

- Set global Guest chat format:

```text
/pchat setformat Guest global &e[Guest]{BLANK}&f{display_name}{BLANK}&7>{BLANK}{msg}
```

- Set global OP nametag:

```text
/pchat setnametag OP global &9[OP]{BLANK}&f{display_name}
```

- Use modern root command:

```text
/pchat setprefix YourName &6[VIP]BLANK
```

## 5. Permissions

- `pchat`
- `pchat.coloredMessages`
- `pchat.command`
- `pchat.command.setprefix`
- `pchat.command.setsuffix`
- `pchat.command.setnametag`
- `pchat.command.setformat`

### 5.1 Assigning nodes with PurePerms (recommended)

Examples:

- Grant PureChat admin commands to `OP`:

```text
/setgperm OP pchat.command.setprefix
/setgperm OP pchat.command.setsuffix
/setgperm OP pchat.command.setformat
/setgperm OP pchat.command.setnametag
```

- Allow colored messages for a group (e.g. `Guest`):

```text
/setgperm Guest pchat.coloredMessages
```

If `OP` has `*`, you usually do not need individual nodes.

## 6. Configuration model

PureChat stores plugin data in `plugin:PureChat` with this logical structure:

- `enableMultiworldChat` (`boolean`)
- `groups.<Group>.chat` (`string`)
- `groups.<Group>.nametag` (`string`)
- `groups.<Group>.worlds.<world>.chat` (`string`, optional override)
- `groups.<Group>.worlds.<world>.nametag` (`string`, optional override)
- `players.<Player>.prefix` (`string`)
- `players.<Player>.suffix` (`string`)

Default group templates are seeded for:

- `Guest`
- `Admin`
- `Owner`
- `OP`

### 6.1 Key properties (what they do)

- `enableMultiworldChat`:
  - `false`: always use `groups.<Group>.chat/nametag`.
  - `true`: if a world override exists, use `groups.<Group>.worlds.<world>.*`.

- `groups.<Group>.chat`:
  - chat format template for that group.

- `groups.<Group>.nametag`:
  - nametag template for that group.

- `players.<Player>.prefix` / `players.<Player>.suffix`:
  - per-player extra tags (VIP, special tags, etc.).

### 6.2 Important: `{display_name}` vs `{nametag}`

- `{display_name}` is the raw player name (no rank/prefix formatting), to avoid duplicate rank tags.
- `{nametag}` is the current NameTag (may contain formatting).

## 7. Placeholders

Supported placeholders:

- `{display_name}`
- `{nametag}`
- `{msg}`
- `{prefix}`
- `{suffix}`
- `{world}`
- `{fac_name}` (optional adapter)
- `{fac_rank}` (optional adapter)

If faction adapter data is unavailable, faction placeholders resolve to empty strings.

### 7.1 External PlaceholderAPI tokens (`%...%`)

PureChat also supports PlaceholderAPI tokens after internal placeholder resolution.

Resolution order:

1. PureChat internal placeholders (`{msg}`, `{display_name}`, etc.).
2. PlaceholderAPI tokens (`%player_name%`, `%time_current%`, etc.).

Example:

```text
/pchat setformat OP global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

## 8. Color Codes

PureChat supports classic `&` formatting codes in templates and user messages:

- Colors: `&0`..`&f`
- Styles: `&k`, `&l`, `&m`, `&n`, `&o`, `&r`

Message body colorization is only kept if sender has `pchat.coloredMessages`.

## 9. Lifecycle Behavior

- `onEnable`: creates service, subscribes chat/spawn hooks, registers migration.
- `onStartup(event)`: registers root + legacy commands.
- `onWorldReady`: runs migration, initializes service state, marks plugin ready.
- `onDisable`: unsubscribes hooks and stops runtime behavior.

## 10. Troubleshooting

### Chat is not formatted

- Check sender has `pchat`.
- Verify plugin reached world-ready phase.
- Check template exists for effective group.

### Colors removed from message

- Sender likely lacks `pchat.coloredMessages`.

### setformat/setnametag appears unchanged

- Verify target group name matches existing PurePerms group.
- Verify world override mode (`world` vs `global`) is intended.

### I am OP but I see Guest formatting

Likely causes:

- You are not OP in this world (Bedrock did not grant you command permission level).
- PurePerms hasn't synced you to group `OP` yet (it happens on `playerSpawn`).
- Your user is not assigned to `OP` inside PurePerms data.

What to do:

1. Run:

```text
/usrinfo YourName
```

2. If still `Guest`, assign:

```text
/setgroup YourName OP
```

3. Re-run `/pchat preview`.

## 11. FAQ

### Why support both root and legacy commands?

To provide compatibility with old usage while offering a cleaner modern command model.

### Is faction integration required?

No. It is optional and safely falls back when unavailable.

### Where should admins configure rank colors?

In PureChat format templates, not directly in PurePerms group names.
