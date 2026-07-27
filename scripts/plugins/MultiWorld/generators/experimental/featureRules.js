/**
 * 1.16.220 Feature Rules Engine (6-pass evaluator & biome tag filter)
 */
import { FEATURES_116 } from "./features.js";

function matchesBiomeFilter(biomeTags, filter) {
  if (!filter || !Array.isArray(filter) || filter.length === 0) return true;
  for (const f of filter) {
    if (f.any_of) {
      let anyMatched = false;
      for (const sub of f.any_of) {
        if (sub.test === "has_biome_tag" && sub.operator === "==" && biomeTags.includes(sub.value)) {
          anyMatched = true;
          break;
        }
      }
      if (!anyMatched) return false;
    } else if (f.test === "has_biome_tag") {
      if (f.operator === "==" && !biomeTags.includes(f.value)) return false;
      if (f.operator === "!=" && biomeTags.includes(f.value)) return false;
    }
  }
  return true;
}

export class FeatureRulesEngine116 {
  static runPasses(dimension, chunkX, chunkZ, biome, random) {
    const originX = chunkX * 16;
    const originZ = chunkZ * 16;
    const tags = biome.tags ?? [];

    // 1. UNDERGROUND PASS: Ore Veins & Mineral Strata (Overworld)
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:coal_ore", 17, -64, 128, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:iron_ore", 9, -64, 64, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:gold_ore", 8, -64, 32, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:diamond_ore", 6, -64, 16, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:redstone_ore", 8, -64, 16, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:lapis_ore", 7, -64, 32, ["minecraft:stone", "minecraft:deepslate"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:diorite", 33, -64, 80, ["minecraft:stone"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:granite", 33, -64, 80, ["minecraft:stone"]);
    FEATURES_116.placeOreVein(dimension, originX, originZ, random, "minecraft:andesite", 33, -64, 80, ["minecraft:stone"]);

    // 2. SURFACE PASS: Overworld Trees
    if (tags.includes("forest") || tags.includes("plains") || tags.includes("taiga") || tags.includes("jungle")) {
      const treeCount = tags.includes("forest") || tags.includes("jungle") ? 5 : 1;

      for (let t = 0; t < treeCount; t++) {
        const tx = originX + Math.floor(random() * 12) + 2;
        const tz = originZ + Math.floor(random() * 12) + 2;

        let ty = -64;
        for (let y = 120; y >= 60; y--) {
          const b = dimension.getBlock({ x: tx, y, z: tz })?.typeId;
          if (b === "minecraft:grass_block" || b === "minecraft:dirt" || b === "minecraft:podzol") {
            ty = y;
            break;
          }
        }
        if (ty <= 60) continue;

        if (tags.includes("birch")) {
          FEATURES_116.placeBirchTree(dimension, tx, ty, tz, random);
        } else if (tags.includes("taiga")) {
          FEATURES_116.placeSpruceTree(dimension, tx, ty, tz, random);
        } else {
          FEATURES_116.placeOakTree(dimension, tx, ty, tz, random);
        }
      }
    }

    // 3. AFTER SURFACE PASS: Overworld Flora
    if (tags.includes("plains") || tags.includes("forest")) {
      FEATURES_116.placeScatterFlora(dimension, originX, originZ, random, "minecraft:tall_grass", 30);
      FEATURES_116.placeScatterFlora(dimension, originX, originZ, random, "minecraft:yellow_flower", 4);
      FEATURES_116.placeScatterFlora(dimension, originX, originZ, random, "minecraft:red_flower", 4);
    } else if (tags.includes("desert")) {
      FEATURES_116.placeScatterFlora(dimension, originX, originZ, random, "minecraft:deadbush", 3);
    }
  }
}
