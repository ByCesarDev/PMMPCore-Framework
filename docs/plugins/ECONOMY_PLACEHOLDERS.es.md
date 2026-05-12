# Placeholders de EconomyAPI

Esta documentación describe los placeholders proporcionados por EconomyAPI a través de PlaceholderAPI.

## Requisitos

- PMMPCore Framework
- EconomyAPI Plugin
- PlaceholderAPI Plugin (soft dependency)

## Placeholders Disponibles

### Dinero y Finanzas

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `%economy_money%` | Balance principal del jugador | `1500.50` |
| `%economy_wallet%` | Dinero en billetera (alias de money) | `1500.50` |
| `%economy_bank%` | Dinero en banco | `5000.00` |
| `%economy_debt%` | Deuda del jugador | `0.00` |

### Formateo

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `%economy_formatted%` | Balance con símbolo de dólar | `$1500.50` |
| `%economy_formatted_commas%` | Balance con separadores de miles | `$1,500.50` |

## Uso en ScoreHud

```javascript
// En ScoreHud/config.js
lines: Object.freeze([
  "§eMoney: %economy_money%",
  "§6Bank: %economy_bank%",
  // ...
]),
```

## Uso en Otros Plugins

```javascript
// Acceder al runtime de PlaceholderAPI
const placeholderPlugin = PMMPCore.getPlugin("PlaceholderAPI");
const papi = placeholderPlugin?.runtime ?? null;

// Parsear texto con placeholders de economía
const text = papi?.parse("Tu balance: %economy_money%", player);
```

## Integración Técnica

EconomyAPI registra automáticamente su expansión en PlaceholderAPI cuando ambos plugins están disponibles. Si PlaceholderAPI no está presente, EconomyAPI continuará funcionando normalmente pero sin proporcionar placeholders.

## Registro Automático

La expansión se registra automáticamente durante `onEnable()` de EconomyAPI:

```javascript
// Log esperado:
// [EconomyAPI] Registered PlaceholderAPI expansion with placeholders: %economy_money%, %economy_wallet%, %economy_bank%, %economy_debt%, %economy_formatted%
```

## Manejo de Errores

- Si PlaceholderAPI no está disponible, se registrará un mensaje informativo
- Si hay errores al acceder a datos económicos, se devuelve "0" como fallback
- Todos los errores se registran en la consola para debugging
