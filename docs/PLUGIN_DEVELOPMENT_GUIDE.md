# PMMPCore - Plugin Creation Guide

Language: **English** | [Español](PLUGIN_DEVELOPMENT_GUIDE.es.md)

## 1) Purpose and audience

This guide teaches how to build production-ready plugins for PMMPCore:

- plugin lifecycle usage
- commands and permissions
- persistence and migration patterns
- dependency and module design
- testing and release checklist

If you are new to the framework, read this guide fully once before coding your plugin.

---

## 2) Prerequisites

- JavaScript knowledge for Bedrock Script API
- Basic command registration understanding (`customCommandRegistry`)
- Familiarity with PMMPCore docs:
  - `docs/API_PUBLIC_GUIDE.md`
  - `docs/DATABASE_GUIDE.md`
  - `docs/PLUGIN_MIGRATION_GUIDE.md`

---

## 3) Plugin lifecycle explained in detail

### `onLoad()`

Use for:

- static constants
- configuration parsing
- local module setup

Avoid:

- Dynamic Property reads/writes
- world-dependent initialization

### `onEnable()`

Use for:

- event subscriptions
- runtime state setup
- migration registration
- plugin context creation

### `onStartup(event)`

Use for:

- command enum registration
- command registration
- startup-only Bedrock registration tasks

Avoid DB access here.

### `onWorldReady()`

Use for:

- first DB reads/writes
- hydration of in-memory caches from storage
- migration execution
- relational engine setup (if needed)

### `onDisable()`

Use for:

- unsubscribing handlers
- cleanup of runtime tasks
- optional final `flush()` for critical pending writes

---

## 4) Recommended folder structure

```text
scripts/plugins/MyPlugin/
  main.js
  commands.js
  service.js
  state.js
  config.js
```

Responsibilities:

- `main.js`: plugin registration and lifecycle hooks
- `commands.js`: command registration + routing only
- `service.js`: business logic and persistence orchestration
- `state.js`: shared runtime state (caches/maps/flags)
- `config.js`: constants and tuning knobs

---

## 5) Base plugin template (safe pattern)

```javascript
import { PMMPCore } from "../../api/index.js";
import { registerMyPluginCommands } from "./commands.js";
import { MyPluginService } from "./service.js";

PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],
  softdepend: [],

  onEnable() {
    this.context = PMMPCore.getPluginContext("MyPlugin", "1.0.0");
    this.service = new MyPluginService();
    this.service.registerMigrations();
  },

  onStartup(event) {
    registerMyPluginCommands(event, this.service);
  },

  onWorldReady() {
    this.service.runMigrations();
    this.service.hydrate();
  },

  onDisable() {
    this.service?.shutdown();
    PMMPCore.db.flush();
  },
});
```

---

## 6) Registering plugin in runtime

Add import in `scripts/plugins.js`:

```javascript
import "./plugins/MyPlugin/main.js";
```

If your repository keeps a `pluginList`, add the plugin there for diagnostics.

---

## 7) Persistence patterns (KV first, relational when needed)

Primary persistence path:

- `PMMPCore.db` (stable)

Common operations:

- `get`, `set`, `delete`, `has`
- `getPluginData`, `setPluginData`
- `flush`

Important behavior:

- `get()` returns cloned objects/arrays
- mutating returned data does nothing until `set()` is called
- writes may be buffered in memory until `flush()`

When to call `flush()`:

- after admin-critical mutations
- after batch operations that must survive abrupt shutdown

Use `RelationalEngine` only when filtering/indexing/querying needs justify it.

---

## 8) Commands: complete practical pattern

Guidelines:

- namespaced command names (`pmmpcore:...`)
- keep one root command + enum subcommands
- validate source (`origin.initiator ?? origin.sourceEntity`)
- return clear actionable responses

Example router:

