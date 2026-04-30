class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.metadata = new Map();
  }

  register(name, service, metadata = {}) {
    this.services.set(name, service);
    this.metadata.set(name, {
      stability: metadata.stability || "stable",
      source: metadata.source || "core",
    });
    return service;
  }

  get(name) {
    return this.services.get(name) ?? null;
  }

  has(name) {
    return this.services.has(name);
  }

  entries() {
    return Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      service,
      metadata: this.metadata.get(name) ?? {},
    }));
  }

  summary() {
    return this.entries().map((entry) => ({
      name: entry.name,
      stability: entry.metadata.stability ?? "stable",
      source: entry.metadata.source ?? "core",
    }));
  }
}

export { ServiceRegistry };
