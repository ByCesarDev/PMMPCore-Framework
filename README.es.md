# PMMPCore

Idioma: [English](README.md) | **EspaÃ±ol**

<div align="center">

![PMMPCore Logo](images/PMMPCore.png)

**Framework modular para Minecraft Bedrock Edition (Behavior Packs)**

[![Estado](https://img.shields.io/badge/Status-Estable%20v1.1.5-brightgreen)](#estado)
[![Licencia](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock%20Edition-green)](https://www.minecraft.net/en-us/download/bedrock-edition)

[Inicio rÃ¡pido](#inicio-rÃ¡pido) Â· [DocumentaciÃ³n](#documentaciÃ³n) Â· [Ecosistema](#ecosistema-de-addons-independientes) Â· [Contribuir](#contribuir)

</div>

## Tabla de Contenidos

1. [Â¿QuÃ© es PMMPCore?](#quÃ©-es-pmmpcore)
2. [Estado](#estado)
3. [Inicio rÃ¡pido](#inicio-rÃ¡pido)
4. [Ecosistema de Addons Independientes](#ecosistema-de-addons-independientes)
5. [DocumentaciÃ³n](#documentaciÃ³n)
6. [Estructura del repo (alto nivel)](#estructura-del-repo-alto-nivel)
7. [Contribuir](#contribuir)
8. [FAQ](#faq)

---

## Â¿QuÃ© es PMMPCore?

PMMPCore es un poderoso framework modular para proyectos con Bedrock Script API, inspirado en el ecosistema de plugins estilo PocketMine. ActÃºa como el puente central de comunicaciÃ³n y base de datos para una familia entera de Addons.

Incluye:

- **Bus de ComunicaciÃ³n (InterAddonBridge v1)**: Interfaz de red sincrÃ³nica para que los Addons externos interactÃºen con el framework vÃ­a `scriptevent`.
- **Motor Dual de Permisos**: Sistema de permisos lÃ³gicos en memoria (`PurePermsPermissionService`) fuertemente enlazado con los comandos nativos de Operador (`commandPermissionLevel`).
- **Persistencia Centralizada (KV y SQL)**: Acceso seguro de lectura/escritura unificada para todos los Addons con motores relacionales, bÃºferes y Write-Ahead Logging (`DatabaseManager`).
- **Ciclo de Vida Predecible**: Carga de componentes bajo esquemas controlados.

PMMPCore se distribuye como **Behavior Pack** y funciona estrictamente respetando las limitaciones y estÃ¡ndares de la Sandbox de Bedrock Script API.

---

## Estado

- **Estado del proyecto**: Estable `v1.1.5`.
- **Objetivo**: Proveer un core central ultra-fluido (0ms de latencia en consultas a RAM) para que la suite oficial de Addons y terceros puedan construir mecÃ¡nicas avanzadas en Bedrock.

---

## Inicio rÃ¡pido

### Requisitos

- Minecraft Bedrock 1.26.40+ con **Beta APIs** habilitadas si deseas usar Addons como PureChat.

### Instalar / habilitar

1. Descarga el archivo `PMMPCore-Framework.mcpack`.
2. Importa el archivo a Minecraft Bedrock.
3. Activa el Behavior Pack en tu mundo.
4. Entra al mundo y ejecuta `/diag` para validar la integridad del nÃºcleo.

### VerificaciÃ³n

- `/diag`: Verifica los servicios, bus de eventos, tareas del scheduler y mÃ©tricas de memoria.
- `/selftest`: Prueba la lectura/escritura de la capa KV relacional y el protocolo IPC.

---

## Ecosistema de Addons Independientes

En versiones anteriores, los plugins venÃ­an incrustados dentro del repositorio del framework. A partir de **v1.1.5**, **TODOS los plugins son autÃ³nomos** y se distribuyen en sus propios repositorios / archivos `.mcpack`.

Para tener la experiencia completa, debes descargar los Addons que necesites y activarlos junto al PMMPCore:

- **MultiWorld**: Mundos y dimensiones dinÃ¡micas personalizadas.
- **PurePerms**: El motor maestro de rangos y permisos, emite jerarquÃ­as en RAM.
- **PureChat**: Chat en tiempo real, nametags y prefijos (requiere Beta APIs).
- **ScoreHud**: Scoreboard fluido a 100ms (2 ticks), integrando TPS, % CPU, dinero y rangos.
- **EconomyAPI**: Motor de transacciones y divisas virtuales.
- **PlaceholderAPI**: Extensibilidad de placeholders `%...%` para todos los Addons.
- **EssentialsTP**: Sistema TPA, homes y warps.
- **FormAPI**: ConstrucciÃ³n de GUIs complejas en Bedrock.

*(Nota: Cada uno de estos Addons contiene su propio manual tÃ©cnico `docs/` y su propia licencia dentro de su paquete).*

---

## DocumentaciÃ³n

Empieza por:

- **Ãndice de docs**: `docs/README.es.md`

Referencias del core:

- **API pÃºblica (servicios y puente IPC)**: `docs/API_PUBLIC_GUIDE.es.md`
- **Base de datos (KV, RelationalEngine + SQL)**: `docs/DATABASE_GUIDE.es.md`
- **GuÃ­a de Desarrollo de Addons V1 (Standalone)**: `docs/INTER_ADDON_DEVELOPMENT_GUIDE.es.md`

---

## Estructura del repo (alto nivel)

```text
scripts/
  main.js                  # Pipeline de inicializaciÃ³n segura
  PMMPCore.js              # Core y service registry
  client/                  # MÃ³dulos cliente SDK
  core/                    # Puente IPC (InterAddonBridge), eventos, permisos
  db/                      # RelationalEngine, Codecs, Storage
docs/
  README.es.md             # Ãndice central
  INTER_ADDON...es.md      # Protocolo de creaciÃ³n de addons
  ...
```

---

## Contribuir

- Prioriza siempre cambios **retrocompatibles** en la API pÃºblica.
- Utiliza el sistema de eventos `bus_event` del puente IPC para conectar mÃ³dulos desacoplados.

---

## FAQ

**P: Â¿DÃ³nde estÃ¡n las carpetas `scripts/plugins/`?**  
R: Se han eliminado. Desde la versiÃ³n v1.1.5 la arquitectura es 100% modular. Debes descargar los plugins oficiales por separado y activarlos como packs adicionales en tu mundo.

**P: Â¿Por quÃ© PureChat no muestra los prefijos en mi servidor?**  
R: Bedrock implementa la captura de chat nativo bajo los experimentos de script. Debes activar **Beta APIs** en la configuraciÃ³n de tu mundo y asegurarte de tener PurePerms cargado.

**P: Â¿QuÃ© ocurre si elimino el Behavior Pack del PMMPCore?**  
R: El resto de los Addons independientes detectarÃ¡n la caÃ­da del motor IPC y se deshabilitarÃ¡n con seguridad, pero los datos guardados en el mundo (KV) no se perderÃ¡n.

