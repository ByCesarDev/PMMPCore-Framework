# PMMPCore

<div align="center">

![PMMPCore Logo](https://img.shields.io/badge/PMMPCore-Framework-blue?style=for-the-badge&logo=minecraft)

**Framework modular para Minecraft Bedrock Edition**

[![Status](https://img.shields.io/badge/Status-Prototype%20Phase-orange)](#estado-actual)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/es-es/download/bedrock-edition)

[Documentación](#documentacion) · [Roadmap](#roadmap-integrado) · [Contribuir](#contribucion)

</div>

---

## Overview

PMMPCore es un framework que traslada el enfoque modular tipo PocketMine al ecosistema de Bedrock, con una arquitectura orientada a plugins, persistencia centralizada y comandos tipados.

Está diseñado para crear servidores/addons complejos de forma mantenible, incluso bajo las limitaciones de la Script API de Bedrock.

## ¿Por qué PMMPCore?

### El problema

Minecraft Bedrock tiene restricciones importantes para construir sistemas modulares grandes:

- no hay carga dinámica real de plugins;
- no existe acceso libre a sistema de archivos en runtime;
- muchos addons terminan acoplados y difíciles de mantener.

### La solución

PMMPCore implementa una base de framework que:

- simula un ecosistema de plugins mediante carga estática controlada;
- centraliza estado y persistencia con `DatabaseManager` + Dynamic Properties;
- estandariza el ciclo de vida (`onEnable`, `onStartup`, `onDisable`);
- unifica la capa de comandos usando `customCommandRegistry`.

## Características principales

### Core system

- Registro de plugins y validación de dependencias.
- Base de datos compartida para todo el ecosistema.
- Pipeline de startup único y predecible.
- API común para plugins (`PMMPCore` + `PMMPCore.db`).

### Plugin architecture

- Plugins desacoplados en `scripts/plugins/<PluginName>/`.
- Carga central desde `scripts/plugins.js`.
- Dependencias obligatorias y opcionales (`depend`, `softdepend`).
- Contrato de lifecycle consistente.

### Developer experience

- Comandos core de diagnóstico (`plugins`, `pl`, `info`, `pmmphelp`).
- Guías detalladas para crear plugins y operar módulos.
- Documentación técnica versionable dentro del repo.

## Estado actual

- Fase actual: **prototipo funcional en evolución**.
- Core estable para uso interno y pruebas activas.
- Plugins activos en este repo:
  - `MultiWorld`
  - `EconomyAPI` (en documentación pendiente)
  - `PurePerms` (en documentación pendiente)

## Arquitectura técnica (resumen)

```text
scripts/main.js
  -> PMMPCore.initialize(DatabaseManager)
  -> PMMPCore.enableAll()
  -> plugin.onStartup(event) por plugin
```

```text
scripts/
  main.js
  PMMPCore.js
  DatabaseManager.js
  plugins.js
  plugins/
    MultiWorld/
    EconomyAPI/
    PurePerms/
```

## Roadmap integrado

### Fase 1 - Base estable del framework

- [x] Núcleo PMMPCore funcional.
- [x] Registro y habilitación centralizada de plugins.
- [x] Persistencia base con `DatabaseManager`.
- [x] Comandos base del core.
- [~] Endurecimiento de validaciones y manejo de errores.

### Fase 2 - MultiWorld robusto

- [x] CRUD base de mundos (`create`, `tp`, `list`, `info`, `delete`).
- [x] Tipos: `normal`, `flat`, `void`, `skyblock`.
- [x] Limpieza batch y recuperación (`purgechunks`).
- [x] Mundo principal configurable (`setmain`, `main`).
- [~] Optimización de generación en `normal`.
- [ ] Perfilado formal por carga de jugadores.

### Fase 3 - Plataforma de plugins

- [x] Contrato base para creación de plugins.
- [x] Guía de desarrollo de plugins.
- [ ] Scaffolding automático para nuevos plugins.
- [ ] Suite de testing/regresión de plugins.

### Fase 4 - Release del ecosistema

- [ ] Congelar API pública del core.
- [ ] Publicar `v1.0.0`.
- [ ] Documentación operativa para despliegue.
- [ ] Paquetes de plugins por tipo de servidor.

## Documentación

- Guía general del proyecto: `docs/PROJECT_DOCUMENTATION.md`
- Guía para crear plugins: `docs/PLUGIN_DEVELOPMENT_GUIDE.md`
- Documentación de MultiWorld: `docs/MULTIWORLD_DOCUMENTATION.md`
- Índice de docs: `docs/README.md`

> Nota: la documentación detallada de `EconomyAPI` y `PurePerms` se publicará cuando esas APIs estén estabilizadas.

## Contribución

Si contribuyes al proyecto:

- mantén compatibilidad con la Bedrock Script API usada por el repo;
- evita romper contratos existentes del core y plugins;
- documenta cambios funcionales relevantes en `docs/`;
- prioriza cambios incrementales y verificables.

---

<div align="center">

**Built with passion for the Minecraft Bedrock community**

</div>
