# Proyecto análisis
_Exported on 5/3/2026 at 17:21:45 AST from Cursor (3.2.16)_

---

**User**

Analiza el proyecto

---

**Cursor**

Voy a hacer un barrido general del repositorio para entender su estructura, propósito, componentes principales y estado actual, y después te devuelvo un diagnóstico claro con riesgos y siguientes pasos. Empezaré con una exploración amplia del código y documentación.

Aquí tienes un análisis técnico rápido del proyecto `PMMPCore-Framework`:

## Qué es el proyecto
Es un **framework modular para Minecraft Bedrock** (behavior pack) con arquitectura tipo plugins.  
Su objetivo es dar ciclo de vida estándar, servicios comunes y persistencia centralizada para módulos como `MultiWorld`, `PurePerms` y `PureChat`.

## Arquitectura principal
- `scripts/main.js`: arranque global, registro de comandos, hooks de lifecycle y tareas periódicas.
- `scripts/PMMPCore.js`: núcleo del framework (registro, dependencias, enable/disable, servicios).
- `scripts/DatabaseManager.js` + `scripts/db/*`: persistencia (Dynamic Properties), WAL, motor relacional y migraciones.
- `scripts/core/*`: buses de eventos/comandos, scheduler y observabilidad.
- `scripts/plugins/*`: funcionalidades de negocio (mundos, permisos, chat).

## Flujo de ejecución (alto nivel)
- `manifest.json` carga `main.js` → delega a `scripts/main.js`.
- En startup: inicializa DB/core, habilita plugins, ejecuta `onStartup`.
- En world load: replay de WAL, evento `world.ready`, ejecuta `onWorldReady`.
- Intervalos periódicos: tick/scheduler/flush de datos.

## Hallazgos importantes
- **Inconsistencias docs vs código** en `MultiWorld` (comportamiento spawn y flags debug/metrics).
- `scripts/plugins/ExamplePlugin/main.js` usa patrón que puede romper en runtime ESM (`require(...)`).
- El **SQL debug shell** en `scripts/main.js` está protegido por permisos/toggles, pero sigue siendo una superficie sensible.
- `Placeholder-Original/` parece legado (PHP/PocketMine) y no parte del runtime Bedrock actual.

## Prioridad de mejoras
1. Alinear documentación con comportamiento real (`docs/plugins/MULTIWORLD_DOCUMENTATION.md`).
2. Endurecer o aislar el SQL debug shell por entorno.
3. Corregir/excluir `ExamplePlugin` del loader por defecto.
4. Agregar regresión mínima automatizada para lifecycle, migraciones y permisos.
5. Evaluar dependencia `@minecraft/server` beta en `manifest.json`.
6. Limpiar o archivar contenido legacy (`Placeholder-Original/`).

Si quieres, en el siguiente paso te preparo un **roadmap por fases (quick wins / mediano plazo)** con estimación de esfuerzo y riesgo.

---

**User**

Toca hacer el PlaceholderAPI, recuerda que te enseño el original para que veas como funciona, pero ya tenemos nuestra api, nuestra forma de hacer comandos y nuestra forma de programar cosas aquí, hicimos esto de manera que se puedan hacer plugins con la API de PMMPCore y db. Crea un plan para hacer el PlaceholderAPI como creas conveniente
Este es el plugin original @Placeholder-Original y esto lo copie de poggit

What is PlaceholderAPI
PlaceholderAPI is a powerful and flexible placeholder system for PocketMine-MP. It allows you to easily manage placeholders and dynamically replace them in messages. Whether you're creating a server with custom features or just want to improve the player experience, PlaceholderAPI has you covered!

Features
Dynamic Placeholder Replacement: Easily replace placeholders with values in messages.
Custom Placeholder Support: Create and register your own placeholders.
Cache Management: Efficient caching system to improve performance and reduce redundant processing.
Advanced API: Provides a clean and simple API to integrate placeholders into your PocketMine-MP plugins.

Generals:

%online_players%: Shows the current number of online players (count(Server::getInstance()->getOnlinePlayers())).
%max_players%: Shows the maximum number of players allowed on the server (Server::getInstance()->getMaxPlayers()).
%server_motd%: Displays the server's Message of the Day (Server::getInstance()->getMotd()).
%server_version%: Displays the version of the server (Server::getInstance()->getVersion()).
%server_ip%: Shows the IP address of the server (Server::getInstance()->getIp()).
%server_port%: Displays the port the server is running on (Server::getInstance()->getPort()).
%player_name%: Shows the name of the player ($player->getName()).
%player_display_name%: Displays the display name of the player ($player->getDisplayName()).
%player_ping%: Shows the player's ping in milliseconds ($player->getNetworkSession()->getPing()).
%player_ip%: Displays the player's IP address ($player->getNetworkSession()->getIp()).
%player_health%: Shows the player's current health ($player->getHealth()).
%player_max_health%: Displays the player's maximum health ($player->getMaxHealth()).
%player_x%: Displays the player's X-coordinate ($player->getPosition()->getX()).
%player_y%: Displays the player's Y-coordinate ($player->getPosition()->getY()).
%player_z%: Displays the player's Z-coordinate ($player->getPosition()->getZ()).
%player_world%: Shows the name of the world the player is in ($player->getWorld()->getDisplayName()).
%server_time%: Displays the current server time in H:i:s format (date("H:i:s")).
%server_date%: Displays the current server date in Y-m-d format (date("Y-m-d")).
%random_number%: Generates and shows a random number between 1 and 100 (mt_rand(1, 100)).
%total_worlds%: Displays the total number of worlds loaded on the server (count(Server::getInstance()->getWorldManager()->getWorlds())).
%tps%: Shows the server's ticks per second rounded to two decimal places (round(Server::getInstance()->getTicksPerSecond(), 2)).
%uptime%: Displays the server's uptime in seconds since it started (round(microtime(true) - Server::getInstance()->getStartTime(), 2) . " seconds").

In your plugin or messages, you can use placeholders such as %online_players% and %max_players%. PlaceholderAPI will automatically replace them with the corresponding values.

$text = "%online_players%/%max_players%";
$player = $player;// If the player is not needed: $player = null;
$processedText = PlaceholderAPI::getInstance()->processPlaceholders($player, $text);
$this->getLogger()->info(processedText); // Output: 5/100 (Example output)


wiki:
PlaceholderAPI
A powerful and flexible placeholder plugin for PocketMine-MP Minecraft servers, enabling dynamic data integration in chat, scoreboards, and other plugins.

Overview
PlaceholderAPI allows server administrators to use dynamic placeholders (e.g., %player_name%, %server_online_players%) to display real-time information about players, server status, and time. It includes built-in expansions and supports custom ones for developers to extend functionality.

Features
Dynamic Placeholders: Replace placeholders with real-time data.
Built-in Expansions: Player, server, and time data out of the box.
Player Data Tracking: Tracks session data like join time.
Commands: Manage and test placeholders easily.
Developer-Friendly: Extendable with custom expansions.
Commands
/papi reload: Reloads the plugin configuration.
/papi list: Lists all registered expansions.
/papi parse <text>: Parses placeholders in the given text.
/papi test <expansion> <placeholder>: Tests a specific placeholder.
Permission: placeholderapi.admin (required for commands).

Default Expansions
Player Expansion (player)
%player_name%: Player's username.
%player_display_name%: Player's display name.
%player_ping%: Player's ping.
%player_health%: Current health.
%player_max_health%: Maximum health.
%player_food%: Food level.
%player_level%: World name.
%player_gamemode%: Current gamemode.
%player_ip%: Player's IP address.
%player_x%, %player_y%, %player_z%: Coordinates.
%player_is_op%: Operator status (true/false).
%player_name_format%: Rank-based name color (requires RankSystem).
%player_session_time%: Session duration (HH:MM:SS).
Server Expansion (server)
%server_name%: Server MOTD.
%server_ip%: Server IP.
%server_port%: Server port.
%server_max_players%: Max player limit.
%server_online_players%: Current online players.
%server_version%: Server version.
%server_tps%: Ticks per second.
%server_load%: Tick usage percentage.
Time Expansion (time)
%time_current%: Current time (e.g., 14:30:45).
%time_date%: Current date (e.g., 2025-07-23).
%time_datetime%: Date and time (e.g., 2025-07-23 14:30:45).
%time_timestamp%: Unix timestamp.
Parsing Placeholders
To use placeholders in your plugin, call the parsePlaceholders method from the PlaceholderAPI class. This method processes a string containing placeholders and replaces them with their corresponding values.

Method Signature
public function parsePlaceholders(string $text, ?Player $player = null): string
Parameters:
$text: The input string containing placeholders (e.g., Hello %player_name%!).
$player: An optional Player object for player-specific placeholders. Pass null for non-player-specific placeholders (e.g., server or time).
Returns: The string with placeholders replaced by their values.
How It Works
The method uses a regular expression to match placeholders in the format %identifier_placeholder% (e.g., %player_name%). It then calls the onPlaceholderRequest method of the corresponding expansion to retrieve the value. If the placeholder or expansion is invalid, the original placeholder text is returned unchanged.

Example Usage
use MohamadRZ4\Placeholder\PlaceholderAPI;
use pocketmine\player\Player;

function displayWelcomeMessage(Player $player): void {
    $placeholderAPI = PlaceholderAPI::getAPI();
    if ($placeholderAPI !== null) {
        $message = $placeholderAPI->parsePlaceholders(
            "Welcome %player_name% to %server_name%! Time: %time_current%",
            $player
        );
        $player->sendMessage($message);
    }
}
Output (example):

Welcome Steve to MyServer! Time: 14:30:45
Notes on Parsing
Ensure the PlaceholderAPI plugin is enabled and loaded before calling getAPI().
Placeholders are case-sensitive.
For player-specific placeholders, always pass a valid Player object.
Non-existent placeholders remain unchanged in the output string.
For Developers
Create custom expansions by extending PlaceholderExpansion. Implement required methods: getIdentifier, getVersion, getAuthor, and onPlaceholderRequest.

Example: Custom Expansion
<?php

namespace MyPlugin\Expansion;

use MohamadRZ4\Placeholder\expansion\PlaceholderExpansion;
use MohamadRZ4\Placeholder\PlaceholderAPI;
use pocketmine\player\Player;

class PlayTimeExpansion extends PlaceholderExpansion {

    public function getIdentifier(): string {
        return "playtime";
    }

