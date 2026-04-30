# PMMPCore Public API Guide

Language: **English** | [Español](API_PUBLIC_GUIDE.es.md)

This guide is the canonical reference for PMMPCore’s public API. It is written for plugin authors who need to build features safely without depending on unstable internals.

---

## 1) What “public API” means in PMMPCore

In this repository, a symbol is considered public if:

1. It is exported by `scripts/api/index.js`, and
2. It is documented in this guide (or companion core docs).

If code exists in `scripts/` but is not exported/documented as public, treat it as internal implementation detail.

Why this matters:

- You avoid accidental breakage during refactors.
- You can reason about stability (`stable`, `experimental`, `internal`).
- New contributors know which surface is safe to consume.

---

## 2) Stability policy

### `stable`

- Intended for ecosystem-wide plugin usage.
- Breaking changes require a major-version policy decision.
- Example: `PMMPCore.db`, `PMMPCore.getDataProvider()`, `PMMPCore.getPermissionService()`.

### `experimental`

- Publicly available, but behavior/signatures may evolve in minor iterations.
- Use when you need the feature and can keep your plugin updated.
- Example: `RelationalEngine`, `CommandBus`, `Scheduler`, `MigrationService`.

### `internal`

- Not for third-party/plugin-level dependencies.
- Can change at any time.

---

## 3) Importing PMMPCore APIs correctly

PMMPCore is a Behavior Pack project, not an npm package. Plugin “installation” means placing code under `scripts/plugins/` and importing modules by relative path.

Recommended:

```javascript
import { PMMPCore, PMMPDataProvider, RelationalEngine } from "../api/index.js";
```

Avoid deep imports like `../core/...` unless there is a documented reason.

---

## 4) Lifecycle contract (critical for reliability)

A plugin should follow this lifecycle contract:

- `onLoad()` -> lightweight setup only (constants, flags, wiring)
- `onEnable()` -> subscriptions, local state setup, migration registration
- `onStartup(event)` -> Bedrock startup registrations (commands/enums)
- `onWorldReady()` -> first safe world I/O, DB access, data hydration, migration execution
- `onDisable()` -> cleanup and optional final flush

### Why `onWorldReady()` matters

`PMMPCore.db` uses Dynamic Properties. In early execution, Bedrock may throw:

`Native function [World::getDynamicProperty] cannot be used in early execution`

So first DB reads/writes must be deferred until `onWorldReady()` (or equivalent world-load-safe path).

---

## 5) Core entrypoints you will use most

### `PMMPCore.db` (stable)

Use for key-value persistence:

- `get`, `set`, `delete`, `has`
- plugin/player helpers (`getPluginData`, `setPluginData`, etc.)
- `flush()` for explicit durability after critical writes

Use this when:

- You need simple persistent state
- You need maximum compatibility and lowest complexity

### `PMMPCore.getDataProvider()` (stable)

PocketMine-style facade over the same storage layer:

- `loadPlayer`, `savePlayer`, `loadPluginData`, `savePluginData`, `flush`, etc.

Use this when:

- You prefer DataProvider naming style
- You are porting PMMP-inspired logic

### `PMMPCore.getPermissionService()` (stable)

Stable contract for permissions, usually backed by PurePerms:

- `has(...)`, `resolve(...)`, group/user helpers

Use this instead of direct PurePerms internals when possible.

### `PMMPCore.createRelationalEngine()` (experimental)

SQL-lite layer over the same persistence backend:

- tables, indexes, upsert/find, SQL subset queries

Use this when:

- Data has relational patterns
- You need filtered/aggregated reads beyond plain KV

### `PMMPCore.getEventBus()` (experimental)

Decoupled event communication between modules/plugins.

### `PMMPCore.getCommandBus()` (experimental)

Centralized command abstraction; useful when your plugin has many commands and shared validation/routing logic.

### `PMMPCore.getScheduler()` (experimental)

Tick-budgeted delayed/repeating tasks; preferred over ad-hoc timing logic for observability and control.

### `PMMPCore.getMigrationService()` (experimental)

