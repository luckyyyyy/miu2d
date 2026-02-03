/**
 * NPC system exports
 *
 * NPC classes and manager (based on C# JxqyHD):
 * - Npc (extends Character) - npc.ts
 * - NpcManager - npcManager.ts
 * - NpcMagicCache - modules/npcMagicCache.ts
 */

// NPC modules
export { NpcMagicCache, type SpecialMagicType } from "./modules";
// NPC class
export { Npc } from "./npc";
// NPC manager
export { DeathInfo, NpcManager, type ViewRect } from "./npcManager";