    public function getVersion(): string {
        return "1.0.0";
    }

    public function getAuthor(): string {
        return "YourName";
    }

    public function onPlaceholderRequest(?Player $player, string $placeholder): ?string {
        if ($player === null) {
            return null;
        }

        if ($placeholder === "total_hours") {
            $joinTime = $this->plugin->getPlayerData($player->getName())["join_time"] ?? time();
            $totalSeconds = time() - $joinTime;
            $hours = floor($totalSeconds / 3600);
            return (string)$hours;
        }

        return null;
    }

    public function onRegister(PlaceholderAPI $plugin): void {
        parent::onRegister($plugin);
    }
}
Register the expansion:

$placeholderAPI = PlaceholderAPI::getAPI();
if ($placeholderAPI !== null) {
    $placeholderAPI->registerExpansion(new PlayTimeExpansion());
}
Use %playtime_total_hours% to display total hours played.

Notes
Requires RankSystem for %player_name_format%.
Placeholders are case-sensitive (e.g., %player_name%).
Updates every 20 ticks (1 second) for real-time data.
Ensure dependencies are installed for full functionality.



---

**Cursor**

Voy a revisar cómo está montado el sistema de plugins/comandos en PMMPCore para proponerte un plan aterrizado a tu arquitectura (no un port directo de PocketMine). Haré una lectura corta de archivos clave y te presento el plan por fases.

Ya confirmé el patrón real del framework (contexto por plugin, `CommandBus`, lifecycle). Ahora leo un par de plugins existentes y la API pública para diseñar el plan de PlaceholderAPI con el mismo estilo de PMMPCore.

Ya tengo suficiente contexto para aterrizarlo al estilo PMMPCore (plugins + servicios + comandos + API estable). Te voy a dejar un plan de implementación por fases, con alcance MVP primero y extensibilidad para expansiones custom después.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Empiezo a implementar exactamente ese plan por fases y sin tocar el archivo del plan. Primero marco el primer todo como `in_progress` y luego creo el scaffold completo del plugin `PlaceholderAPI` (estructura, servicio, expansiones y config).

Voy a crear ahora los archivos del plugin (`main`, `service`, `commands`, `config`, expansiones y runtime API) y luego lo conecto al loader/API pública. Después corro revisión de lint y cierro los todos restantes.

El scaffold base ya está creado y registrado en el loader. Ahora conecto la API pública para que otros plugins puedan consumir PlaceholderAPI, y agrego la documentación con placeholders/aliases y ejemplo de expansión custom.

Implementé el plan completo de `PlaceholderAPI` para PMMPCore, respetando tu arquitectura (plugin lifecycle + API + comandos Bedrock), sin tocar el archivo del plan.

Cambios realizados:

- Integré el plugin en el loader:
  - `scripts/plugins.js`

- Creé el plugin `PlaceholderAPI`:
  - `scripts/plugins/PlaceholderAPI/main.js`
  - `scripts/plugins/PlaceholderAPI/config.js`
  - `scripts/plugins/PlaceholderAPI/service.js`
  - `scripts/plugins/PlaceholderAPI/commands.js`
  - `scripts/plugins/PlaceholderAPI/runtime.js`

- Creé contrato y expansiones por defecto:
  - `scripts/plugins/PlaceholderAPI/expansion/PlaceholderExpansion.js`
  - `scripts/plugins/PlaceholderAPI/expansion/GeneralExpansion.js`
  - `scripts/plugins/PlaceholderAPI/expansion/PlayerExpansion.js`
  - `scripts/plugins/PlaceholderAPI/expansion/ServerExpansion.js`
  - `scripts/plugins/PlaceholderAPI/expansion/TimeExpansion.js`

- Expuse API pública para terceros:
  - `scripts/api/index.js` (runtime getter/setter + base class de expansión)

- Documentación nueva:
  - `docs/plugins/PLACEHOLDERAPI_DOCUMENTATION.md`

Qué incluye esta implementación:

- Parseo de placeholders:
  - `%identifier_key%` (ej. `%player_name%`, `%server_online_players%`)
  - `%key%` como alias a expansión `general` (ej. `%online_players%`)
- Fallback seguro: placeholder no reconocido se mantiene sin reemplazo.
- Registro/desregistro/listado dinámico de expansiones.
- Caché por tipo de expansión (TTL configurable).
- Comando raíz `/papi` con subcomandos:
  - `reload`, `list`, `parse`, `test`
- Permisos:
  - `placeholderapi.admin`, `placeholderapi.list`, `placeholderapi.parse`, `placeholderapi.test`
- Hook lifecycle PMMPCore:
  - `onEnable`, `onStartup`, `onWorldReady`, `onDisable`
- Evento emitido:
  - `placeholderapi.ready`

Validación ejecutada:

- Revisé lints de archivos nuevos/modificados con `ReadLints`: sin errores.
- Confirmé estado de git y que los cambios de PlaceholderAPI quedaron aplicados junto al árbol existente.

Si quieres, siguiente paso te lo hago en caliente: integrar `PureChat` para que su formateo pase por `PlaceholderAPI.parse(...)` y así soportar placeholders dentro de prefijos/formato/nametag automáticamente.

---

**User**

como@scripts/plugins/PureChat manejaba los Placeholder?

---

**Cursor**

Voy a revisar `PureChat` para decirte exactamente cómo resolvía placeholders antes de `PlaceholderAPI` (si eran tokens internos, reemplazos manuales o integración externa).

En `PureChat` **no se usaba PlaceholderAPI** como plugin externo.  
Manejaba placeholders **internos y manuales** con plantillas propias.

- En `scripts/plugins/PureChat/service.js` arma un objeto `placeholders` con claves como:
  - `display_name`, `nametag`, `msg`, `prefix`, `suffix`, `world`, `fac_name`, `fac_rank`.
- Luego aplica esas variables sobre `chatTemplate` y `nametagTemplate` usando:
  - `buildChatMessage(...)`
  - `buildNametag(...)`
- El reemplazo ocurre en `scripts/plugins/PureChat/formatter.js` con `replaceAll` para:
  - `{placeholder}`
  - `<<placeholder>>` (compatibilidad)

O sea, PureChat tenía su **mini motor de placeholders de formato**, pero solo para los tokens que él mismo define; no parseaba `%player_name%` tipo PlaceholderAPI.

---

**User**

Pues se supone que PureChat depende de PlaceholderAPI, otra cosa, porque pones cosas de PlaceholderAPI en la API de PMMPCore? se supone que PlaceholderAPI es un Plugin 

---

**Cursor**

Tienes razón en ambas observaciones: ahí hubo una decisión de diseño incorrecta. Voy a corregirlo para que `PlaceholderAPI` quede 100% como plugin y `PureChat` dependa explícitamente de él, sin mezclarlo en la API core.

Totalmente de acuerdo: `PlaceholderAPI` debe vivir como plugin desacoplado del core. Voy a hacer dos ajustes concretos ahora: 1) quitar sus exports de `scripts/api/index.js`, 2) hacer que `PureChat` dependa de `PlaceholderAPI` y use su runtime como plugin.

Exacto, tu criterio es el correcto.

- `PureChat` ahora **depende explícitamente** de `PlaceholderAPI` en `depend`.
- Quité `PlaceholderAPI` de la API core de `PMMPCore` (`scripts/api/index.js`), porque eso acoplaba plugin con core sin necesidad.
- `PureChat` ahora consume PlaceholderAPI como plugin, vía `PMMPCore.getPlugin("PlaceholderAPI")?.runtime`, y parsea placeholders en:
  - chat final
  - nametag final

### Qué corregí
- `scripts/plugins/PureChat/main.js`
  - `depend: ["PMMPCore", "PurePerms", "PlaceholderAPI"]`
- `scripts/plugins/PureChat/service.js`
  - agrega `_applyExternalPlaceholders(...)`
  - aplica parseo PlaceholderAPI en `formatChatForPlayer(...)` y `applyNametag(...)`
- `scripts/api/index.js`
  - removidos exports de `PlaceholderAPI` (runtime y `PlaceholderExpansion`)

Con esto `PlaceholderAPI` queda donde corresponde: **plugin**, no parte del núcleo de API de PMMPCore.

---

**User**

omo testeo todo esto

---

**Cursor**

Prueba rápida y ordenada para validar todo en juego:

## 1) Arranque y dependencia
- Reinicia el mundo/servidor con el behavior pack activo.
- Ejecuta `/pmmpcore:plugins`.
- Verifica:
  - `PlaceholderAPI` = enabled
  - `PureChat` = enabled  
Si `PureChat` falla, revisa que `PlaceholderAPI` cargó primero (ahora es dependencia obligatoria).

## 2) Comandos de PlaceholderAPI
Usa estos comandos:

- `/papi list`  
  Debe listar `general`, `player`, `server`, `time`.

- `/papi parse %online_players%`
- `/papi parse Hola_%player_name%`
- `/papi test player name`
- `/papi test time current`
- `/papi reload`

Esperado:
- placeholders válidos se reemplazan,
- placeholder inválido queda igual (fallback).

## 3) Verificar integración con PureChat
Haz que un grupo/formato tenga placeholders `%...%` y manda un mensaje.

Ejemplo (si tienes permisos):
- Ajusta formato de chat (con tu comando de PureChat) para incluir `%player_name%` o `%time_current%`.
- Envía mensaje en chat.

Esperado:
- PureChat primero resuelve `{msg}`, `{prefix}`, etc.
- Luego PlaceholderAPI resuelve `%player_name%`, `%server_*%`, `%time_*%`.

## 4) Verificar nametag con placeholders
Configura nametag de grupo con `%player_name%` o `%time_current%` y respawnea/reentra.

Esperado:
- `player.nameTag` se actualiza con placeholders resueltos.

## 5) Casos borde
- Placeholder desconocido: `%foo_bar%` → debe quedar literal.
- Sin permisos de `/papi`: debe negar comando correctamente.
- Texto largo en `/papi parse`: no debe romper (se recorta por límite interno).

## 6) Si algo falla, diagnóstico rápido
- `/pmmpcore:pluginstatus PlaceholderAPI`
- `/pmmpcore:pluginstatus PureChat`
- Revisa logs de consola buscando:
  - `[PlaceholderAPI]`
  - `[PureChat]`
  - errores en `onStartup/onWorldReady`

Si quieres, te preparo una **plantilla de test (checklist copy-paste)** para marcar OK/FAIL en 2 minutos por cada release.

