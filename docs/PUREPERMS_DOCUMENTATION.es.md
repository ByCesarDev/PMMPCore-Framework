# PMMPCore - Manual de Usuario PurePerms

Idioma: [English](PUREPERMS_DOCUMENTATION.md) | **Español**

## 1. Para qué sirve PurePerms

PurePerms es el administrador de rangos y permisos de PMMPCore.

Se usa para:

- crear rangos (grupos) como `Guest`, `Mod`, `Admin`, `OP`;
- asignar jugadores a rangos;
- permitir o negar nodos de permiso por grupo y por usuario;
- construir herencia entre rangos;
- inspeccionar y depurar permisos activos.

## 2. Cómo funcionan los permisos (modelo simple)

Cada jugador puede recibir permisos desde varias capas:

1. **Permisos del grupo** del jugador.
2. **Permisos heredados** de grupos padre.
3. **Permisos directos de usuario**.
4. **Permisos por mundo** cuando se usan.

Reglas importantes:

- `node.name` = permitido.
- `-node.name` = denegado.
- `*` = wildcard (todos los nodos).
- Si existe permitido y denegado del mismo nodo, prevalece denegado.

## 3. Grupos por defecto

PurePerms asegura automáticamente estos grupos:

- `Guest` (grupo por defecto)
- `Mod` (hereda `Guest`)
- `Admin` (hereda `Mod`)
- `OP` (hereda `Admin`, incluye wildcard)

Si faltan en la data guardada, se recrean al iniciar/recargar/leer grupos.

## 4. Primeros comandos recomendados

Ejecuta este bloque al iniciar:

1. `/ppreload`
2. `/groups`
3. `/grpinfo Guest`
4. `/grpinfo OP`

Con eso confirmas que el plugin está cargado y la base está correcta.

## 5. Referencia completa de comandos

Todos se registran como `pmmpcore:<command>`, pero en chat normalmente puedes usarlos sin namespace.

### 5.1 `/ppinfo`

- **Qué hace:** muestra estado general del plugin.
- **Permiso:** `pperms.command.ppinfo`
- **Sintaxis:** `/ppinfo`
- **Muestra:** cantidad de grupos/usuarios y flags principales.

### 5.2 `/ppreload`

- **Qué hace:** recarga configuración runtime y corrige estructuras base.
- **Permiso:** `pperms.command.ppreload`
- **Sintaxis:** `/ppreload`
- **Cuándo usarlo:** después de cambios en `config.js`.

### 5.3 `/groups`

- **Qué hace:** lista todos los grupos existentes.
- **Permiso:** `pperms.command.groups`
- **Sintaxis:** `/groups`

### 5.4 `/addgroup <group>`

- **Qué hace:** crea un grupo nuevo.
- **Permiso:** `pperms.command.addgroup`
- **Sintaxis:** `/addgroup Builder`

### 5.5 `/rmgroup <group>`

- **Qué hace:** elimina un grupo.
- **Permiso:** `pperms.command.rmgroup`
- **Sintaxis:** `/rmgroup Builder`
- **Notas:**
  - no puedes borrar el grupo default;
  - rangos superadmin protegidos no se eliminan.

### 5.6 `/grpinfo <group> [world]`

- **Qué hace:** muestra información de un grupo.
- **Permiso:** `pperms.command.grpinfo`
- **Sintaxis:** `/grpinfo Admin`
- **Opcional:** `[world]` para ver capa de ese mundo.

### 5.7 `/addparent <target_group> <parent_group>`

- **Qué hace:** agrega herencia entre grupos.
- **Permiso:** `pperms.command.addparent`
- **Sintaxis:** `/addparent Admin Mod`
- **Resultado:** `Admin` hereda permisos de `Mod`.
- **Seguridad:** bloquea ciclos automáticamente.

### 5.8 `/rmparent <target_group> <parent_group>`

- **Qué hace:** quita herencia entre grupos.
- **Permiso:** `pperms.command.rmparent`
- **Sintaxis:** `/rmparent Admin Mod`

### 5.9 `/defgroup <group> [world]`

- **Qué hace:** define grupo por defecto global o por mundo.
- **Permiso:** `pperms.command.defgroup`
- **Sintaxis:** `/defgroup Guest`

### 5.10 `/listgperms <group> <page> [world]`

