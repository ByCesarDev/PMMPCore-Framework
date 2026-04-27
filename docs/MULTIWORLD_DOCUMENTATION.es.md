# PMMPCore MultiWorld - Documentación Detallada

Idioma: [English](MULTIWORLD_DOCUMENTATION.md) | **Español**

## 1. Alcance

Este documento cubre arquitectura, comandos, persistencia y comportamiento de `MultiWorld`.

No cubre (por ahora):

- EconomyAPI.
- PurePerms.

## 2. Objetivo de MultiWorld

Proveer mundos custom en dimensiones dedicadas, con:

- Creación/eliminación segura por owner.
- Teleport y activación en runtime.
- Generación procedural por tipo.
- Limpieza de chunks por lotes.
- Mundo principal configurable para spawn/recuperación.

## 3. Estructura modular

```text
scripts/plugins/MultiWorld/
  main.js
  config.js
  state.js
  manager.js
  generator.js
  commands.js
```

Responsabilidades:

- `main.js`: bootstrap del plugin y loops runtime.
- `config.js`: constantes y tipos.
- `state.js`: estado compartido en memoria.
- `manager.js`: CRUD de mundos, flush/load y control runtime.
- `generator.js`: generación y limpieza de chunks.
- `commands.js`: handlers y registro de comandos.

## 4. Tipos de mundo

- `normal`: terreno estilo vanilla con relieve y robles.
- `flat`: mundo plano configurable.
- `void`: dimensión vacía.
- `skyblock`: isla inicial tipo skyblock.

## 5. Comandos disponibles

Comando raíz:

- `/pmmpcore:mw <subcommand> ...`

Autocompletado:

- `subcommand` en enum (`pmmpcore:mw_subcommand`).
- `type` en `create` en enum (`pmmpcore:mw_world_type`).
- No existe `/mw` sin namespace vía `customCommandRegistry`.

Subcomandos:

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

Notas:

- `type` por defecto en `create`: `normal`.
- `dimension` opcional entre 1 y 50.
- `delete` y `purgechunks`: solo owner del mundo.
- `keepmode` se guarda por jugador y define si el ejecutor intenta quedarse en dimensión durante delete/purge.
- Con cleanup lock activo, `keepmode` se ignora y se evacua a los jugadores de la dimensión objetivo por seguridad.
- `setspawn` funciona para custom y vanilla (`overworld`, `nether`, `end`).
- En vanilla, `setspawn` guarda override persistente de MultiWorld.
- `setlobby` aplica solo a mundos custom (`forceSpawnOnJoin`).

## 6. Flujo de creación

1. Validar nombre, tipo y dimensión.
2. Reservar dimensión libre.
3. Crear `WorldData`.
4. Marcar dirty flag.
5. Persistir en flush.

Campos relevantes de `WorldData`:

- `id`, `type`, `owner`
- `dimensionId`, `dimensionNumber`
- `spawn`
- `forceSpawnOnJoin` (opcional, modo lobby)
- `loaded`, `createdAt`, `lastUsed`

## 7. Flujo de teleport y join

### Teleport general

1. Resolver destino vanilla/custom.
2. Si es custom, activar mundo en runtime.
3. Preparar entorno inicial (ticking area temporal).
4. Pre-generar spawn según tipo.
5. Teleport del jugador.
6. Limpiar ticking area temporal.

### Routing en reconnect/join

1. Si existe última ubicación válida en mundo no-main, restaurar ahí.
2. Si ese mundo tiene `forceSpawnOnJoin = true`, usar spawn global del mundo.
3. Si no hay ubicación válida (o era main), rutear a main world configurado.

Aclaración lobby:

- Con `setlobby <world> on`, el reconnect prioriza spawn global del mundo sobre la última ubicación guardada.

### Prioridad de spawn en overworld

1. `player.getSpawnPoint()` válido.
2. `world.getDefaultSpawnLocation()` válido.
3. `safe-scan-fallback` (escaneo de suelo válido).
4. `fallback-config` como último recurso.

### Resolución de spawn en mundos custom

- Usa `WorldData.spawn` como punto preferido.
- Valida terreno en runtime y ajusta a suelo seguro si hace falta.
- Si encuentra mejor spawn seguro, actualiza y persiste `WorldData.spawn`.

