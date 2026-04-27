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
- Limpia chunks en batch (sin barrido extra agresivo).
- Si el jugador está dentro, lo mueve antes al main world.

### `purgechunks`

- Mantiene metadata del mundo.
- Limpia chunks generados como operación de recuperación.
- Incluye barrido de seguridad configurable.

Pipeline batch:

- Construcción de lista objetivo.
- Procesamiento por lotes (`CLEAR_BATCH_SIZE`).
- Segmentación vertical.
- Ticking areas temporales.
- Mensajes de progreso.

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

## 15. Pendientes sugeridos

- Configuración runtime de parámetros de generación.
- Perfilador simple de chunks/min por mundo.
- Estrategia documentada de migración de `WorldData`.

