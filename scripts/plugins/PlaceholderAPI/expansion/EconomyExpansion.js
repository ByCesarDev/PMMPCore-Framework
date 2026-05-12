import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class EconomyExpansion extends PlaceholderExpansion {
  constructor(economyService = null) {
    super({
      identifier: "economy",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
    this.economyService = economyService;
  }

  onPlaceholderRequest(player, key) {
    if (!player) return null;
    if (!this.economyService) return null;
    
    const id = String(key ?? "").toLowerCase();
    const playerName = player.name;
    
    try {
      if (id === "money" || id === "balance") {
        const money = this.economyService.getMoney(playerName);
        return String(Math.round(money * 100) / 100);
      }
      
      if (id === "wallet") {
        const money = this.economyService.getMoney(playerName);
        return String(Math.round(money * 100) / 100);
      }
      
      if (id === "bank") {
        // Si EconomyAPI tiene sistema de banco, implementar aquí
        // Por ahora devuelve el mismo balance
        const money = this.economyService.getMoney(playerName);
        return String(Math.round(money * 100) / 100);
      }
      
      if (id === "debt") {
        // Si EconomyAPI tiene sistema de deudas, implementar aquí
        return "0";
      }
      
      if (id === "formatted") {
        const money = this.economyService.getMoney(playerName);
        return `$${Math.round(money * 100) / 100}`;
      }
      
      if (id === "formatted_commas") {
        const money = this.economyService.getMoney(playerName);
        const roundedMoney = Math.round(money * 100) / 100;
        return `$${roundedMoney.toLocaleString()}`;
      }
      
    } catch (error) {
      console.error(`[EconomyExpansion] Error getting ${id} for ${playerName}:`, error?.message ?? error);
      return "0";
    }
    
    return null;
  }

  /**
   * Set the economy service reference
   */
  setEconomyService(economyService) {
    this.economyService = economyService;
  }
}

export { EconomyExpansion };