## 8. Generación procedural

### `normal`

- Altura por ruido 2D determinista.
- Estratos: bedrock, stone, dirt, grass.
- Árboles de roble con densidad y separación deterministas.
- Orden de generación (mundos normal):
  1. terreno base (bedrock/stone/suelo/grass)
  2. minerales (`WorldGenerator` ore rules)
  3. hooks custom de generación (callbacks con scope)
  4. features (árboles)

### 8.1.1 Extender la generación (API de minerales + hooks)

MultiWorld expone una API ligera vía `WorldGenerator` para que otros plugins agreguen:
- **Reglas de minerales** (con alcance por mundo/dimensión/tipo)
- **Hooks de generación custom** (callbacks por chunk, con scope)

Implementación en:
- `scripts/plugins/MultiWorld/generator.js`

#### API de minerales

Registrar una regla:

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

Scopes soportados:
- `{ type: "dimensionId", value: "<dimension id>" }`
- `{ type: "worldName", value: "<nombre del mundo custom>" }`
- `{ type: "worldType", value: "normal|flat|void|skyblock" }`

Notas:
- Sin `scope`, la regla aplica donde se invoque la generación de minerales (hoy: mundos `normal`).
- El seed es determinista por chunk.

#### API de hooks de generación

Los hooks corren después del terreno base + minerales, y antes de features (árboles). Un hook puede retornar un **array de tareas** (funciones). Si retorna tareas, MultiWorld las ejecuta **repartidas en ticks** para reducir riesgo de watchdog.

Registrar un hook:

