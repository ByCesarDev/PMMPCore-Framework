# PMMPCore - Plugin Creation Guide

Language: **English** | [Español](PLUGIN_DEVELOPMENT_GUIDE.es.md)

## 1. Purpose of this guide

This guide explains how to create plugins compatible with PMMPCore, following the core contract and avoiding common errors of Bedrock Script API.

## 2. Requirements

- Knowledge of JavaScript for Bedrock Script API.
- Understanding of custom commands (`customCommandRegistry`).
- Respect the PMMPCore plugin lifecycle.

## 3. Minimum Structure

Create folder:

```text
scripts/plugins/MyPlugin/
```

Main file:

```text
scripts/plugins/MyPlugin/main.js
```

## 4. Basic Plugin Template

```javascript
import { PMMPCore } from "../../PMMPCore.js";
import { Player, CustomCommandStatus, CommandPermissionLevel } from "@minecraft/server";

PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: [],

  onEnable() {
    console.log("[MyPlugin] Enabled");
  },

  onStartup(event) {
    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:myplugin_ping",
        description: "Basic health command",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const source = origin.initiator ?? origin.sourceEntity;
        if (!(source instanceof Player)) {
          return { status: CustomCommandStatus.Failure, message: "Only players can run this command." };
        }
        source.sendMessage("MyPlugin OK");
        return { status: CustomCommandStatus.Success };
      }
    );
  },

  onDisable() {
    console.log("[MyPlugin] Disabled");
  },
});
```

Note:

- If `depend: ["PMMPCore"]` is declared, PMMPCore treats it as strict and the plugin is blocked until core initialization is valid.

## 5. Runtime Integration

Add import in `scripts/plugins.js`:

```javascript
import "./plugins/MyPlugin/main.js";
```

If `pluginList` exists, also add the plugin name.

## 6. Database Usage

### General API

- `PMMPCore.db.get(key)`
- `PMMPCore.db.set(key, value)`
- `PMMPCore.db.delete(key)`

### Plugin-specific API

- `PMMPCore.db.getPluginData("MyPlugin")`
- `PMMPCore.db.setPluginData("MyPlugin", { ... })`
- `PMMPCore.db.setPluginData("MyPlugin", "setting", value)`

### Recommendations

- Namespacing by plugin in internal structures.
- Save in batch when possible.
- Avoid writing every tick unless real necessity.

## 7. Commands: Practical Recommendations

- Use `pmmpcore:` prefix.
- Bedrock requires command names in `namespace:value` format (e.g. `pmmpcore:mycommand`).
- Define `mandatoryParameters`/`optionalParameters` correctly.
- Prefer `CustomCommandParamType.Enum` for stable options (actions, modes, fixed subcommands) to get autocomplete.
- If the command does heavy work, divide into ticks.
- Clear and actionable error messages for the player.

### 7.1 Basic command pattern (`help`, `info`, actions)

A practical pattern is to expose one root command and route by subcommand:

- `/pmmpcore:myplugin help`
- `/pmmpcore:myplugin info`
- `/pmmpcore:myplugin <action> ...`

Example:

```javascript
import {
  Player,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandParamType,
} from "@minecraft/server";

function handleHelp(player) {
  player.sendMessage("=== MyPlugin Help ===");
  player.sendMessage("/pmmpcore:myplugin help");
  player.sendMessage("/pmmpcore:myplugin info");
  player.sendMessage("/pmmpcore:myplugin greet <name>");
  return { status: CustomCommandStatus.Success };
}

function handleInfo(player) {
  player.sendMessage("MyPlugin v1.0.0 - status OK");
  return { status: CustomCommandStatus.Success };
}

export function registerMyPluginCommands(event) {
  event.customCommandRegistry.registerEnum("pmmpcore:myplugin_subcommand", [
    "help",
    "info",
    "greet",
  ]);

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:myplugin",
      description: "MyPlugin root command",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [
        { type: CustomCommandParamType.Enum, name: "pmmpcore:myplugin_subcommand" },
      ],
      optionalParameters: [
        { type: CustomCommandParamType.String, name: "targetName" },
      ],
    },
    (origin, subcommand, targetName) => {
      const player = origin.initiator ?? origin.sourceEntity;
      if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can run this command." };
      }

      switch ((subcommand ?? "help").toLowerCase()) {
        case "help":
          return handleHelp(player);
        case "info":
          return handleInfo(player);
        case "greet":
          if (!targetName) {
            player.sendMessage("Usage: /pmmpcore:myplugin greet <name>");
            return { status: CustomCommandStatus.Success };
          }
          player.sendMessage(`Hello ${targetName}!`);
          return { status: CustomCommandStatus.Success };
        default:
          return handleHelp(player);
      }
    }
  );
}
```

Why this works well:

