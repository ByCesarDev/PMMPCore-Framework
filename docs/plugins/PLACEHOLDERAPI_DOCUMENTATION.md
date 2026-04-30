# PMMPCore - PlaceholderAPI Documentation

Language: **English**

## 1. Purpose and Scope

PlaceholderAPI is a plugin-level placeholder engine for PMMPCore.

It provides:

- Runtime placeholder parsing in text strings.
- Default expansions (`general`, `player`, `server`, `time`).
- A custom expansion contract for third-party plugins.
- Integration points for other plugins (for example, PureChat).

Important architecture note:

- PlaceholderAPI is a plugin, not part of PMMPCore core API exports.

## 2. Syntax and Resolution Rules

- Main syntax: `%identifier_key%` (for example, `%player_name%`).
- Alias syntax: `%key%` (resolved by `general` expansion).
- Unknown placeholders remain unchanged (safe fallback).
- Matching is case-insensitive in this implementation.

## 3. Commands

- `/papi list`
- `/papi parse <text>`
- `/papi test <expansion> <placeholder>`
- `/papi reload`

Bedrock command parser note:

- `%...%` may be parsed as syntax when unquoted.
- Prefer quotes in `/papi parse`, for example:

```text
/papi parse "%online_players%"
```

## 4. Permissions

- `placeholderapi.admin`
- `placeholderapi.list`
- `placeholderapi.parse`
- `placeholderapi.test`

## 5. Built-in Expansions

### 5.1 General (`general`)

- `%online_players%`
- `%max_players%`
- `%server_time%`
- `%server_date%`
- `%random_number%`

### 5.2 Player (`player`)

- `%player_name%`
- `%player_display_name%`
- `%player_health%`
- `%player_max_health%`
- `%player_x%`, `%player_y%`, `%player_z%`
- `%player_world%`
- `%player_ip%` (`n/a` in Bedrock runtime)
- `%player_ping%` (`n/a` in Bedrock runtime)

### 5.3 Server (`server`)

- `%server_name%`
- `%server_motd%`
- `%server_ip%`
- `%server_port%`
- `%server_max_players%`
- `%server_online_players%`
- `%server_version%`
- `%server_tps%`
- `%server_load%`

### 5.4 Time (`time`)

- `%time_current%`
- `%time_date%`
- `%time_datetime%`
- `%time_timestamp%`

## 6. Runtime Access from Another Plugin

Use PMMPCore plugin registry to access PlaceholderAPI runtime:

```js
import { PMMPCore } from "../../PMMPCore.js";

const placeholderPlugin = PMMPCore.getPlugin("PlaceholderAPI");
const papi = placeholderPlugin?.runtime ?? null;
const line = papi?.parse("Welcome %player_name% - Online: %online_players%", player) ?? "fallback";
```

## 7. Custom Expansion Contract

Create an object with:

- `identifier` (`string`)
- `version` (`string`)
- `author` (`string`)
- `onPlaceholderRequest(player, key, context)` (`function`)

Example:

```js
const placeholderPlugin = PMMPCore.getPlugin("PlaceholderAPI");
const papi = placeholderPlugin?.runtime ?? null;

const playtimeExpansion = {
  identifier: "playtime",
  version: "1.0.0",
  author: "YourName",
  onPlaceholderRequest(player, key) {
    if (!player) return null;
    if (key === "seconds") return "0";
    return null;
  },
};

papi?.registerExpansion(playtimeExpansion);
// Usage: %playtime_seconds%
```

## 8. PureChat Integration

PureChat resolves internal placeholders first (`{msg}`, `{display_name}`, etc.) and then runs PlaceholderAPI parsing for `%...%` tokens.

Example format:

```text
/pchat setformat OP global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

## 9. Quick Test Checklist

```text
/papi list
/papi parse "%online_players%"
/papi parse "Hello %player_name%"
/papi test player name
/papi test time current
/papi parse "NoExiste: %foo_bar%"
```

Expected:

- valid placeholders are resolved,
- unknown placeholders remain unchanged.

## 10. Limitations and Notes

- Some PocketMine placeholders cannot be implemented 1:1 in Bedrock runtime.
- Network-derived values like IP/ping are exposed as safe fallbacks.
- PlaceholderAPI follows PMMPCore lifecycle (`onEnable`, `onStartup`, `onWorldReady`, `onDisable`).
