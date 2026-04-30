class PlaceholderExpansion {
  constructor({ identifier, version = "1.0.0", author = "unknown" } = {}) {
    if (!identifier || typeof identifier !== "string") {
      throw new Error("Expansion identifier is required.");
    }
    this.identifier = identifier.toLowerCase();
    this.version = version;
    this.author = author;
  }

  onPlaceholderRequest(_player, _key, _context) {
    return null;
  }
}

export { PlaceholderExpansion };
