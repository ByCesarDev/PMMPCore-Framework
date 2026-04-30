# PMMPCore - Documentación de PureChat

Idioma: [English](PURECHAT_DOCUMENTATION.md) | **Español**

## Tabla de contenidos

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Instalación y verificación rápida](#2-instalación)
3. [Cómo testear PureChat (checklist)](#3-cómo-testear-purechat-checklist)
4. [Comandos (`/pchat`) con ejemplos](#4-comandos)
5. [Permisos (y cómo asignarlos con PurePerms)](#5-permisos)
6. [Modelo de datos y configuración (propiedad por propiedad)](#6-modelo-de-datos-y-configuración)
7. [Placeholders](#7-placeholders)
8. [Colores y reglas de sanitización](#8-códigos-de-color)
9. [Comportamiento por lifecycle](#9-comportamiento-por-lifecycle)
10. [Troubleshooting (por síntoma)](#10-troubleshooting)
11. [FAQ](#11-faq)

## 1. Objetivo y alcance

PureChat es el plugin de formato de chat de PMMPCore. Proporciona:

- Formato de chat y nametag por grupo.
- Overrides opcionales por mundo.
- Prefijo y sufijo por jugador.
- Placeholders de facción opcionales por adaptador.
- Mensajes con color condicionados por permiso.

## 2. Instalación

1. Verifica carpeta en `scripts/plugins/PureChat/`.
2. Verifica import en loader `./plugins/PureChat/main.js`.
3. Reinicia mundo y confirma logs de carga.
4. Ejecuta comandos de prueba:
   - `/pchat preview`
   - `/pchat setprefix <player> <prefix>`

## 3. Cómo testear PureChat (checklist)

### 3.1 Verificar que el plugin está “listo”

1. Ejecuta:

```text
/pchat preview
```

2. Esperado:
   - Te muestra `Group: <...>` y templates.
   - Si PurePerms está bien, el `effectiveGroup` debe coincidir con tu rango (por ejemplo `OP` si eres operador).

### 3.2 Verificar resolución de grupo (OP vs Guest)

1. Ejecuta (PurePerms):

```text
/usrinfo TuNombre
```

2. Esperado:
   - `Group:` debe ser el grupo efectivo (ej. `OP`).
   - Si dice `Guest` pero eres OP, revisa “Notas OP” en troubleshooting.

### 3.3 Verificar intercept del chat

1. Escribe “hola” en chat.
2. Esperado:
   - El mensaje sale con el formato del grupo (y no el chat vanilla).

### 3.4 Probar prefix/suffix por jugador

1. Prefix VIP:

```text
/pchat setprefix TuNombre &6[VIP]BLANK
```

2. Escribe en chat.
3. Esperado:
   - Aparece `[VIP]` antes del rango del grupo (si tu template lo pone así).

4. Limpiar prefix:

```text
/pchat setprefix TuNombre BLANK
```

### 3.5 Probar color gating del mensaje

1. Sin permiso `pchat.coloredMessages`, escribe:
   - `&cHola`
2. Esperado:
   - El `&c` se elimina (sale “Hola” sin color).

3. Con permiso `pchat.coloredMessages`, repite:
   - Debe conservar el color.

### 3.6 Probar overrides por mundo (opcional)

1. Habilita override por mundo (ver sección 6).
2. Setea un formato distinto para un mundo (ej. `overworld`).
3. Cambia de mundo/dimensión y verifica que el template cambia.

## 4. Comandos

Usa los comandos de PureChat con esta base:

- `/pchat <subcommand> ...`

Nota de compatibilidad:

- En algunos runtimes también funciona la variante namespaced: `/pchat <subcommand> ...`
- Los atajos legacy (`/setprefix`, etc.) no están garantizados en todos los runtimes.

### Subcomandos del root

- `setprefix <player> <prefix>`
- `setsuffix <player> <suffix>`
- `setformat <group> <world|global> <format>`
- `setnametag <group> <world|global> <format>`
- `preview`

Tip: usa `BLANK` (sin llaves) en prefix/suffix para representar un espacio.
Nota: algunos parsers de comandos rechazan `{` `}`; por compatibilidad PureChat acepta `BLANK` y también `{BLANK}` si tu runtime lo permite.

### 4.1 Ejemplos copiables

- Cambiar formato global de `Guest`:

```text
/pchat setformat Guest global &e[Guest]{BLANK}&f{display_name}{BLANK}&7>{BLANK}{msg}
```

- Cambiar nametag global de `OP`:

```text
/pchat setnametag OP global &9[OP]{BLANK}&f{display_name}
```

- Usar comando moderno:

```text
/pchat setprefix TuNombre &6[VIP]BLANK
```

## 5. Permisos

- `pchat`
- `pchat.coloredMessages`
- `pchat.command`
- `pchat.command.setprefix`
- `pchat.command.setsuffix`
- `pchat.command.setnametag`
- `pchat.command.setformat`

### 5.1 Cómo asignar permisos con PurePerms (recomendado)

PurePerms administra los nodos. Ejemplos:

- Dar permisos de administración de PureChat a `OP`:

```text
/setgperm OP pchat.command.setprefix
/setgperm OP pchat.command.setsuffix
/setgperm OP pchat.command.setformat
/setgperm OP pchat.command.setnametag
```

- Permitir colores a un grupo (ej. `Guest`):

```text
/setgperm Guest pchat.coloredMessages
```

Nota: si el grupo `OP` tiene `*`, no necesitas añadir nodos individuales.

## 6. Modelo de datos y configuración

PureChat guarda estado en `plugin:PureChat` con esta estructura lógica:

- `enableMultiworldChat` (`boolean`)
- `groups.<Group>.chat` (`string`)
- `groups.<Group>.nametag` (`string`)
- `groups.<Group>.worlds.<world>.chat` (`string`, override opcional)
- `groups.<Group>.worlds.<world>.nametag` (`string`, override opcional)
- `players.<Player>.prefix` (`string`)
- `players.<Player>.suffix` (`string`)

Se inicializan defaults para:

- `Guest`
- `Admin`
- `Owner`
- `OP`

### 6.1 Propiedades clave (qué hacen)

- `enableMultiworldChat`:
  - `false`: siempre usa `groups.<Group>.chat/nametag`.
  - `true`: si existe override para el mundo actual, usa `groups.<Group>.worlds.<world>.*`.

- `groups.<Group>.chat`:
  - template del chat para ese grupo.

- `groups.<Group>.nametag`:
  - template del nametag para ese grupo.

- `players.<Player>.prefix` / `players.<Player>.suffix`:
  - extras por jugador (VIP, tags especiales, etc.).

### 6.2 Nota importante sobre `{display_name}` vs `{nametag}`

- `{display_name}` es **solo el nombre del jugador** (sin formato). Se usa para evitar duplicar rangos.
- `{nametag}` es el nametag actual del jugador (puede contener formato).

## 7. Placeholders

Placeholders soportados:

- `{display_name}`
- `{nametag}`
- `{msg}`
- `{prefix}`
- `{suffix}`
- `{world}`
- `{fac_name}` (adapter opcional)
- `{fac_rank}` (adapter opcional)

Si no hay datos de facción disponibles, `{fac_name}` y `{fac_rank}` se resuelven a vacío.

### 7.1 Tokens externos de PlaceholderAPI (`%...%`)

PureChat también soporta tokens de PlaceholderAPI después de resolver los placeholders internos.

Orden de resolución:

1. Placeholders internos de PureChat (`{msg}`, `{display_name}`, etc.).
2. Tokens de PlaceholderAPI (`%player_name%`, `%time_current%`, etc.).

Ejemplo:

```text
/pchat setformat OP global "[%time_current%] %player_name% (%online_players%) > {msg}"
```

## 8. Códigos de color

PureChat soporta `&` codes en templates y mensaje de usuario:

- Colores: `&0`..`&f`
- Estilos: `&k`, `&l`, `&m`, `&n`, `&o`, `&r`

El color en contenido de mensaje se mantiene solo con permiso `pchat.coloredMessages`.

## 9. Comportamiento por lifecycle

- `onEnable`: crea servicio, suscribe hooks de chat/spawn, registra migración.
- `onStartup(event)`: registra comandos root + legacy.
- `onWorldReady`: corre migración, inicializa estado, marca plugin listo.
- `onDisable`: desuscribe hooks y limpia estado runtime.

## 10. Troubleshooting

### El chat no se formatea

- Verifica permiso `pchat`.
- Verifica que el plugin llegó a `onWorldReady`.
- Verifica template del grupo efectivo.

### Se eliminan colores del mensaje

- El jugador no tiene `pchat.coloredMessages`.

### setformat/setnametag no parece aplicar

- Verifica que el grupo exista en PurePerms.
- Verifica si aplicaste override por mundo o global.

### Soy OP pero me sale Guest

Posibles causas:

- No eres OP “nativo” en este mundo (Bedrock no te dio permiso de comandos).
- PurePerms aún no te sincronizó a grupo `OP` (se hace en `playerSpawn`).
- Tu usuario no está asignado a `OP` en PurePerms.

Qué hacer:

1. Ejecuta:

```text
/usrinfo TuNombre
```

2. Si sigue en `Guest`, fuerza asignación:

```text
/setgroup TuNombre OP
```

3. Re-ejecuta `/pchat preview`.

## 11. FAQ

### ¿Por qué soportar root y legacy a la vez?

Para compatibilidad con flujos antiguos y adopción gradual del modelo moderno.

### ¿La integración de facciones es obligatoria?

No. Es opcional y tiene fallback seguro.

### ¿Dónde deben configurarse colores de rangos?

En templates de PureChat, no en nombres de grupo de PurePerms.
