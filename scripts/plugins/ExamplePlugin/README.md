# ExamplePlugin - Template for PMMPCore MultiWorld

Language: **English** | [Español](README.es.md)

## Description

This is a complete template that demonstrates how to use MultiWorld APIs to:

- **Register custom ores** with world/type/dimension scoping
- **Create generation hooks** for custom structures
- **Implement commands** to interact with content
- **Handle game events**
- **Validate content** by world

## Installation

1. Copy the `ExamplePlugin` folder to `scripts/plugins/`
2. Add the import in `scripts/plugins.js`:

```javascript
import "./ExamplePlugin/main.js";
```

3. Restart Minecraft Bedrock with the behavior pack enabled

## Quickstart

1. Start the world.
2. Create a test world:

```text
/mw create test_normal normal
```

3. Teleport:

```text
/mw tp test_normal
```

4. Run ExamplePlugin commands:

```text
/exampleplugin_test
/exampleplugin_ores
/exampleplugin_hooks
```

## Custom Ores

### Mithril Ore
- **Type**: `normal` worlds
- **Range**: Y: -32 to 16
- **Frequency**: 2 veins per chunk, 4 blocks each
- **Block**: Emerald (placeholder)

### Crystal Ore  
- **World**: `crystal_world` specific
- **Range**: Y: -16 to 64
- **Frequency**: 1 vein per chunk, 3 blocks
- **Block**: Diamond (placeholder)

### Dimension Ore
- **Dimension**: `pmmpcore:multiworld_10`
- **Range**: Y: 0 to 50  
- **Frequency**: 3 veins per chunk, 5 blocks
- **Block**: Gold (placeholder)

## Custom Structures

### Crystal Clusters
- **Type**: `normal` worlds
- **Chance**: 5% per chunk
- **Content**: Crystal clusters 2-4 blocks high

### Crystal Pillars  
- **Type**: `normal` worlds
- **Chance**: 2% per chunk
- **Content**: Quartz pillars with glowstone on top

### Special Structures
- **World**: `special_world`
- **Chance**: 10% per chunk  
- **Content**: 5x5 platforms with elevated center

## Commands

### `/exampleplugin_ores`
List all custom ores registered:
```
/exampleplugin_ores
```

### `/exampleplugin_hooks`
List all active generation hooks:
```
/exampleplugin_hooks
```

### `/exampleplugin_test`
Analyze current world and show custom content:
```
/exampleplugin_test
```

## Testing

### Ore Testing
```bash
# Create normal world (should have ores)
/mw create test_normal normal

# Create flat world (should not have ores)  
/mw create test_flat flat

# Create specific world
/mw create crystal_world normal

# Test commands
/exampleplugin_test
/exampleplugin_ores
```

### Structure Testing
```bash
# Teleport and explore
/mw tp test_normal
# Walk around to generate chunks and find structures

# Check in specific world
/mw tp crystal_world
/exampleplugin_hooks
```

## Configuration

The plugin is configured via `scripts/plugins/ExamplePlugin/config.js` (exported as `CONFIG`).

### `CONFIG.plugin`

- `enabled`: enables/disables the plugin
- `debugMode`: extra logs (plugin-level)
- `version`: plugin version string
- `name`: plugin name (must match registration)

### `CONFIG.ores`

- `enabled`: master switch
- `mithril` / `crystal` / `dimension`: individual ore rule entries

Ore rule properties (per entry):

- `enabled`: enables/disables this rule
- `blockId`: block to generate (placeholder in template)
- `minY`, `maxY`: vertical range
- `veinsPerChunk`: frequency
- `veinSize`: blocks per vein
- `replace`: array of block ids that may be replaced
- `seed`: RNG seed for deterministic placement
- `scope`: where the rule applies
  - `type`: `"worldType" | "worldName" | "dimensionId"`
  - `value`: string value for the chosen type

### `CONFIG.structures`

