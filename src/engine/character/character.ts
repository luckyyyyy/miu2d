/**
 * Character class - based on JxqyHD Engine/Character.cs
 * Base class for all characters (player, NPCs, enemies)
 */
import type {
  Vector2,
  Direction,
  CharacterConfig,
  CharacterStats,
  CharacterKind,
  RelationType,
  NpcData,
  PlayerData,
} from "../core/types";
import { CharacterState, DEFAULT_WALK_SPEED, TILE_WIDTH, TILE_HEIGHT } from "../core/types";
import { tileToPixel, pixelToTile, getDirection, distance, findPath } from "../core/utils";

export interface CharacterUpdateResult {
  moved: boolean;
  reachedDestination: boolean;
  triggeredScript?: string;
}

/**
 * Create default NPC data
 */
export function createNpcData(
  id: string,
  config: CharacterConfig,
  tileX: number,
  tileY: number,
  direction: Direction = 4
): NpcData {
  const pixelPos = tileToPixel(tileX, tileY);
  return {
    id,
    config,
    tilePosition: { x: tileX, y: tileY },
    // C# uses ToPixelPosition directly (tile top-left corner)
    // Drawing offset is handled by ASF left/bottom values
    pixelPosition: { x: pixelPos.x, y: pixelPos.y },
    direction,
    state: CharacterState.Stand,
    currentFrame: 0,
    path: [],
    isVisible: true,
    isAIDisabled: false,
    actionPathTilePositions: undefined,
  };
}

/**
 * Create default player data
 */
export function createPlayerData(
  config: CharacterConfig,
  tileX: number,
  tileY: number,
  direction: Direction = 4
): PlayerData {
  const pixelPos = tileToPixel(tileX, tileY);
  return {
    config,
    tilePosition: { x: tileX, y: tileY },
    // C# uses ToPixelPosition directly (tile top-left corner)
    // Drawing offset is handled by ASF left/bottom values
    pixelPosition: { x: pixelPos.x, y: pixelPos.y },
    direction,
    state: CharacterState.Stand,
    currentFrame: 0,
    money: 0,
    path: [],
    isMoving: false,
    targetPosition: null,
  };
}

/**
 * Update character position along path
 */
export function updateCharacterMovement(
  character: NpcData | PlayerData,
  deltaTime: number,
  _isWalkable: (tile: Vector2) => boolean
): CharacterUpdateResult {
  const result: CharacterUpdateResult = {
    moved: false,
    reachedDestination: false,
  };

  if (character.path.length === 0) {
    // No path, stand still
    if (character.state === CharacterState.Walk || character.state === CharacterState.Run) {
      character.state = CharacterState.Stand;
    }
    return result;
  }

  // Get next waypoint
  const target = character.path[0];
  // C# uses ToPixelPosition directly (no offset)
  const targetPixel = tileToPixel(target.x, target.y);

  // Calculate movement
  const dx = targetPixel.x - character.pixelPosition.x;
  const dy = targetPixel.y - character.pixelPosition.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2) {
    // Reached waypoint
    character.pixelPosition = { ...targetPixel };
    character.tilePosition = { ...target };
    character.path.shift();
    result.moved = true;

    if (character.path.length === 0) {
      character.state = CharacterState.Stand;
      result.reachedDestination = true;
      if ("isMoving" in character) {
        character.isMoving = false;
        character.targetPosition = null;
      }
    }
  } else {
    // Move towards waypoint
    const speed = (character.config.stats.walkSpeed || 1) * DEFAULT_WALK_SPEED;
    const moveDistance = speed * deltaTime;
    const ratio = Math.min(1, moveDistance / dist);

    character.pixelPosition.x += dx * ratio;
    character.pixelPosition.y += dy * ratio;
    character.direction = getDirection(character.pixelPosition, targetPixel);
    character.state = CharacterState.Walk;
    result.moved = true;

    // Update tile position
    const newTile = pixelToTile(character.pixelPosition.x, character.pixelPosition.y);
    character.tilePosition = newTile;
  }

  return result;
}

/**
 * Set character to walk to a destination
 * Matches C# Character.WalkTo
 */
export function walkTo(
  character: NpcData | PlayerData,
  destTile: Vector2,
  isWalkable: (tile: Vector2) => boolean
): boolean {
  // Already at destination
  if (character.tilePosition.x === destTile.x && character.tilePosition.y === destTile.y) {
    return true;
  }

  // Find path
  const path = findPath(character.tilePosition, destTile, isWalkable);

  // No path found - stand immediately
  if (path.length === 0) {
    character.path = [];
    character.state = CharacterState.Stand;
    if ("isMoving" in character) {
      character.isMoving = false;
      character.targetPosition = null;
    }
    return false;
  }

  // Set path (exclude starting position, already there)
  character.path = path.slice(1);
  character.state = CharacterState.Walk;

  if ("isMoving" in character) {
    character.isMoving = true;
    character.targetPosition = destTile;
  }

  return true;
}

/**
 * Update character animation frame
 */
export function updateCharacterAnimation(
  character: NpcData | PlayerData,
  deltaTime: number,
  frameCount: number = 8,
  frameRate: number = 8
): void {
  const frameInterval = 1000 / frameRate;
  character.currentFrame += deltaTime * 1000 / frameInterval;
  if (character.currentFrame >= frameCount) {
    character.currentFrame = character.currentFrame % frameCount;
  }
}

/**
 * Check if a character can interact with another
 */
export function canInteract(
  source: NpcData | PlayerData,
  target: NpcData,
  dialogRadius: number = 3
): boolean {
  const dist =
    Math.abs(source.tilePosition.x - target.tilePosition.x) +
    Math.abs(source.tilePosition.y - target.tilePosition.y);
  return dist <= dialogRadius * 2;
}

