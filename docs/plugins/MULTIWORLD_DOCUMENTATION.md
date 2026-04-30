# PMMPCore MultiWorld - Detailed Documentation

Language: **English** | [Español](MULTIWORLD_DOCUMENTATION.es.md)

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

## 3.1 Configuration reference (`scripts/plugins/MultiWorld/config.js`)

MultiWorld is configured by editing constants in `scripts/plugins/MultiWorld/config.js`.

### Capacity and activity

- `MAX_ACTIVE_WORLDS`: max number of custom worlds kept active at once.
- `INACTIVE_TIMEOUT`: time (ms) after which an inactive world can be unloaded.
- `TOTAL_DIMENSIONS`: size of the custom dimension pool (default 50).

### Generation pacing and performance

- `GENERATION_RADIUS`: radius (in chunks) around the player to consider for generation work.
- `CHUNKS_PER_TICK`: generation budget per player/cycle (higher = faster generation, more lag risk).
- `GENERATION_TICK_RATE`: how often generation runs (ticks). Default 10 (\(\approx\) 0.5s).

### Cleanup / deletion policy

- `CLEAR_RADIUS`: base cleanup radius (in chunks) around spawn when purging.
- `CLEAR_BATCH_SIZE`: number of columns per batch when deleting/purging chunks.
- `CLEAR_TICKS_PER_BATCH`: ticks between cleanup batches (1 = fastest).
- `CLEAR_BATCHES_PER_CYCLE`: number of batches launched per cleanup cycle.

### Safety sweep (recommended)

MultiWorld can perform an additional “safety sweep” beyond tracked chunks to reduce the risk of leaving orphan terrain:

- `DELETE_SAFETY_SWEEP`: master switch for safety sweep behavior.
- `DELETE_SAFETY_RADIUS`: fallback sweep radius (in chunks). Warning: large values imply large areas.
- `DELETE_SAFETY_RADIUS_WHEN_TRACKED`: smaller sweep when tracked chunks already exist (faster).

### Cleanup profiles

`CLEANUP_PROFILES` defines tuning profiles and `CLEANUP_PROFILE` selects which profile is active.

- `CLEANUP_PROFILE`: `"safe" | "balanced" | "aggressive"`
- `resolveCleanupPolicy(mode)`: returns the concrete policy for `"delete"` or `"purge"`.

### Debug and metrics

- `MW_DEBUG`: extra debug logging.
- `MW_METRICS`: metrics logging for generation/cleanup loops.

### World types and vanilla worlds

- `WORLD_TYPES`: `"normal" | "flat" | "void" | "skyblock"` (used by `/pmmpcore:mw create`).
- `VANILLA_WORLDS`: alias and label mapping for `overworld`, `nether`, `end`.
- `resolveVanillaWorld(name)`: resolves aliases like `ow` → overworld.

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
- `keepmode <on|off>`
- `info <name>`
- `setmain <name>`
- `setspawn <name>`
- `setlobby <name> <on|off>`
- `main`
- `help`

Notes:

- `type` default in `create` is `normal`.
- `dimension` optional between 1 and 50.
- `delete` and `purgechunks` only for the world owner.
- `keepmode` is stored per-player and controls whether the caller is kept in-dimension during delete/purge.
- During active cleanup lock, keepmode is ignored and players are evacuated from target dimension for safety.
- `setspawn` updates global spawn using the player's current location.
- `setspawn` supports custom and vanilla worlds (`overworld`, `nether`, `end`).
- For vanilla worlds, spawn is stored as a persistent MultiWorld override.
- `setlobby` applies to custom worlds and toggles `forceSpawnOnJoin`.

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
- `forceSpawnOnJoin` (optional lobby-like behavior)
- `loaded`, `createdAt`, `lastUsed`

## 7. Teleport Flow

1. Resolve if destination is vanilla or custom.
2. If custom: activate world at runtime.
3. Create temporary ticking area for initial environment.
4. Pre-generate spawn according to type.
5. Player teleport.
6. Remove temporary ticking area.

