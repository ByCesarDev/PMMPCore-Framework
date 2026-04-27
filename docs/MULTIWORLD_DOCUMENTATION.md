# PMMPCore MultiWorld - Documentacion Detallada

## 1. Alcance

Este documento cubre la arquitectura, comandos, persistencia y comportamiento de `MultiWorld`.

No cubre (por ahora):

- EconomyAPI.
- PurePerms.

## 2. Objetivo de MultiWorld

Proveer mundos personalizados en dimensiones dedicadas, con:

- Creacion y eliminacion segura por propietario.
- Teleport y activacion runtime.
- Generacion procedural por tipo de mundo.
- Limpieza de chunks por lotes.
- Mundo principal configurable para spawn/recuperacion.

## 3. Estructura de modulos

Ubicacion:

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
- `manager.js`: CRUD de mundos, flush/load, control runtime.
- `generator.js`: generacion y limpieza de chunks.
- `commands.js`: handlers y registro de comandos.

## 4. Tipos de mundo soportados

Actualmente:

- `normal`: terreno tipo vanilla con relieve y robles.
- `flat`: terreno plano configurable en altura.
- `void`: dimension vacia.
- `skyblock`: isla inicial en forma de L, con arbol y cofre.

## 5. Comandos disponibles

Comando raiz:

- `/pmmpcore:mw <subcommand> ...`

Subcomandos:

- `create <name> [type] [dimension]`
- `tp <name>`
- `list`
- `delete <name>`
- `purgechunks <name>`
- `info <name>`
- `setmain <name>`
- `main`
- `help`

Notas:

- `type` por defecto en `create` es `normal`.
- `dimension` opcional entre 1 y 50.
- `delete` y `purgechunks` solo para el owner del mundo.

## 6. Flujo de creacion de mundo

1. Validar nombre, tipo y dimension.
2. Reservar dimension libre en pool.
3. Crear `WorldData` con metadata inicial.
4. Marcar estado dirty.
5. Persistir en flush.

Campos relevantes de `WorldData`:

- `id`, `type`, `owner`
- `dimensionId`, `dimensionNumber`
- `spawn`
- `loaded`, `createdAt`, `lastUsed`

## 7. Flujo de teleport

1. Resolver si destino es vanilla o custom.
2. Si custom: activar mundo en runtime.
3. Crear ticking area temporal para entorno inicial.
4. Pre-generar spawn segun tipo.
5. Teleport del jugador.
6. Remover ticking area temporal.

## 8. Generacion procedural

### 8.1 `normal`

- Altura por ruido 2D deterministico.
- Estratos:
  - `bedrock` en `-64`
  - `stone` hasta subsuelo
  - `dirt` bajo superficie
  - `grass` en superficie
- Arboles de roble por probabilidad deterministica y separacion de grilla.
- Optimizacion aplicada: relleno por rangos verticales con `fillBlocks` y fallback seguro.

### 8.2 `flat`

- Base en `FLAT_WORLD_TOP_Y` (actualmente negativa).
- Capas de stone/dirt/grass y bedrock inferior.

### 8.3 `void`

- Marca chunk como generado sin construir bloques.

### 8.4 `skyblock`

- Genera solo chunk central inicial.
- Isla estilo L.
- Arbol y cofre inicial.
- Sin bedrock en base de isla.

## 9. Generacion continua por jugador

Loop principal:

- Se ejecuta con `GENERATION_TICK_RATE`.
- Detecta jugadores en mundos activos.
- Genera alrededor del jugador por cercania de chunk.
- Presupuesto por ciclo: `CHUNKS_PER_TICK`.

## 10. Borrado de mundos y limpieza de chunks

### `delete`

- Elimina metadatos de mundo.
- Limpia chunks en batch sin barrido extra agresivo.
- Si jugador esta en ese mundo, lo mueve primero al mundo principal.

### `purgechunks`

- No elimina metadatos del mundo.
- Limpia chunks generados como operacion de recuperacion.
- Incluye barrido de seguridad extra (configurable por constantes).

### Pipeline de limpieza batch

- Construccion de lista de chunks objetivo (tracked + fallback radial).
- Procesamiento por lotes (`CLEAR_BATCH_SIZE`).
- Segmentacion vertical para evitar limites de volumen.
- Ticking areas temporales por tile.
- Mensajes de progreso por lotes.

## 11. Mundo principal configurable

Config persistida por plugin:

- `mainWorldTarget` en `plugin:MultiWorld`.

Comandos:

- `setmain <name>`: define mundo principal (vanilla o custom).
- `main`: muestra configuracion y destino resuelto.

Comportamiento:

- Primer spawn de jugador nuevo -> redirige a main world.
- Respawn sin spawnpoint personal -> redirige a main world.
- Si el destino configurado no existe -> fallback a overworld.

## 12. Persistencia de datos

Claves usadas en DB:

- `mw:index` -> lista de mundos
- `mw:world:<name>` -> datos del mundo
- `mw:chunks:<name>` -> chunks generados

Estrategia:

- Dirty flag en memoria.
- Flush on-demand (create/delete/autosave/disable).
- Carga completa al worldLoad inicial.

## 13. Seguridad funcional

Controles implementados:

- Ownership en operaciones destructivas.
- Validacion de tipo/dimension en `create`.
- Fallbacks de teleport y world resolution.

## 14. Ajustes de rendimiento recomendados

Si hay lag:

- bajar `CHUNKS_PER_TICK`.
- subir `GENERATION_TICK_RATE`.
- ajustar radio de generacion.
- revisar `CLEAR_BATCH_SIZE` si limpieza impacta TPS.

Si falta agresividad de limpieza:

- usar `purgechunks`.
- ajustar radios de seguridad en `config.js`.

## 15. Pendientes sugeridos

- Configuracion runtime por comando de parametros de generacion.
- Perfilador simple por metricas de chunk/min por mundo.
- Documentar oficialmente strategy de migraciones de `WorldData`.
