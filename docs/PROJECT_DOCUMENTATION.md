# PMMPCore - Project Documentation

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

- Initializing DB.
- Initializing PMMPCore.
- Registering global core commands.
- Executing `enableAll()` and then hooks `onStartup(event)` of each plugin.

### 3.2 `scripts/PMMPCore.js`

Responsible for:

- Registering plugins (internal `Map`).
- Validating dependencies (`depend`, `softdepend`).
- Executing plugin lifecycle (`onEnable`/`onDisable`).
- Exposing DB access (`PMMPCore.db`).

### 3.3 `scripts/DatabaseManager.js`

Responsible for:

- Reading/writing data with namespace `pmmpcore:*`.
- Generic API (`get`, `set`, `delete`, `has`).
- Plugin/player helpers.
- Sharded API of MultiWorld (`mw:index`, `mw:world:*`, `mw:chunks:*`).

### 3.4 `scripts/plugins.js`

Responsible for:

- Explicitly importing all active plugins.
- Defining the "official list" loaded at runtime.

## 4. Plugin Lifecycle

Expected contract:

- `onEnable()`: prepare state and runtime subscriptions.
- `onStartup(event)`: register commands/dimensions/objects that require startup.
- `onDisable()`: final flush/cleanup.

Order:

1. `PMMPCore.enableAll()` calls `onEnable`.
2. `main.js` iterates plugins and executes `onStartup(event)`.
3. On shutdown/reload, `PMMPCore.disableAll()` calls `onDisable`.

## 5. Dependency Model

### `depend`

- Mandatory dependency.
- If missing, the plugin is not enabled.

### `softdepend`

- Optional dependency.
- If missing, only generates a warning.

Best practices:

- Maintain `depend: ["PMMPCore"]` in ecosystem plugins.
- Verify optional plugin before using its API.

## 6. Commands and Basic Security

Recommended:

- Namespaced names: `pmmpcore:<command>`.
- Resolve origin with `origin.initiator ?? origin.sourceEntity`.
- Validate `instanceof Player` when applicable.
- For sensitive mutations, execute from `system.run(...)`.

## 7. Persistence and Data Schema

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

## 8. Recommended Structure for New Plugins

```text
scripts/plugins/MyPlugin/
  main.js
  (optional internal modules)
```

And register in:

- `scripts/plugins.js` (import).
- `pluginList` (if used for listing/diagnosis).

## 9. Current Status and Documentation Scope

This documentation covers:

- PMMPCore Core.
- Plugin contract.
- MultiWorld (documented in dedicated file).

Pending detailed documentation:

- EconomyAPI.
- PurePerms.

## 10. Summary Operational Roadmap

### Short term

- Continue optimizing MultiWorld `normal` type generation.
- Harden error paths and observability.

### Medium term

- Scaffolding for new plugins.
- Regression tests for critical commands.

### Long term

- Stable framework version.
- Complete documentation of all base plugins.
