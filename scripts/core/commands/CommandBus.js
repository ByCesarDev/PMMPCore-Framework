class CommandBus {
  constructor(observability = null) {
    this.observability = observability;
    this.commands = new Map();
  }

  register(definition) {
    if (!definition?.name) {
      throw new Error("Command name is required");
    }
    this.commands.set(definition.name, definition);
    return definition;
  }

  unregister(name) {
    return this.commands.delete(name);
  }

  get(name) {
    return this.commands.get(name) ?? null;
  }

  list() {
    return Array.from(this.commands.values()).map((cmd) => ({
      name: cmd.name,
      description: cmd.description || "",
      permission: cmd.permission || null,
      stability: cmd.stability || "stable",
    }));
  }

  registerBedrockCommand(registry, definition) {
    this.register(definition);
    registry.registerCommand(
      {
        name: definition.name,
        description: definition.description,
        permissionLevel: definition.permissionLevel,
        cheatsRequired: definition.cheatsRequired ?? false,
        mandatoryParameters: definition.mandatoryParameters,
        optionalParameters: definition.optionalParameters,
      },
      (...args) => {
        const startedAt = Date.now();
        try {
          return definition.execute(...args);
        } finally {
          this.observability?.recordTask?.(Date.now() - startedAt, definition.owner || "command", definition.name);
        }
      }
    );
  }
}

export { CommandBus };