---

**User**

use /papi parse %online_players% y me dijo el error lo de la foto
use /papi parse "%online_players%" y me respondio un 1

---

**Cursor**

Perfecto, eso confirma que el plugin está funcionando y el problema es del parser de comandos de Bedrock, no de PlaceholderAPI.

- Sin comillas: `/papi parse %online_players%`  
  El parser interpreta `%...%` como sintaxis especial/tokens y rompe.
- Con comillas: `/papi parse "%online_players%"`  
  Lo toma como string literal y PlaceholderAPI lo procesa bien (`1` en tu caso).

Usa siempre comillas cuando metas `%...%` en comandos:

- `/papi parse "%player_name%"`
- `/papi parse "Online: %online_players%"`
- `/papi parse "Hora: %time_current%"`

Si quieres, puedo ajustar el comando para aceptar también un modo `test` sin comillas (por ejemplo `/papi test general online_players`) y dejarlo más cómodo para debug.

---

**User**

Vuelve a decirme como testear, mi nickname es ByCesarKun por cierto

---

**Cursor**

Checklist corto para testear **todo** (con tu nick `ByCesarKun`):

## 1) Verifica que cargaron plugins
- `/pmmpcore:plugins`
- Debe salir `PlaceholderAPI` y `PureChat` en enabled.

## 2) Test directo de PlaceholderAPI
Importante: usa comillas en `parse`.

- `/papi list`
- `/papi parse "%online_players%"`
- `/papi parse "Hola %player_name%"`
- `/papi parse "Jugador: %player_name% | Hora: %time_current%"`
- `/papi parse "Server: %server_online_players%/%server_max_players%"`
- `/papi parse "NoExiste: %foo_bar%"`

Esperado:
- `%player_name%` te devuelva `ByCesarKun`
- `%foo_bar%` quede sin reemplazar
- sin errores de sintaxis mientras uses comillas

## 3) Test sin comillas (modo seguro)
- `/papi test player name`
- `/papi test general online_players`
- `/papi test time current`

Esperado:
- resultados válidos sin pelear con `%...%`.

## 4) Test integración con PureChat
Configura formato para que tenga `%...%` y manda un mensaje.

Ejemplo de idea de formato:
- algo que incluya `%player_name%`, `%time_current%`, `%online_players%`.

Luego escribe en chat:
- `hola`

Esperado:
- PureChat aplica sus placeholders internos (`{msg}`, `{prefix}`, etc.)
- y después PlaceholderAPI resuelve `%...%`.

## 5) Test de nametag con PlaceholderAPI
Pon `%player_name%` en nametag de tu grupo y reaparece/reentra.

Esperado:
- tu `nameTag` refleje `ByCesarKun` (y cualquier `%...%` soportado que pongas).

## 6) Diagnóstico si algo falla
- `/pmmpcore:pluginstatus PlaceholderAPI`
- `/pmmpcore:pluginstatus PureChat`
- `/papi reload`
- Reintenta un `/papi test player name`

Si quieres, te paso una batería exacta de comandos de PureChat según los permisos/comandos que ya tengas habilitados en tu servidor.

---

**User**

/papi parse "NoExiste: %foo_bar%"

como hago esto?
4) Test integración con PureChat
Configura formato para que tenga %...% y manda un mensaje.

Ejemplo de idea de formato:

algo que incluya %player_name%, %time_current%, %online_players%.
Luego escribe en chat:

hola
Esperado:

PureChat aplica sus placeholders internos ({msg}, {prefix}, etc.)
y después PlaceholderAPI resuelve %...%.
5) Test de nametag con PlaceholderAPI
Pon %player_name% en nametag de tu grupo y reaparece/reentra.

Esperado:

tu nameTag refleje ByCesarKun (y cualquier %...% soportado que pongas).

---

**Cursor**

Te explico con comandos concretos para que lo pruebes ya mismo en tu mundo con `ByCesarKun`. Voy a basarme en los comandos reales de `PureChat` que tienes cargados.

Perfecto, ese resultado `NoExiste: %foo_bar%` está **bien** (fallback correcto).

Ahora para probar integración con `PureChat`, hazlo así:

## 1) Cambiar formato de chat del grupo (global)
Prueba con `Guest` primero:

```txt
/pchat setformat Guest global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

Si tu runtime no acepta alias sin namespace, usa:

```txt
/pmmpcore:pchat setformat Guest global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

## 2) Enviar mensaje normal en chat
Escribe:

```txt
hola
```

### Qué debes ver
- `{msg}` lo reemplaza PureChat.
- `%time_current%`, `%player_name%`, `%online_players%` los reemplaza PlaceholderAPI.
- Con tu nick debería salir algo como: `[...] ByCesarKun (1) > hola`

---

## 3) Cambiar nametag del grupo
```txt
/pchat setnametag Guest global "%player_name% | %time_current%"
```

(o con namespace `pmmpcore:pchat` si hace falta)

## 4) Forzar actualización de nametag
- Reentra al mundo, o muere/respawnea.
- También puedes desconectar/conectar.

### Qué debes ver
Tu nametag con placeholders resueltos, por ejemplo:
- `ByCesarKun | 15:08:xx`

---

Si no cambia, normalmente es por grupo/permiso:
- revisa que estés en grupo `Guest` (o cambia `Guest` por tu grupo real: `Admin`, `Owner`, `OP`).
- asegúrate de tener permisos `pchat.command` + `pchat.command.setformat` + `pchat.command.setnametag`.

---

**User**

/pchat setformat Guest global "[%time_current%] %player_name% (%online_players%) > {msg}"
/pmmpcore:pchat setformat Guest global "[%time_current%] %player_name% (%online_players%) > {msg}"

---

**Cursor**

Lo que se ve en tu captura está correcto: **sí cambiaste `Guest`**, pero tu chat sale como **`[OP]`**, así que tu grupo efectivo es `OP` y por eso no toma ese formato.

Usa el mismo comando pero para `OP`:

```txt
/pchat setformat OP global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

Luego escribe `hola` otra vez.

Si quieres probar nametag también en tu grupo real:

```txt
/pchat setnametag OP global "%player_name% | %time_current%"
```

y respawnea/reentra.

Si aún no cambia, hacemos dos checks rápidos:
- `/pchat preview` (para ver template activo)
- `/papi parse "%player_name% %time_current% %online_players%"` (para confirmar que PlaceholderAPI resuelve bien)

Quedó **perfecto**. La captura confirma que ya está funcionando la integración end-to-end:

- `%time_current%` se resolvió (`07:08:48 PM`)
- `%player_name%` se resolvió (`ByCesarKun`)
- `%online_players%` se resolvió (`1`)
- `{msg}` de PureChat se resolvió (`hola`)
- el nametag también ya cambió con placeholders

Estado actual: `PureChat -> placeholders internos -> PlaceholderAPI` está operativo.

Siguiente paso recomendado: guardar un formato final “bonito” para `OP` y `Guest` y documentarlo en tu guía para no perderlo en futuras pruebas.

---

**User**

Crea la documentacion correspondiente

---

**Cursor**

Voy a crear/ajustar la documentación para dejar claro cómo funciona `PlaceholderAPI`, cómo se integra con `PureChat`, comandos, placeholders soportados y guía de pruebas. Primero reviso qué docs ya existen para mantener el estilo del repo.

Voy a dejar la documentación redonda en inglés y español: manual de `PlaceholderAPI`, índice de docs, README principal y nota de integración en `PureChat`. Luego te resumo exactamente qué quedó documentado.

Listo, dejé la documentación correspondiente completa y alineada con cómo quedó realmente implementado.

Cambios principales:

- Actualicé `docs/plugins/PLACEHOLDERAPI_DOCUMENTATION.md` con:
  - propósito y arquitectura (plugin, no core API),
  - sintaxis `%identifier_key%` y `%key%`,
  - comandos/permisos,
  - expansiones incluidas,
  - acceso correcto desde otros plugins vía `PMMPCore.getPlugin("PlaceholderAPI")?.runtime`,
  - ejemplo de expansión custom,
  - integración con `PureChat`,
  - checklist de pruebas y nota de comillas en `/papi parse`.

- Creé `docs/plugins/PLACEHOLDERAPI_DOCUMENTATION.es.md` (versión en español equivalente).

- Actualicé índices de documentación:
  - `docs/README.md`
  - `docs/README.es.md`
  para incluir PlaceholderAPI en documentos y cobertura.

- Actualicé README principal y español para reflejar plugin incluido:
  - `readme.md`
  - `README.es.md`
  agregando `PlaceholderAPI` en “Included plugins / Plugins incluidos” y en estructura de carpetas.

- Añadí en docs de PureChat la integración con PlaceholderAPI (orden de resolución):
  - `docs/plugins/PURECHAT_DOCUMENTATION.md`
  - `docs/plugins/PURECHAT_DOCUMENTATION.es.md`

Si quieres, en el siguiente paso te dejo también una sección de “release notes” corta para pegar en changelog/Discord con los comandos de prueba mínimos.

---

**User**

redacta un commit (solo redactalo)

---

**Cursor**

```text
docs(placeholderapi): document plugin architecture and PureChat integration

