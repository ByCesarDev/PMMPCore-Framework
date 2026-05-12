# PMMPCore - Documentacion de ScoreHud

Idioma: [English](SCOREHUD_DOCUMENTATION.md) | **Espanol**

## 1. Proposito

ScoreHud muestra un **scoreboard lateral (sidebar)** cuyas lineas se resuelven con **PlaceholderAPI** (misma sintaxis `%identificador_clave%` que otros plugins PMMPCore). Esta inspirado en el ecosistema **ScoreHud** de PocketMine-MP (por ejemplo [ScoreHud / ScoreHub-Original](https://github.com/Ifera/ScoreHud)), adaptado a las limitaciones de Bedrock Script API.

## 1.1 Limitaciones de Bedrock (importante)

- El **slot del sidebar es global** en el mundo: todos los jugadores ven el **mismo** objetivo y las **mismas** lineas. Es una limitacion de la plataforma, no un fallo del pack.
- Los placeholders **`%player_*%`** se evaluan con **un unico jugador de contexto**: el primer jugador en linea (por nombre) que no haya desactivado el HUD. Conviene usar **`%server_*%`**, **`%time_*%`** y **`%general_*%`** en plantillas por defecto si hay varios jugadores.
- El toggle guarda una **preferencia por jugador** en KV; si **ningun** jugador en linea quiere el HUD, el plugin limpia el slot del sidebar. Mientras **alguno** lo mantenga activo, el sidebar sigue visible para todos.

## 2. Lifecycle

- `onEnable`: crea `ScoreHudService`, registra migracion **v1**, expone `runtime` (`hasPermissionNode`, `onReloaded`).
- `onStartup`: registra `pmmpcore:scorehud` y `pmmpcore:scorehudreload`.
- `onWorldReady`: migraciones, `initialize()`, intervalo de refresco, suscripcion a `playerLeave` para un tick de refresco, emite `scorehud.ready`.
- `onDisable`: limpia intervalo y suscripcion, `shutdownCleanup()` (quita sidebar y objetivo del plugin), flush de DB.

## 3. Comandos

| Comando | Permiso | Descripcion |
|---------|---------|-------------|
| `/pmmpcore:scorehud` (alias `/scorehud`) | `scorehud.use` | Alterna preferencia guardada (activado/desactivado). |
| `/pmmpcore:scorehudreload` (alias `/scorehudreload`) | `scorehud.admin.reload` | Recarga la config fusionada desde `plugin:ScoreHud` y reinicia el intervalo. |

## 4. Configuracion

Persistencia en **`plugin:ScoreHud`** (`meta`, `config`). Los valores por defecto estan en [`scripts/plugins/ScoreHud/config.js`](../../scripts/plugins/ScoreHud/config.js) y se fusionan al leer.

Campos relevantes:

| Campo | Descripcion |
|-------|-------------|
| `enabled` | Interruptor general; si es `false`, se limpia el sidebar. |
| `updateIntervalTicks` | Ticks entre refrescos (minimo 1). |
| `objectiveId` | Id del objetivo (alfanumerico + guion bajo, minusculas, max 32). |
| `title` | Titulo visible del objetivo (cabecera del sidebar). |
| `maxLineLength` | Trunca cada linea (8–128). |
| `maxLines` | Maximo de lineas de plantilla (1–15). |
| `lines` | Array de cadenas con placeholders. |
| `messaging.prefix` | Prefijo de mensajes en chat. |

## 5. Permisos

- `scorehud.use` — usar `/scorehud`.
- `scorehud.admin.reload` — usar `/scorehudreload`.

## 6. Eventos

- `scorehud.ready` — payload `{ provider: "ScoreHud" }` cuando el intervalo y listeners estan activos.

## 7. Integraciones

- **PlaceholderAPI** (dependencia blanda): si no esta, los tokens `%...%` se eliminan de las lineas.
- **PurePerms** (dependencia blanda): comprobacion opcional de permisos.

## 8. Checklist de prueba manual

1. Cargar mundo con PMMPCore + PlaceholderAPI + ScoreHud; comprobar sidebar y actualizacion.
2. Ejecutar `/scorehud` dos veces; comprobar mensaje y que, si todos desactivan, se limpia el sidebar (idealmente con varios clientes).
3. `/scorehudreload` con permiso; cambiar `lines` en datos del plugin y comprobar refresco.
4. Sin PlaceholderAPI: comprobar que no crashea y que los placeholders desaparecen de la linea.