- **Qué hace:** lista permisos efectivos del grupo.
- **Permiso:** `pperms.command.listgperms`
- **Sintaxis:** `/listgperms OP 1`
- **Paginación:** usar 1, 2, 3...

### 5.11 `/setgperm <group> <permission> [world]`

- **Qué hace:** permite un nodo al grupo.
- **Permiso:** `pperms.command.setgperm`
- **Ejemplos:**
  - `/setgperm Mod pperms.command.ppinfo`
  - `/setgperm OP *`

### 5.12 `/unsetgperm <group> <permission> [world]`

- **Qué hace:** deniega un nodo al grupo.
- **Permiso:** `pperms.command.unsetgperm`
- **Sintaxis:** `/unsetgperm Mod pperms.command.ppinfo`
- **Resultado interno:** se guarda como `-pperms.command.ppinfo`.

### 5.13 `/usrinfo <player> [world]`

- **Qué hace:** muestra perfil de permisos de usuario.
- **Permiso:** `pperms.command.usrinfo`
- **Sintaxis:** `/usrinfo ByCesarKun`
- **Campo clave:** `Direct permissions`
  - solo cuenta permisos dados directo al usuario.
  - no cuenta permisos heredados por grupo.

### 5.14 `/setgroup <player> <group> [world]`

- **Qué hace:** asigna grupo a un jugador.
- **Permiso:** `pperms.command.setgroup`
- **Sintaxis:** `/setgroup ByCesarKun OP`
- **Rangos superadmin:**
  - pueden ser protegidos por `superadminRanks`;
  - OP nativo puede asignar `OP` según la lógica actual.

### 5.15 `/setuperm <player> <permission> [world]`

- **Qué hace:** agrega permiso directo a usuario.
- **Permiso:** `pperms.command.setuperm`
- **Sintaxis:** `/setuperm ByCesarKun pperms.command.fperms`

### 5.16 `/unsetuperm <player> <permission> [world]`

- **Qué hace:** deniega permiso directo a usuario.
- **Permiso:** `pperms.command.unsetuperm`
- **Sintaxis:** `/unsetuperm ByCesarKun pperms.command.fperms`

### 5.17 `/listuperms <player> <page> [world]`

- **Qué hace:** lista permisos efectivos de un usuario.
- **Permiso:** `pperms.command.listuperms`
- **Sintaxis:** `/listuperms ByCesarKun 1`

### 5.18 `/fperms <prefix>`

- **Qué hace:** busca nodos por prefijo.
- **Permiso:** `pperms.command.fperms`
- **Sintaxis:** `/fperms pperms.command`

### 5.19 `/ppsudo <login|register> <password>`

- **Qué hace:** gestiona cuenta Noeul.
- **Permiso:** `pperms.command.ppsudo`
- **Ejemplos:**
  - `/ppsudo register 123456`
  - `/ppsudo login 123456`

## 6. Flujos comunes de administración

### Crear un rango de moderación

1. `/addgroup Helper`
2. `/addparent Helper Guest`
3. `/setgperm Helper pperms.command.ppinfo`
4. `/setgperm Helper pperms.command.groups`
5. `/setgroup SomePlayer Helper`

### Dar acceso total al grupo OP

1. `/setgperm OP *`
2. `/listgperms OP 1`

### Depurar "no tengo permisos"

1. `/usrinfo <player>`
2. `/grpinfo <group_del_usuario>`
3. `/listgperms <group> 1`
4. `/listuperms <player> 1`

Verifica:

- grupo correcto;
- nodo presente en grupo/usuario;
- existencia de denegaciones `-node`.

## 7. Integración con OP nativo

Comportamiento actual:

- si `disableOp: false`, OP nativo bypass de `hasPermission`;
- en spawn, OP nativo se sincroniza al grupo `OP` si hace falta.

Esto ayuda a mantener alineado OP vanilla con el sistema de rangos.

## 8. Guía de configuración (`config.js`)

Claves principales:

- `disableOp`
  - `false`: bypass OP activo.
  - `true`: bypass OP desactivado.
- `enableMultiworldPerms`
  - `true`: evalúa capa por mundo.
- `superadminRanks`
  - define rangos con control especial de asignación.

## 9. Checklist rápido de verificación

Después de instalar o cambiar config:

1. `/ppreload`
2. `/groups`
3. `/grpinfo OP`
4. `/setgroup <player> OP`
5. `/usrinfo <player>`
6. `/ppinfo`

Si todo responde correctamente, tu setup está listo.