```js
import { BlockPermutation } from "@minecraft/server";
import { WorldGenerator } from "./plugins/MultiWorld/generator.js";

WorldGenerator.registerGenerationHook({
  id: "crystals_world7",
  seed: 123,
  scope: { type: "dimensionId", value: "pmmpcore:multiworld_7" },
  onChunkGenerated(ctx) {
    // ctx: { dimension, chunkX, chunkZ, worldName, dimensionId, worldType, originX, originZ, random() }
    // Retorna tareas para ejecutarse en el tiempo (anti-watchdog).
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

Guías de seguridad:
- Mantén `onChunkGenerated` rápido. Prefiere retornar tareas en vez de loops grandes síncronos.
- Usa el random determinista provisto (`ctx.random()`).


### `flat`

- Capas planas con altura `FLAT_WORLD_TOP_Y`.

### `void`

- Marca chunk como generado sin construir bloques.

### `skyblock`

- Solo chunk inicial central, isla en L, árbol y cofre.

## 9. Generación continua por jugador

- Loop con `GENERATION_TICK_RATE`.
- Detecta jugadores en mundos activos.
- Genera alrededor del jugador por proximidad.
- Presupuesto por ciclo: `CHUNKS_PER_TICK`.

## 10. Eliminación y limpieza de chunks

### `delete`

- Elimina metadata del mundo.
- Limpia chunks en batch con política de `resolveCleanupPolicy("delete")`.
- Usa `tracked + safety sweep` o fallback radial, según tracking y política.
- Durante limpieza, mundo y dimensión quedan bloqueados; se rechazan tp/create/re-delete hacia ese objetivo.
- Antes de limpiar, se mueve a los jugadores fuera de la dimensión objetivo.

### `purgechunks`

- Mantiene metadata del mundo.
- Limpia chunks generados como operación de recuperación.
- Usa política de `resolveCleanupPolicy("purge")` (normalmente más amplia que delete).
- Durante limpieza, mundo y dimensión quedan bloqueados; se rechazan tp/create/re-purge hacia ese objetivo.
- Antes de limpiar, se mueve a los jugadores fuera de la dimensión objetivo.

### `keepmode`

- `keepmode on`: preferencia del jugador para quedarse en dimensión durante delete/purge.
- `keepmode off`: preferencia del jugador para moverse primero al main world.
- Comportamiento durante cleanup:
  - Con ON y si el ejecutor está dentro de la dimensión objetivo, el ejecutor se queda.
  - Cualquier otro jugador en esa misma dimensión se evacúa al main world antes de iniciar la limpieza.
  - Los locks de mundo + dimensión siguen aplicando (se bloquea tp/create/re-delete/re-purge al objetivo).

Pipeline batch:

- Construcción de lista objetivo.
- Procesamiento por lotes (`CLEAR_BATCH_SIZE`).
- Segmentación vertical.
- Ticking areas temporales.
- Micro-lotes por tile (`runTimeout`) para evitar watchdog hangs.
- Mensajes de progreso por batch.

## 11. Mundo principal configurable

Config persistida:

- `mainWorldTarget` en `plugin:MultiWorld`.

Comandos:

- `setmain <name>`
- `setspawn <name>`
- `setlobby <name> <on|off>`
- `main`

Comportamiento:

- Primer spawn de jugador nuevo -> main world.
- Respawn sin spawnpoint personal -> main world.
- Destino inexistente -> fallback a overworld.
- Mundos no-main pueden restaurar ubicación previa.
- Mundos con `forceSpawnOnJoin` se comportan como lobby.

## 11.1 Diagnóstico de spawn en `info`

`/pmmpcore:mw info <world>` muestra:

- `Spawn (saved)`
- `Spawn (resolved now)`
- `Spawn source` (vanilla):
  - `saved-override`
  - `player-spawn-point`
  - `world-default-spawn`
  - `safe-scan-fallback`
  - `fallback-config`

## 12. Persistencia de datos

Claves usadas:

- `mw:index`
- `mw:world:<name>`
- `mw:chunks:<name>`

Estrategia:

- Dirty flag en memoria.
- Flush on-demand (`create/delete/autosave/disable`).
- Load completo en primer `worldLoad`.
- Última ubicación por jugador en `playerData.multiWorld.lastLocation`.

### Contrato actual de `WorldData`

Campos requeridos:
- `id` (string)
- `type` (`normal|flat|void|skyblock`)
- `owner` (string)
- `dimensionId` (string)
- `dimensionNumber` (number)
- `spawn` (`{x,y,z}`)
- `createdAt` (epoch ms)
- `lastUsed` (epoch ms)
- `loaded` (boolean de runtime)

Campos opcionales:
- `forceSpawnOnJoin` (boolean): modo lobby que fuerza spawn global al reconectar.
- `playerData.multiWorld.keepMode` (boolean): preferencia por jugador para movimiento durante cleanup.

## 13. Seguridad funcional

- Validación de ownership en operaciones destructivas.
- Validación de tipo/dimensión en `create`.
- Fallbacks robustos en teleport/resolución de mundos.

## 14. Ajustes de rendimiento recomendados

Si hay lag:

- bajar `CHUNKS_PER_TICK`;
- subir `GENERATION_TICK_RATE`;
- ajustar radio de generación;
- revisar `CLEAR_BATCH_SIZE`.

Si falta agresividad en limpieza:

- usar `purgechunks`;
- ajustar radios de seguridad en `config.js`.

### Perfiles de limpieza y diagnósticos

- La limpieza ahora se resuelve por perfil con `resolveCleanupPolicy(mode)` en `config.js`.
- `delete` usa chunks trackeados + barrido corto configurable para reducir residuos.
- `purgechunks` mantiene barrido amplio de recuperación.
- Mensajes de cierre reportan diferencias entre chunks solicitados y limpiados cuando existan.
- Diagnóstico opcional:
  - `MW_DEBUG=true`: warnings estructurados en fallbacks del generador.
  - `MW_METRICS=true`: métricas periódicas (`generated_chunks_per_min`, tiempos de limpieza).

## 15. Locks de limpieza (world + dimensión)

- Al iniciar `delete`/`purgechunks`, se aplican locks por `worldName` y `dimensionId`.
- Mientras el lock está activo:
  - no se permite `tp` al mundo/dimensión objetivo,
  - no se permite relanzar `delete`/`purge` sobre ese mundo,
  - `create` no reutiliza dimensiones lockeadas.
- Al finalizar (o si falla el arranque), los locks se liberan automáticamente.

## 15. Pendientes sugeridos

- Configuración runtime de parámetros de generación.
- Perfilador simple de chunks/min por mundo.
- Estrategia documentada de migración de `WorldData`.

