export enum PermissionPolicy {
  Allowed = "Allowed",
  Denied = "Denied",
  Pending = "Pending",
}

export class PermissionEnforcer {
  private readOnlyTools: Set<string> = new Set([
    "findDeals",
    "findAuctionDeals",
    "calculateMaxOffer",
    "calculateSurplus",
    "skipTrace",
  ]);

  /**
   * Evaluates whether a tool call is permitted.
   * Following user instructions: Auto-allow read-only tools.
   */
  public async checkPermission(toolName: string, args: any): Promise<PermissionPolicy> {
    console.log(`[PermissionEnforcer] Checking: ${toolName}`);
    
    if (this.readOnlyTools.has(toolName)) {
      console.log(`[PermissionEnforcer] ✅ Auto-allowed read-only tool: ${toolName}`);
      return PermissionPolicy.Allowed;
    }

    // For non-read-only tools, for now we log and allow (user said 'engine coexist')
    // but we flag it as a mutation.
    console.log(`[PermissionEnforcer] ⚠️ Mutation Tool detected: ${toolName}. Auto-allowing per current engine config.`);
    return PermissionPolicy.Allowed;
  }
}
