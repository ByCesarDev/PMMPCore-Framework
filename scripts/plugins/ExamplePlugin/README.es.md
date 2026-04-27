# ExamplePlugin - Template para PMMPCore MultiWorld

Idioma: [English](README.md) | **Español**

## Descripción

Este es un template completo que demuestra cómo usar las APIs de MultiWorld para:

- **Registrar minerales personalizados** con scoping por mundo/tipo/dimensión
- **Crear hooks de generación** para estructuras personalizadas
- **Implementar comandos** para interactuar con el contenido
- **Manejar eventos** del juego
- **Validar contenido** por mundo

## Instalación

1. Copia la carpeta `ExamplePlugin` a `scripts/plugins/`
2. Agrega el import en `scripts/plugins.js`:

```javascript
import "./ExamplePlugin/main.js";
```

3. Reinicia Minecraft Bedrock con el behavior pack activado

## Minerales Personalizados

### Mithril Ore
- **Tipo**: `normal` worlds
- **Rango**: Y: -32 a 16
- **Frecuencia**: 2 vetillas por chunk, 4 bloques cada una
- **Bloque**: Esmeralda (placeholder)

### Crystal Ore  
- **Mundo**: `crystal_world` específico
- **Rango**: Y: -16 a 64
- **Frecuencia**: 1 vetilla por chunk, 3 bloques
- **Bloque**: Diamante (placeholder)

### Dimension Ore
- **Dimensión**: `pmmpcore:multiworld_10`
- **Rango**: Y: 0 a 50  
- **Frecuencia**: 3 vetillas por chunk, 5 bloques
- **Bloque**: Oro (placeholder)

## Estructuras Personalizadas

### Crystal Clusters
- **Tipo**: `normal` worlds
- **Probabilidad**: 5% por chunk
- **Contenido**: Clusters de cristales de 2-4 bloques de alto

### Crystal Pillars  
- **Tipo**: `normal` worlds
- **Probabilidad**: 2% por chunk
- **Contenido**: Pilares de cuarzo con glowstone en la cima

### Special Structures
- **Mundo**: `special_world`
- **Probabilidad**: 10% por chunk  
- **Contenido**: Plataformas 5x5 con centro elevado

## Comandos

### `/pmmpcore:exampleplugin_ores`
Lista todos los minerales personalizados registrados:
```
/pmmpcore:exampleplugin_ores
```

### `/pmmpcore:exampleplugin_hooks`
Lista todos los hooks de generación activos:
```
/pmmpcore:exampleplugin_hooks
```

### `/pmmpcore:exampleplugin_test`
Analiza el mundo actual y muestra contenido personalizado:
```
/pmmpcore:exampleplugin_test
```

## Testing

### Test de Minerales
```bash
# Crear mundo normal (debería tener minerales)
/pmmpcore:mw create test_normal normal

# Crear mundo flat (no debería tener minerales)  
/pmmpcore:mw create test_flat flat

# Crear mundo específico
/pmmpcore:mw create crystal_world normal

# Probar comandos
/pmmpcore:exampleplugin_test
/pmmpcore:exampleplugin_ores
```

### Test de Estructuras
```bash
# Teletransportar y explorar
/pmmpcore:mw tp test_normal
# Camina alrededor para generar chunks y buscar estructuras

# Verificar en mundo específico
/pmmpcore:mw tp crystal_world
/pmmpcore:exampleplugin_hooks
```

## Configuración

El plugin tiene configuración básica en `onEnable()`:

```javascript
this.config = {
  enabled: true,           // Plugin activado
  debugMode: false,        // Modo debug
  customOres: true,        // Generar minerales personalizados
  customStructures: true,  // Generar estructuras personalizadas
};
```

## Referencia de API

### Registro de Minerales
```javascript
WorldGenerator.registerOreRule({
  id: "my_ore",                    // ID único
  blockId: "minecraft:iron_ore",   // Bloque a generar
  minY: -32, maxY: 64,             // Rango vertical
  veinsPerChunk: 3,                // Vetillas por chunk
  veinSize: 5,                     // Bloques por vetilla
  replace: ["minecraft:stone"],    // Bloques a reemplazar
  seed: 123,                       // Seed para RNG
  scope: {                         // Scope opcional
    type: "worldType",             // "worldType" | "worldName" | "dimensionId"
    value: "normal"                // Valor correspondiente
  }
});
```

### Registro de Hooks
```javascript
WorldGenerator.registerGenerationHook({
  id: "my_hook",                   // ID único
  seed: 42,                        // Seed para RNG
  scope: {                         // Scope opcional
    type: "worldType", 
    value: "normal"
  },
  onChunkGenerated(ctx) {          // Función callback
    // ctx: { dimension, chunkX, chunkZ, worldName, dimensionId, 
    //        worldType, originX, originZ, random() }
    
    // Retornar array de tareas para ejecución asíncrona
    if (ctx.random() < 0.1) {
      return [
        () => placeBlock1(),
        () => placeBlock2()
      ];
    }
  }
});
```

## Ejemplos de Uso

### Mineral por Bioma (futuro)
```javascript
WorldGenerator.registerOreRule({
  id: "mountain_silver",
  blockId: "minecraft:silver_ore",
  minY: 80, maxY: 120,
  veinsPerChunk: 2,
  veinSize: 4,
  scope: { type: "biome", value: "mountains" }
});
```

### Estructuras Complejas
```javascript
WorldGenerator.registerGenerationHook({
  id: "dungeon_generator",
  seed: 777,
  scope: { type: "worldType", value: "normal" },
  onChunkGenerated(ctx) {
    if (ctx.random() < 0.02) { // 2% chance
      return this.generateDungeon(ctx);
    }
  },
  
  generateDungeon(ctx) {
    // Lógica compleja de generación
    return tasks; // Array de funciones
  }
});
```

## Debug

Para activar mensajes de debug:

```javascript
// En config.js de MultiWorld
MW_DEBUG = true;

// O en el plugin
this.config.debugMode = true;
```

## Notas

- Los bloques usan placeholders (esmeralda, diamante, etc.)
- Las estructuras son ejemplos simples para demostrar la API
- El plugin es completamente modular y extensible
- Compatible con el sistema de scoping de MultiWorld

## Contribuir

Este template es un punto de partida. Siéntete libre de:

- Agregar nuevos tipos de minerales
- Crear estructuras más complejas
- Implementar comandos adicionales
- Mejorar el manejo de eventos

---

**Creado para**: PMMPCore MultiWorld Framework  
**Versión**: 1.0.0  
**Autor**: Template Generator
