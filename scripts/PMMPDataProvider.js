/**
 * API estilo PocketMine DataProvider sobre {@link DatabaseManager}.
 * No accede a DynamicProperty; todo pasa por `db`.
 */
class PMMPDataProvider {
  /**
   * @param {import("./DatabaseManager.js").DatabaseManager} db
   */
  constructor(db) {
    this.db = db;
  }

  loadPlayer(name) {
    return this.db.getPlayerData(name);
  }

  savePlayer(name, data) {
    return this.db.setPlayerData(name, data);
  }

  existsPlayer(name) {
    return this.db.has(`player:${name}`);
  }

  deletePlayer(name) {
    return this.db.delete(`player:${name}`);
  }

  loadPluginData(pluginName) {
    return this.db.getPluginData(pluginName);
  }

  savePluginData(pluginName, data) {
    return this.db.setPluginData(pluginName, data);
  }

  get(key) {
    return this.db.get(key);
  }

  set(key, value) {
    return this.db.set(key, value);
  }

  exists(key) {
    return this.db.has(key);
  }

  delete(key) {
    return this.db.delete(key);
  }

  flush() {
    return this.db.flush();
  }
}

export { PMMPDataProvider };