```javascript
import {
  Player,
  CustomCommandStatus,
  CommandPermissionLevel,
  CustomCommandParamType,
} from "@minecraft/server";

export function registerMyPluginCommands(event, service) {
  event.customCommandRegistry.registerEnum("pmmpcore:myplugin_subcommand", [
    "help",
    "info",
    "reload",
  ]);

  event.customCommandRegistry.registerCommand(
    {
      name: "pmmpcore:myplugin",
      description: "MyPlugin command root",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ type: CustomCommandParamType.Enum, name: "pmmpcore:myplugin_subcommand" }],
    },
    (origin, subcommand) => {
      const player = origin.initiator ?? origin.sourceEntity;
      if (!(player instanceof Player)) {
        return { status: CustomCommandStatus.Failure, message: "Only players can run this command." };
      }
      return service.handleCommand(player, (subcommand ?? "help").toLowerCase());
    }
  );
}
```

---

## 9) Permissions integration

Prefer stable abstraction:

```javascript
const perms = PMMPCore.getPermissionService();
```

Recommended node naming:

- `pperms.command.myplugin.help`
- `pperms.command.myplugin.info`
- `pperms.command.myplugin.reload`
- `pperms.command.myplugin.admin`

Best practices:

- node-per-action granularity
- consistent naming prefix
- central `guardPermission(...)` helper
- optional idempotent “permission seed” from your plugin

---

## 10) Dependencies and soft dependencies

Example:

```javascript
depend: ["PMMPCore"],
softdepend: ["EconomyAPI"]
```

Usage pattern:

```javascript
const economy = PMMPCore.getPlugin("EconomyAPI");
if (!economy) {
  // fallback path
}
```

Rules:

- fail-fast for hard deps
- graceful degradation for soft deps

---

## 11) Migrations for plugin data

Register migrations in `onEnable()`, run in `onWorldReady()`:

```javascript
registerMigrations() {
  PMMPCore.getMigrationService()?.register("MyPlugin", 1, () => {
    PMMPCore.db.setPluginData("MyPlugin", "schema", { version: 1 });
  });
}

runMigrations() {
  PMMPCore.getMigrationService()?.run("MyPlugin");
}
```

Rules for safe migrations:

- idempotent
- minimal destructive behavior
- versioned, explicit, logged

---

## 12) Performance and watchdog safety

- Avoid full scans every tick.
- Chunk heavy operations across multiple ticks.
- Cache expensive repeated lookups.
- Use scheduler for delayed/repeating tasks (`getScheduler()`).
- Avoid large synchronous writes in one frame when possible.

---

## 13) Error handling and observability

Pattern:

- wrap risky command/event handlers in `try/catch`
- log with plugin prefix
- distinguish warning vs blocking error

Suggested message style:

- `[MyPlugin][warn] ...`
- `[MyPlugin][error] ...`

For platform-wide diagnostics, use `/pmmpcore:diag`.

---

## 14) Testing checklist before release

- [ ] Plugin registers and enables successfully.
- [ ] Commands are available and validated.
- [ ] Permission checks enforce intended access.
- [ ] No DB access in early execution phases.
- [ ] Migrations run correctly on first load and no-op on next load.
- [ ] Critical writes survive reboot (verify with flush points).
- [ ] Optional dependencies degrade gracefully.
- [ ] Plugin documentation exists and is current.

---

## 15) Common mistakes and fixes

- **Mistake:** DB in `onStartup` -> **Fix:** move to `onWorldReady`
- **Mistake:** inline giant command callbacks -> **Fix:** route to service layer
- **Mistake:** direct world dynamic property writes -> **Fix:** use `PMMPCore.db`
- **Mistake:** unscoped permission nodes -> **Fix:** plugin-prefixed nodes

---

## 16) Documentation expectations for each plugin

Every plugin should include:

- what the plugin does
- command reference
- permission nodes
- configuration properties
- migration notes (if schema changes)
- troubleshooting section

---

## 17) FAQ

### Should every plugin use all PMMPCore services?

No. Use only what your plugin needs. Start minimal (`db`, commands, permissions), then adopt scheduler/events when justified.

### Where should business logic live?

In `service.js` (or equivalent). Keep command handlers thin and focused on routing/validation.

### Can I write to DB on every tick?

You can, but it is usually a bad idea. Buffer state in memory and persist in controlled batches.

### Should my plugin call `PMMPCore.db.flush()` frequently?

Use it after critical writes and on controlled boundaries (admin actions, shutdown-sensitive operations), not blindly every action.

### How detailed should plugin docs be?

Detailed enough that a new dev can install, configure, run commands, understand permissions, and troubleshoot without reading source first.
