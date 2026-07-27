/**
 * 1.16.220 Data-Driven Biome Registry & Selection Engine in pure JS
 */

export const BIOMES_116 = {
  // --- OVERWORLD BIOMES ---
  plains: {
    id: "plains",
    tags: ["overworld", "plains", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 7,
      dirtDepth: 4,
    },
    climate: { temperature: 0.8, downfall: 0.4 },
    multinoise: { targetTemp: 0.0, targetHumidity: 0.0, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.4 },
  },

  beach: {
    id: "beach",
    tags: ["overworld", "beach"],
    surface: {
      top: "minecraft:sand",
      mid: "minecraft:sandstone",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 6,
      dirtDepth: 4,
    },
    climate: { temperature: 0.8, downfall: 0.4 },
    multinoise: { targetTemp: 0.0, targetHumidity: 0.0, targetAltitude: -0.2, targetWeirdness: 0.0, weight: 0.3 },
  },

  river: {
    id: "river",
    tags: ["overworld", "river"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 4,
    },
    climate: { temperature: 0.5, downfall: 0.5 },
    multinoise: { targetTemp: 0.0, targetHumidity: 0.1, targetAltitude: -0.3, targetWeirdness: 0.0, weight: 0.3 },
  },

  forest: {
    id: "forest",
    tags: ["overworld", "forest", "forest_generation", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 5,
    },
    climate: { temperature: 0.7, downfall: 0.8 },
    multinoise: { targetTemp: 0.1, targetHumidity: 0.3, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.3 },
  },

  birch_forest: {
    id: "birch_forest",
    tags: ["overworld", "forest", "forest_generation", "birch", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 5,
    },
    climate: { temperature: 0.6, downfall: 0.6 },
    multinoise: { targetTemp: 0.0, targetHumidity: 0.2, targetAltitude: 0.0, targetWeirdness: 0.1, weight: 0.2 },
  },

  desert: {
    id: "desert",
    tags: ["overworld", "desert", "monster"],
    surface: {
      top: "minecraft:sand",
      mid: "minecraft:sandstone",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 6,
      dirtDepth: 4,
    },
    climate: { temperature: 2.0, downfall: 0.0 },
    multinoise: { targetTemp: 0.8, targetHumidity: -0.6, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.5 },
  },

  taiga: {
    id: "taiga",
    tags: ["overworld", "taiga", "cold", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 4,
    },
    climate: { temperature: 0.25, downfall: 0.8 },
    multinoise: { targetTemp: -0.4, targetHumidity: 0.4, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.3 },
  },

  jungle: {
    id: "jungle",
    tags: ["overworld", "jungle", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 6,
    },
    climate: { temperature: 0.95, downfall: 0.9 },
    multinoise: { targetTemp: 0.6, targetHumidity: 0.7, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.3 },
  },

  swampland: {
    id: "swampland",
    tags: ["overworld", "swamp", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:dirt",
      seaFloorDepth: 6,
      dirtDepth: 4,
    },
    climate: { temperature: 0.8, downfall: 0.9 },
    multinoise: { targetTemp: 0.2, targetHumidity: 0.6, targetAltitude: -0.4, targetWeirdness: 0.0, weight: 0.3 },
  },

  savanna: {
    id: "savanna",
    tags: ["overworld", "savanna", "animal", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 4,
    },
    climate: { temperature: 1.2, downfall: 0.0 },
    multinoise: { targetTemp: 0.5, targetHumidity: -0.2, targetAltitude: 0.0, targetWeirdness: 0.0, weight: 0.3 },
  },

  mesa: {
    id: "mesa",
    tags: ["overworld", "mesa", "monster"],
    surface: {
      top: "minecraft:red_sand",
      mid: "minecraft:terracotta",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:red_sand",
      seaFloorDepth: 5,
      dirtDepth: 5,
      adjustments: [
        {
          top: "minecraft:orange_terracotta",
          mid: "minecraft:terracotta",
          noiseRange: [0.1, 0.4],
        },
        {
          top: "minecraft:yellow_terracotta",
          mid: "minecraft:terracotta",
          noiseRange: [-0.4, -0.1],
        },
      ],
    },
    climate: { temperature: 2.0, downfall: 0.0 },
    multinoise: { targetTemp: 0.9, targetHumidity: -0.8, targetAltitude: 0.2, targetWeirdness: 0.3, weight: 0.2 },
  },

  ocean: {
    id: "ocean",
    tags: ["overworld", "ocean"],
    surface: {
      top: "minecraft:gravel",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 8,
      dirtDepth: 3,
    },
    climate: { temperature: 0.5, downfall: 0.5 },
    multinoise: { targetTemp: 0.0, targetHumidity: 0.0, targetAltitude: -0.8, targetWeirdness: 0.0, weight: 0.5 },
  },

  extreme_hills: {
    id: "extreme_hills",
    tags: ["overworld", "extreme_hills", "monster"],
    surface: {
      top: "minecraft:grass_block",
      mid: "minecraft:dirt",
      foundation: "minecraft:stone",
      sea: "minecraft:water",
      seaFloor: "minecraft:sand",
      seaFloorDepth: 5,
      dirtDepth: 3,
    },
    climate: { temperature: 0.2, downfall: 0.3 },
    multinoise: { targetTemp: -0.3, targetHumidity: -0.1, targetAltitude: 0.7, targetWeirdness: 0.4, weight: 0.3 },
  },
};

/**
 * 3D Multi-Noise Biome Resolver for 1.16.220 Overworld
 * Picks the closest biome matching sampled (temperature, humidity, altitude, weirdness)
 */
export function resolveBiomeFromMultiNoise(sample) {
  const biomes = Object.values(BIOMES_116);
  let bestBiome = BIOMES_116.plains;
  let bestDist = Infinity;

  for (const b of biomes) {
    const m = b.multinoise;
    const dt = sample.temperature - m.targetTemp;
    const dh = sample.humidity - m.targetHumidity;
    const da = sample.altitude - m.targetAltitude;
    const dw = sample.weirdness - m.targetWeirdness;
    const dist = dt * dt + dh * dh + da * da + dw * dw - (m.weight || 0);

    if (dist < bestDist) {
      bestDist = dist;
      bestBiome = b;
    }
  }

  return bestBiome;
}
