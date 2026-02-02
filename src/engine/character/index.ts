/**
 * Character system exports
 *
 * Class-based architecture (based on C# JxqyHD):
 * - Sprite (base class) - sprite/sprite.ts
 * - Character (abstract, extends Sprite) - characterBase.ts
 * - Npc (extends Character) - ../npc/npc.ts
 * - Player (extends Character) - ../player/player.ts
 *
 * Character classes handle their own sprite loading and drawing:
 * - character.loadSpritesFromNpcIni() - load sprites from NpcRes INI
 * - character.draw() - render character
 * - character.setSpecialAction() - play special action animation
 */

// Class-based exports
export { Character, type MagicToUseInfoItem } from "./character";
// INI Parser - data-driven config parsing (new, replaces verbose switch-case)
export {
  applyConfigToCharacter,
  applyConfigToPlayer,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
  loadCharacterConfig,
  parseCharacterIni,
} from "./iniParser";
// Re-export Npc and NpcManager from npc module for backward compatibility
export { Npc } from "../npc";
export { NpcManager } from "../npc";
// ResFile utilities - INI file loading (based on C# ResFile.cs)
export {
  // Image loading (ASF/MPC with optional SHD shadow)
  loadCharacterAsf,
  loadCharacterImage,
  loadNpcConfig,
  loadNpcRes,
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
  // NPC config loading (re-exported from iniParser for backward compatibility)
  parseNpcConfig,
  parseNpcResIni,
} from "./resFile";
