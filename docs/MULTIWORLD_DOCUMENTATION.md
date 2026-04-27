# PMMPCore MultiWorld - Detailed Documentation

## 1. Scope

This document covers the architecture, commands, persistence and behavior of `MultiWorld`.

It does not cover (for now):

- EconomyAPI.
- PurePerms.

## 2. MultiWorld Objective

To provide custom worlds in dedicated dimensions, with:

- Safe creation and deletion by owner.
- Teleport and runtime activation.
- Procedural generation by world type.
- Batch chunk cleanup.
- Configurable main world for spawn/recovery.

## 3. Module Structure

Location:

```text
scripts/plugins/MultiWorld/
  main.js
  config.js
  state.js
  manager.js
  generator.js
  commands.js
```

Responsibilities:

- `main.js`: plugin bootstrap and runtime loops.
- `config.js`: constants and types.
- `state.js`: shared in-memory state.
- `manager.js`: world CRUD, flush/load, runtime control.
- `generator.js`: chunk generation and cleanup.
- `commands.js`: handlers and command registration.

## 4. Supported World Types

Currently:

- `normal`: vanilla-type terrain with relief and oaks.
- `flat`: configurable flat terrain at height.
- `void`: empty dimension.
- `skyblock`: initial L-shaped island, with tree and chest.

## 5. Available Commands

Root command:

- `/pmmpcore:mw <subcommand> ...`

Autocomplete support:

- `subcommand` is registered as enum (`pmmpcore:mw_subcommand`).
- world `type` in `create` is registered as enum (`pmmpcore:mw_world_type`).
- Short alias `/mw` is not registered through `customCommandRegistry` because Bedrock requires namespaced command names.

Subcommands:

- `create <name> [type] [dimension]`
- `tp <name>`
- `list`
- `delete <name>`
- `purgechunks <name>`
- `info <name>`
- `setmain <name>`
- `setspawn <name>`
- `main`
- `help`

Notes:

- `type` default in `create` is `normal`.
- `dimension` optional between 1 and 50.
- `delete` and `purgechunks` only for the world owner.
- `setspawn` updates the global spawn of a custom world to the player's current location.

## 6. World Creation Flow

1. Validate name, type and dimension.
2. Reserve free dimension in pool.
3. Create `WorldData` with initial metadata.
4. Mark state as dirty.
5. Persist in flush.

Relevant `WorldData` fields:

- `id`, `type`, `owner`
- `dimensionId`, `dimensionNumber`
- `spawn`
- `loaded`, `createdAt`, `lastUsed`

## 7. Teleport Flow

1. Resolve if destination is vanilla or custom.
2. If custom: activate world at runtime.
3. Create temporary ticking area for initial environment.
4. Pre-generate spawn according to type.
5. Player teleport.
6. Remove temporary ticking area.

Overworld-specific spawn resolution priority:

1. player personal spawnpoint (`player.getSpawnPoint()`), if valid.
2. world default spawn (`world.getDefaultSpawnLocation()`), if valid.
3. safe runtime scan (`safe-scan-fallback`) to find valid ground.
4. static fallback config as last resort.

Custom-world spawn resolution:

- Uses saved `WorldData.spawn` as preferred point.
- Validates against terrain at runtime and resolves safe ground when needed.
- If a better safe spawn is found, `WorldData.spawn` is updated and persisted.

## 8. Procedural Generation

### 8.1 `normal`

- Height by deterministic 2D noise.
- Strata:
  - `bedrock` at `-64`
  - `stone` until subsoil
  - `dirt` under surface
  - `grass` on surface
- Oak trees by deterministic probability and grid separation.
- Applied optimization: vertical range filling with `fillBlocks` and safe fallback.

### 8.2 `flat`

- Base at `FLAT_WORLD_TOP_Y` (currently negative).
- Layers of stone/dirt/grass and lower bedrock.

### 8.3 `void`

- Marks chunk as generated without building blocks.

### 8.4 `skyblock`

- Generates only initial central chunk.
- L-style island.
- Tree and initial chest.
- No bedrock at island base.

## 9. Continuous Generation by Player

Main loop:

- Executes with `GENERATION_TICK_RATE`.
- Detects players in active worlds.
- Generates around player by chunk proximity.
- Budget per cycle: `CHUNKS_PER_TICK`.

## 10. World Deletion and Chunk Cleanup

### `delete`

- Removes world metadata.
- Cleans chunks in batch without extra aggressive sweep.
- If player is in that world, moves them first to main world.

### `purgechunks`

- Does not remove world metadata.
- Cleans generated chunks as recovery operation.
- Includes extra safety sweep (configurable by constants).

### Batch Cleanup Pipeline

- Construction of target chunk list (tracked + fallback radial).
- Batch processing (`CLEAR_BATCH_SIZE`).
- Vertical segmentation to avoid volume limits.
- Temporary ticking areas per tile.
- Progress messages per batch.

## 11. Configurable Main World

Persisted config by plugin:

- `mainWorldTarget` in `plugin:MultiWorld`.

Commands:

- `setmain <name>`: defines main world (vanilla or custom).
- `setspawn <name>`: sets global spawn for your custom world using your current position.
- `main`: shows configuration and resolved destination.

Behavior:

- First spawn of new player -> redirects to main world.
- Respawn without personal spawnpoint -> redirects to main world.
- If configured destination does not exist -> fallback to overworld.
- Spawn fallback chain is explicit and inspectable in `info`.

## 11.1 Spawn Diagnostics in `info`

`/pmmpcore:mw info <world>` now reports:

- `Spawn (saved)`: spawn stored in world metadata/config.
- `Spawn (resolved now)`: effective spawn resolved at runtime.
- `Spawn source` (vanilla worlds): origin of resolved spawn:
  - `player-spawn-point`
  - `world-default-spawn`
  - `safe-scan-fallback`
  - `fallback-config`

## 12. Data Persistence

Keys used in DB:

- `mw:index` -> world list
- `mw:world:<name>` -> world data
- `mw:chunks:<name>` -> generated chunks

Strategy:

- Dirty flag in memory.
- Flush on-demand (create/delete/autosave/disable).
- Complete load at initial worldLoad.

## 13. Functional Security

Implemented controls:

- Ownership in destructive operations.
- Type/dimension validation in `create`.
- Teleport and world resolution fallbacks.

## 14. Recommended Performance Settings

If there is lag:

- lower `CHUNKS_PER_TICK`.
- increase `GENERATION_TICK_RATE`.
- adjust generation radius.
- review `CLEAR_BATCH_SIZE` if cleanup impacts TPS.

If cleanup aggressiveness is lacking:

- use `purgechunks`.
- adjust safety radii in `config.js`.

## 15. Suggested Pending Items

- Runtime configuration by command of generation parameters.
- Simple profiler by chunk/min metrics per world.
- Officially document `WorldData` migration strategy.