- single entrypoint makes command UX consistent;
- enum subcommands provide autocomplete;
- each subcommand can call a dedicated handler function.

## 8. Permissions Integration with PurePerms

If your plugin exposes commands or administrative actions, define explicit permission nodes and validate them through PurePerms.

Recommended rules:

- publish permission nodes per feature/subcommand;
- keep node names predictable;
- do not hardcode permission defaults into PurePerms core config if the nodes belong to another plugin;
- if needed, seed safe defaults from the plugin that owns the feature.

### 8.1 Recommended node naming

Use plugin-scoped nodes:

- `pperms.command.myplugin.help`
- `pperms.command.myplugin.info`
- `pperms.command.myplugin.create`
- `pperms.command.myplugin.delete`

This keeps permissions organized and avoids collisions.

### 8.2 Command-side permission guard

Recommended pattern:

```javascript
function getPurePermsService() {
  const plugin = PMMPCore.getPlugin("PurePerms");
  return plugin?.service ?? null;
}

function guardPermission(player, node) {
  const purePerms = getPurePermsService();
  if (!purePerms) return true; // fallback policy if PurePerms is absent
  const allowed = purePerms.hasPermission(player.name, node, player.dimension?.id ?? null, player);
  if (!allowed) {
    player.sendMessage(`[MyPlugin] You do not have permission: ${node}`);
  }
  return allowed;
}
```

Then before each action:

```javascript
if (!guardPermission(player, "pperms.command.myplugin.create")) {
  return { status: CustomCommandStatus.Success };
}
```

### 8.3 Permission seed owned by the plugin

If your plugin needs sensible out-of-the-box permissions, prefer a plugin-owned permission seed instead of editing PurePerms defaults directly.

Why:

- PurePerms stays generic;
- each plugin owns its own nodes;
- defaults are added only when missing;
- administrators can still customize ranks manually.

Example idea:

```javascript
const MYPLUGIN_PERMISSION_SEED = {
  Guest: ["pperms.command.myplugin.help", "pperms.command.myplugin.info"],
  Admin: ["pperms.command.myplugin.create", "pperms.command.myplugin.delete"],
};
```

At startup, the plugin can:

1. detect whether PurePerms is loaded;
2. read existing group permissions;
3. add only missing nodes;
4. avoid overwriting manual admin choices.

### 8.4 Idempotent seeding rules

A good permission seed should be:

- **idempotent**: running it multiple times changes nothing after the first successful pass;
- **non-destructive**: do not delete or overwrite existing permissions automatically;
- **scoped**: seed only nodes owned by your plugin;
- **optional**: if PurePerms is missing, skip seeding gracefully.

## 9. Dependencies Between Plugins

Example:

```javascript
depend: ["PMMPCore"],
softdepend: ["EconomyAPI"]
```

Before using another plugin's API:

```javascript
const economy = PMMPCore.getPlugin("EconomyAPI");
if (!economy) {
  // fallback or message
}
```

## 10. Performance Best Practices

- Avoid complete world scans per tick.
- Limit loops with per-cycle budgets.
- Cache results of frequent operations.
- In terrain generation, prefer operations by volume/range.

## 11. Error Handling

- In event/command callbacks, wrap risky operations in `try/catch`.
- Do not silence critical errors without logging.
- Differentiate recoverable warning from blocking error.

## 12. Exit Checklist for a New Plugin

- [ ] Registers correctly in PMMPCore.
- [ ] Does not break startup if an optional dependency fails.
- [ ] Commands registered in `onStartup(event)`.
- [ ] Permission nodes documented and validated if the plugin has protected actions.
- [ ] Data persisted with clear namespace.
- [ ] Useful logs for debugging.
- [ ] Minimum plugin documentation added in `docs/`.

## 13. Suggested Conventions

- Plugin names in PascalCase (`MyPlugin`).
- Commands in lowercase.
- Messages with short plugin prefix (`[MyPlugin]`).
- Separate logic into modules if the file grows too much.

## 14. Modular Plugin Design (recommended)

Do not keep the full plugin in one giant `main.js`. Prefer modules by responsibility.

Suggested layout:

```text
scripts/plugins/MyPlugin/
  main.js
  commands.js
  service.js
  state.js
  config.js
```

Suggested responsibilities:

- `main.js`: plugin registration + lifecycle hooks (`onEnable`, `onStartup`, `onDisable`).
- `commands.js`: command registration and command handlers only.
- `service.js`: business logic (calculations, rules, operations).
- `state.js`: runtime shared state (caches, maps, flags).
- `config.js`: constants/enums/tuning knobs.

Modular rule of thumb:

- command files should call services, not implement full business logic inline;
- persistence calls should be centralized (service layer) instead of scattered;
- avoid circular imports between modules.
