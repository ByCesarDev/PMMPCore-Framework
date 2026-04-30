# PMMPCore

Language: **English** | [Español](README.es.md)

<div align="center">

![PMMPCore Logo](images/PMMPCore.png)

**Modular framework for Minecraft Bedrock Edition (Behavior Packs)**

[![Status](https://img.shields.io/badge/Status-Prototype%20%2F%20Public%20API%20in%20progress-orange)](#status)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/en-us/download/bedrock-edition)

[Quickstart](#quickstart) · [Documentation](#documentation) · [Plugins](#included-plugins) · [Contributing](#contributing)

</div>

---

## What is PMMPCore?

PMMPCore is a modular framework for Bedrock Script API projects, inspired by PocketMine-style plugin ecosystems.

It provides:

- **A predictable plugin lifecycle** (`onLoad`, `onEnable`, `onStartup`, `onWorldReady`, `onDisable`)
- **A shared persistence layer** built on **world Dynamic Properties** (`DatabaseManager`, `PMMPDataProvider`, optional `RelationalEngine`)
- **A unified services layer** (events, commands, scheduler, permissions, migrations)
- **Diagnostics** to keep the platform observable as it grows

PMMPCore is implemented as a Behavior Pack (not a dedicated server mod). It runs inside the limitations of the Bedrock Script API.

---

## Status

- **Project state**: functional prototype with an expanding public API
- **Target**: a stable core usable by third-party plugins inside this repository-based ecosystem

---

## Quickstart

### Requirements

- Minecraft Bedrock (Preview) with Script API enabled (the repo is already placed under a `development_behavior_packs/` path).

### Install / enable

1. Copy (or keep) this folder as a Behavior Pack under:
   - `com.mojang/development_behavior_packs/PMMPCore-Framework`
2. In Minecraft, enable the pack in your world.
3. Start the world, then open chat and run:

```text
/info
```

### Verify everything is working

Run:

```text
/diag
/selftest
```

- `/diag`: shows services, event topics, scheduler tasks, and last tick/flush metrics
- `/selftest`: smoke tests KV + relational layer and prints a summary

### Native SQL shell (toggleable)

PMMPCore includes a native SQL debug shell with global on/off state.

```text
/sqltoggle on
/sqlseed
/sql SELECT * FROM items
/sql upsert items 99 {"name":"AdminBlade","power":250}
/sql delete items 99
/sqltoggle off
```

Notes:

- `/sql select` only accepts `SELECT` queries from the SQL subset implemented by `RelationalEngine`.
- `/sql upsert` expects JSON inline (`<table> <id> <json-object>`).
- SQL shell commands require SQL permissions (`pmmpcore.sql.read`/`write`/`admin`) and respect the global toggle.

---

## Included plugins

PMMPCore is a framework plus a curated set of core plugins living under `scripts/plugins/`.

Current included plugins:

- **MultiWorld**: dimension-backed custom worlds with commands and persistence
- **PurePerms**: permissions and groups, with a stable core-facing permission contract
- **PlaceholderAPI**: dynamic `%placeholder%` parser with built-in expansions and plugin runtime registry
- **PureChat**: group-based chat formats, player prefix/suffix, and nametag templates
- **ExamplePlugin**: reference plugin showing MultiWorld hooks and patterns

See each plugin’s documentation under `docs/plugins/`.

---

## Documentation

Start here:

- **Docs index**: `docs/README.md`

Core references:

- **Public API (core services, lifecycle, stability levels)**: `docs/API_PUBLIC_GUIDE.md`
- **Database layer (KV, WAL, DataProvider, RelationalEngine + SQL subset)**: `docs/DATABASE_GUIDE.md`
- **Project architecture and runtime pipeline**: `docs/PROJECT_DOCUMENTATION.md`

Plugin authors:

- **Plugin development guide**: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- **Plugin migration guide (legacy → API v1 patterns)**: `docs/PLUGIN_MIGRATION_GUIDE.md`

---

## Repository structure (high level)

```text
scripts/
  main.js                  # boot pipeline (worldLoad-safe init + diagnostics)
  PMMPCore.js               # core facade + service registry
  DatabaseManager.js        # persistence: cache + dirty buffer + flush + WAL hook
  api/                      # public export surface for third-party plugins
  core/                     # events, scheduler, permissions, observability, etc.
  db/                       # relational engine, codecs, migrations, WAL
  plugins/
    MultiWorld/
    PurePerms/
    PlaceholderAPI/
    ExamplePlugin/
docs/
  README.md                 # documentation index
  DATABASE_GUIDE.md
  API_PUBLIC_GUIDE.md
  PROJECT_DOCUMENTATION.md
  plugins/                  # plugin manuals (usage + configuration)
```

---

## Contributing

- Keep compatibility with the Bedrock Script API version used by this repo.
- Prefer **backwards-compatible** changes for `stable` APIs.
- Document changes in `docs/` (and add an `.es.md` counterpart when applicable).
- Avoid direct `world.getDynamicProperty` / `world.setDynamicProperty` usage for PMMPCore data; use `PMMPCore.db`.