/**
 * Get closest NPC that can be interacted with
 */
export function getClosestInteractableNpc(
  source: NpcData | PlayerData,
  npcs: Map<string, NpcData>,
  dialogRadius: number = 3
): NpcData | null {
  let closest: NpcData | null = null;
  let closestDist = Infinity;

  for (const [, npc] of npcs) {
    if (!npc.isVisible) continue;
    if (npc.config.kind === 1) continue; // Fighter, not interactable

    const dist = distance(source.pixelPosition, npc.pixelPosition);
    if (dist < closestDist && canInteract(source, npc, dialogRadius)) {
      closest = npc;
      closestDist = dist;
    }
  }

  return closest;
}

/**
 * Parse NPC configuration from INI content
 */
export function parseNpcConfig(content: string): CharacterConfig | null {
  const lines = content.split("\n");
  const config: Partial<CharacterConfig> = {
    stats: {} as CharacterStats,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith(";") || !trimmed.includes("=")) {
      continue;
    }

    const [key, value] = trimmed.split("=").map((s) => s.trim());
    const stats = config.stats as CharacterStats;

    switch (key.toLowerCase()) {
      case "name":
        config.name = value;
        stats.name = value;
        break;
      case "npcini":
        config.npcIni = value;
        break;
      case "flyini":
        config.flyIni = value;
        break;
      case "bodyini":
        config.bodyIni = value;
        break;
      case "kind":
        config.kind = parseInt(value, 10) as CharacterKind;
        break;
      case "relation":
        config.relation = parseInt(value, 10) as RelationType;
        break;
      case "life":
        stats.life = parseInt(value, 10);
        break;
      case "lifemax":
        stats.lifeMax = parseInt(value, 10);
        break;
      case "mana":
        stats.mana = parseInt(value, 10);
        break;
      case "manamax":
        stats.manaMax = parseInt(value, 10);
        break;
      case "thew":
        stats.thew = parseInt(value, 10);
        break;
      case "thewmax":
        stats.thewMax = parseInt(value, 10);
        break;
      case "attack":
        stats.attack = parseInt(value, 10);
        break;
      case "defence":
        stats.defence = parseInt(value, 10);
        break;
      case "evade":
        stats.evade = parseInt(value, 10);
        break;
      case "exp":
        stats.exp = parseInt(value, 10);
        break;
      case "walkspeed":
        stats.walkSpeed = parseInt(value, 10);
        break;
      case "visionradius":
        stats.visionRadius = parseInt(value, 10);
        break;
      case "attackradius":
        stats.attackRadius = parseInt(value, 10);
        break;
      case "scriptfile":
        config.scriptFile = value;
        break;
      case "deathscript":
        config.deathScript = value;
        break;
      case "timerscript":
        config.timerScript = value;
        break;
      case "timerscriptinterval":
        config.timerInterval = parseInt(value, 10);
        break;
      case "pathfinder":
        config.pathFinder = value === "1";
        break;
    }
  }

  if (!config.name || !config.stats) {
    return null;
  }

  return config as CharacterConfig;
}

/**
 * Load NPC configuration from URL
 * Based on C# Character.cs - NPCs can be in ini\npc\ or ini\npcres\
 */
export async function loadNpcConfig(url: string): Promise<CharacterConfig | null> {
  console.log(`[loadNpcConfig] Loading: ${url}`);

  // Try loading from the specified path first
  let response = await tryFetchNpcConfig(url);

  // If not found and url contains /ini/npc/, try /ini/npcres/
  if (!response && url.includes('/ini/npc/')) {
    const npcresUrl = url.replace('/ini/npc/', '/ini/npcres/');
    console.log(`[loadNpcConfig] Not found, trying npcres: ${npcresUrl}`);
    response = await tryFetchNpcConfig(npcresUrl);
  }

  // If not found and url contains /ini/npcres/, try /ini/npc/
  if (!response && url.includes('/ini/npcres/')) {
    const npcUrl = url.replace('/ini/npcres/', '/ini/npc/');
    console.log(`[loadNpcConfig] Not found, trying npc: ${npcUrl}`);
    response = await tryFetchNpcConfig(npcUrl);
  }

  if (!response) {
    console.warn(`[loadNpcConfig] FAILED to load NPC config: ${url} (tried both npc and npcres directories)`);
    return null;
  }

  console.log(`[loadNpcConfig] Successfully loaded from: ${response.url}`);


  try {
    // NPC config files are in GB2312 encoding (Chinese)
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let content: string;
    try {
      // Try GB2312 first (for Chinese NPC names)
      const decoder = new TextDecoder('gb2312');
      content = decoder.decode(bytes);
    } catch {
      try {
        // Fallback to GBK
        const decoder = new TextDecoder('gbk');
        content = decoder.decode(bytes);
      } catch {
        // Last resort: UTF-8
        const decoder = new TextDecoder('utf-8');
        content = decoder.decode(bytes);
      }
    }

    return parseNpcConfig(content);
  } catch (error) {
    console.error(`Error loading NPC config ${url}:`, error);
    return null;
  }
}

/**
 * Try to fetch NPC config from a URL
 * Check if the response is actually an INI file, not HTML fallback
 */
async function tryFetchNpcConfig(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    
    // Check Content-Type - if it's HTML, it's probably Vite's fallback
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return null;
    }
    
    // Double-check by reading first few bytes to ensure it's not HTML
    const clone = response.clone();
    const text = await clone.text();
    const trimmed = text.trim();
    
    // If starts with HTML tags, it's Vite's 404 fallback page
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return null;
    }
    
    // Valid INI file
    return response;
  } catch {
    // Ignore fetch errors
  }
  return null;
}