Join routing behavior:

1. If a valid last known player location exists and belongs to a non-main world, player is restored there.
2. If that world has `forceSpawnOnJoin = true`, player is sent to that world's spawn instead.
3. If last location is unavailable/invalid/main world, plugin routes to configured main world.

Lobby-mode clarification:

- When `forceSpawnOnJoin` is enabled (`setlobby <world> on`), reconnect routing prioritizes the world's global spawn over the player's last saved location.

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
- Generation order (normal worlds):
  1. base terrain (bedrock/stone/soil/grass)
  2. ores/minerals (`WorldGenerator` ore rules)
  3. custom generation hooks (scoped callbacks)
  4. features (trees)

### 8.1.1 Extending generation (Ores + Hooks API)

MultiWorld exposes a lightweight API via `WorldGenerator` to let other plugins add:
- **Ore/mineral rules** (including scoping per world/dimension/type)
- **Custom generation hooks** (callbacks executed per generated chunk, scoped)

The implementation lives in:
- `scripts/plugins/MultiWorld/generator.js`

#### Ore rules API

Register a rule:

```js
import { WorldGenerator } from "./plugins/MultiWorld/generator.js";

WorldGenerator.registerOreRule({
  id: "mythril",
  blockId: "minecraft:emerald_ore",
  minY: -32,
  maxY: 16,
  veinsPerChunk: 1,
  veinSize: 4,
  replace: ["minecraft:stone"],
  seed: 99,
  scope: { type: "dimensionId", value: "pmmpcore:multiworld_7" },
});
```

Supported `scope` types:
- `{ type: "dimensionId", value: "<dimension id>" }`
- `{ type: "worldName", value: "<custom world name>" }`
- `{ type: "worldType", value: "normal|flat|void|skyblock" }`

Notes:
- Rules without `scope` apply everywhere the ore generator is invoked (currently normal worlds).
- Seeds are deterministic per chunk.

#### Generation hooks API

Hooks run after base terrain + ores, and before features (trees). A hook can optionally return an **array of tasks** (functions). When tasks are returned, MultiWorld executes them **sliced across ticks** to reduce watchdog risk.

Register a hook:

```js
import { BlockPermutation } from "@minecraft/server";
import { WorldGenerator } from "./plugins/MultiWorld/generator.js";

WorldGenerator.registerGenerationHook({
  id: "crystals_world7",
  seed: 123,
  scope: { type: "dimensionId", value: "pmmpcore:multiworld_7" },
  onChunkGenerated(ctx) {
    // ctx: { dimension, chunkX, chunkZ, worldName, dimensionId, worldType, originX, originZ, random() }
    // Return tasks to run over time (anti-watchdog).
    const tasks = [];
    const placeOne = () => {
      const x = ctx.originX + Math.floor(ctx.random() * 16);
      const z = ctx.originZ + Math.floor(ctx.random() * 16);
      const y = -40 + Math.floor(ctx.random() * 30);
      const b = ctx.dimension.getBlock({ x, y, z });
      if (b && b.typeId === "minecraft:stone") {
        b.setPermutation(BlockPermutation.resolve("minecraft:amethyst_block"));
      }
    };
    for (let i = 0; i < 8; i++) tasks.push(placeOne);
    return tasks;
  },
});
```

Safety guidelines:
- Keep `onChunkGenerated` fast. Prefer returning tasks instead of doing heavy synchronous loops.
- Use deterministic randomness (provided as `ctx.random()`).


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
- Cleans chunks in batch using policy from `resolveCleanupPolicy("delete")`.
- Uses `tracked + safety sweep` or fallback radial clear, depending on tracking and policy.
- While cleanup runs, world and dimension are locked; teleport/create/re-delete into that target is blocked.
- Players in the target dimension are moved out before cleanup starts.

### `purgechunks`

- Does not remove world metadata.
- Cleans generated chunks as recovery operation.
- Uses policy from `resolveCleanupPolicy("purge")` (typically wider than delete).
- While cleanup runs, world and dimension are locked; teleport/create/re-purge into that target is blocked.
- Players in the target dimension are moved out before cleanup starts.

