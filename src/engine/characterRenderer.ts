/**
 * Character Renderer - handles loading and rendering character sprites
 * Based on JxqyHD character rendering system
 *
 * C# Reference: Engine/ResFile.cs, Engine/Character.cs
 *
 * NPC sprites are loaded via npcres/*.ini files which map states to ASF files:
 * - NPC config (ini/npc/*.ini) has NpcIni=xxx.ini pointing to npcres file
 * - NpcRes file (ini/npcres/*.ini) has sections like [Stand], [Walk] with Image=xxx.asf
 * - ASF files are in asf/character/ or asf/interlude/
 */

import type { NpcData, PlayerData, CharacterSpriteData, Direction, CharacterState } from "./core/types";
import { CharacterState as CharState } from "./core/types";
import {
  createCharacterSprite,
  loadSpriteSet,
  getAsfForState,
  getAsfForStateAsync,
  updateSpriteAnimation,
  resetSpriteAnimation,
  drawCharacterSprite,
  createEmptySpriteSet,
  startSpecialAction,
  isSpecialActionEnd,
  endSpecialAction,
  type CharacterSprite,
  type SpriteSet,
} from "./sprite";
import { loadAsf, getFrameCanvas, getFrameIndex, type AsfData } from "./asf";

/**
 * NpcRes state info parsed from ini/npcres/*.ini
 * Based on C# ResStateInfo
 */
interface NpcResStateInfo {
  imagePath: string;  // ASF file name
  soundPath: string;  // WAV file name
}

/**
 * Parse npcres INI file content
 * Based on C# ResFile.ReadFile()
 */
function parseNpcResIni(content: string): Map<number, NpcResStateInfo> {
  const stateMap = new Map<number, NpcResStateInfo>();
  const sections: Record<string, Record<string, string>> = {};
  let currentSection = "";

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) {
      continue;
    }

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = {};
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0 && currentSection) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      sections[currentSection][key] = value;
    }
  }

  // Map section names to CharacterState (based on C# ResFile.GetState)
  const stateNames: Record<string, number> = {
    "Stand": CharState.Stand,
    "Stand1": CharState.Stand1,
    "Walk": CharState.Walk,
    "Run": CharState.Run,
    "Jump": CharState.Jump,
    "Attack": CharState.Attack,
    "Attack1": CharState.Attack1,
    "Attack2": CharState.Attack2,
    "Magic": CharState.Magic,
    "Sit": CharState.Sit,
    "Hurt": CharState.Hurt,
    "Death": CharState.Death,
    "FightStand": CharState.FightStand,
    "FightWalk": CharState.FightWalk,
    "FightRun": CharState.FightRun,
    "FightJump": CharState.FightJump,
  };

  for (const [sectionName, keys] of Object.entries(sections)) {
    const state = stateNames[sectionName];
    if (state !== undefined && keys["Image"]) {
      stateMap.set(state, {
        imagePath: keys["Image"],
        soundPath: keys["Sound"] || "",
      });
    }
  }

  return stateMap;
}

/**
 * Load ASF file from character or interlude directory
 * Based on C# ResFile.GetAsfFilePathBase()
 */
async function loadCharacterAsf(asfFileName: string): Promise<AsfData | null> {
  const paths = [
    `/resources/asf/character/${asfFileName}`,
    `/resources/asf/interlude/${asfFileName}`,
  ];

  for (const path of paths) {
    const asf = await loadAsf(path);
    if (asf) {
      return asf;
    }
  }

  return null;
}

/**
 * Character Renderer manages sprite loading and rendering for all characters
 */
export class CharacterRenderer {
  // Sprite instances by character ID (or "player" for player)
  private sprites: Map<string, CharacterSprite> = new Map();
  // Loaded sprite sets cache
  private spriteSets: Map<string, SpriteSet> = new Map();
  // Loading promises to prevent duplicate loads
  private loadingPromises: Map<string, Promise<SpriteSet>> = new Map();
  // NpcRes cache (npcIni -> state map)
  private npcResCache: Map<string, Map<number, NpcResStateInfo>> = new Map();

  /**
   * Get base file name from NPC INI path
   * e.g. "npc006_st.asf" -> "npc006"
   */
  private getBaseFileName(npcIni: string): string {
    // Remove file extension and path
    let name = npcIni.replace(/\\/g, "/");
    const lastSlash = name.lastIndexOf("/");
    if (lastSlash >= 0) {
      name = name.substring(lastSlash + 1);
    }

    // Remove extension
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx >= 0) {
      name = name.substring(0, dotIdx);
    }

