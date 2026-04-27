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

### `/pmmpcore:exampleplugin_ores`
List all custom ores registered:
```
/pmmpcore:exampleplugin_ores
```

### `/pmmpcore:exampleplugin_hooks`
List all active generation hooks:
```
/pmmpcore:exampleplugin_hooks
```

### `/pmmpcore:exampleplugin_test`
Analyze current world and show custom content:
```
/pmmpcore:exampleplugin_test
```

## Testing

### Ore Testing
```bash
# Create normal world (should have ores)
/pmmpcore:mw create test_normal normal

# Create flat world (should not have ores)  
/pmmpcore:mw create test_flat flat

# Create specific world
/pmmpcore:mw create crystal_world normal

# Test commands
/pmmpcore:exampleplugin_test
/pmmpcore:exampleplugin_ores
```

### Structure Testing
```bash
# Teleport and explore
/pmmpcore:mw tp test_normal
# Walk around to generate chunks and find structures

# Check in specific world
/pmmpcore:mw tp crystal_world
/pmmpcore:exampleplugin_hooks
```

## Configuration

The plugin has basic configuration in `onEnable()`:

```javascript
this.config = {
  enabled: true,           // Plugin enabled
  debugMode: false,        // Debug mode
  customOres: true,        // Generate custom ores
  customStructures: true,  // Generate custom structures
};
```

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