### `keepmode`

- `keepmode on`: caller preference to remain in-dimension for delete/purge.
- `keepmode off`: caller preference to move to main world first.
- Behavior during cleanup:
  - When ON and the caller is inside the target dimension, the caller stays.
  - Any other players in that same dimension are evacuated to main world before cleanup starts.
  - World + dimension locks still apply (teleport/create/re-delete/re-purge into that target is blocked).

### Batch Cleanup Pipeline

- Construction of target chunk list (tracked + fallback radial).
- Batch processing (`CLEAR_BATCH_SIZE`).
- Vertical segmentation to avoid volume limits.
- Temporary ticking areas per tile.
- Intra-tile micro-slices (`runTimeout`) to avoid watchdog hangs.
- Progress messages every batch.

## 11. Configurable Main World

Persisted config by plugin:

- `mainWorldTarget` in `plugin:MultiWorld`.

Commands:

- `setmain <name>`: defines main world (vanilla or custom).
- `setspawn <name>`: sets global spawn for custom or vanilla world using your current position.
- `setlobby <name> <on|off>`: enables/disables lobby mode (`forceSpawnOnJoin`) for a custom world.
- `main`: shows configuration and resolved destination.

Behavior:

- First spawn of new player -> redirects to main world.
- Respawn without personal spawnpoint -> redirects to main world.
- If configured destination does not exist -> fallback to overworld.
- Spawn fallback chain is explicit and inspectable in `info`.
- Non-main worlds can restore players to their previous location on reconnect.
- Worlds flagged with `forceSpawnOnJoin` behave as lobby/spawn-forced worlds.
- In lobby mode, reconnect uses world spawn even if a previous location was saved.

## 11.1 Spawn Diagnostics in `info`

`/pmmpcore:mw info <world>` now reports:

- `Spawn (saved)`: spawn stored in world metadata/config.
- `Spawn (resolved now)`: effective spawn resolved at runtime.
- `Spawn source` (vanilla worlds): origin of resolved spawn:
  - `saved-override`
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
- Player last location is stored under player data (`multiWorld.lastLocation`).

### `WorldData` contract (current)

Required fields:
- `id` (string)
- `type` (`normal|flat|void|skyblock`)
- `owner` (string)
- `dimensionId` (string)
- `dimensionNumber` (number)
- `spawn` (`{x,y,z}`)
- `createdAt` (epoch ms)
- `lastUsed` (epoch ms)
- `loaded` (boolean runtime state)

Optional fields:
- `forceSpawnOnJoin` (boolean): lobby-like mode that forces world spawn on reconnect.
- `playerData.multiWorld.keepMode` (boolean): per-player cleanup movement preference.

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

### Cleanup profiles and diagnostics

- Cleanup behavior is profile-driven in `config.js` via `resolveCleanupPolicy(mode)`.
- `delete` now uses tracked chunks plus a short configurable sweep to reduce leftover terrain.
- `purgechunks` keeps an aggressive recovery sweep.
- Completion messages include requested vs cleared chunk counts when mismatch is detected.
- Optional diagnostics:
  - `MW_DEBUG=true`: structured warnings in generator fallback paths.
  - `MW_METRICS=true`: periodic logs (`generated_chunks_per_min`, cleanup timing stats).

## 15. Configuration Constants Reference

### 15.1 World Management Constants

| Constant | Value | Purpose | Impact |
|----------|-------|---------|--------|
| `MAX_ACTIVE_WORLDS` | 10 | Maximum simultaneous active worlds | Memory usage & server performance |
| `INACTIVE_TIMEOUT` | 300000ms (5 min) | Time before inactive worlds unload | Resource management |
| `TOTAL_DIMENSIONS` | 50 | Total available dimensions | World creation limits |

### 15.2 Generation Performance Constants