Versioned schema/data migrations per plugin.

---

## 6) Practical usage patterns

## 6.1 Minimal plugin (safe lifecycle)

```javascript
import { PMMPCore } from "../../api/index.js";

PMMPCore.registerPlugin({
  name: "MyPlugin",
  version: "1.0.0",
  depend: ["PMMPCore"],

  onEnable() {
    this.context = PMMPCore.getPluginContext("MyPlugin", "1.0.0");
  },

  onStartup(event) {
    // command enums + command registration only
  },

  onWorldReady() {
    const count = PMMPCore.db.getPluginData("MyPlugin", "bootCount") ?? 0;
    PMMPCore.db.setPluginData("MyPlugin", "bootCount", count + 1);
    PMMPCore.db.flush();
  },
});
```

## 6.2 Migrations + hydration

```javascript
onEnable() {
  PMMPCore.getMigrationService()?.register("MyPlugin", 1, () => {
    PMMPCore.db.setPluginData("MyPlugin", "schema", { version: 1 });
  });
}

onWorldReady() {
  PMMPCore.getMigrationService()?.run("MyPlugin");
}
```

## 6.3 Permission checks via stable contract

```javascript
const perms = PMMPCore.getPermissionService();
if (!perms?.has(player.name, "pperms.command.myplugin.admin", player.dimension?.id ?? null, player)) {
  player.sendMessage("[MyPlugin] You do not have permission.");
  return;
}
```

---

## 7) Public exports reference (`scripts/api/index.js`)

### Core facade

- `PMMPCore`
- `Color`

### Persistence

- `DatabaseManager` (stable)
- `PMMPDataProvider` (stable)
- `RelationalEngine` (experimental)
- `JsonCodec` (stable utility)
- `WalLog` (experimental utility)
- `MigrationService` (experimental)

### Service-level exports (mostly experimental)

- `ServiceRegistry`
- `EventBus`, `CoreEvent`, `EventPriority`
- `CommandBus`
- `TaskScheduler`
- `TickCoordinator`
- `ObservabilityService`, `CoreLogger`
- `PurePermsPermissionService` (adapter class)

Note: even if an export exists, always prefer top-level `PMMPCore.get...()` accessors first unless you are building framework-level extensions.

---

## 8) Anti-patterns to avoid

- Reading/writing DB in `onStartup`.
- Calling `world.getDynamicProperty` directly for PMMPCore-managed keys.
- Deep importing internal modules without API contract.
- Mixing command registration, persistence, and business logic in one giant callback.
- Skipping `flush()` after critical, must-survive writes.

---

## 9) Quick decision matrix

- Need simple persistent config/state -> use `PMMPCore.db`
- Need PMMP-like data facade -> use `getDataProvider()`
- Need structured querying -> use `createRelationalEngine()`
- Need permissions -> use `getPermissionService()`
- Need plugin-to-plugin events -> use `getEventBus()`
- Need delayed/repeating jobs -> use `getScheduler()`
- Need versioned data upgrades -> use `getMigrationService()`

---

## 10) Cross references

- Storage and durability details: `docs/DATABASE_GUIDE.md`
- Architecture and runtime flow: `docs/PROJECT_DOCUMENTATION.md`
- Authoring plugins end-to-end: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- Migrating old plugins: `docs/PLUGIN_MIGRATION_GUIDE.md`

---

## 11) FAQ

### Do I have to use `scripts/api/index.js` for imports?

Yes, for plugin-facing code it is the recommended and safest path because it represents the curated public surface.

### Can I use experimental APIs in production plugins?

Yes, but you should isolate those calls behind your own wrappers so future updates are easier to adapt.

### Is `PMMPCore.db` enough for most plugins?

Usually yes. Start with KV; adopt `RelationalEngine` only when query complexity (indexing/filtering/grouping) justifies it.

### Where should I register commands vs load data?

Register commands in `onStartup(event)`. Load/persist data in `onWorldReady()`.

### Should I access PurePerms directly?

Prefer `PMMPCore.getPermissionService()` first. Use backend-specific internals only when strictly necessary.
