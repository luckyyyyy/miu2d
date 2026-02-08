/**
 * Character system exports
 *
 * Class-based architecture ():
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
export { Character } from "./character";
// INI Parser - data-driven config parsing (new, replaces verbose switch-case)
export {
  applyConfigToCharacter,
  applyConfigToPlayer,
  extractConfigFromCharacter,
  extractStatsFromCharacter,
  loadCharacterConfig,
  parseCharacterIni,
} from "./iniParser";
// ResFile utilities - INI file loading ()
export {
  // Image loading (ASF/MPC with optional SHD shadow)
  loadCharacterAsf,
  loadCharacterImage,
  loadNpcConfig,
  loadNpcRes,
  // NpcRes (state -> ASF mappings)
  type NpcResStateInfo,
} from "./resFile";
