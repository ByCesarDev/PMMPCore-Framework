# PMMPCore - Project Documentation

Language: **English** | [Español](PROJECT_DOCUMENTATION.es.md)

## 1. General Overview

PMMPCore is a framework for Minecraft Bedrock that aims to standardize the modular development of "plugin" type functionalities, within the limitations of the Script API.

Objectives:

- Unify architecture and lifecycle.
- Reduce coupling between modules.
- Centralize persistence and commands.
- Facilitate maintenance and scalability.

## 2. Bedrock Limitations and Design Decisions

### Relevant Limitations

- No dynamic script loading at runtime.
- File access is limited/unavailable in game environment.
- Main persistence through Dynamic Properties.

### Architecture Decisions

- Static plugin loading from `scripts/plugins.js`.
- Plugin registration in `PMMPCore.registerPlugin(...)`.
- Coordinated startup from `scripts/main.js`.
- Centralized persistence via `DatabaseManager`.

## 3. System Components

### 3.1 `scripts/main.js`

Responsible for:

- Initializing the shared DB (`DatabaseManager`).
- Initializing `PMMPCore` and its service registry.
- Registering core diagnostic commands.
- Calling `enableAll()` and running early-phase hooks.
- Deferring **world-backed initialization** to `world.afterEvents.worldLoad` (because Dynamic Properties are not available in early execution).

### 3.2 `scripts/PMMPCore.js`

Responsible for:

- Registering plugins (internal `Map`).
- Tracking plugin status (`enabled` / `blocked`) with reasons.
- Validating dependencies (`depend`, `softdepend`).
- Executing plugin lifecycle (`onEnable`/`onDisable`).
- Exposing DB access (`PMMPCore.db`) and public services (EventBus, Scheduler, PermissionService, MigrationService, etc).

### 3.3 `scripts/DatabaseManager.js`

Responsible for:

- Sole access to Dynamic Properties for application data under `pmmpcore:*` (LRU cache, dirty buffer, `flush()`, optional WAL snapshot on flush).
- Generic API (`get`, `set`, `delete`, `has`) with `get` returning clones of objects/arrays.
- Plugin/player helpers.
- Sharded API of MultiWorld (`mw:index`, `mw:world:*`, `mw:chunks:*`).
- `listPropertySuffixes(prefix)` for internal engines.
- Optional relational SQL layer lives in `scripts/db/RelationalEngine.js` and uses only `DatabaseManager`; `PMMPCore.getDataProvider()` exposes `scripts/PMMPDataProvider.js`.
- Authoritative documentation: [DATABASE_GUIDE.md](DATABASE_GUIDE.md).

### 3.4 `scripts/plugins.js`

Responsible for:

- Explicitly importing all active plugins.
- Defining the "official list" loaded at runtime.

### 3.5 `scripts/api/index.js` (Public API surface)

This file is the **public export barrel** intended for third-party plugin authors inside the PMMPCore ecosystem. It re-exports stable and experimental APIs in one place, so plugins can avoid deep imports.

See: `docs/API_PUBLIC_GUIDE.md`.

## 4. Plugin Lifecycle

Expected contract:

- `onLoad()` (optional): lightweight bootstrap; **no world I/O**.
- `onEnable()`: enable runtime hooks/subscriptions; still avoid heavy world I/O.
- `onStartup(event)`: register Bedrock command/enums/dimensions only (early execution safe tasks).
- `onWorldReady()` (recommended): first **world-safe** initialization point (migrations, reading/writing `PMMPCore.db`, RelationalEngine warmup).
- `onDisable()`: cleanup and final flush-sensitive logic.

Order:

1. (Optional) `PMMPCore.loadAll()` calls `onLoad` (if present).
2. `PMMPCore.enableAll()` calls `onEnable`.
3. `main.js` executes `onStartup(event)` only for plugins that are enabled.
4. On `world.afterEvents.worldLoad`, the core emits `world.ready` and calls `onWorldReady()` for enabled plugins.
5. On shutdown/reload, `PMMPCore.disableAll()` calls `onDisable`.

