import { PlaceholderExpansion } from "./PlaceholderExpansion.js";

class PurePermsExpansion extends PlaceholderExpansion {
  constructor(purePermsService = null) {
    super({
      identifier: "pureperms",
      version: "1.0.0",
      author: "PMMPCore Team",
    });
    this.purePermsService = purePermsService;
  }

  onPlaceholderRequest(player, key) {
    if (!player) return null;
    if (!this.purePermsService) return null;
    
    const id = String(key ?? "").toLowerCase();
    const playerName = player.name;
    
    try {
      // Get user info using the actual PurePerms method
      const userInfo = this.purePermsService.getUserInfo(playerName);
      const effectiveGroup = userInfo?.effectiveGroup || "Default";
      
      if (id === "rank" || id === "group" || id === "primary_group") {
        return String(effectiveGroup);
      }
      
      if (id === "groups") {
        // PurePerms doesn't have multiple groups per user, return effective group
        return String(effectiveGroup);
      }
      
      if (id === "prefix") {
        try {
          const groupInfo = this.purePermsService.getGroupInfo(effectiveGroup);
          return String(groupInfo?.prefix || "");
        } catch (error) {
          return "";
        }
      }
      
      if (id === "suffix") {
        try {
          const groupInfo = this.purePermsService.getGroupInfo(effectiveGroup);
          return String(groupInfo?.suffix || "");
        } catch (error) {
          return "";
        }
      }
      
      if (id === "rank_display") {
        try {
          const groupInfo = this.purePermsService.getGroupInfo(effectiveGroup);
          const prefix = groupInfo?.prefix || "";
          const rankName = effectiveGroup;
          return prefix ? `${prefix}${rankName}` : rankName;
        } catch (error) {
          return String(effectiveGroup);
        }
      }
      
      if (id === "full_display") {
        try {
          const groupInfo = this.purePermsService.getGroupInfo(effectiveGroup);
          const prefix = groupInfo?.prefix || "";
          const suffix = groupInfo?.suffix || "";
          const rankName = effectiveGroup;
          
          let display = "";
          if (prefix) display += prefix;
          display += rankName;
          if (suffix) display += suffix;
          
          return display;
        } catch (error) {
          return String(effectiveGroup);
        }
      }
      
    } catch (error) {
      console.error(`[PurePermsExpansion] Error getting ${id} for ${playerName}:`, error?.message ?? error);
      return "Default";
    }
    
    return null;
  }

  /**
   * Set the PurePerms service reference
   */
  setPurePermsService(purePermsService) {
    this.purePermsService = purePermsService;
  }
}

export { PurePermsExpansion };