- `enabled`: master switch
- `crystalClusters`, `crystalPillars`, `specialStructures`: structure entries

Structure entry properties:

- `enabled`
- `chance`: probability per chunk (0..1)
- placement params (`minHeight`, `maxHeight`, etc) depending on structure
- `blockId` / `topBlockId` / `platformBlockId` (depends on entry)
- `scope`: same contract as ore rules

### `CONFIG.commands`

Per command key (`ores`, `hooks`, `test`):

- `enabled`
- `permissionLevel`: who may run it (template value: `"any"`)
- `cheatsRequired`: whether cheats are required for the command to function

### `CONFIG.debug`

- `enabled`: master switch
- `logLevel`: `"debug" | "info" | "warn" | "error"`
- `logGeneration`, `logEvents`, `logCommands`: feature-specific logs

### `CONFIG.performance`

- `maxTasksPerHook`: max tasks returned by one generation hook callback
- `taskDelayTicks`: delay between tasks to avoid watchdog
- `chunkProcessingTimeout`: soft timeout in ms for chunk processing flows
- `enableMetrics`: enable template metrics output

## API Reference

### Ore Registration
```javascript
WorldGenerator.registerOreRule({
  id: "my_ore",                    // Unique ID
  blockId: "minecraft:iron_ore",   // Block to generate
  minY: -32, maxY: 64,             // Vertical range
  veinsPerChunk: 3,                // Veins per chunk
  veinSize: 5,                     // Blocks per vein
  replace: ["minecraft:stone"],    // Blocks to replace
  seed: 123,                       // Seed for RNG
  scope: {                         // Optional scope
    type: "worldType",             // "worldType" | "worldName" | "dimensionId"
    value: "normal"                // Corresponding value
  }
});
```

### Hook Registration
```javascript
WorldGenerator.registerGenerationHook({
  id: "my_hook",                   // Unique ID
  seed: 42,                        // Seed for RNG
  scope: {                         // Optional scope
    type: "worldType", 
    value: "normal"
  },
  onChunkGenerated(ctx) {          // Callback function
    // ctx: { dimension, chunkX, chunkZ, worldName, dimensionId, 
    //        worldType, originX, originZ, random() }
    
    // Return task array for async execution (anti-watchdog)
    if (ctx.random() < 0.1) {
      return [
        () => placeBlock1(),
        () => placeBlock2()
      ];
    }
  }
});
```

## Usage Examples

### Biome-Specific Ores (future)
```javascript
WorldGenerator.registerOreRule({
  id: "mountain_silver",
  blockId: "minecraft:silver_ore",
  minY: 80, maxY: 120,
  veinsPerChunk: 2,
  veinSize: 4,
  scope: { type: "biome", value: "mountains" }
});
```

### Complex Structures
```javascript
WorldGenerator.registerGenerationHook({
  id: "dungeon_generator",
  seed: 777,
  scope: { type: "worldType", value: "normal" },
  onChunkGenerated(ctx) {
    if (ctx.random() < 0.02) { // 2% chance
      return this.generateDungeon(ctx);
    }
  },
  
  generateDungeon(ctx) {
    // Complex generation logic
    return tasks; // Array of functions
  }
});
```

## Debug

To enable debug messages:

```javascript
// In MultiWorld config.js
MW_DEBUG = true;

// Or in the plugin
this.config.debugMode = true;
```

## Notes

- Blocks use placeholders (emerald, diamond, etc.)
- Structures are simple examples to demonstrate the API
- The plugin is completely modular and extensible
- Compatible with MultiWorld's scoping system

## Contributing

This template is a starting point. Feel free to:

- Add new ore types
- Create more complex structures
- Implement additional commands
- Improve event handling

---

**Created for**: PMMPCore MultiWorld Framework  
**Version**: 1.0.0  
**Author**: Template Generator

## Languages

Language: **English** | [Español](README.es.md)
