# PMMPCore

Idioma: [English](readme.md) | **Español**

<div align="center">

![PMMPCore Logo](images/PMMPCore.png)

**Framework modular para Minecraft Bedrock Edition (Behavior Packs)**

[![Estado](https://img.shields.io/badge/Status-Prototipo%20%2F%20API%20p%C3%BAblica%20en%20progreso-orange)](#estado)
[![Licencia](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/en-us/download/bedrock-edition)

[Inicio rápido](#inicio-r%C3%A1pido) · [Documentación](#documentaci%C3%B3n) · [Plugins](#plugins-incluidos) · [Contribuir](#contribuir)

</div>

---

## ¿Qué es PMMPCore?

PMMPCore es un framework modular para proyectos con Bedrock Script API, inspirado en el ecosistema de plugins estilo PocketMine.

Incluye:

- **Ciclo de vida predecible** (`onLoad`, `onEnable`, `onStartup`, `onWorldReady`, `onDisable`)
- **Persistencia centralizada** basada en **Dynamic Properties** del mundo (`DatabaseManager`, `PMMPDataProvider`, `RelationalEngine` opcional)
- **Capa de servicios** (eventos, comandos, scheduler, permisos, migraciones)
- **Diagnóstico/observabilidad** para operar y depurar

PMMPCore se distribuye como Behavior Pack (no como mod de servidor dedicado) y respeta las limitaciones de la Script API.

---

## Estado

- **Estado del proyecto**: prototipo funcional con API pública en expansión
- **Objetivo**: core estable para que terceros puedan crear plugins dentro del ecosistema del repo

---

## Inicio rápido

### Requisitos

- Minecraft Bedrock (Preview) con Script API habilitada (este repo ya está bajo una ruta `development_behavior_packs/`).

### Instalar / habilitar

1. Copia (o mantén) esta carpeta como Behavior Pack en:
   - `com.mojang/development_behavior_packs/creator_customdi`
2. En Minecraft, habilita el pack en tu mundo.
3. Entra al mundo y ejecuta:

```text
/pmmpcore:info
```

### Verificar que todo funciona

Ejecuta:

```text
/pmmpcore:diag
/pmmpcore:selftest
```

- `pmmpcore:diag`: servicios, eventos, tareas del scheduler, métricas de tick/flush
- `pmmpcore:selftest`: prueba rápida de KV + capa relacional y muestra el resultado

---

## Plugins incluidos

PMMPCore es framework + un set de plugins core en `scripts/plugins/`.

Actualmente:

- **MultiWorld**: mundos personalizados por dimensiones con comandos y persistencia
- **PurePerms**: permisos y grupos, con contrato estable hacia el core
- **ExamplePlugin**: plugin de referencia con patrones y hooks de MultiWorld

La documentación por plugin vive en `docs/plugins/`.

---

## Documentación

Empieza por:

- **Índice de docs**: `docs/README.es.md`

Referencias del core:

- **API pública (servicios, ciclo de vida, estabilidad)**: `docs/API_PUBLIC_GUIDE.es.md`
- **Base de datos (KV, WAL, DataProvider, RelationalEngine + SQL)**: `docs/DATABASE_GUIDE.es.md`
- **Arquitectura y pipeline de arranque**: `docs/PROJECT_DOCUMENTATION.es.md`

Para autores de plugins:

- **Guía de desarrollo de plugins**: `docs/PLUGIN_DEVELOPMENT_GUIDE.es.md`
- **Guía de migración (legacy → API v1)**: `docs/PLUGIN_MIGRATION_GUIDE.es.md`

---

## Estructura del repo (alto nivel)

```text
scripts/
  main.js                  # pipeline de arranque (seguro post-worldLoad) + diagnósticos
  PMMPCore.js               # facade core + service registry
  DatabaseManager.js        # persistencia: cache + dirty buffer + flush + WAL
  api/                      # export surface pública para plugins de terceros
  core/                     # eventos, scheduler, permisos, observabilidad, etc.
  db/                       # motor relacional, codecs, migraciones, WAL
  plugins/
    MultiWorld/
    PurePerms/
    ExamplePlugin/
docs/
  README.es.md              # índice
  DATABASE_GUIDE.es.md
  API_PUBLIC_GUIDE.es.md
  PROJECT_DOCUMENTATION.es.md
  plugins/                  # manuales de plugins (uso + configuración)
```

---

## Contribuir

- Mantén compatibilidad con la Bedrock Script API usada por el repo.
- Prioriza cambios **retrocompatibles** para APIs `stable`.
- Documenta cambios en `docs/` (y añade versión `.es.md` cuando aplique).
- Evita usar `world.getDynamicProperty` / `world.setDynamicProperty` directamente para datos de PMMPCore; usa `PMMPCore.db`.

