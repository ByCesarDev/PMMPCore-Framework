class PurePermsPermissionService {
  constructor(purePermsService = null) {
    this.backend = purePermsService;
  }

  setBackend(service) {
    this.backend = service;
  }

  isReady() {
    return !!this.backend;
  }

  has(playerName, node, worldName = null, playerActor = null) {
    if (!this.backend) return false;
    return !!this.backend.hasPermission(playerName, node, worldName, playerActor);
  }

  resolve(playerName, worldName = null) {
    if (!this.backend) return { allowed: new Set(), denied: new Set() };
    return this.backend.resolvePermissions(playerName, worldName);
  }

  getUserInfo(playerName, worldName = null) {
    if (!this.backend) return null;
    return this.backend.getUserInfo(playerName, worldName);
  }

  getGroupInfo(groupName, worldName = null) {
    if (!this.backend) return null;
    return this.backend.getGroupInfo(groupName, worldName);
  }

  setUserGroup(playerName, groupName, worldName = null, changedByConsole = false, actor = null) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setUserGroup(playerName, groupName, worldName, changedByConsole, actor);
  }

  setUserPermission(playerName, node, worldName = null, enabled = true) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setUserPermission(playerName, node, worldName, enabled);
  }

  setGroupPermission(groupName, node, worldName = null, enabled = true) {
    if (!this.backend) throw new Error("Permission backend is not ready");
    return this.backend.setGroupPermission(groupName, node, worldName, enabled);
  }

  listPermissionNodes(prefix = "") {
    if (!this.backend) return [];
    return this.backend.findPermissionsByPrefix(prefix);
  }
}

export { PurePermsPermissionService };
