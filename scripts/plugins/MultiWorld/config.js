// ============== TIPOS Y CONSTANTES ==============

export const MAX_ACTIVE_WORLDS      = 10;
export const INACTIVE_TIMEOUT       = 300000;  // 5 min en ms
export const GENERATION_RADIUS      = 10;       // radio de generación alrededor del jugador (chunks)
export const CHUNKS_PER_TICK        = 6;        // presupuesto por jugador/ciclo (equilibrio rendimiento)
export const GENERATION_TICK_RATE   = 10;       // cada 10 ticks (~0.5s) para que se sienta fluido
export const CLEAR_RADIUS           = 150;      // radio de borrado desde spawn (en chunks)
export const CLEAR_BATCH_SIZE       = 450;      // columnas por lote de borrado (mas rapido)
export const CLEAR_TICKS_PER_BATCH  = 1;        // ticks entre lotes (1 = max velocidad)
export const CLEAR_BATCHES_PER_CYCLE = 2;       // cuantos lotes lanzar por ciclo de limpieza
export const DELETE_SAFETY_SWEEP    = true;     // ademas de tracked chunks, barre un radio extra
export const DELETE_SAFETY_RADIUS   = 220;      // miles de chunks extra (lineal: 441, area: 194,481)
export const DELETE_SAFETY_RADIUS_WHEN_TRACKED = 40; // sweep corto cuando ya hay tracking (rapido)
export const FLAT_WORLD_TOP_Y       = -53;      // Cesped en -53, bedrock queda en -64
export const TOTAL_DIMENSIONS       = 50;
export const MW_DEBUG               = true;
export const MW_METRICS             = true;

export const CLEANUP_PROFILES = {
  safe: {
    delete: { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: 170, trackedExtraRadius: 48 },
    purge:  { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: 240, trackedExtraRadius: 72 },
  },
  balanced: {
    delete: { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: CLEAR_RADIUS, trackedExtraRadius: DELETE_SAFETY_RADIUS_WHEN_TRACKED },
    purge:  { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: Math.max(CLEAR_RADIUS, DELETE_SAFETY_RADIUS), trackedExtraRadius: DELETE_SAFETY_RADIUS_WHEN_TRACKED },
  },
  aggressive: {
    delete: { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: Math.max(CLEAR_RADIUS, DELETE_SAFETY_RADIUS), trackedExtraRadius: DELETE_SAFETY_RADIUS_WHEN_TRACKED },
    purge:  { includeSafetySweep: true, safetySweepEnabled: true, fallbackRadius: Math.max(CLEAR_RADIUS, DELETE_SAFETY_RADIUS), trackedExtraRadius: Math.max(DELETE_SAFETY_RADIUS_WHEN_TRACKED, 96) },
  },
};
export const CLEANUP_PROFILE = "balanced";

export function resolveCleanupPolicy(mode = "delete") {
  const profile = CLEANUP_PROFILES[CLEANUP_PROFILE] ?? CLEANUP_PROFILES.balanced;
  const profileMode = profile[mode] ?? profile.delete;
  return {
    includeSafetySweep: !!profileMode.includeSafetySweep,
    safetySweepEnabled: !!profileMode.safetySweepEnabled,
    fallbackRadius: Number.isFinite(profileMode.fallbackRadius) ? profileMode.fallbackRadius : CLEAR_RADIUS,
    trackedExtraRadius: Number.isFinite(profileMode.trackedExtraRadius) ? profileMode.trackedExtraRadius : DELETE_SAFETY_RADIUS_WHEN_TRACKED,
  };
}

export const WORLD_TYPES = {
  NORMAL:   "normal",
  FLAT:     "flat",
  VOID:     "void",
  SKYBLOCK: "skyblock",
};

export const VANILLA_WORLDS = {
  overworld: {
    id: "minecraft:overworld",
    aliases: ["overworld", "ow", "world"],
    spawn: { x: 0, y: 64, z: 0 },
    label: "Overworld",
  },
  nether: {
    id: "minecraft:nether",
    aliases: ["nether", "the_nether"],
    spawn: { x: 0, y: 64, z: 0 },
    label: "Nether",
  },
  end: {
    id: "minecraft:the_end",
    aliases: ["end", "the_end"],
    spawn: { x: 0, y: 64, z: 0 },
    label: "The End",
  },
};

export function resolveVanillaWorld(name) {
  if (!name || typeof name !== "string") return null;
  const normalized = name.toLowerCase();
  return Object.values(VANILLA_WORLDS).find((e) => e.aliases.includes(normalized)) ?? null;
}

// Pool de 50 dimensiones personalizadas
export const dimensionPool = [];
for (let i = 1; i <= TOTAL_DIMENSIONS; i++) {
  dimensionPool.push({ id: `pmmpcore:multiworld_${i}`, used: false, number: i });
}
