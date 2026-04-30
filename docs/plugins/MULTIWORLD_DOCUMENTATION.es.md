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

## 3.1 Referencia de configuración (`scripts/plugins/MultiWorld/config.js`)

MultiWorld se configura editando constantes en `scripts/plugins/MultiWorld/config.js`.

### Capacidad y actividad

- `MAX_ACTIVE_WORLDS`: máximo de mundos custom activos a la vez.
- `INACTIVE_TIMEOUT`: tiempo (ms) tras el cual un mundo inactivo puede descargarse.
- `TOTAL_DIMENSIONS`: tamaño del pool de dimensiones personalizadas (default 50).

### Ritmo de generación y rendimiento

- `GENERATION_RADIUS`: radio (en chunks) alrededor del jugador para trabajo de generación.
- `CHUNKS_PER_TICK`: presupuesto de generación por jugador/ciclo (más alto = más rápido, más riesgo de lag).
- `GENERATION_TICK_RATE`: cada cuántos ticks corre la generación. Default 10 (\(\approx\) 0.5s).

### Política de limpieza / borrado

- `CLEAR_RADIUS`: radio base de limpieza (en chunks) desde el spawn al purgar.
- `CLEAR_BATCH_SIZE`: columnas por lote en borrado/purga.
- `CLEAR_TICKS_PER_BATCH`: ticks entre lotes (1 = más rápido).
- `CLEAR_BATCHES_PER_CYCLE`: cuántos lotes lanzar por ciclo.

### Safety sweep (recomendado)

MultiWorld puede hacer un “barrido de seguridad” adicional más allá de los chunks trackeados para reducir el riesgo de dejar terreno huérfano:

- `DELETE_SAFETY_SWEEP`: switch principal del safety sweep.
- `DELETE_SAFETY_RADIUS`: radio de barrido fallback (en chunks). Aviso: valores grandes implican áreas enormes.
- `DELETE_SAFETY_RADIUS_WHEN_TRACKED`: barrido corto cuando ya hay tracking (más rápido).

### Perfiles de limpieza

`CLEANUP_PROFILES` define perfiles y `CLEANUP_PROFILE` elige el perfil activo.

- `CLEANUP_PROFILE`: `"safe" | "balanced" | "aggressive"`
- `resolveCleanupPolicy(mode)`: devuelve la política concreta para `"delete"` o `"purge"`.

### Debug y métricas

- `MW_DEBUG`: logging extra.
- `MW_METRICS`: métricas de loops de generación/limpieza.

### Tipos de mundo y mundos vanilla

- `WORLD_TYPES`: `"normal" | "flat" | "void" | "skyblock"` (usado por `/mw create`).
- `VANILLA_WORLDS`: aliases y labels para `overworld`, `nether`, `end`.
- `resolveVanillaWorld(name)`: resuelve aliases como `ow` → overworld.

## 4. Tipos de mundo

- `normal`: terreno estilo vanilla con relieve y robles.
- `flat`: mundo plano configurable.
- `void`: dimensión vacía.
- `skyblock`: isla inicial tipo skyblock.

## 5. Comandos disponibles

Comando raíz:

- `/mw <subcommand> ...`

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

`/mw info <world>` muestra:

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

---

## 16. Instalación y habilitación (paso a paso)

1. Asegura la carpeta `MultiWorld` en `scripts/plugins/MultiWorld/`.
2. Confirma import en `scripts/plugins.js`:
   - `import "./plugins/MultiWorld/main.js";`
3. Inicia mundo y verifica logs:
   - `Loading modular MultiWorld plugin...`
4. Ejecuta comandos de humo:
   - `/mw help`
   - `/mw list`
   - `/diag`

Si todo responde, MultiWorld está correctamente conectado.

## 17. Inicio rápido (primeros 5 minutos)

1. Crear mundo:
   - `/mw create demo normal`
2. Teleport:
   - `/mw tp demo`
3. Inspección runtime:
   - `/mw info demo`
4. Definir main world (opcional):
   - `/mw setmain demo`
5. Probar limpieza en entorno de prueba:
   - `/mw purgechunks demo`

## 18. Integración con lifecycle (qué hace y cuándo)

- `onEnable()`
  - Registra estado interno, hooks de migración y referencias de servicio.
- `onStartup(event)`
  - Registra comandos y enums.
- `onWorldReady()`
  - Ejecuta carga segura de datos, hidratación de índice de mundos y comportamiento de seed de permisos.
- `onDisable()`
  - Hace flush de estado pendiente y limpia tareas/intervalos.

Por qué importa: el acceso a mundo se difiere a fases seguras para evitar fallos de early execution.

## 19. Modelo operativo de permisos

MultiWorld aplica controles de ownership y rol en handlers:

- Acciones destructivas (`delete`, `purgechunks`) restringidas por owner.
- Operaciones de mundo principal/spawn deben tratarse como admin-level.
- Si tu servidor exige nodos externos, agrega guards en `commands.js` con naming consistente.

Nombres sugeridos (si extiendes):

- `pperms.command.multiworld.create`
- `pperms.command.multiworld.tp`
- `pperms.command.multiworld.delete`
- `pperms.command.multiworld.purge`
- `pperms.command.multiworld.setmain`

## 20. Notas de migración y compatibilidad

Al evolucionar `WorldData`:

1. Añadir campos nuevos primero como opcionales.
2. Backfill de defaults en carga/migración.
3. Mantener lectura de campos legacy por al menos un ciclo de transición.
4. Persistir objeto normalizado solo después de transformar compatibilidad.

Así evitas que mundos viejos fallen tras actualizar.

## 21. FAQ

### ¿Por qué no existe alias `/mw`?

Bedrock permite usar comandos custom sin escribir el namespace; esta documentación usa `/mw`.

### ¿Puedo subir capacidad más allá de 50 mundos?

Sí, elevando `TOTAL_DIMENSIONS`, pero validando memoria/rendimiento.

### ¿Por qué cleanup dice que está lockeado?

Hay una operación `delete`/`purgechunks` en curso para ese mundo/dimensión.

### ¿Por qué lobby mode ignora ubicación previa?

Con `forceSpawnOnJoin=true`, se prioriza intencionalmente spawn global del mundo.

### ¿Qué debo tunear primero si hay lag?

Primero `CHUNKS_PER_TICK`, luego `GENERATION_TICK_RATE`, luego radios.

## 22. Checklist de release (MultiWorld)

- [ ] Registro de comandos correcto tras reinicio.
- [ ] Flujo create/tp/list/info funciona en targets custom y vanilla.
- [ ] Routing de spawn correcto en modo normal y lobby.
- [ ] Locks de limpieza se activan y liberan correctamente.
- [ ] No aparecen errores de DB en early execution.
- [ ] La data de mundos persiste correctamente tras reinicio.

