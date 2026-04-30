# PMMPCore - Documentación de PureChat

Idioma: [English](PURECHAT_DOCUMENTATION.md) | **Español**

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
   - `/pmmpcore:pchat preview`
   - `/pmmpcore:setprefix <player> <prefix>`

## 3. Comandos

PureChat soporta **ambos** estilos:

- Comando raíz moderno: `/pmmpcore:pchat <subcommand> ...`
- Comandos legacy:
  - `/pmmpcore:setprefix <player> <prefix>`
  - `/pmmpcore:setsuffix <player> <suffix>`
  - `/pmmpcore:setnametag <group> <world|global> <format>`
  - `/pmmpcore:setformat <group> <world|global> <format>`

### Subcomandos del root

- `setprefix <player> <prefix>`
- `setsuffix <player> <suffix>`
- `setformat <group> <world|global> <format>`
- `setnametag <group> <world|global> <format>`
- `preview`

Tip: usa `BLANK` (sin llaves) en prefix/suffix para representar un espacio.
Nota: algunos parsers de comandos rechazan `{` `}`; por compatibilidad PureChat acepta `BLANK` y también `{BLANK}` si tu runtime lo permite.

## 4. Nodos de permiso

- `pchat`
- `pchat.coloredMessages`
- `pchat.command`
- `pchat.command.setprefix`
- `pchat.command.setsuffix`
- `pchat.command.setnametag`
- `pchat.command.setformat`

## 5. Modelo de configuración

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

## 6. Placeholders

Placeholders soportados:

- `{display_name}`
- `{msg}`
- `{prefix}`
- `{suffix}`
- `{world}`
- `{fac_name}` (adapter opcional)
- `{fac_rank}` (adapter opcional)

Si no hay datos de facción disponibles, `{fac_name}` y `{fac_rank}` se resuelven a vacío.

## 7. Códigos de color

PureChat soporta `&` codes en templates y mensaje de usuario:

- Colores: `&0`..`&f`
- Estilos: `&k`, `&l`, `&m`, `&n`, `&o`, `&r`

El color en contenido de mensaje se mantiene solo con permiso `pchat.coloredMessages`.

## 8. Comportamiento por lifecycle

- `onEnable`: crea servicio, suscribe hooks de chat/spawn, registra migración.
- `onStartup(event)`: registra comandos root + legacy.
- `onWorldReady`: corre migración, inicializa estado, marca plugin listo.
- `onDisable`: desuscribe hooks y limpia estado runtime.

## 9. Troubleshooting

### El chat no se formatea

- Verifica permiso `pchat`.
- Verifica que el plugin llegó a `onWorldReady`.
- Verifica template del grupo efectivo.

### Se eliminan colores del mensaje

- El jugador no tiene `pchat.coloredMessages`.

### setformat/setnametag no parece aplicar

- Verifica que el grupo exista en PurePerms.
- Verifica si aplicaste override por mundo o global.

## 10. FAQ

### ¿Por qué soportar root y legacy a la vez?

Para compatibilidad con flujos antiguos y adopción gradual del modelo moderno.

### ¿La integración de facciones es obligatoria?

No. Es opcional y tiene fallback seguro.

### ¿Dónde deben configurarse colores de rangos?

En templates de PureChat, no en nombres de grupo de PurePerms.
