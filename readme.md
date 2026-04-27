# PMMPCore

<div align="center">

![PMMPCore Logo](https://img.shields.io/badge/PMMPCore-Framework-blue?style=for-the-badge&logo=minecraft)

**Modular framework for Minecraft Bedrock Edition**

[![Status](https://img.shields.io/badge/Status-Prototype%20Phase-orange)](#current-status)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/en-us/download/bedrock-edition)

[Documentation](#documentation) · [Roadmap](#integrated-roadmap) · [Contribute](#contributing)

</div>

---

## Overview

PMMPCore is a framework that brings the PocketMine-style modular approach to the Bedrock ecosystem, with a plugin-oriented architecture, centralized persistence, and typed commands.

It is designed to create complex servers/addons in a maintainable way, even under the limitations of the Bedrock Script API.

## Why PMMPCore?

### The Problem

Minecraft Bedrock has significant restrictions for building large modular systems:

- no real dynamic plugin loading;
- no free access to file system at runtime;
- many addons end up coupled and difficult to maintain.

### The Solution

PMMPCore implements a framework foundation that:

- simulates a plugin ecosystem through controlled static loading;
- centralizes state and persistence with `DatabaseManager` + Dynamic Properties;
- standardizes the lifecycle (`onEnable`, `onStartup`, `onDisable`);
- unifies the command layer using `customCommandRegistry`.

## Key Features

### Core system

- Plugin registration and dependency validation.
- Shared database for the entire ecosystem.
- Single and predictable startup pipeline.
- Common API for plugins (`PMMPCore` + `PMMPCore.db`).

### Plugin architecture

- Decoupled plugins in `scripts/plugins/<PluginName>/`.
- Central loading from `scripts/plugins.js`.
- Mandatory and optional dependencies (`depend`, `softdepend`).
- Consistent lifecycle contract.

### Developer experience

- Core diagnostic commands (`pmmpcore:plugins`, `pmmpcore:pl`, `pmmpcore:pluginstatus`, `pmmpcore:info`, `pmmpcore:pmmphelp`).
- Detailed guides for creating plugins and operating modules.
- Versionable technical documentation within the repo.

## Current Status

- Current phase: **functional prototype in evolution**.
- Stable core for internal use and active testing.
- Active plugins in this repo:
  - `MultiWorld`
  - `EconomyAPI` (pending documentation)
  - `PurePerms` (pending documentation)

## Technical Architecture (summary)

```text
scripts/main.js
  -> PMMPCore.initialize(DatabaseManager)
  -> PMMPCore.enableAll()
  -> plugin.onStartup(event) for enabled plugins only
```

```text
scripts/
  main.js
  PMMPCore.js
  DatabaseManager.js
  plugins.js
  plugins/
    MultiWorld/
    EconomyAPI/
    PurePerms/
```

## Integrated Roadmap

### Phase 1 - Stable framework foundation

- [x] Functional PMMPCore core.
- [x] Centralized plugin registration and enabling.
- [x] Basic persistence with `DatabaseManager`.
- [x] Core base commands.
- [~] Hardening of validations and error handling.

### Phase 2 - Robust MultiWorld

- [x] Basic world CRUD (`create`, `tp`, `list`, `info`, `delete`).
- [x] Types: `normal`, `flat`, `void`, `skyblock`.
- [x] Batch cleanup and recovery (`purgechunks`).
- [x] Configurable main world (`setmain`, `main`).
- [x] Global world spawn control (`setspawn`) and runtime spawn diagnostics (`info`).
- [~] Generation optimization in `normal`.
- [ ] Formal profiling by player load.

### Phase 3 - Plugin platform

- [x] Base contract for plugin creation.
- [x] Plugin development guide.
- [ ] Automatic scaffolding for new plugins.
- [ ] Plugin testing/regression suite.

### Phase 4 - Ecosystem release

- [ ] Freeze public core API.
- [ ] Publish `v1.0.0`.
- [ ] Operational documentation for deployment.
- [ ] Plugin packages by server type.

## Documentation

- General project guide: `docs/PROJECT_DOCUMENTATION.md`
- Plugin creation guide: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- MultiWorld documentation: `docs/MULTIWORLD_DOCUMENTATION.md`
- Documentation index: `docs/README.md`

> Note: Detailed documentation for `EconomyAPI` and `PurePerms` will be published when those APIs are stabilized.

## Contributing

If you contribute to the project:

- maintain compatibility with the Bedrock Script API used by the repo;
- avoid breaking existing core and plugin contracts;
- document relevant functional changes in `docs/`;
- prioritize incremental and verifiable changes.

---

<div align="center">

**Built with passion for the Minecraft Bedrock community**

</div>