| Constant | Value | Purpose | Tuning Notes |
|----------|-------|---------|--------------|
| `GENERATION_RADIUS` | 10 chunks | Generation radius around players | Higher = more chunks per player |
| `CHUNKS_PER_TICK` | 6 | Chunk budget per player/cycle | Lower = less lag, slower generation |
| `GENERATION_TICK_RATE` | 10 ticks (~0.5s) | Generation frequency | Higher = less frequent, more spread load |

### 15.3 Cleanup & Deletion Constants

| Constant | Value | Purpose | Performance Impact |
|----------|-------|---------|-------------------|
| `CLEAR_RADIUS` | 150 chunks | Deletion radius from spawn | Larger = more thorough cleanup |
| `CLEAR_BATCH_SIZE` | 450 columns | Blocks per deletion batch | Higher = faster cleanup, more lag |
| `CLEAR_TICKS_PER_BATCH` | 1 tick | Delay between batches | 1 = maximum speed |
| `CLEAR_BATCHES_PER_CYCLE` | 2 batches | Batches per cleanup cycle | Higher = faster cleanup |
| `DELETE_SAFETY_SWEEP` | true | Enable extra safety sweep | More thorough, slower |
| `DELETE_SAFETY_RADIUS` | 220 chunks | Extra sweep radius | Very thorough cleanup |
| `DELETE_SAFETY_RADIUS_WHEN_TRACKED` | 40 chunks | Reduced sweep when tracking | Faster when chunks tracked |
| `MW_DEBUG` | false | Enable structured debug warnings | Better diagnostics, more logs |
| `MW_METRICS` | false | Enable periodic metrics logs | Visibility into generation/cleanup rate |

### 15.4 World Type Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `FLAT_WORLD_TOP_Y` | -53 | Grass level for flat worlds |
| `WORLD_TYPES.NORMAL` | "normal" | Vanilla-style terrain |
| `WORLD_TYPES.FLAT` | "flat" | Flat terrain |
| `WORLD_TYPES.VOID` | "void" | Empty dimension |
| `WORLD_TYPES.SKYBLOCK` | "skyblock" | Island-style world |

## 16. Performance Tuning Guide

### 16.1 For Laggy Servers

Reduce generation load:
```javascript
// Lower chunk generation per cycle
CHUNKS_PER_TICK = 3;           // Default: 6
GENERATION_TICK_RATE = 20;      // Default: 10
GENERATION_RADIUS = 6;         // Default: 10
```

### 16.2 For Fast Cleanup

Increase deletion speed:
```javascript
// Faster but more intensive cleanup
CLEAR_BATCH_SIZE = 600;        // Default: 450
CLEAR_BATCHES_PER_CYCLE = 3;   // Default: 2
```

### 16.3 For Memory-Constrained Servers

Reduce active worlds:
```javascript
MAX_ACTIVE_WORLDS = 5;         // Default: 10
INACTIVE_TIMEOUT = 180000;     // 3 minutes (Default: 5 min)
```

### 16.4 For High-Performance Servers

Increase capacity:
```javascript
// More simultaneous worlds
MAX_ACTIVE_WORLDS = 15;        // Default: 10
// Faster generation
CHUNKS_PER_TICK = 10;          // Default: 6
GENERATION_TICK_RATE = 5;      // Default: 10
```

## 17. Troubleshooting Common Issues

### 17.1 "No available dimensions" Error
- **Cause**: All 50 dimensions are in use
- **Solution**: Delete unused worlds or increase `TOTAL_DIMENSIONS`

### 17.2 Generation Too Slow
- **Cause**: `CHUNKS_PER_TICK` too low or many players
- **Solution**: Increase `CHUNKS_PER_TICK` or decrease `GENERATION_TICK_RATE`

### 17.3 Cleanup Taking Too Long
- **Cause**: Large `CLEAR_RADIUS` or small `CLEAR_BATCH_SIZE`
- **Solution**: Increase `CLEAR_BATCH_SIZE` or use `purgechunks` command