### Early execution warning (critical)

Bedrock will error if you call `world.getDynamicProperty` / `world.setDynamicProperty` too early (for example inside `beforeEvents.startup` or some `onStartup` flows). Because `PMMPCore.db` is backed by Dynamic Properties, **first reads/writes must be deferred** until `world.afterEvents.worldLoad` or later.

This is documented in detail in: `docs/DATABASE_GUIDE.md` (section “When you may call the database”).

## 5. Dependency Model

### `depend`

- Mandatory dependency.
- If missing, the plugin is not enabled.
- `PMMPCore` is validated as a strict required dependency when declared in `depend`.

### `softdepend`

- Optional dependency.
- If missing, only generates a warning.

Best practices:

- Maintain `depend: ["PMMPCore"]` in ecosystem plugins.
- Verify optional plugin before using its API.

## 6. Commands, permissions, and basic security

Recommended:

- Namespaced names: `pmmpcore:<command>`.
- Custom commands must always include namespace (`namespace:value`) in Bedrock.
- Resolve origin with `origin.initiator ?? origin.sourceEntity`.
- Validate `instanceof Player` when applicable.
- For sensitive mutations, execute from `system.run(...)`.

Core command set currently includes:

- `pmmpcore:plugins` (shows loaded plugins and state).
- `pmmpcore:pl` (short state list).
- `pmmpcore:pluginstatus <plugin>` (detailed status + reason).
- `pmmpcore:info`
- `pmmpcore:pmmphelp`
- `pmmpcore:diag` (platform diagnostics: services, events, scheduler, metrics)
- `pmmpcore:selftest` (smoke tests: KV + relational layer)

For plugin commands, prefer the `CommandBus` abstraction (experimental) so you can register, validate, and execute commands consistently across the ecosystem.

## 7. Core services (high level)

PMMPCore provides a service registry (internal) and exposes a set of services via the `PMMPCore` facade.

Commonly used services:

- **Persistence**: `PMMPCore.db` (stable), `PMMPCore.getDataProvider()` (stable), `PMMPCore.createRelationalEngine()` (experimental)
- **Permissions**: `PMMPCore.getPermissionService()` (stable), default backend is PurePerms
- **Migrations**: `PMMPCore.getMigrationService()` (experimental) for plugin-owned versioned upgrades
- **Events**: `PMMPCore.getEventBus()` (experimental)
- **Scheduler**: `PMMPCore.getScheduler()` (experimental), coordinated by `TickCoordinator`
- **Observability**: `PMMPCore.getLogger()` and internal metrics recording (flush/query/tick durations)

## 8. Persistence and Data Schema

### Namespace

All keys under `pmmpcore:*`.

### Key Examples

- `pmmpcore:player:<name>`
- `pmmpcore:plugin:<pluginName>`
- `pmmpcore:mw:index`
- `pmmpcore:mw:world:<worldName>`
- `pmmpcore:mw:chunks:<worldName>`

### Recommendations

- Save compact structures.
- Avoid unnecessary writes per tick.
- Use controlled flush in mass operations.

## 9. Recommended Structure for New Plugins

```text
scripts/plugins/MyPlugin/
  main.js
  (optional internal modules)
```

And register in:

- `scripts/plugins.js` (import).
- `pluginList` (if used for listing/diagnosis).

## 10. Where to read next

- **Getting started / navigation**: `readme.md` and `docs/README.md`
- **Public API surface**: `docs/API_PUBLIC_GUIDE.md`
- **Database and persistence**: `docs/DATABASE_GUIDE.md`
- **Plugin author guide**: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- **Plugin manuals**: `docs/plugins/`

## 11. Summary Operational Roadmap

### Short term

- Continue optimizing MultiWorld `normal` type generation.
- Harden error paths and observability.

### Medium term

- Scaffolding for new plugins.
- Regression tests for critical commands.

### Long term

- Stable framework version.
- Complete documentation of all base plugins.
