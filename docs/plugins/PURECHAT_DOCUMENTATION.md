# PMMPCore - PureChat Documentation

Language: **English** | [Español](PURECHAT_DOCUMENTATION.es.md)

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
   - `/pmmpcore:pchat preview`
   - `/pmmpcore:setprefix <player> <prefix>`

## 3. Commands

PureChat supports **both** compatibility styles:

- Modern root command: `/pmmpcore:pchat <subcommand> ...`
- Legacy compatibility commands:
  - `/pmmpcore:setprefix <player> <prefix>`
  - `/pmmpcore:setsuffix <player> <suffix>`
  - `/pmmpcore:setnametag <group> <world|global> <format>`
  - `/pmmpcore:setformat <group> <world|global> <format>`

### Root subcommands

- `setprefix <player> <prefix>`
- `setsuffix <player> <suffix>`
- `setformat <group> <world|global> <format>`
- `setnametag <group> <world|global> <format>`
- `preview`

Tip: use `BLANK` (without braces) in prefix/suffix to represent a single space.
Note: some Bedrock command parsers reject `{` `}`; PureChat accepts both `BLANK` and `{BLANK}` when supported.

## 4. Permission Nodes

- `pchat`
- `pchat.coloredMessages`
- `pchat.command`
- `pchat.command.setprefix`
- `pchat.command.setsuffix`
- `pchat.command.setnametag`
- `pchat.command.setformat`

## 5. Configuration Model

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

## 6. Placeholders

Supported placeholders:

- `{display_name}`
- `{msg}`
- `{prefix}`
- `{suffix}`
- `{world}`
- `{fac_name}` (optional adapter)
- `{fac_rank}` (optional adapter)

If faction adapter data is unavailable, faction placeholders resolve to empty strings.

## 7. Color Codes

PureChat supports classic `&` formatting codes in templates and user messages:

- Colors: `&0`..`&f`
- Styles: `&k`, `&l`, `&m`, `&n`, `&o`, `&r`

Message body colorization is only kept if sender has `pchat.coloredMessages`.

## 8. Lifecycle Behavior

- `onEnable`: creates service, subscribes chat/spawn hooks, registers migration.
- `onStartup(event)`: registers root + legacy commands.
- `onWorldReady`: runs migration, initializes service state, marks plugin ready.
- `onDisable`: unsubscribes hooks and stops runtime behavior.

## 9. Troubleshooting

### Chat is not formatted

- Check sender has `pchat`.
- Verify plugin reached world-ready phase.
- Check template exists for effective group.

### Colors removed from message

- Sender likely lacks `pchat.coloredMessages`.

### setformat/setnametag appears unchanged

- Verify target group name matches existing PurePerms group.
- Verify world override mode (`world` vs `global`) is intended.

## 10. FAQ

### Why support both root and legacy commands?

To provide compatibility with old usage while offering a cleaner modern command model.

### Is faction integration required?

No. It is optional and safely falls back when unavailable.

### Where should admins configure rank colors?

In PureChat format templates, not directly in PurePerms group names.
