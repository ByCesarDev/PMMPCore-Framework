// ExamplePlugin Configuration
// Template para demostrar la API de MultiWorld

export const CONFIG = {
  // ============== CONFIGURACIÓN PRINCIPAL ==============
  plugin: {
    enabled: true,
    debugMode: false,
    version: "1.0.0",
    name: "ExamplePlugin"
  },

  // ============== MINERALES PERSONALIZADOS ==============
  ores: {
    enabled: true,
    
    // Mithril Ore - Para mundos normales
    mithril: {
      enabled: true,
      blockId: "minecraft:emerald_ore", // Placeholder
      minY: -32,
      maxY: 16,
      veinsPerChunk: 2,
      veinSize: 4,
      replace: ["minecraft:stone"],
      seed: 999,
      scope: { type: "worldType", value: "normal" }
    },

    // Crystal Ore - Para mundo específico
    crystal: {
      enabled: true,
      blockId: "minecraft:diamond_ore", // Placeholder
      minY: -16,
      maxY: 64,
      veinsPerChunk: 1,
      veinSize: 3,
      replace: ["minecraft:stone"],
      seed: 1234,
      scope: { type: "worldName", value: "crystal_world" }
    },

    // Dimension Ore - Para dimensión específica
    dimension: {
      enabled: true,
      blockId: "minecraft:gold_ore", // Placeholder
      minY: 0,
      maxY: 50,
      veinsPerChunk: 3,
      veinSize: 5,
      replace: ["minecraft:stone"],
      seed: 5678,
      scope: { type: "dimensionId", value: "pmmpcore:multiworld_10" }
    }
  },

  // ============== ESTRUCTURAS PERSONALIZADAS ==============
  structures: {
    enabled: true,
    
    // Crystal Clusters
    crystalClusters: {
      enabled: true,
      chance: 0.05, // 5% por chunk
      maxHeight: 80,
      minHeight: 60,
      maxCrystals: 6,
      minCrystals: 3,
      maxHeightVariation: 3,
      minHeightVariation: 2,
      maxRadius: 3,
      blockId: "minecraft:amethyst_block",
      scope: { type: "worldType", value: "normal" }
    },

    // Crystal Pillars
    crystalPillars: {
      enabled: true,
      chance: 0.02, // 2% por chunk
      baseY: 64,
      minHeight: 5,
      maxHeight: 9,
      blockId: "minecraft:quartz_block",
      topBlockId: "minecraft:glowstone",
      scope: { type: "worldType", value: "normal" }
    },

    // Special Structures
    specialStructures: {
      enabled: true,
      chance: 0.1, // 10% por chunk
      baseY: 70,
      platformSize: 5, // 5x5
      centerBlockId: "minecraft:gold_block",
      platformBlockId: "minecraft:stone_bricks",
      topBlockId: "minecraft:torch",
      scope: { type: "worldName", value: "special_world" }
    }
  },

  // ============== EVENTOS Y MENSAJES ==============
  events: {
    playerSpawn: {
      enabled: true,
      welcomeMessage: true,
      customWorldMessage: true
    },
    
    blockBreak: {
      enabled: true,
      customOreNotification: true
    }
  },

  // ============== COMANDOS ==============
  commands: {
    ores: {
      enabled: true,
      permissionLevel: "any",
      cheatsRequired: false
    },
    
    hooks: {
      enabled: true,
      permissionLevel: "any", 
      cheatsRequired: false
    },
    
    test: {
      enabled: true,
      permissionLevel: "any",
      cheatsRequired: false
    }
  },

  // ============== DEBUG Y LOGGING ==============
  debug: {
    enabled: false,
    logLevel: "info", // "debug", "info", "warn", "error"
    logToFile: false,
    logGeneration: false,
    logEvents: false,
    logCommands: false
  },

  // ============== PERFORMANCE ==============
  performance: {
    maxTasksPerHook: 10, // Máximo de tareas por hook
    taskDelayTicks: 1,    // Delay entre tareas
    chunkProcessingTimeout: 1000, // Timeout en ms
    enableMetrics: false
  }
};

// ============== UTILIDADES DE CONFIGURACIÓN ==============

export function isFeatureEnabled(featurePath) {
  const path = featurePath.split('.');
  let current = CONFIG;
  
  for (const segment of path) {
    if (current[segment] === undefined) return false;
    current = current[segment];
  }
  
  return current !== false && current !== null;
}

export function getConfigValue(featurePath, defaultValue = null) {
  const path = featurePath.split('.');
  let current = CONFIG;
  
  for (const segment of path) {
    if (current[segment] === undefined) return defaultValue;
    current = current[segment];
  }
  
  return current;
}

export function getEnabledOres() {
  const enabled = [];
  for (const [name, config] of Object.entries(CONFIG.ores)) {
    if (name !== 'enabled' && config.enabled) {
      enabled.push({ name, ...config });
    }
  }
  return enabled;
}

export function getEnabledStructures() {
  const enabled = [];
  for (const [name, config] of Object.entries(CONFIG.structures)) {
    if (name !== 'enabled' && config.enabled) {
      enabled.push({ name, ...config });
    }
  }
  return enabled;
}

export function shouldLog(level) {
  if (!CONFIG.debug.enabled) return false;
  const levels = ["debug", "info", "warn", "error"];
  const configLevel = levels.indexOf(CONFIG.debug.logLevel);
  const messageLevel = levels.indexOf(level);
  return messageLevel >= configLevel;
}

// ============== VALIDACIÓN DE CONFIGURACIÓN ==============

export function validateConfig() {
  const errors = [];
  
  // Validar rangos numéricos
  if (CONFIG.ores.mithril.minY > CONFIG.ores.mithril.maxY) {
    errors.push("Mithril ore: minY cannot be greater than maxY");
  }
  
  if (CONFIG.ores.crystal.veinsPerChunk < 0) {
    errors.push("Crystal ore: veinsPerChunk cannot be negative");
  }
  
  // Validar probabilidades
  if (CONFIG.structures.crystalClusters.chance < 0 || CONFIG.structures.crystalClusters.chance > 1) {
    errors.push("Crystal clusters: chance must be between 0 and 1");
  }
  
  // Validar scopes
  const validScopeTypes = ["worldType", "worldName", "dimensionId"];
  for (const [name, config] of Object.entries(CONFIG.ores)) {
    if (name !== 'enabled' && config.scope && !validScopeTypes.includes(config.scope.type)) {
      errors.push(`${name} ore: invalid scope type "${config.scope.type}"`);
    }
  }
  
  return errors;
}

// Log de configuración al cargar
if (CONFIG.debug.enabled) {
  console.log("[ExamplePlugin] Configuration loaded");
  console.log("[ExamplePlugin] Enabled ores:", getEnabledOres().length);
  console.log("[ExamplePlugin] Enabled structures:", getEnabledStructures().length);
}