    // Remove state suffix (e.g., _st, _wlk, etc.)
    const suffixes = ["_st", "_pst", "_wlk", "_run", "_at", "_bat", "_die", "_sit", "_sst2", "_st2"];
    for (const suffix of suffixes) {
      if (name.endsWith(suffix)) {
        name = name.substring(0, name.length - suffix.length);
        break;
      }
    }

    return name;
  }

  /**
   * Load NpcRes INI file to get state -> ASF mappings
   * Based on C# ResFile.ReadFile(@"ini\npcres\" + fileName, ResType.Npc)
   */
  private async loadNpcRes(npcIni: string): Promise<Map<number, NpcResStateInfo> | null> {
    // Check cache first
    if (this.npcResCache.has(npcIni)) {
      return this.npcResCache.get(npcIni)!;
    }

    try {
      // npcIni is the filename like "npc006.ini" or "z-杨影枫.ini"
      const filePath = `/resources/ini/npcres/${npcIni}`;
      const response = await fetch(filePath);

      if (!response.ok) {
        console.warn(`[CharacterRenderer] NpcRes not found: ${filePath}`);
        return null;
      }

      // Check if it's actually an INI file (not Vite's HTML fallback)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        console.warn(`[CharacterRenderer] NpcRes is HTML (404 fallback): ${filePath}`);
        return null;
      }

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();

      // Check if content is HTML
      if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
        console.warn(`[CharacterRenderer] NpcRes content is HTML: ${filePath}`);
        return null;
      }

      const stateMap = parseNpcResIni(content);
      console.log(`[CharacterRenderer] Loaded NpcRes: ${npcIni} with ${stateMap.size} states`);
      this.npcResCache.set(npcIni, stateMap);
      return stateMap;
    } catch (error) {
      console.warn(`[CharacterRenderer] Failed to load NpcRes: ${npcIni}`, error);
      return null;
    }
  }

  /**
   * Load sprites for a character from NpcRes INI file
   * This is the new method that properly reads npcres/*.ini files
   * Based on C# Character.SetNpcIni() and ResFile.ReadFile()
   */
  async loadSpritesFromNpcRes(characterId: string, npcIni: string): Promise<boolean> {
    // Check if already loaded
    if (this.sprites.has(characterId)) {
      console.log(`[CharacterRenderer] Sprites already loaded for: ${characterId}`);
      return true;
    }

    // Load NpcRes INI to get state mappings
    const stateMap = await this.loadNpcRes(npcIni);
    if (!stateMap || stateMap.size === 0) {
      console.warn(`[CharacterRenderer] No state map for ${characterId} (${npcIni}), using fallback`);
      // Fall back to old method
      return false;
    }

    // Create sprite set by loading each state's ASF
    const spriteSet = createEmptySpriteSet();
    const loadPromises: Promise<void>[] = [];

    // Map CharacterState to SpriteSet keys
    const stateToKey: Record<number, keyof SpriteSet> = {
      [CharState.Stand]: "stand",
      [CharState.Stand1]: "stand1",
      [CharState.Walk]: "walk",
      [CharState.Run]: "run",
      [CharState.Attack]: "attack",
      [CharState.Attack1]: "attack1",
      [CharState.Attack2]: "attack2",
      [CharState.Magic]: "magic",
      [CharState.Hurt]: "hurt",
      [CharState.Death]: "death",
      [CharState.Sit]: "sit",
      [CharState.FightStand]: "stand",      // Use stand as fallback
      [CharState.FightWalk]: "walk",        // Use walk as fallback
      [CharState.FightRun]: "run",          // Use run as fallback
    };

    for (const [state, info] of stateMap) {
      const key = stateToKey[state];
      if (key && info.imagePath) {
        const promise = loadCharacterAsf(info.imagePath).then(asf => {
          if (asf) {
            spriteSet[key] = asf;
            console.log(`[CharacterRenderer] Loaded state ${state} (${key}): ${info.imagePath}`);
          } else {
            console.warn(`[CharacterRenderer] Failed to load ASF for state ${state}: ${info.imagePath}`);
          }
        });
        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);

    // Check if we loaded at least the stand animation
    if (!spriteSet.stand && !spriteSet.walk) {
      console.warn(`[CharacterRenderer] No basic animations loaded for ${characterId}`);
      return false;
    }

    // Create sprite instance
    const sprite = createCharacterSprite("/resources/asf/character", npcIni);
    sprite.spriteSet = spriteSet;
    sprite.isLoaded = true;
    this.sprites.set(characterId, sprite);

    console.log(`[CharacterRenderer] Successfully loaded sprites for ${characterId} from NpcRes`);
    return true;
  }

  /**
   * Load sprites for a character (main entry point)
   * First tries to load from NpcRes INI, then falls back to suffix-based loading
   */
  async loadCharacterSprites(
    characterId: string,
    npcIni: string,
    basePath: string = "/resources/asf/character"
  ): Promise<void> {
    // Check if already loaded
    if (this.sprites.has(characterId)) {
      return;
    }

    console.log(`[CharacterRenderer] Loading sprites for ${characterId}, npcIni=${npcIni}`);

    // Try to load from NpcRes INI first (the correct C# way)
    const loadedFromNpcRes = await this.loadSpritesFromNpcRes(characterId, npcIni);
    if (loadedFromNpcRes) {
      return;
    }

    // Fall back to suffix-based loading (legacy method)
    console.log(`[CharacterRenderer] Falling back to suffix-based loading for ${characterId}`);
    const baseFileName = this.getBaseFileName(npcIni);
    const cacheKey = `${basePath}/${baseFileName}`;

    // Check if already loading
    let loadPromise = this.loadingPromises.get(cacheKey);
    if (!loadPromise) {
      loadPromise = loadSpriteSet(basePath, baseFileName);
      this.loadingPromises.set(cacheKey, loadPromise);
    }

    try {
      const spriteSet = await loadPromise;
      this.spriteSets.set(cacheKey, spriteSet);

      const sprite = createCharacterSprite(basePath, baseFileName);
      sprite.spriteSet = spriteSet;
      sprite.isLoaded = true;
      this.sprites.set(characterId, sprite);
    } catch (error) {
      console.warn(`Failed to load sprites for ${characterId}:`, error);
    }
  }

  /**
   * Load player sprites
   */
  async loadPlayerSprites(npcIni: string = "npc006"): Promise<void> {
    await this.loadCharacterSprites("player", npcIni);
  }

  /**
   * Load NPC sprites
   */
  async loadNpcSprites(npc: NpcData): Promise<void> {
    if (npc.config.npcIni) {
      await this.loadCharacterSprites(npc.id, npc.config.npcIni);
    }
  }

  /**
   * Update character animation
   */
  updateAnimation(
    characterId: string,
    state: CharacterState,
    deltaTime: number,
    _direction: Direction
  ): void {
    const sprite = this.sprites.get(characterId);
    if (sprite && sprite.isLoaded) {
      updateSpriteAnimation(sprite, state, deltaTime);
    }
  }

  /**
   * Update all NPC animations
   * This should be called every frame to ensure NPC sprites are properly animated
   */
  updateAllNpcAnimations(
    npcs: Map<string, NpcData>,
    deltaTime: number
  ): void {
    for (const [id, npc] of npcs) {
      const sprite = this.sprites.get(id);
      if (sprite && sprite.isLoaded) {
        updateSpriteAnimation(sprite, npc.state, deltaTime);
      }
    }
  }

  /**
   * Set custom action file for a character state
   * Based on C# Character.SetNpcActionFile() and ResFile.SetNpcStateImage()
   */
  setNpcActionFile(
    characterId: string,
    stateType: number,
    asfFile: string
  ): void {
    const sprite = this.sprites.get(characterId);
    if (!sprite) {
      console.warn(`[CharacterRenderer] Cannot set action file, character not found: ${characterId}`);
      return;
    }

    // Initialize customActionFiles map if needed
    if (!sprite.customActionFiles) {
      sprite.customActionFiles = new Map();
    }

    // Store the custom action file
    sprite.customActionFiles.set(stateType, asfFile);
    console.log(`[CharacterRenderer] Set action file for ${characterId} state ${stateType}: ${asfFile}`);

    // Clear cached ASF for this state to force reload
    if (sprite.customAsfCache) {
      sprite.customAsfCache.delete(stateType);
    }
  }

  /**
   * Preload custom action file for immediate use
   * This ensures the ASF is loaded before it's needed
   */
  async preloadCustomActionFile(
    characterId: string,
    stateType: number,
    asfFile: string
  ): Promise<void> {
    this.setNpcActionFile(characterId, stateType, asfFile);

    const sprite = this.sprites.get(characterId);
    if (!sprite) return;

    // Trigger async load to populate cache
    await getAsfForStateAsync(sprite, stateType);
    console.log(`[CharacterRenderer] Preloaded custom action file for ${characterId} state ${stateType}`);
  }

  /**
   * Start a special action animation for a character
   * Based on C# Character.SetSpecialAction()
   *
   * @param characterId - Character ID or "player"
   * @param asfFileName - ASF file to play (e.g., "mpc001.asf")
   * @returns Promise that resolves when ASF is loaded
   */
  async setSpecialAction(
    characterId: string,
    asfFileName: string
  ): Promise<boolean> {
    const sprite = this.sprites.get(characterId);
    if (!sprite) {
      console.warn(`[CharacterRenderer] Cannot set special action, character not found: ${characterId}`);
      return false;
    }

    // Load the special action ASF
    const asf = await loadCharacterAsf(asfFileName);
    if (!asf) {
      console.warn(`[CharacterRenderer] Failed to load special action ASF: ${asfFileName}`);
      return false;
    }

    // Start playing the special action
    startSpecialAction(sprite, asf);
    console.log(`[CharacterRenderer] Started special action for ${characterId}: ${asfFileName}`);
    return true;
  }

  /**
   * Check if a character's special action has finished
   * Based on C# Sprite.IsPlayCurrentDirOnceEnd()
   */
  isSpecialActionEnd(characterId: string): boolean {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return true;
    return isSpecialActionEnd(sprite);
  }

  /**
   * End special action and restore character state
   * Based on C# Character.EndSpecialAction()
   */
  endSpecialActionFor(characterId: string): void {
    const sprite = this.sprites.get(characterId);
    if (!sprite) return;
    endSpecialAction(sprite);
    console.log(`[CharacterRenderer] Ended special action for ${characterId}`);
  }

  /**
   * Draw a character
   */
  drawCharacter(
    ctx: CanvasRenderingContext2D,
    characterId: string,
    x: number,
    y: number,
    direction: Direction,
    state: CharacterState,
    name: string
  ): void {
    const sprite = this.sprites.get(characterId);

    if (sprite && sprite.isLoaded) {
      drawCharacterSprite(ctx, sprite, x, y, direction, state);
    } else {
      // Draw placeholder
      this.drawPlaceholder(ctx, x, y, characterId === "player" ? "#4a90d9" : "#d9a04a");
    }
  }

  /**
   * Draw placeholder for unloaded sprites
   */
  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ): void {
    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 20, 15, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator using arrow
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 10, y - 20);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw player
   */
  drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerData,
    cameraX: number,
    cameraY: number
  ): void {
    const screenX = player.pixelPosition.x - cameraX;
    const screenY = player.pixelPosition.y - cameraY;

    this.drawCharacter(
      ctx,
      "player",
      screenX,
      screenY,
      player.direction,
      player.state,
      player.config.name
    );
  }

  /**
   * Draw NPC
   */
  drawNpc(
    ctx: CanvasRenderingContext2D,
    npc: NpcData,
    cameraX: number,
    cameraY: number
  ): void {
    if (!npc.isVisible) return;

    const screenX = npc.pixelPosition.x - cameraX;
    const screenY = npc.pixelPosition.y - cameraY;

    this.drawCharacter(
      ctx,
      npc.id,
      screenX,
      screenY,
      npc.direction,
      npc.state,
      npc.config.name
    );
  }

  /**
   * Draw all NPCs
   */
  drawAllNpcs(
    ctx: CanvasRenderingContext2D,
    npcs: Map<string, NpcData>,
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    // Collect visible NPCs and sort by Y position for proper layering
    const visibleNpcs: NpcData[] = [];

    for (const [, npc] of npcs) {
      if (!npc.isVisible) continue;

      const screenX = npc.pixelPosition.x - cameraX;
      const screenY = npc.pixelPosition.y - cameraY;

      // Skip if off-screen
      if (screenX < -100 || screenX > screenWidth + 100 ||
          screenY < -100 || screenY > screenHeight + 100) {
        continue;
      }

      visibleNpcs.push(npc);
    }

    // Sort by Y position (lower Y = further back = draw first)
    visibleNpcs.sort((a, b) => a.pixelPosition.y - b.pixelPosition.y);

    // Draw each NPC
    for (const npc of visibleNpcs) {
      this.drawNpc(ctx, npc, cameraX, cameraY);
    }
  }

  /**
   * Check if a character's sprites are loaded
   */
  isLoaded(characterId: string): boolean {
    const sprite = this.sprites.get(characterId);
    return sprite?.isLoaded ?? false;
  }

  /**
   * Clear all loaded sprites
   */
  clear(): void {
    this.sprites.clear();
    this.spriteSets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Remove a specific character's sprites
   */
  removeCharacter(characterId: string): void {
    this.sprites.delete(characterId);
  }
}

// Global character renderer instance
let globalCharacterRenderer: CharacterRenderer | null = null;

/**
 * Get or create global character renderer
 */
export function getCharacterRenderer(): CharacterRenderer {
  if (!globalCharacterRenderer) {
    globalCharacterRenderer = new CharacterRenderer();
  }
  return globalCharacterRenderer;
}

/**
 * Reset global character renderer
 */
export function resetCharacterRenderer(): void {
  if (globalCharacterRenderer) {
    globalCharacterRenderer.clear();
  }
  globalCharacterRenderer = null;
}
