/**
 * NPC system exports
 *
 * NPC classes and manager (based on C# JxqyHD):
 * - Npc (extends Character) - npc.ts
 * - NpcManager - npcManager.ts
 * - NpcMagicCache - modules/npcMagicCache.ts
 */

// NPC class
export { Npc } from "./npc";

// NPC manager
export { NpcManager, DeathInfo, type ViewRect } from "./npcManager";

// NPC modules
export { NpcMagicCache, type SpecialMagicType } from "./modules";
