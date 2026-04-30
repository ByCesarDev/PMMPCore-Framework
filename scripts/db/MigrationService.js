class MigrationService {
  constructor(db, observability = null) {
    this.db = db;
    this.observability = observability;
    this._runners = new Map();
  }

  register(pluginName, version, runner) {
    if (!this._runners.has(pluginName)) {
      this._runners.set(pluginName, []);
    }
    this._runners.get(pluginName).push({ version, runner });
    this._runners.get(pluginName).sort((a, b) => a.version - b.version);
  }

  _versionKey(pluginName) {
    return `plugin:${pluginName}:schemaVersion`;
  }

  getVersion(pluginName) {
    return Number(this.db.get(this._versionKey(pluginName)) ?? 0);
  }

  setVersion(pluginName, version) {
    this.db.set(this._versionKey(pluginName), Number(version));
  }

  run(pluginName, context = {}) {
    const current = this.getVersion(pluginName);
    const runners = this._runners.get(pluginName) ?? [];
    let applied = 0;
    for (const item of runners) {
      if (item.version <= current) continue;
      item.runner({ db: this.db, pluginName, context });
      this.setVersion(pluginName, item.version);
      applied++;
      this.observability?.info?.("migration", `Applied migration for ${pluginName}`, {
        version: item.version,
      });
    }
    return applied;
  }

  runAll(context = {}) {
    const result = {};
    for (const pluginName of this._runners.keys()) {
      result[pluginName] = this.run(pluginName, context);
    }
    return result;
  }
}

export { MigrationService };
