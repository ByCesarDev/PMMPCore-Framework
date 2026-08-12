# PMMPCore

Language: **English** | [Español](README.es.md)

<div align="center">

![PMMPCore Logo](images/PMMPCore.png)

**Modular Framework for Minecraft Bedrock Edition (Behavior Packs)**

[![Status](https://img.shields.io/badge/Status-Stable%20v1.1.5-brightgreen)](#status)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/en-us/download/bedrock-edition)

[Quick Start](#quick-start) · [Documentation](#documentation) · [Ecosystem](#standalone-addons-ecosystem) · [Contributing](#contributing)

</div>

## Table of Contents

1. [What is PMMPCore?](#what-is-pmmpcore)
2. [Status](#status)
3. [Quick Start](#quick-start)
4. [Standalone Addons Ecosystem](#standalone-addons-ecosystem)
5. [Documentation](#documentation)
6. [Repository Structure (High Level)](#repository-structure-high-level)
7. [Contributing](#contributing)
8. [FAQ](#faq)

---

## What is PMMPCore?

PMMPCore is a powerful modular framework for Bedrock Script API projects, inspired by the PocketMine plugin ecosystem. It acts as the central communication hub and database core for a whole family of external Addons.

Includes:

- **Communication Bus (InterAddonBridge v1)**: Synchronous network interface for external Addons to interact with the framework via `scriptevent`.
- **Dual Permission Engine**: Logical in-memory permission system (`PurePermsPermissionService`) tightly bound to native Operator commands (`commandPermissionLevel`).
- **Centralized Persistence (KV and SQL)**: Unified safe read/write access for all Addons featuring relational engines, buffers, and Write-Ahead Logging (`DatabaseManager`).
- **Predictable Lifecycle**: Controlled component loading and hooks.

PMMPCore is distributed as a **Behavior Pack** and operates strictly within the limitations and standards of the Bedrock Script API Sandbox.

---

## Status

- **Project Status**: Stable `v1.1.5`.
- **Goal**: To provide an ultra-fluid central core (0ms ram query latency) so the official Addon suite and third parties can build advanced mechanics in Bedrock.

---

## Quick Start

### Requirements

- Minecraft Bedrock 1.21.0+ with **Beta APIs** enabled if you wish to use Addons like PureChat.

### Install / Enable

1. Download the `PMMPCore-Framework.mcpack` file.
2. Import the file into Minecraft Bedrock.
3. Activate the Behavior Pack in your world.
4. Join the world and run `/diag` to validate core integrity.

### Verification

- `/diag`: Verifies services, event bus, scheduler tasks, and memory metrics.
- `/selftest`: Tests KV relational read/write capabilities and the IPC protocol.

---

## Standalone Addons Ecosystem

In previous versions, plugins were embedded within the framework's repository. As of **v1.1.5**, **ALL plugins are autonomous** and are distributed in their own repositories / `.mcpack` files.

For the complete experience, you must download the Addons you need and enable them alongside PMMPCore:

- **MultiWorld**: Custom dynamic worlds and dimensions.
- **PurePerms**: The master ranks and permissions engine, emitting hierarchies to RAM.
- **PureChat**: Real-time chat formatting, nametags, and prefixes (requires Beta APIs).
- **ScoreHud**: Fluid 100ms (2 ticks) scoreboard integrating TPS, CPU %, money, and ranks.
- **EconomyAPI**: Transactions and virtual currency engine.
- **PlaceholderAPI**: `%...%` placeholders extensibility for all Addons.
- **EssentialsTP**: TPA, homes, and warps system.
- **FormAPI**: Complex GUI construction in Bedrock.

*(Note: Each of these Addons contains its own technical manual `docs/` and license inside its package).*

---

## Documentation

Start with:

- **Docs Index**: `docs/README.md`

Core references:

- **Public API (services and IPC bridge)**: `docs/API_PUBLIC_GUIDE.md`
- **Database (KV, RelationalEngine + SQL)**: `docs/DATABASE_GUIDE.md`
- **Addon Development Guide V1 (Standalone)**: `docs/INTER_ADDON_DEVELOPMENT_GUIDE.md`

---

## Repository Structure (High Level)

```text
scripts/
  main.js                  # Safe initialization pipeline
  PMMPCore.js              # Core and service registry
  client/                  # SDK client modules
  core/                    # IPC bridge (InterAddonBridge), events, permissions
  db/                      # RelationalEngine, Codecs, Storage
docs/
  README.md                # Central index
  INTER_ADDON...md         # Addon creation protocol
  ...
```

---

## Contributing

- Always prioritize **backward-compatible** changes in the public API.
- Use the IPC bridge's `bus_event` system to connect decoupled modules.

---

## FAQ

**Q: Where is the `scripts/plugins/` folder?**  
A: It has been removed. Starting with v1.1.5, the architecture is 100% modular. You must download the official plugins separately and activate them as additional packs in your world.

**Q: Why doesn't PureChat show prefixes on my server?**  
A: Bedrock implements native chat interception under script experiments. You must activate **Beta APIs** in your world settings and ensure you have PurePerms loaded.

**Q: What happens if I remove the PMMPCore Behavior Pack?**  
A: The independent Addons will detect the IPC engine failure and safely disable themselves, but your data saved in the world (KV) will not be lost.