### 17.5 Dimension Locked During Cleanup
- **Cause**: `delete` or `purgechunks` is currently running for a world/dimension
- **Expected behavior**: `tp/create/delete/purge` targeting that locked dimension is denied until cleanup finishes
- **Solution**: Wait for cleanup completion message, then retry

### 17.4 Memory Issues
- **Cause**: Too many active worlds
- **Solution**: Reduce `MAX_ACTIVE_WORLDS` or decrease `INACTIVE_TIMEOUT`

## 18. Suggested Pending Items

- Runtime configuration by command of generation parameters.
- Simple profiler by chunk/min metrics per world.
- Officially document `WorldData` migration strategy.

---

## 19. Installation and Enablement (Step-by-step)

1. Ensure `MultiWorld` folder exists at `scripts/plugins/MultiWorld/`.
2. Confirm import in `scripts/plugins.js`:
   - `import "./plugins/MultiWorld/main.js";`
3. Start world and confirm load logs:
   - `Loading modular MultiWorld plugin...`
4. Run smoke commands:
   - `/pmmpcore:mw help`
   - `/pmmpcore:mw list`
   - `/pmmpcore:diag`

If these succeed, MultiWorld is wired correctly.

## 20. Quickstart (First 5 minutes)

1. Create world:
   - `/pmmpcore:mw create demo normal`
2. Teleport:
   - `/pmmpcore:mw tp demo`
3. Inspect runtime info:
   - `/pmmpcore:mw info demo`
4. Set as main world (optional):
   - `/pmmpcore:mw setmain demo`
5. Test cleanup in a non-production test world:
   - `/pmmpcore:mw purgechunks demo`

## 21. Lifecycle Integration (What MultiWorld does and when)

- `onEnable()`
  - Registers internal state, migration hooks, service references.
- `onStartup(event)`
  - Registers commands and command enums.
- `onWorldReady()`
  - Runs migration-safe data load, world index hydration, permission seed behavior.
- `onDisable()`
  - Flushes pending world state and clears runtime intervals/tasks.

Why this matters: world access is deferred to world-ready-safe phases, avoiding early-execution failures.

## 22. Operational Permission Model

MultiWorld applies ownership and role-style controls in command handlers:

- Destructive actions (`delete`, `purgechunks`) are owner-restricted.
- Main-world and spawn-changing operations should be treated as admin-level actions.
- If your server enforces external permission nodes, add command guards consistently in `commands.js` (recommended plugin-scoped nodes).

Recommended node naming (if extending):

- `pperms.command.multiworld.create`
- `pperms.command.multiworld.tp`
- `pperms.command.multiworld.delete`
- `pperms.command.multiworld.purge`
- `pperms.command.multiworld.setmain`

## 23. Migration and Compatibility Notes

When evolving `WorldData` structure:

1. Add new fields as optional first.
2. Backfill defaults during load or migration phase.
3. Keep old fields readable for at least one transition cycle.
4. Persist normalized objects only after compatibility transforms.

This prevents old worlds from failing hard after updates.

## 24. FAQ

### Why does `/mw` alias not exist?

Bedrock custom commands require `namespace:value`; MultiWorld uses `/pmmpcore:mw`.

### Can I increase world capacity beyond 50?

Yes by increasing `TOTAL_DIMENSIONS`, but test memory/performance carefully.

### Why is my cleanup blocked with lock messages?

A `delete`/`purgechunks` operation is still in progress for that target world/dimension.

### Why does lobby mode ignore last player location?

`forceSpawnOnJoin=true` intentionally prioritizes global world spawn over last saved location.

### Which should I tune first for lag?

Start with `CHUNKS_PER_TICK`, then `GENERATION_TICK_RATE`, then generation/cleanup radii.

## 25. Release Checklist (MultiWorld)

- [ ] Command registration works after restart.
- [ ] Create/tp/list/info flows work for custom and vanilla targets.
- [ ] Spawn routing behaves correctly in normal and lobby mode.
- [ ] Cleanup locks engage and release correctly.
- [ ] No early-execution DB errors appear in logs.
- [ ] World data persists correctly across restart.
