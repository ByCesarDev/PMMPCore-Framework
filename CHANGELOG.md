# Changelog: PMMPCore Framework (v1.1.0-stable ➔ v1.1.5)

## Cambios Principales

### 1. InterAddonBridge y Protocolo IPC
- **Protocolo Estabilizado (`protocolVersion: 1`)**: Se formalizó la primera versión del protocolo de comunicación inter-addon (IPC) entre el Core y los plugins independientes.
- **Canales de Respuesta Silenciosos**: Se ajustó el motor del cliente SDK para procesar de forma silenciosa e interna los canales de respuesta salientes (`handshake_ack`, `db_response`, `sql_response`, `perm_response`, `bus_event`). Esto elimina el spam de advertencias por "canales desconocidos" en la consola de Minecraft Bedrock que ocurría en los Addons suscritos al puente.
- **Retransmisión Global (EventBus)**: `PMMPCore` ahora es capaz de enrutar eventos cruzados entre Addons (ej. `pureperms.data_changed` disparado por PurePerms y recibido por ScoreHud/PureChat en 0ms).

### 2. Motor Dual de Permisos (PurePermsPermissionService)
- **Resolución Autoritativa de Operador**: Se implementó un parche síncrono para verificar nativamente el nivel de operador en Bedrock (`commandPermissionLevel >= 1`), fusionándolo autoritativamente con los permisos lógicos del servidor en memoria.

### 3. Sistema de Archivos y Documentación
- **Desacoplamiento Total**: La carpeta `docs/plugins/` fue removida del repositorio de PMMPCore. Ahora la arquitectura obliga a cada plugin a distribuir sus propios manuales (`README.md`, `LICENSE.md`, `docs/`) de forma 100% aislada.
- **Promoción de API**: El core se promovió oficialmente a la versión `"1.1.5"`. Todos los saludos de inicialización del `InterAddonBridge` ahora validarán esta versión.
