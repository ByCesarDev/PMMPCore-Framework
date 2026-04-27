import { world, system, BlockPermutation, Player, CommandPermissionLevel } from "@minecraft/server";
import { PMMPCore, Color } from "../../PMMPCore.js";
import { WorldGenerator } from "../MultiWorld/generator.js";

console.log("[ExamplePlugin] Loading example plugin template...");

PMMPCore.registerPlugin({
  name: "ExamplePlugin",
  version: "1.0.0",
  depend: ["PMMPCore", "MultiWorld"],

  onEnable() {
    console.log(`${Color.aqua}[ExamplePlugin] Enabling plugin...${Color.reset}`);
    
    // Inicializar configuración del plugin
    this.config = {
      enabled: true,
      debugMode: false,
      customOres: true,
      customStructures: true,
    };
    
    // Registrar contenido personalizado
    this.registerCustomContent();
    
    // Suscribir a eventos del mundo
    this.setupEventHandlers();
    
    console.log(`${Color.green}[ExamplePlugin] Plugin enabled successfully!${Color.reset}`);
  },

  onStartup(event) {
    console.log(`${Color.aqua}[ExamplePlugin] Registering commands...${Color.reset}`);
    
    // Registrar comandos del plugin
    this.registerCommands(event);
  },

  onDisable() {
    console.log(`${Color.yellow}[ExamplePlugin] Disabling plugin...${Color.reset}`);
    
    // Limpieza de recursos si es necesario
    this.cleanup();
  },

  // ============== REGISTRO DE CONTENIDO PERSONALIZADO ==============
  registerCustomContent() {
    if (!this.config.customOres) return;
    
    console.log("[ExamplePlugin] Registering custom ores...");
    
    // Ejemplo: Mineral de Mithril solo en mundos de tipo "normal"
    WorldGenerator.registerOreRule({
      id: "mithril_ore",
      blockId: "minecraft:emerald_ore", // Usamos emerald como placeholder
      minY: -32,
      maxY: 16,
      veinsPerChunk: 2,
      veinSize: 4,
      replace: ["minecraft:stone"],
      seed: 999,
      scope: { type: "worldType", value: "normal" },
    });
    
    // Ejemplo: Mineral de Cristal en un mundo específico
    WorldGenerator.registerOreRule({
      id: "crystal_ore", 
      blockId: "minecraft:diamond_ore", // Placeholder
      minY: -16,
      maxY: 64,
      veinsPerChunk: 1,
      veinSize: 3,
      replace: ["minecraft:stone"],
      seed: 1234,
      scope: { type: "worldName", value: "crystal_world" },
    });
    
    // Ejemplo: Mineral en dimensión específica
    WorldGenerator.registerOreRule({
      id: "dimension_ore",
      blockId: "minecraft:gold_ore", // Placeholder
      minY: 0,
      maxY: 50,
      veinsPerChunk: 3,
      veinSize: 5,
      replace: ["minecraft:stone"],
      seed: 5678,
      scope: { type: "dimensionId", value: "pmmpcore:multiworld_10" },
    });
  },

  // ============== REGISTRO DE HOOKS DE GENERACIÓN ==============
  setupGenerationHooks() {
    if (!this.config.customStructures) return;
    
    console.log("[ExamplePlugin] Registering generation hooks...");
    
    // Hook para generar cristales en mundos normales
    WorldGenerator.registerGenerationHook({
      id: "crystal_structures",
      seed: 42,
      scope: { type: "worldType", value: "normal" },
      onChunkGenerated: (ctx) => {
        // ctx: { dimension, chunkX, chunkZ, worldName, dimensionId, worldType, originX, originZ, random() }
        
        // 5% de probabilidad de generar cristales
        if (ctx.random() < 0.05) {
          return this.generateCrystalCluster(ctx);
        }
        
        // 2% de probabilidad de generar pilar
        if (ctx.random() < 0.02) {
          return this.generateCrystalPillar(ctx);
        }
      },
    });
    
    // Hook para estructuras especiales en un mundo específico
    WorldGenerator.registerGenerationHook({
      id: "special_structures",
      seed: 777,
      scope: { type: "worldName", value: "special_world" },
      onChunkGenerated: (ctx) => {
        // 10% de probabilidad en el mundo especial
        if (ctx.random() < 0.1) {
          return this.generateSpecialStructure(ctx);
        }
      },
    });
  },

  // ============== GENERADORES DE ESTRUCTURAS ==============
  generateCrystalCluster(ctx) {
    const tasks = [];
    const { dimension, chunkX, chunkZ, originX, originZ, random } = ctx;
    
    // Posición aleatoria dentro del chunk
    const centerX = originX + Math.floor(random() * 16);
    const centerZ = originZ + Math.floor(random() * 16);
    const baseY = 60 + Math.floor(random() * 20); // Entre 60-80
    
    // Generar cluster de cristales
    for (let i = 0; i < 3 + Math.floor(random() * 3); i++) {
      const offsetX = Math.floor(random() * 7) - 3; // -3 a 3
      const offsetZ = Math.floor(random() * 7) - 3; // -3 a 3
      const height = 2 + Math.floor(random() * 3); // 2-4 bloques de alto
      
      tasks.push(() => {
        try {
          const crystalPerm = BlockPermutation.resolve("minecraft:amethyst_block");
          for (let y = baseY; y < baseY + height; y++) {
            const block = dimension.getBlock({ x: centerX + offsetX, y, z: centerZ + offsetZ });
            if (block && block.typeId === "minecraft:air") {
              block.setPermutation(crystalPerm);
            }
          }
        } catch (e) {
          console.warn("[ExamplePlugin] Failed to place crystal:", e?.message);
        }
      });
    }
    
    return tasks;
  },

  generateCrystalPillar(ctx) {
    const tasks = [];
    const { dimension, chunkX, chunkZ, originX, originZ, random } = ctx;
    
    const x = originX + Math.floor(random() * 16);
    const z = originZ + Math.floor(random() * 16);
    const baseY = 64;
    const height = 5 + Math.floor(random() * 5); // 5-9 bloques
    
    tasks.push(() => {
      try {
        const pillarPerm = BlockPermutation.resolve("minecraft:quartz_block");
        const topPerm = BlockPermutation.resolve("minecraft:glowstone");
        
        for (let y = baseY; y < baseY + height; y++) {
          const block = dimension.getBlock({ x, y, z });
          if (block && block.typeId === "minecraft:air") {
            const perm = (y === baseY + height - 1) ? topPerm : pillarPerm;
            block.setPermutation(perm);
          }
        }
      } catch (e) {
        console.warn("[ExamplePlugin] Failed to place pillar:", e?.message);
      }
    });
    
    return tasks;
  },

  generateSpecialStructure(ctx) {
    const tasks = [];
    const { dimension, chunkX, chunkZ, originX, originZ, random } = ctx;
    
    // Estructura simple: plataforma 5x5 con centro elevado
    const centerX = originX + Math.floor(random() * 8) + 4; // 4-11 desde origen
    const centerZ = originZ + Math.floor(random() * 8) + 4;
    const baseY = 70;
    
    // Generar plataforma
    for (let x = centerX - 2; x <= centerX + 2; x++) {
      for (let z = centerZ - 2; z <= centerZ + 2; z++) {
        tasks.push(() => {
          try {
            const block = dimension.getBlock({ x, y: baseY, z });
            if (block && block.typeId === "minecraft:air") {
              const perm = (x === centerX && z === centerZ) 
                ? BlockPermutation.resolve("minecraft:gold_block")
                : BlockPermutation.resolve("minecraft:stone_bricks");
              block.setPermutation(perm);
            }
          } catch (e) {
            console.warn("[ExamplePlugin] Failed to place platform block:", e?.message);
          }
        });
      }
    }
    
    // Centro elevado
    tasks.push(() => {
      try {
        const topBlock = dimension.getBlock({ x: centerX, y: baseY + 1, z: centerZ });
        if (topBlock && topBlock.typeId === "minecraft:air") {
          topBlock.setPermutation(BlockPermutation.resolve("minecraft:torch"));
        }
      } catch (e) {
        console.warn("[ExamplePlugin] Failed to place torch:", e?.message);
      }
    });
    
    return tasks;
  },

  // ============== MANEJO DE EVENTOS ==============
  setupEventHandlers() {
    try {
      // Evento cuando un jugador entra al mundo
      if (system.afterEvents && system.afterEvents.playerSpawn) {
        system.afterEvents.playerSpawn.subscribe((event) => {
          try {
            const player = event.player;
            
            // Mensaje de bienvenida si está en un mundo con contenido personalizado
            const worldName = this.getWorldNameByDimension(player.dimension.id);
            if (worldName && this.hasCustomContent(worldName)) {
              player.sendMessage(`${Color.aqua}¡Bienvenido a ${worldName}! Este mundo tiene contenido personalizado de ExamplePlugin.${Color.reset}`);
            }
          } catch (e) {
            console.warn("[ExamplePlugin] Error in playerSpawn event:", e?.message);
          }
        });
      }
      
      // Evento cuando un jugador usa un bloque (opcional)
      if (system.beforeEvents && system.beforeEvents.playerBreakBlock) {
        system.beforeEvents.playerBreakBlock.subscribe((event) => {
          try {
            const block = event.block;
            const player = event.player;
            
            // Detectar si rompe un mineral personalizado
            if (this.isCustomOre(block.typeId)) {
              player.sendMessage(`${Color.gold}¡Has encontrado un mineral personalizado!${Color.reset}`);
            }
          } catch (e) {
            console.warn("[ExamplePlugin] Error in playerBreakBlock event:", e?.message);
          }
        });
      }
    } catch (e) {
      console.warn("[ExamplePlugin] Failed to setup event handlers:", e?.message);
    }
  },

  // ============== COMANDOS DEL PLUGIN ==============
  registerCommands(event) {
    // Comando para listar minerales personalizados
    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:exampleplugin_ores",
        description: "List all custom ores registered by ExamplePlugin",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          console.log("[ExamplePlugin] This command can only be used by players");
          return;
        }
        
        const ores = WorldGenerator.getOreRules().filter(ore => 
          ore.id.includes("mithril") || ore.id.includes("crystal") || ore.id.includes("dimension")
        );
        
        if (ores.length === 0) {
          player.sendMessage(`${Color.yellow}No custom ores found.${Color.reset}`);
          return;
        }
        
        player.sendMessage(`${Color.aqua}Custom Ores (${ores.length}):${Color.reset}`);
        ores.forEach(ore => {
          const scope = ore.scope ? ` in ${ore.scope.type}:${ore.scope.value}` : "";
          player.sendMessage(`${Color.green}- ${ore.id}${scope} (Y: ${ore.minY}-${ore.maxY})${Color.reset}`);
        });
      }
    );
    
    // Comando para listar hooks de generación
    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:exampleplugin_hooks",
        description: "List all generation hooks registered by ExamplePlugin",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          console.log("[ExamplePlugin] This command can only be used by players");
          return;
        }
        
        const hooks = WorldGenerator.getGenerationHooks().filter(hook => 
          hook.id.includes("crystal") || hook.id.includes("special")
        );
        
        if (hooks.length === 0) {
          player.sendMessage(`${Color.yellow}No generation hooks found.${Color.reset}`);
          return;
        }
        
        player.sendMessage(`${Color.aqua}Generation Hooks (${hooks.length}):${Color.reset}`);
        hooks.forEach(hook => {
          const scope = hook.scope ? ` in ${hook.scope.type}:${hook.scope.value}` : "";
          player.sendMessage(`${Color.green}- ${hook.id}${scope}${Color.reset}`);
        });
      }
    );
    
    // Comando para probar generación
    event.customCommandRegistry.registerCommand(
      {
        name: "pmmpcore:exampleplugin_test",
        description: "Test custom content in current world",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = origin.sourceEntity;
        if (!player || !(player instanceof Player)) {
          console.log("[ExamplePlugin] This command can only be used by players");
          return;
        }
        
        const worldName = this.getWorldNameByDimension(player.dimension.id);
        const hasOres = this.hasCustomOres(worldName);
        const hasStructures = this.hasCustomStructures(worldName);
        
        player.sendMessage(`${Color.aqua}World Analysis for: ${worldName}${Color.reset}`);
        player.sendMessage(`${Color.green}Custom Ores: ${hasOres ? '✓' : '✗'}${Color.reset}`);
        player.sendMessage(`${Color.green}Custom Structures: ${hasStructures ? '✓' : '✗'}${Color.reset}`);
        
        if (!hasOres && !hasStructures) {
          player.sendMessage(`${Color.yellow}This world doesn't have custom content. Try creating a 'normal' world or 'crystal_world'.${Color.reset}`);
        }
      }
    );
  },

  // ============== UTILIDADES ==============
  getWorldNameByDimension(dimensionId) {
    // Lógica para obtener nombre del mundo por dimensión
    // Esto depende de cómo MultiWorld almacena esta información
    try {
      const { worldsData } = require("../MultiWorld/state.js");
      for (const [name, data] of worldsData) {
        if (data.dimensionId === dimensionId) {
          return name;
        }
      }
    } catch (e) {
      console.warn("[ExamplePlugin] Could not access MultiWorld state:", e?.message);
    }
    return null;
  },

  hasCustomContent(worldName) {
    return this.hasCustomOres(worldName) || this.hasCustomStructures(worldName);
  },

  hasCustomOres(worldName) {
    const ores = WorldGenerator.getOreRules();
    return ores.some(ore => {
      if (!ore.scope) return false;
      if (ore.scope.type === "worldType" && ore.scope.value === "normal") return true;
      if (ore.scope.type === "worldName" && ore.scope.value === worldName) return true;
      return false;
    });
  },

  hasCustomStructures(worldName) {
    const hooks = WorldGenerator.getGenerationHooks();
    return hooks.some(hook => {
      if (!hook.scope) return false;
      if (hook.scope.type === "worldType" && hook.scope.value === "normal") return true;
      if (hook.scope.type === "worldName" && hook.scope.value === worldName) return true;
      return false;
    });
  },

  isCustomOre(blockId) {
    const ores = WorldGenerator.getOreRules();
    return ores.some(ore => ore.blockId === blockId && (
      ore.id.includes("mithril") || 
      ore.id.includes("crystal") || 
      ore.id.includes("dimension")
    ));
  },

  cleanup() {
    // Limpieza de recursos si es necesario
    console.log("[ExamplePlugin] Cleanup completed");
  },
});