Add full PlaceholderAPI documentation in English and Spanish, including command usage, built-in expansions, Bedrock parser quoting notes, runtime access patterns, and custom expansion examples. Update docs indexes/README files to include PlaceholderAPI and document PureChat’s two-step placeholder resolution (internal `{...}` first, then external `%...%`).
```

---

**User**

Ahora hagamos el EconomyAPI @EconomyAPI-Original recuerda que te adjunto el original para que veas como funciona pero nosotros en PMMPCore tenemos nuestra propia API, forma de hacer plugins documentada y con cocidog fuente y nuestro propio mini gestor de base de datos

A complete suite of Economy plugins by onebone:

User oriented plugin
EconomyAPI Individual language support
Economy API support
Direct accessible API
Lots of configurations
Lots of events to handle
Fast processing with massive features

Commands
Default command	Parameter	Description	Default Permission
/mymoney		Shows your money	All
/mydebt		Shows your debt	All
/takedebt	<money>	Borrows $<money> from plugin	All
/returndebt	<money>	Returns $<money> to plugin	All
/topmoney	<page>	Shows server's top money	All
/moneysave		Saves data to your hardware	Console
/moneyload		Loads data from your hardware	Console
/setmoney	<player> <money>	Sets <player>'s money to $<money>	OP Console
/economys		Shows plugin which are using EconomyAPI	All
/givemoney	<player> <money>	Gives $<money> <player>	OP Console
/takemoney	<player> <money>	Takes $<money> from <player>	OP Console
/seemoney	<player>	Shows <player>'s money	All
/bank deposit	<money>	Deposit $<money> to your account	All
/bank withdraw	<money>	Withdraw $<money> from your account	All
/bank mymoney		Shows your money from your account	All
/mystatus		Shows your money status	All
/bankadmin takemoney	<player> <money>	Takes $<money> from <player>'s account	OP Console
/bankadmin givemoney	<player> <money>	Gives $<money> for <player>'s account	OP Console
Configuration
File : plugins/EconomyAPI/economy.properties

Key	Description	Available Value	Default Value
show-using-economy	Changes server name to [EconomyS] SERVER NAME on : Change off : Don't change	on off	on
once-debt-limit	Limits borrowing debt at once	All integers	100
debt-limit	Limits available debt	All integers	500
add-op-at-rank	Shows OP at top money rank on : Shows OP off : Don't shows OP	on off	off
default-money	Sets default money	All integers	1000
default-debt	Sets default debt	All integers	0
time-for-increase-debt	Sets how long will take for debt increase	All integers	10
percent-of-increase-debt	Sets percentage of increasing debt	All integers	5
default-bank-money	Sets default bank money	All integers	0
time-for-increase-money	Sets how long will take for credit increase	All integers	10
bank-increase=money-rate	Sets percentage of increasing credit	All integers	5
debug	Money debugging preferences on : yes off : no	on off	on

You can access to EconomyAPI by using EconomyAPI::getInstance()

Example:

EconomyAPI::getInstance()->addMoney($player, $amount);



---

**Cursor**

Para hacer un plan correcto de `EconomyAPI` en PMMPCore sin sobre/infra-implementar, necesito cerrar 2 decisiones de alcance primero.

**Definir alcance de EconomyAPI**

> **¿Qué alcance quieres para la primera versión (v1)?**
> - Paridad amplia con original (wallet + debt + bank + top + admin + eventos)
> - MVP enfocado en wallet (saldo, transferencias, top, comandos admin) y dejar debt/bank para v2
> - MVP wallet + debt, dejando bank para v2
>
> Answer: Nada de MVP, no quiero lo minimo, quiero todo.

> **¿Cómo quieres modelar cuentas en PMMPCore DB?**
> - Una sola cuenta por jugador (wallet) y campos extra opcionales (debt/bank) en el mismo registro
> - Separar wallet y bank como subcuentas explícitas desde v1
> - Lo más compatible posible con la lógica original, adaptada a Bedrock
>
> Answer: Pues como lo hace el original pero adaptado a Bedrock, y mas importante, adaptado al PMMPCore y nuestro gestor de db

Perfecto, entonces planifico **paridad completa desde v1** (wallet + debt + bank + top + admin + eventos), compatible con el comportamiento original pero implementado al estilo PMMPCore + DB propia. Haré una exploración breve del original y de los patrones del repo para aterrizar el plan exacto.

---

**User**

@economyapi_pmmpcore_plan_9eae2550.plan.md (7-8) a que te refieres con esto? se supone que es un plugin, pero como lo dice su nombre es una API para otros plugins y dev

---

**Cursor**

Buena observación. Esa línea significa esto:

- **Sí, será un plugin** dentro de `scripts/plugins/EconomyAPI/` (con lifecycle PMMPCore).
- **Y también será una API para otros plugins/devs**, pero **API a nivel plugin**, no “API core” de `scripts/api/index.js`.

En otras palabras:
- `PMMPCore` = framework base.
- `EconomyAPI` = plugin proveedor de servicios económicos.
- Otros plugins lo consumen vía runtime del plugin (por ejemplo a través de `PMMPCore.getPlugin("EconomyAPI")`) y sus eventos/contratos.

Lo puse así para evitar repetir el error que corregimos con `PlaceholderAPI` (mezclar API de plugin con exports del core).  
Si quieres, ajusto la redacción del plan a:

- “`EconomyAPI` es un **plugin-proveedor de API pública para terceros** dentro del ecosistema PMMPCore (no parte del core base).”

Y además agrego explícitamente en el plan una sección de **contrato público para devs** (`addMoney`, `takeMoney`, `transfer`, `getBalance`, `bank/debt methods`, registro de consumidores) para que quede cristalino.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Empiezo ejecución del plan ahora: marcaré el primer todo en `in_progress`, revisaré la API real de `RelationalEngine/DB` y luego crearé el plugin `EconomyAPI` completo (scaffold, modelo, comandos, intereses, eventos y docs) en orden.

Estoy implementando el núcleo de `EconomyService` ahora (wallet/debt/bank + ledger + intereses + ranking + registro de consumidores), que es la parte más crítica para que todos los comandos funcionen consistente.

---

**User**

continua

---

**Cursor**

Sigo con la parte final: cerrar eventos de fallo, pulir reglas pendientes (ranking con `addOpAtRank`) y completar la documentación EN/ES + actualización de índices, luego paso lints y marco todos como completados.

Ya quedó implementado el plugin y docs; voy a correr una verificación final de lints en los archivos nuevos/modificados de EconomyAPI e índices para cerrar todos los to-dos con confirmación técnica.

Continué y ya quedó implementado todo el plan de `EconomyAPI` en PMMPCore, con los to-dos marcados y completados.

Cambios hechos:

- Plugin completo creado en:
  - `scripts/plugins/EconomyAPI/main.js`
  - `scripts/plugins/EconomyAPI/config.js`
  - `scripts/plugins/EconomyAPI/service.js`
  - `scripts/plugins/EconomyAPI/commands.js`
  - `scripts/plugins/EconomyAPI/state.js`
  - `scripts/plugins/EconomyAPI/events.js`

- Integración al loader:
  - `scripts/plugins.js` (añadido `EconomyAPI` a imports y `pluginList`)

- Modelo de datos + migraciones:
  - tablas relacionales `econ_accounts` y `econ_transactions` con índices
  - persistencia config/meta/consumers en `plugin:EconomyAPI` (KV)
  - migración registrada con `MigrationService`

- Comandos implementados (usuario/admin/bank/bankadmin):
  - `/mymoney`, `/mydebt`, `/takedebt`, `/returndebt`, `/topmoney`, `/pay`, `/seemoney`, `/mystatus`, `/economys`
  - `/bank deposit|withdraw|mymoney`
  - `/setmoney`, `/givemoney`, `/takemoney`
  - `/bankadmin givemoney|takemoney`
  - `/moneysave`, `/moneyload`

- Reglas de negocio completas:
  - wallet/debt/bank
  - límites de deuda (`onceDebtLimit`, `debtLimit`)
  - validación de montos
  - ranking con flag `addOpAtRank`
  - ledger de transacciones

- Scheduler de intereses:
  - interés periódico de deuda y banco según config
  - flush posterior cuando hay cambios

- Eventos internos:
  - `economy.ready`
  - `economy.account.created`
  - `economy.wallet.changed`
  - `economy.debt.changed`
  - `economy.bank.changed`
  - `economy.transfer.completed`
  - `economy.transaction.failed`
  - `economy.config.reloaded`

- Documentación EN/ES:
  - `docs/plugins/ECONOMYAPI_DOCUMENTATION.md`
  - `docs/plugins/ECONOMYAPI_DOCUMENTATION.es.md`
  - actualizados índices/readmes:
    - `docs/README.md`
    - `docs/README.es.md`
    - `readme.md`
    - `README.es.md`

Verificación:
- Ejecuté revisión de lints en los archivos modificados: **sin errores**.

Si quieres, ahora te preparo un checklist de pruebas in-game específico para `EconomyAPI` con comandos copy-paste (incluyendo casos límite de deuda/bank/intereses).

---

**User**

Creo que hay documentaciones que son muy pobres, a parte en minguna pusiste flowcharts mermeid

---

**Cursor**

Buena observación. Voy a subirles el nivel ahora mismo: ampliaré las docs de `EconomyAPI` y `PlaceholderAPI` (EN/ES) con más detalle operativo y agregaré flowcharts Mermaid claros para arquitectura, flujo de comando y pipeline de resolución.

Totalmente válido el feedback. Ya reforcé la documentación y agregué Mermaid flowcharts en las docs principales de los plugins nuevos.

Actualicé:

- `docs/plugins/ECONOMYAPI_DOCUMENTATION.md`
- `docs/plugins/ECONOMYAPI_DOCUMENTATION.es.md`
- `docs/plugins/PLACEHOLDERAPI_DOCUMENTATION.md`
- `docs/plugins/PLACEHOLDERAPI_DOCUMENTATION.es.md`

Mejoras aplicadas:

- **Flowcharts Mermaid**:
  - arquitectura de `EconomyAPI` (comando -> servicio -> storage/eventos/flush + scheduler)
  - pipeline de resolución de `PlaceholderAPI` (scan -> lookup -> cache -> fallback)
- **Contenido más profundo**:
  - lifecycle detallado
  - estrategia de persistencia
  - semántica de transacciones
  - contrato de consumo runtime para otros plugins
  - guía de payload de eventos
  - troubleshooting por síntomas
- **Integración explícita**:
  - orden exacto `PureChat` `{...}` -> PlaceholderAPI `%...%`

Si quieres, siguiente paso te hago lo mismo para `PURECHAT_DOCUMENTATION` y `PUREPERMS_DOCUMENTATION` (añadiendo diagrams de flujo de permisos/chat pipeline para homogeneizar todo el set de docs).

---

**User**

Siguen siendo docs muy pobres, debes explicar la mas minima cosa, a parte me refiero a todos los @docs cuando digo que no tiene flowcharts mermeid y hay muchos demasiado pobres

---

**Cursor**

Para hacerlo bien en **todos** los `@docs` sin romper consistencia, necesito cerrar 2 decisiones de alcance/editorial primero.

**Alcance de mejora de documentación**

> **¿Qué alcance exacto quieres para esta pasada de documentación?**
> - Todos los .md y .es.md dentro de docs/ (reescritura profunda + flowcharts en cada documento) ✔
> - Solo docs core + docs/plugins (dejar PLUGIN_DOC_TEMPLATE intacto)
> - Primero los más críticos (README, PROJECT_DOCUMENTATION, API_PUBLIC_GUIDE, DATABASE_GUIDE, TROUBLESHOOTING y todos plugins), luego segunda pasada al resto

> **¿Qué política de Mermaid quieres aplicar?**
> - Mínimo 1 flowchart por documento
> - 1 flowchart por sección técnica importante (más de uno por documento grande)
> - Cobertura máxima: varios diagramas (arquitectura, runtime, datos, troubleshooting) en cada doc ✔

Perfecto. Con ese alcance (“todos los `.md/.es.md` en `docs/`” + política Mermaid máxima), te preparo un plan de ejecución por fases para rehacer toda la documentación con nivel profundo y homogéneo.

---

**User**

esto lo copie de google

APIs make the world go round. Developers and other professionals use APIs almost daily. Working with them, by some estimates, 10+ hours a week, for researching, googling for support, studying reviews, and rummaging around in the documentation. How clear, easy, useful, and supported your API is determines the whole developer experience (DX) – an emotional response devs have to the product. In the API economy, great developer experience is fundamental. APIs that help developers succeed and are a joy to deal with will get tons of users and rise above the competition. And it starts at the exact moment they open the documentation for the first time.

API Documentation and Why it MattersPlayButton
Watch this video for an introduction to API documentation

Today we will talk about how to foster positive developer experience in API documentation. But first, we need to understand what makes bad API docs.

What API documentation is and things developers hate about it
API documentation is a guide on how to integrate and work with a given application programming interface. It describes requests, responses, error messages, and other essential details.

The dev community is a passionate one. It’s specifically passionate about the things they don’t like. If they don’t like an API, it’s mostly because of junky docs, even if the product is great. Here are some common issues devs have with API docs.

It’s not written using simple human language. This is a common problem for auto-generated docs or docs that are neglected by creators. Although many documentation generation tools are doing a great job at commenting on the code, they cannot replace actual explanations in English written by a developer or technical writer.

It has very few code samples. This is another end of the spectrum where explanations are abundant, but there are minimal examples of the actual code.

It’s available only to registered users. This not-so-slick maneuver does nothing for your marketing. It only frustrates the people who want to know what your API does before deciding if they want it (as any sane person would).

It’s too long/can’t be found/inaccurate/hasn’t been updated in years, etc. Creating good docs is almost as important as building a good API. Because poorly written docs or the ones that can’t be found by simply googling “Product API” are failing the whole development effort. If you’re interested, we’ve already outlined specifics of technical documentation in general. But API docs deserve a dedicated article. So how do you write great API docs?

Another type of documentation worth exploring is code documentation. Our dedicated article explores this type of documentation in detail.

Adopt spec-driven development
Spec-driven development (SDD) is similar to test-driven development in which you write test cases for each feature and then code that should pass them. In SDD, you create docs or some parts of it in parallel with building an API, often following a certain API description format called a specification.

An API specification is like a template for your future API; the unified language that describes the design of your API explains how it functions and what to expect from it. There are a few specifications, such as RAML (RESTful API Modeling Language), OpenAPI, and API Blueprint. Still, there’s a trend toward combining all specs under the hood of OpenAPI.

These specs have prebuilt documentation tools that allow for writing and managing your docs. For example, API Console automatically generates docs from RAML and OpenAPI formats and helps you run it on your existing web application or as a standalone app.

We’ll touch more on specifications and tools in a bit.

api console
API Console lets you build a web portal for your API docs from RAML and OpenAPI specifications. Source: Pawel Psztyc

Alternative to traditional API doc solutions like WordPress or Drupal CMSs, API spec products are open source, created by the dev community for the dev community, have parsers in different programming languages, and enjoy constant creator support.

Write for the entry-level
There’s a reason technical documentation is usually not written by developers themselves – it’s the job of technical writers, experts in translating tech aspects into a readable format. But even technical writers tend to leak a bit of jargon into the text.

An API, like any software product, is created for a specific audience. But the audience for documentation is vast. There are three main groups of documentation users:

developers who will intimately interact with the docs;
decision-makers like CTOs and solution architects who want to determine whether your API will be a good fit quickly; and
product managers, business analysts, and other non-technical specialists who evaluate the API.
API users by the primary job table
API users by the primary job. Source: Postman

Within each of these groups, there are people with different skills, roles, and needs, all of whom should have a positive experience with the docs. How do you target them all? By targeting the least experienced users. So, how do you write docs for a newcomer?

Start with the opportunities rather than the technicalities. Greet users with compelling storytelling about how your API can enrich their product or make developers’ lives ten times easier.

Amazon Alexa API docs
Amazon Alexa API docs start with explaining what Alexa does and what benefits it can bring to the client

Show where to start. API docs are notorious for being too overwhelming and assuming that users have vast experience with APIs. The getting started section is obligatory and should be written clearly for a potential user.

facebook apis
Facebook provides a clear reference for beginners and follows the getting started process step by step

Create instructions for the most common use cases. You probably already know what functions people use your API for. Create separate sections addressing them and include sample messages there.

Use a conversational tone. The developer community is laidback and informal, so they won’t appreciate dry corporate language even if it sounds more “professional.” Good docs always talk to humans.

Educate on external tools. If your API requires using and understanding third-party products and concepts like OAuth or npm, include links to docs or installation guides.

Make it easy to learn. API docs are not IKEA assembly instructions, they are the learning source. Enrich your documentation with FAQs, tutorials, blogs, and even videos when possible.

Incorporate must-have sections
In 2019, SmartBear, the developer of tools for API designing and documenting Swagger, surveyed API developers and users. They found what docs features are considered the most important in the community, giving us a list of the must-have documentation sections devs want to cover. We’ll go through some of them.

api documentation features
SmartBear surveyed 3,000 API practitioners

Examples. Examples are usually presented as pieces of code that are useful enough but can be made even more practical. For instance, include a transcript of fields as it’s done in Medium docs or even create a mock API to test it on real calls. Mock APIs can be easily shared via a URL or on GitHub, and if done to a certain level of detail, even used in the final product.

Status and errors. There are standard status codes and those specific to your API ones. Including all errors your API can trigger is a good idea. Errors are often put on a dedicated page of the docs, but it makes sense to duplicate some directly under the endpoint where they surface the most.

Authentication. Most API docs start with authentication and authorization. It should cover info on how to get an API key and how to authenticate requests, including possible errors, token expiration times, and an explanation of authentication sensitivity (basically reminding that keys can’t be shared, and where they can be used.)

HTTP requests. Providing web requests in HTTP is the bare minimum for documentation. It’s usually assumed that devs will know how to send HTTP requests in their language of choice, but sometimes, API creators include requests in various languages. This can be done automatically via API spec tools and API management tools like Postman.

Quotas and limits on requests. If you expose the API to third-party users, define how many requests your infrastructure can handle and let your customers know the limits. This transparency will prevent API overuse.

Use industry-standard layout
If you’re relying on a documentation generator, the layout is already decided. Most API docs look and feel the same. You know how to approach new docs if you’ve used a few. Still, organizing large volumes of data, making it findable and easy to navigate, is complex. Here are some features of the most functional layout.

Dynamic layout. You can recognize an outdated API by its static documentation. A single page or PDF document doesn’t cut it in 2023. Dynamic docs are easy to look through, update, and bookmark.

Sticky contents. No, the navigation bar shouldn't distract or steal precious screen space. Always keep the contents in sight.

Three-column layout. Not used very often, this layout allows you to have another column on the right for the code examples. Of course, this only makes sense if you have a ton of text and want to highlight code so that users don’t have to scroll back and forth or switch between tabs.

Shutterstock API docs 
Shutterstock API docs use a three-column layout

Use contrast colors for syntax. Developers spend a lot of time looking at your code examples, so make them readable and separate different components by color.

facebook graph api
This example from Facebook’s Graph API docs also shows how you can use different tabs to choose between SDKs

Saved scroll state. This is a small detail that any developer will appreciate. You can also use anchor links to specify different sections of the page in case they copy the URL.

Encourage feedback. Your docs are your main marketing tool – if people love them, they will prefer your API over competitors and drive the community around it. The usual “Was this page helpful?” message will let you know how well you’re addressing devs’ questions, and the feedback form will be used often as long as you deliver on it.

Don’t abandon your docs
Outdated docs are the biggest pet peeve of API users. This is also one of the most common mistakes. Developers often write about updates several days after rolling them out, sometimes limiting themselves to a few sentences. This happens because there’s no established process, and it’s no one’s responsibility. Here’s how to ensure regular and useful doc updates.

Prepare docs prior to the updates. Make it an additional step in your launch plan, don’t roll updates out before you have well-written, detailed, and edited paragraphs to introduce your changes.

Regularly remove deprecated data. The docs must be reviewed at least once every few months. User feedback features will let you catch inconsistencies earlier, and a team member should always be responsible for reviewing them and reacting to new versions.

Use analytics to improve docs. Standard API analytics will tell you which endpoints are used more often, so you can focus on certain parts of the documentation and provide more helpful info or create dedicated tutorials. Monitor the most common API use cases because that will let you widen the value proposition and update the docs with more possibilities.

API documentation templates and tools
Today, you don’t need to create your API documentation from scratch and manually if your API follows the OpenAPI specification. As mentioned, API specification is a language that allows you to standardize your web service, generate client code and even test cases. Similarly, you can employ tools to automatically design the initial version of your docs and then infuse it with details and descriptions.

Postman
Postman is one of the key tools used to build and test APIs. If you stick to OpenAPI 2.0 or 3.0, it will automatically generate documentation from the template, containing methods, requests/response bodies, examples, and parameters. Also, Postman will highlight constraints, including minimum and maximum values.

Swagger
Swagger is another popular API development tool using OpenAPI specification. In fact, OpenAPI was part of Swagger until 2016, when the specification became the brand-agnostic standard for web services. Like Postman, it automatically generates documentation based on your API definition and allows for creating this definition if you don’t have one. Swagger suggests an advanced versioning system to track your API iterations in docs.

Great REST API documentation examples
There are tons of good docs to explore and learn from. In addition to the examples we’ve shared throughout the article, here are some more for you to enjoy and take note of. All of them follow REST conventions, as this API architecture is currently the most popular for web-based APIs.

Salesforce API documentation
Salesforce Platform API (or rather a set of many APIs) is currently the world's most popular application programming interface, according to Postman. With massive integration capabilities and functionalities covered, Salesforce requires robust and approachable documentation to bring developers on board quickly. While it’s a bit of a jungle for a newcomer to find a specific API, such tools as guides, the catalog, and a search bar help a user to conquer the complexity.

Salesforce and its community keep their documents updated, regardless of the scope. Most API docs are broken down into three sections: brief informative descriptions, guides, and references with all endpoints and methods listed in the contents.

salesforce screenshot
Besides, the users can quickly switch between versions

Mailchimp API documentation
Mailchimp realizes that most of its audience are marketing professionals and uses language that enables even non-tech people to understand how to work with its APIs. At a glance, each section follows the same structure:

what an endpoint does and what the guide will let users do;
what you’ll need – any accesses or accounts a user must get first; and
what each function is, with a text description, a code example in several languages, and sometimes screenshots of the interface.
mailchimp api
There’s even a copy button for each piece of code – a detail that non-techies will certainly appreciate.

Twilio API documentation
Twilio has famously good API docs. Although docs are just the tip of the iceberg of all the help Twilio shares – there are SDKs in several languages and sample apps for iOS, Android, and the web. First, they follow the three-column logic with the code directly on the right side of the guide. The simplest actions are explained in detail, and there are tons of links for additional information in addition to screenshots. Feedback is also encouraged via a “Rate this page” button and links to the support team and the tag on StackOverflow.

twilio api
Spotify API documentation
Although Spotify’s web API docs are very typical, they have a lot of additional information in its Spotify for Developers platform. There are demos for basic functions, mock apps, live examples built using Spotify APIs and widgets, wrappers for different programming languages, and the console. The console is basically an interactive documentation where you can fill your (or sample) data in and explore endpoints live. Powerful products and a strong knowledge base make Spotify a reliable partner that developers like to work with.

spotify api
Who writes API documentation?
Documentation is the only touchpoint you’ll have with most of your audience, so you need to learn to communicate clearly through it. The best tip here is to make it someone’s job. This technical writer must know how to speak to audiences of different skills, translate developers’ words into actionable points, and monitor the timely maintenance and updating of the docs. But managing great documentation is possible even without an expert on your staff. API management tools like Swagger UI, Spotlight, Apiary, and docs specification software have a broad functionality to help you make docs that developers will love.

---

**Cursor**

Excelente referencia; está muy alineada con lo que faltaba. La traduzco a reglas concretas para tu repo y la usaré como estándar de reescritura en **todos** los `docs/`.

## Cómo lo aplicamos en PMMPCore docs

- **Entrada para novatos**: cada documento empieza con “qué resuelve”, “por qué importa” y “cómo empezar en 3 pasos”.
- **Secciones obligatorias**: comandos/API, errores comunes, auth/permisos, límites, ejemplos reales, troubleshooting.
- **Ejemplos first-class**: más comandos copy-paste y snippets por caso de uso (no solo teoría).
- **Layout consistente**: misma estructura en todos los docs EN/ES para que navegar sea predecible.
- **Diagramas Mermaid máximos**: arquitectura + runtime flow + data flow + decisión de troubleshooting por documento técnico.
- **DX tone**: lenguaje claro, directo, humano; menos jerga y más intención práctica.
- **Mantenimiento**: cada doc tendrá sección de “cambios/versionado” y checklist de revisión periódica.
- **Encontrabilidad**: reforzar índices (`docs/README*`) y enlaces cruzados por tema.

## Criterio de “doc no pobre”
Un documento no se considera terminado si no tiene:

- explicación de contexto (qué problema resuelve),
- guía de inicio rápido,
- ejemplos ejecutables,
- errores y respuestas esperadas,
- al menos 2-4 diagramas en docs grandes,
- checklist de validación.

Si quieres, en el siguiente paso te entrego una **plantilla maestra única** (EN/ES) que voy a imponer a todos los documentos para que el rewrite quede uniforme y fácil de auditar.

---

**User**

de momento modifica el plan

---

**Cursor**

Perfecto, voy a ajustar el plan para que incorpore explícitamente ese estándar de DX documental (lenguaje simple, onboarding, ejemplos, errores, mantenimiento y Mermaid máximo) como criterio obligatorio de aceptación.

Hecho. Ya modifiqué el plan para que quede más exigente y alineado con lo que pediste.

### Qué le añadí al plan
- **Enfoque DX explícito** (entry-level primero, lenguaje humano, docs orientadas a tareas reales).
- **Secciones obligatorias nuevas** en todos los docs:
  - propuesta de valor,
  - getting started paso a paso,
  - errores/estados esperados,
  - límites/cuotas,
  - auth/permisos.
- **Principios editoriales obligatorios** para evitar docs pobres.
- **Fase 1 reforzada** con plantilla base y bloques estándar (`Quickstart + Use Cases + Errors`).
- **Fase 4 reforzada** con guía editorial para mantenimiento futuro.
- **QA más estricto**:
  - cobertura mínima de ejemplos,
  - cobertura de errores,
  - usabilidad para entry-level.
- **Definition of Done** clara:
  - ningún doc sin reescritura profunda,
  - Mermaid múltiples por doc técnico,
  - inicio rápido + casos comunes + límites + errores en cada guía relevante.

Si quieres, ahora te hago una versión aún más “de control” con checklist por archivo (uno por uno en `docs/`) para ir marcando cumplimiento.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Empiezo ya con la ejecución completa del plan documental: primero marco `docs-inventory-map` en progreso y hago inventario total de `docs/` para reescribir cada archivo EN/ES con el nuevo estándar + Mermaid maximal.

Voy con Fase 1: reforzaré primero las guías core (`PROJECT`, `API_PUBLIC`, `DATABASE`, `PLUGIN_DEVELOPMENT` en EN/ES) agregando secciones de onboarding, casos comunes, errores y varios diagramas Mermaid por archivo.

Sigo con `DATABASE_GUIDE` y `PLUGIN_DEVELOPMENT_GUIDE` (EN/ES): voy a meter diagramas múltiples adicionales de arquitectura, flujo de escritura/flush y runbook de errores para cumplir tu estándar maximal en docs core.

Voy a cubrir ahora todos los manuales de `docs/plugins/*` (EN/ES) con ampliaciones homogéneas: quickstart, flujo Mermaid de arquitectura/runtime y árbol de troubleshooting por plugin.

Listo. Ya ejecuté el plan completo de reescritura documental en `docs/` y marqué todos los to-dos como **completed**.

Qué quedó hecho:

- Reescritura y ampliación profunda de guías core:
  - `docs/PROJECT_DOCUMENTATION.md` / `.es.md`
  - `docs/API_PUBLIC_GUIDE.md` / `.es.md`
  - `docs/DATABASE_GUIDE.md` / `.es.md`
  - `docs/PLUGIN_DEVELOPMENT_GUIDE.md` / `.es.md`

- Reescritura operativa:
  - `docs/PLUGIN_MIGRATION_GUIDE.md` / `.es.md`
  - `docs/TROUBLESHOOTING_PLAYBOOK.md` / `.es.md`

- Reforzado de docs de plugins (`docs/plugins/` EN/ES):
  - `MULTIWORLD_DOCUMENTATION`
  - `PUREPERMS_DOCUMENTATION`
  - `PURECHAT_DOCUMENTATION`
  - `PLACEHOLDERAPI_DOCUMENTATION`
  - `ECONOMYAPI_DOCUMENTATION`

- Armonización de índices y plantilla:
  - `docs/README.md` / `.es.md`
  - `docs/PLUGIN_DOC_TEMPLATE.md` / `.es.md`

Qué mejoró de forma concreta:

- Más contenido orientado a **entry-level onboarding** y casos de uso.
- Secciones más operativas: validación, fallos frecuentes, runbooks y árboles de decisión.
- Cobertura Mermaid ampliada con enfoque **maximal** en docs técnicos:
  - arquitectura,
  - flujo runtime/comandos,
  - dataflow,
  - troubleshooting decision trees.
- Consistencia editorial EN/ES y navegación de índice.

Validación final:

- Linter de docs: **sin errores**.
- Confirmación de presencia de bloques Mermaid en los documentos técnicos de `docs/`.

Si quieres, siguiente paso te hago una **auditoría de calidad por archivo (scorecard)** con una tabla de cumplimiento (onboarding, ejemplos, errores, límites, Mermaid, mantenibilidad) para que veas qué docs aún podrían subir a nivel “excelente”.

---

**User**

prepara un commit (redactalo)

Ahora hagamos el essentialsTP@essentialsTP-Original/ recuerda que te adjunto el original para que veas como funciona pero nosotros en PMMPCore tenemos nuestra propia API, forma de hacer plugins documentada y con codigo fuente y nuestro propio mini gestor de base de datos

---

**Cursor**

Para planear `EssentialsTP` bien y alineado a PMMPCore, necesito cerrar 2 decisiones críticas de alcance antes de crear el plan.

**Definir alcance de EssentialsTP**

> **¿Qué nivel de paridad quieres con el original?**
> - Paridad completa (todos los comandos TP del original + comportamiento equivalente adaptado a Bedrock/PMMPCore)
> - Solo núcleo TP (tpa/tpaccept/tpdeny/tpahere/back/home-like si aplica) y luego ampliamos
> - Paridad completa + mejoras propias PMMPCore desde v1 ✔

> **¿Incluimos también documentación EN/ES y flowcharts Mermaid en esta misma entrega?**
> - Sí, código + docs completas EN/ES con Mermaid ✔
> - Primero solo código; docs en una segunda fase

Perfecto: entonces voy con **paridad completa + mejoras PMMPCore** y además **código + documentación EN/ES con Mermaid** en la misma entrega. Haré un barrido del original y del framework para devolverte un plan de implementación sólido.

Ya tengo el mapeo completo del original y de PMMPCore. Voy a dejarte el plan ejecutable por fases, con arquitectura, archivos objetivo y entregables de docs EN/ES.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Empiezo ejecutando el plan en orden: primero marco el primer to-do como `in_progress` y luego hago el scaffold base de `EssentialsTP` siguiendo el patrón de plugins actuales (`main/config/state/service/commands`).

Ya tengo la referencia técnica suficiente; ahora voy a crear el plugin completo por capas (scaffold → persistencia → comandos/flujo → integraciones/eventos) y al final redacto la documentación EN/ES con Mermaid + verificación de lints.

Terminé el núcleo del plugin y ya estoy cerrando la parte documental e índice; ahora ajusto `README.es.md`, luego corro lints y finalizo todos los to-dos en orden.

Implementación completada según el plan, sin tocar el archivo `.plan.md`, y todos los to-dos quedaron en `completed`.

Cambios principales:

- Nuevo plugin `EssentialsTP` creado en `scripts/plugins/EssentialsTP/`:
  - `config.js`
  - `state.js`
  - `service.js`
  - `commands.js`
  - `main.js`
- Registro del plugin en `scripts/plugins.js` (import + `pluginList` + log de loader).
- Documentación bilingüe creada:
  - `docs/plugins/ESSENTIALSTP_DOCUMENTATION.md`
  - `docs/plugins/ESSENTIALSTP_DOCUMENTATION.es.md`
- Índices de docs actualizados:
  - `docs/README.md`
  - `docs/README.es.md`

Qué quedó implementado:

- Paridad funcional de comandos base: homes, warps, spawn, back, wild, tpa/tpahere/tpaccept/tpdeny.
- Mejora adicional PMMPCore: `tpcancel` y aceptación/denegación selectiva por jugador.
- Persistencia híbrida:
  - Relacional: `ess_tp_homes`, `ess_tp_requests`, `ess_tp_warps`, `ess_tp_spawns`.
  - KV: `back`, `cooldowns`, `plugin config/meta`.
- Flujo robusto de requests: `pending`, `accepted`, `denied`, `cancelled`, `expired` + limpieza periódica.
- Eventos de dominio `essentialstp.*`.
- Integraciones opcionales:
  - PlaceholderAPI (expansión `essentialstp` con placeholders básicos).
  - EconomyAPI (costos opcionales por acción).
  - Degradación segura si faltan plugins opcionales.
- Lint check ejecutado en archivos modificados: sin errores.

Si quieres, en el siguiente paso te preparo un bloque de pruebas in-game por fases (single-player + 2 jugadores) con comandos exactos para validar cada flujo end-to-end.

---

**User**

Si, necesito probar

---

**Cursor**

Revisando los comandos y permisos exactos del plugin para darte una guía de prueba precisa (incluyendo prefijo `pmmpcore:` y alias).



Estás en **Ask mode**: no puedo ejecutar nada en tu mundo ni tocar archivos; aquí va una guía concreta para probar **EssentialsTP** tal como está en el repo.

## 1. Requisitos previos

- El pack debe cargar `EssentialsTP` vía `scripts/plugins.js` (ya incluye el import y `pluginList`).
- **PurePerms**: el backend debe estar listo. Si eres **operador de Bedrock**, por defecto PurePerms te da **todos** los permisos (salvo que en config de PurePerms esté `disableOp: true`).
- Si **no** eres OP, asigna al grupo/usuario los nodos de `essentialstp.command.*` y admin `essentialstp.admin.*` según lo que quieras probar (están en `scripts/plugins/EssentialsTP/config.js`).

## 2. Forma de los comandos

Cada comando se registra como `pmmpcore:<nombre>` y además se intenta registrar **alias sin namespace** (por ejemplo `sethome` además de `pmmpcore:sethome`). Si uno falla en tu versión, usa siempre el prefijo `pmmpcore:`.

## 3. Pruebas en solitario (un jugador)

Ejecuta en este orden (puedes usar alias o la forma namespaced):

1. **Home**
   - `pmmpcore:sethome` o `sethome`
   - Muévete un poco y: `pmmpcore:home` o `home`
   - Opcional nombre: `pmmpcore:sethome casa` luego `pmmpcore:home casa`
   - Borrar: `pmmpcore:delhome casa`

2. **Back + cooldown**
   - `pmmpcore:home` (o `warp`/`spawn` más abajo)
   - Espera unos segundos y: `pmmpcore:back`
   - Repite `back` enseguida: debería quejarse por **cooldown** (por defecto 5 s para back).

3. **Warp admin + uso**
   - `pmmpcore:setwarp prueba` (requiere `essentialstp.admin.setwarp`)
   - Muévete y: `pmmpcore:warp prueba`
   - `pmmpcore:delwarp prueba`

4. **Spawn por dimensión**
   - Donde estés: `pmmpcore:setspawn` (requiere permiso setspawn)
   - Muévete y: `pmmpcore:spawn`

5. **Wild**
   - `pmmpcore:wild` (varias veces; a veces puede fallar si no encuentra sitio “seguro” en los intentos configurados)

## 4. Pruebas con dos jugadores (tpa / tpahere)

Necesitas **dos cuentas** en el mismo mundo (LAN, Realm o servidor). Llama al otro jugador `Otro`.

**Jugador A (ByCesarKun):**

- `pmmpcore:tpa Otro` — pide ir hacia Otro.

**Jugador B (Otro):**

- `pmmpcore:tpaccept` — acepta la solicitud más reciente.
- O con selección: `pmmpcore:tpaccept ByCesarKun` si hay varias.

**Negar / cancelar:**

- Otro: `pmmpcore:tpdeny` o `pmmpcore:tpdeny ByCesarKun`
- ByCesarKun: `pmmpcore:tpcancel` o `pmmpcore:tpcancel Otro`

**tpahere:**

- ByCesarKun: `pmmpcore:tpahere Otro`
- Otro: `pmmpcore:tpaccept`

**Expiración:** por defecto las solicitudes duran **30 s** (`requests.timeoutSeconds` en `config.js`); deja pasar el tiempo y prueba `tpaccept` (debería fallar / marcar expirada en limpieza).

## 5. Integraciones opcionales (rápido)

- **PlaceholderAPI** (si está cargado): en chat u otro plugin que use PAPI, prueba placeholders documentados, por ejemplo `essentialstp_home_count` (formato `%identifier_key%` según PlaceholderAPI).
- **EconomyAPI**: con `costs.enabled: true` y montos > 0 en la config persistida del plugin, los comandos deberían cobrar vía `reduceMoney`. Con `enabled: false` (default en código) no cobra nada.

## 6. Qué mirar si “no hace nada”

- Mensaje `Missing permission: essentialstp.command....` → falta nodo o no eres OP con PurePerms activo.
- Mensaje de cooldown → espera los segundos indicados (home/spawn/warp/wild/back/tpa/tpahere).
- Fallo de dimensión → destino guardado con un `dimensionId` que el juego no puede resolver ahora.

Si quieres que yo **verifique en el proyecto** algo más fino (por ejemplo si tu grupo actual tiene los permisos o si falta seed de nodos), dime si pruebas como **OP** o como **Guest** y en qué dimensión estás; en Agent mode podría ayudarte a ajustar seeds o mensajes.

---

**User**

/pmmpcore:home

---

**Cursor**

Detectando un límite del Script API de Bedrock: los callbacks de comandos personalizados ejecutan en contexto restringido y no pueden llamar a `player.teleport()` directamente. Aplazando el teletransporte con `system.run()` (siguiente tick).



Aplazando `player.teleport` con `system.run()` para ejecutarlo fuera del contexto restringido de los custom commands.



El mensaje sale porque **los callbacks de comandos personalizados en Bedrock corren en contexto restringido** y ahí **no se puede** llamar a `Entity.teleport()` de forma directa.

**Qué hice:** en `EssentialsTPService.teleportPlayer` el teletransporte real va ahora en `system.run(() => { ... })`, en el **siguiente tick**, y se vuelve a resolver el jugador y la dimensión dentro de ese callback. Si falla, se emite `essentialstp.teleport.failed` y se registra en consola.

Archivo tocado: `scripts/plugins/EssentialsTP/service.js` (import de `system` + cambio en `teleportPlayer`).

También actualicé la documentación EN/ES con este caso y el evento `essentialstp.teleport.failed`.

**Qué hacer tú:** vuelve a cargar el mundo / reaplica el behavior pack y prueba otra vez:

1. `pmmpcore:sethome`
2. `pmmpcore:home`

Deberías teleportarte sin ese error (el TP puede ocurrir **un instante después** de enviar el comando, por el `system.run`).

---

**User**

Dame la guia paso a paso de como usarlos comandos

---

**Cursor**

Aquí va una **guía paso a paso** para usar **EssentialsTP** en PMMPCore. Está alineada con lo que documenta el plugin (`docs/plugins/ESSENTIALSTP_DOCUMENTATION.es.md`) y los permisos de `scripts/plugins/EssentialsTP/config.js`.

---

## Antes de empezar

1. **Asegúrate** de que el behavior pack con PMMPCore (y `EssentialsTP` cargado en `scripts/plugins.js`) está activo en el mundo.
2. **Permisos (PurePerms):** cada comando exige su nodo `essentialstp.command.*` o `essentialstp.admin.*`. Si eres **operador de Bedrock**, PurePerms suele dejarte usar todo salvo que tengas `disableOp` activado en PurePerms.
3. **Cómo escribir el comando:** cada uno existe como **`/pmmpcore:<nombre>`** (recomendado). También se intenta registrar **alias** sin prefijo (por ejemplo `/home`). Si un alias no te funciona en tu versión, usa siempre `pmmpcore:`.
4. **Teletransporte:** el TP puede aplicarse **un tick después** de ejecutar el comando (diseño para evitar el error de “restricted execution” en comandos personalizados).

---

## 1) Homes (casa)

| Paso | Qué haces | Comando ejemplo |
|------|-----------|-----------------|
| 1 | Ponte donde quieres la casa | — |
| 2 | Guardas el home por defecto (`home`) | `/pmmpcore:sethome` o `/sethome` |
| 3 | Te alejas y vuelves | `/pmmpcore:home` o `/home` |
| 4 | (Opcional) Otro home con nombre | `/pmmpcore:sethome mina` |
| 5 | Ir a ese home | `/pmmpcore:home mina` |
| 6 | Borrar un home | `/pmmpcore:delhome mina` |

Límite por defecto: **5 homes** por jugador; nombre máximo **24** caracteres (normalizado en minúsculas).

---

## 2) Back (volver atrás)

| Paso | Qué haces | Comando |
|------|-----------|---------|
| 1 | Haz cualquier TP del plugin (home, warp, spawn, wild, tpa aceptado, etc.) | — |
| 2 | Vuelve a la posición guardada como “back” | `/pmmpcore:back` |

Hay **cooldown** (por defecto **5 s** entre usos de `back`).

---

## 3) Spawn (punto de spawn del mundo / dimensión)

**Un admin/configurador** debe definir el spawn en la dimensión actual:

| Paso | Comando |
|------|---------|
| 1 | Ir al sitio del spawn y ejecutar | `/pmmpcore:setspawn` |

**Cualquier jugador** con permiso:

| Paso | Comando |
|------|---------|
| 1 | Ir a ese spawn (usa el spawn de **tu dimensión actual**; si no hay, intenta overworld) | `/pmmpcore:spawn` |

Si no hay spawn guardado, el comando dirá que no está configurado.

---

## 4) Warps (puntos globales)

| Paso | Quién | Comando |
|------|--------|---------|
| 1 | Admin en el sitio | `/pmmpcore:setwarp nombre` (permiso `essentialstp.admin.setwarp`) |
| 2 | Jugador | `/pmmpcore:warp nombre` |
| 3 | Admin borra warp | `/pmmpcore:delwarp nombre` |

---

## 5) Wild (tele aleatorio)

| Paso | Comando |
|------|---------|
| 1 | En la dimensión donde quieras explorar | `/pmmpcore:wild` |

Puede fallar si no encuentra un sitio “seguro” en varios intentos (configurable en el plugin).

---

## 6) TPA / TPAHERE (con otro jugador)

Necesitas **dos jugadores online** en el mismo mundo (LAN, Realm, servidor). Sustituye nombres reales.

### A) “Quiero ir yo hacia él” (`tpa`)

| Paso | Jugador | Comando |
|------|---------|---------|
| 1 | Tú (solicitante) | `/pmmpcore:tpa NombreDelOtro` |
| 2 | El otro (receptor) acepta | `/pmmpcore:tpaccept` o `/pmmpcore:tpaccept TuNombre` si hay varias solicitudes |
| O | El otro rechaza | `/pmmpcore:tpdeny` o `/pmmpcore:tpdeny TuNombre` |
| O | Tú cancelas tu pedido | `/pmmpcore:tpcancel` o `/pmmpcore:tpcancel NombreDelOtro` |

### B) “Quiero que él venga a mí” (`tpahere`)

| Paso | Jugador | Comando |
|------|---------|---------|
| 1 | Tú | `/pmmpcore:tpahere NombreDelOtro` |
| 2 | El otro | `/pmmpcore:tpaccept` (o con tu nombre si hace falta) |

Las solicitudes **expiran** (por defecto **30 s**). Si tardas mucho, pide de nuevo.

Hay **cooldown** en `tpa` y `tpahere` (por defecto **5 s** cada uno).

---

## 7) Cooldowns y economía (resumen)

- Varios comandos comparten política de **cooldown** (home, spawn, warp, wild, back, tpa, tpahere): por defecto **5 s** cada uno en la config del plugin.
- **EconomyAPI:** si en la config del plugin activas costes (`costs.enabled`), algunos comandos pueden cobrar; con la config por defecto del código, **no cobra**.

---

## 8) Si algo falla

- **“Missing permission: essentialstp.command.…”** → falta ese permiso en PurePerms (o no eres OP con la regla de OP activa).
- **“Cooldown active…”** → espera los segundos que indica el mensaje.
- **“No spawn has been configured”** → alguien debe usar `/pmmpcore:setspawn` en esa dimensión (o en overworld como respaldo).

Si quieres, en un siguiente mensaje dime si juegas **solo**, **dos cuentas** o **servidor**, y tu grupo PurePerms (OP, Guest, etc.), y te armo una **lista mínima de permisos** solo para lo que uses.

---

**User**

Eso deberia estar en las docs

---

**Cursor**

Añadiendo la guía paso a paso a la documentación EN y ES de EssentialsTP.



Insertando la sección «3.1» con la guía paso a paso en ambos archivos, justo después del listado de comandos.



Listo. La guía paso a paso quedó integrada en la documentación del plugin:

- **Español:** [docs/plugins/ESSENTIALSTP_DOCUMENTATION.es.md](docs/plugins/ESSENTIALSTP_DOCUMENTATION.es.md) — nueva sección **3.1 Guia paso a paso (uso en juego)** (antes de permisos): requisitos, sintaxis `pmmpcore:` vs alias, homes, back, spawn, warps, wild, TPA/TPAHERE, cooldowns y costes EconomyAPI.
- **Inglés:** [docs/plugins/ESSENTIALSTP_DOCUMENTATION.md](docs/plugins/ESSENTIALSTP_DOCUMENTATION.md) — misma estructura como **3.1 Step-by-step usage guide**.

En la **sección 9** (checklist rápido) añadí un enlace explícito a la 3.1 en ambos idiomas.

---

**User**

Ahora para yo testear sin tanta palabreria dime que comandos ir usando para testear uno a uno

---

**Cursor**

Ejecútalos **en este orden** (puedes usar siempre la forma `pmmpcore:`):

1. `/pmmpcore:sethome`  
2. `/pmmpcore:home`  
3. `/pmmpcore:sethome test`  
4. `/pmmpcore:home test`  
5. `/pmmpcore:delhome test`  
6. `/pmmpcore:setwarp prueba` *(necesitas permiso admin del warp)*  
7. `/pmmpcore:warp prueba`  
8. `/pmmpcore:setspawn`  
9. `/pmmpcore:spawn`  
10. `/pmmpcore:wild`  
11. `/pmmpcore:back`  

**Con otro jugador online** (sustituye `Nombre`):

12. `/pmmpcore:tpa Nombre` → el otro: `/pmmpcore:tpaccept`  
13. `/pmmpcore:tpahere Nombre` → el otro: `/pmmpcore:tpaccept`  
14. Prueba `/pmmpcore:tpdeny` o `/pmmpcore:tpcancel` en otro intento  

15. `/pmmpcore:delwarp prueba` *(admin)*

---

**User**

claro pero como usarlos, porque no pondre sethome y ya, seria sethome casa por ejemplo

---

**Cursor**

Así va la sintaxis:

**`sethome`**  
- Sin nombre → guarda el home **por defecto** llamado `home`:  
  `/pmmpcore:sethome`  
- Con nombre → guarda un home con ese nombre (ej. `casa`):  
  `/pmmpcore:sethome casa`  

**`home`**  
- Sin argumento → vas al home **por defecto** (`home`):  
  `/pmmpcore:home`  
- Con nombre → vas al que guardaste:  
  `/pmmpcore:home casa`  

**`delhome`**  
- Borra el default: `/pmmpcore:delhome` o explícito `/pmmpcore:delhome home`  
- Borra uno con nombre: `/pmmpcore:delhome casa`  

Los nombres se guardan en **minúsculas** por dentro; puedes escribirlos como quieras y el juego los normaliza.

**Resumen:** si quieres “la casa”, usa `sethome casa` y luego `home casa`; el default es solo `sethome` + `home` sin texto.

---

**User**

TestLista completa 

---

**Cursor**

Lista **completa** para probar (sintaxis recomendada `pmmpcore:`). Sustituye `nombre`, `jugador`, etc.

### Homes
- `/pmmpcore:sethome` — home por defecto (`home`)
- `/pmmpcore:sethome casa` — home llamado `casa`
- `/pmmpcore:home` — ir al default
- `/pmmpcore:home casa` — ir a `casa`
- `/pmmpcore:delhome` o `/pmmpcore:delhome home` — borrar default
- `/pmmpcore:delhome casa` — borrar `casa`

### Back
- `/pmmpcore:back` — tras cualquier TP del plugin

### Spawn
- `/pmmpcore:setspawn` — guardar spawn de la dimensión actual *(permiso setspawn)*
- `/pmmpcore:spawn` — ir al spawn

### Warps
- `/pmmpcore:setwarp nombre` — crear warp *(admin setwarp)*
- `/pmmpcore:warp nombre` — ir al warp
- `/pmmpcore:delwarp nombre` — borrar *(admin delwarp)*

### Wild
- `/pmmpcore:wild`

### TPA (dos jugadores)
- `/pmmpcore:tpa jugador`
- `/pmmpcore:tpahere jugador`
- Receptor: `/pmmpcore:tpaccept` o `/pmmpcore:tpaccept nombreSolicitante`
- Receptor: `/pmmpcore:tpdeny` o `/pmmpcore:tpdeny nombreSolicitante`
- Solicitante: `/pmmpcore:tpcancel` o `/pmmpcore:tpcancel nombreObjetivo`

### Orden sugerido (una pasada)
1. `sethome` → `home` → `sethome casa` → `home casa` → `delhome casa`  
2. `setwarp prueba` → `warp prueba`  
3. `setspawn` → `spawn`  
4. `wild`  
5. `back`  
6. Con otro jugador: `tpa` / `tpaccept` → `tpahere` / `tpaccept` → probar `tpdeny` o `tpcancel`  
7. `delwarp prueba`  

**Alias** (si tu cliente los muestra): mismos nombres sin `pmmpcore:`, p. ej. `/sethome casa`.

---

**User**

que hace /back exactamente

---

**Cursor**

En **este** EssentialsTP, `/back` hace esto:

1. **Lee** la última posición guardada en tus datos de jugador bajo `essentialsTP.back` (coordenadas, dimensión, mirada aproximada y cuándo se guardó).

2. **Te teletransporta** a ese sitio (con el cooldown de `back` si aplica).

3. **De dónde sale ese punto:** justo **antes** de cada teletransporte que hace el plugin vía `teleportPlayer`, se llama a `recordBack` y se guarda **donde estás en ese momento**. Eso pasa en: `home`, `warp`, `spawn`, `wild`, aceptar `tpa`/`tpahere`, y también cuando usas `/back` (primero guarda dóde estás ahora, luego te mueve al “back” anterior).

En la práctica:

- Vas al sitio **A**, usas por ejemplo `/pmmpcore:home` y acabas en **B** → el “back” queda **A**.
- `/pmmpcore:back` te devuelve a **A** y, al hacerlo, el nuevo “back” pasa a ser **B** (donde estabas al pulsar `/back`), así que **otro** `/back` te puede llevar otra vez hacia **B** (efecto “ida y vuelta” entre los dos sitios).

**No** es el “último sitio de muerte” ni un historial largo: es **solo la última posición previa** que el plugin fue guardando en cadena.

Si nunca hubo un TP de EssentialsTP antes (o no hay dato guardado), `/back` responde con algo como que **no hay ubicación de back**.

---

**User**

el /setspawn no guada el spawn, testee haciendome kill y no apareci ahi xd, tambien deberia poder resetear el spawn al original de esa dimension creo, el mw setspawn guarda el spawn por dimension y esto deberia hacer lo mismo creo

