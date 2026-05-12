# Placeholders de PurePerms

Esta documentación describe los placeholders proporcionados por PurePerms a través de PlaceholderAPI.

## Requisitos

- PMMPCore Framework
- PurePerms Plugin
- PlaceholderAPI Plugin (soft dependency)

## Placeholders Disponibles

### Información de Rango

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `%pureperms_rank%` | Rango principal del jugador | `Admin` |
| `%pureperms_group%` | Grupo principal (alias de rank) | `Admin` |
| `%pureperms_primary_group%` | Grupo principal (alias) | `Admin` |

### Múltiples Grupos

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `%pureperms_groups%` | Todos los grupos del jugador | `Admin, VIP, Member` |

### Formato y Estilo

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `%pureperms_prefix%` | Prefijo del rango | `&c[Admin] ` |
| `%pureperms_suffix%` | Sufijo del rango | ` &r` |
| `%pureperms_rank_display%` | Rango con prefijo | `&c[Admin] Admin` |
| `%pureperms_full_display%` | Rango completo (prefijo + rango + sufijo) | `&c[Admin] Admin&r` |

## Uso en ScoreHud

```javascript
// En ScoreHud/config.js
lines: Object.freeze([
  "§6Rank: %pureperms_rank%",
  "§6Display: %pureperms_rank_display%",
  // ...
]),
```

## Uso en Chat

```javascript
// Ejemplo de uso en PureChat o sistema de chat
const displayName = papi?.parse("%pureperms_full_display% %player_name%", player);
// Resultado: "&c[Admin] Admin&r Steve"
```

## Integración Técnica

PurePerms registra automáticamente su expansión en PlaceholderAPI cuando ambos plugins están disponibles. Si PlaceholderAPI no está presente, PurePerms continuará funcionando normalmente pero sin proporcionar placeholders.

## Registro Automático

La expansión se registra automáticamente durante `onEnable()` de PurePerms:

```javascript
// Log esperado:
// [PurePerms] Registered PlaceholderAPI expansion with placeholders: %pureperms_rank%, %pureperms_prefix%, %pureperms_suffix%, %pureperms_group%, %pureperms_groups%
```

## Manejo de Errores

- Si PlaceholderAPI no está disponible, se registra un mensaje informativo
- Si hay errores al acceder a datos de permisos, se devuelve "Default" como fallback
- Todos los errores se registran en la consola para debugging

## Compatibilidad con ScoreHubX

Esta implementación reemplaza a los placeholders del ScoreHubX original:

| ScoreHubX Original | Nuevo Placeholder | Compatibilidad |
|-------------------|-------------------|----------------|
| `{ppscore.rank}` | `%pureperms_rank%` | ✅ Reemplazo directo |
| `{ppscore.prefix}` | `%pureperms_prefix%` | ✅ Reemplazo directo |
| `{ppscore.suffix}` | `%pureperms_suffix%` | ✅ Reemplazo directo |

La nueva implementación usa la sintaxis estándar de PlaceholderAPI (`%identifier_key%`) en lugar de la sintaxis personalizada del ScoreHubX (`{tag}`).

## Servicios Utilizados

La expansión utiliza directamente el servicio de PurePerms para obtener información:

- `purePermsService.getPlayerRank(playerName)`
- `purePermsService.getRankPrefix(rank)`
- `purePermsService.getRankSuffix(rank)`
- `purePermsService.getPlayerGroups(playerName)`
- `purePermsService.getPrimaryGroup(playerName)`
