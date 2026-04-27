# PMMPCore - Plugin Creation Guide

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
- Define `mandatoryParameters`/`optionalParameters` correctly.
- If the command does heavy work, divide into ticks.
- Clear and actionable error messages for the player.

## 8. Dependencies Between Plugins

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

## 9. Performance Best Practices

- Avoid complete world scans per tick.
- Limit loops with per-cycle budgets.
- Cache results of frequent operations.
- In terrain generation, prefer operations by volume/range.

## 10. Error Handling

- In event/command callbacks, wrap risky operations in `try/catch`.
- Do not silence critical errors without logging.
- Differentiate recoverable warning from blocking error.

## 11. Exit Checklist for a New Plugin

- [ ] Registers correctly in PMMPCore.
- [ ] Does not break startup if an optional dependency fails.
- [ ] Commands registered in `onStartup(event)`.
- [ ] Data persisted with clear namespace.
- [ ] Useful logs for debugging.
- [ ] Minimum plugin documentation added in `docs/`.

## 12. Suggested Conventions

- Plugin names in PascalCase (`MyPlugin`).
- Commands in lowercase.
- Messages with short plugin prefix (`[MyPlugin]`).
- Separate logic into modules if the file grows too much.
