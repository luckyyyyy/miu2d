/**
 * ResFile - NPC Resource File Parser
 * Based on JxqyHD Engine/ResFile.cs
 *
 * Handles loading and parsing npcres INI files (state to ASF mappings).
 * NPC config parsing moved to iniParser.ts for better separation.
 *
 * Reference: Engine/ResFile.cs
 */

import { ResourcePath } from "../config/resourcePaths";
import { logger } from "../core/logger";
import { CharacterState } from "../core/types";
import { loadMpcWithShadow } from "../resource/mpc";
import { resourceLoader } from "../resource/resourceLoader";
import { type AsfData, loadAsf } from "../resource/asf";
import { parseIni } from "../utils";

// Re-export from iniParser for backward compatibility
export {
  loadCharacterConfig as loadNpcConfig,
  parseCharacterIni as parseNpcConfig,
} from "./iniParser";

/**
 * NpcRes state info parsed from ini/npcres/*.ini
 *
 */
export interface NpcResStateInfo {
  imagePath: string; // ASF or MPC file name
  shadePath: string; // SHD file name (for MPC only)
  soundPath: string; // WAV file name
}

/**
 * State name to CharacterState mapping
 * ()
 */
const STATE_NAMES: Record<string, number> = {
  Stand: CharacterState.Stand,
  Stand1: CharacterState.Stand1,
  Walk: CharacterState.Walk,
  Run: CharacterState.Run,
  Jump: CharacterState.Jump,
  Attack: CharacterState.Attack,
  Attack1: CharacterState.Attack1,
  Attack2: CharacterState.Attack2,
  Magic: CharacterState.Magic,
  Sit: CharacterState.Sit,
  Hurt: CharacterState.Hurt,
  Death: CharacterState.Death,
  FightStand: CharacterState.FightStand,
  FightWalk: CharacterState.FightWalk,
  FightRun: CharacterState.FightRun,
  FightJump: CharacterState.FightJump,
};

/**
 * Parse npcres INI file content
 * ()
 */
export function parseNpcResIni(content: string): Map<number, NpcResStateInfo> {
  const stateMap = new Map<number, NpcResStateInfo>();
  const sections = parseIni(content);

  // Map sections to states
  for (const [sectionName, keys] of Object.entries(sections)) {
    const state = STATE_NAMES[sectionName];
    if (state !== undefined && keys.Image) {
      stateMap.set(state, {
        imagePath: keys.Image,
        shadePath: keys.Shade || "",
        soundPath: keys.Sound || "",
      });
    }
  }

  return stateMap;
}

/**
 * Load ASF file from character or interlude directory
 * ()
 */
export async function loadCharacterAsf(asfFileName: string): Promise<AsfData | null> {
  // Encode Chinese characters in filename for URL
  const encodedFileName = encodeURIComponent(asfFileName);

  const paths = [
    ResourcePath.asfCharacter(encodedFileName),
    ResourcePath.asfInterlude(encodedFileName),
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      return asf;
    }
  }

  logger.warn(`[ResFile] ASF not found: ${asfFileName}`);
  return null;
}

/**
 * Load character sprite image (ASF or MPC format)
 * () which checks file extension
 *
 * @param imagePath - Image filename (can be .asf or .mpc)
 * @param shadePath - Optional SHD shadow filename (for MPC only)
 * @returns AsfData if successful, null otherwise
 */
export async function loadCharacterImage(
  imagePath: string,
  shadePath?: string
): Promise<AsfData | null> {
  const ext = imagePath.toLowerCase().slice(-4);
  const encodedImageName = encodeURIComponent(imagePath);

  if (ext === ".mpc") {
    // MPC format - load from mpc/character/ directory with optional SHD
    const mpcPath = ResourcePath.mpcCharacter(encodedImageName);
    let shdPath: string | undefined;
    if (shadePath) {
      shdPath = ResourcePath.mpcCharacter(encodeURIComponent(shadePath));
    }

    const mpc = await loadMpcWithShadow(mpcPath, shdPath);
    if (mpc) {
      // Convert MPC to AsfData format for unified handling
      return mpcToAsfData(mpc);
    }
    logger.warn(`[ResFile] MPC not found: ${imagePath}`);
    return null;
  }

  // Default: ASF format
  return loadCharacterAsf(imagePath);
}

/**
 * Convert MPC data to AsfData format
 * This allows unified sprite handling regardless of source format
 */
function mpcToAsfData(mpc: import("../core/mapTypes").Mpc): AsfData {
  const directions = mpc.head.direction || 1;
  const frameCount = mpc.head.frameCounts;
  const framesPerDirection = directions > 0 ? Math.floor(frameCount / directions) : frameCount;

  return {
    width: mpc.head.globleWidth,
    height: mpc.head.globleHeight,
    frameCount: frameCount,
    directions: directions,
    colorCount: mpc.head.colourCounts,
    interval: mpc.head.interval,
    left: mpc.head.left,
    bottom: mpc.head.bottom,
    framesPerDirection: framesPerDirection,
    frames: mpc.frames.map((frame) => ({
      width: frame.width,
      height: frame.height,
      imageData: frame.imageData,
      canvas: null, // Will be created on first render if needed
    })),
    isLoaded: true,
  };
}

/**
 * Load NpcRes INI file to get state -> ASF mappings
 * (@"ini\npcres\" + fileName, ResType.Npc)
 * Uses resourceLoader.loadIni to cache parsed result
 */
export async function loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
  // npcIni is the filename like "npc006.ini" or "z-杨影枫.ini"
  const filePath = ResourcePath.npcRes(npcIni);

  const stateMap = await resourceLoader.loadIni(filePath, parseNpcResIni, "npcRes");
  if (!stateMap) {
    logger.warn(`[ResFile] NpcRes not found or parse failed: ${filePath}`);
    return null;
  }

  logger.debug(`[ResFile] Loaded NpcRes: ${npcIni} with ${stateMap.size} states`);
  return stateMap;
}
