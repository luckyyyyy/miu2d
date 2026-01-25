/**
 * NPC Manager - based on JxqyHD Engine/NpcManager.cs
 * Manages all NPCs in the game
 */
import type { NpcData, CharacterConfig, Vector2, Direction } from "../core/types";
import { CharacterState, CharacterKind } from "../core/types";
import {
  createNpcData,
  loadNpcConfig,
  updateCharacterMovement,
  updateCharacterAnimation,
  walkTo,
} from "./character";
import { generateId, distance } from "../core/utils";

export class NpcManager {
  private npcs: Map<string, NpcData> = new Map();
  private npcConfigCache: Map<string, CharacterConfig> = new Map();
  private isWalkable: (tile: Vector2) => boolean;
  // Optional reference to character renderer for custom action files
  private characterRenderer: any = null;

  constructor(isWalkable: (tile: Vector2) => boolean) {
    this.isWalkable = isWalkable;
  }

  /**
   * Set character renderer reference
   * This is needed to properly handle custom action files
   */
  setCharacterRenderer(renderer: any): void {
    this.characterRenderer = renderer;
  }

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(checker: (tile: Vector2) => boolean): void {
    this.isWalkable = checker;
  }

  /**
   * Get all NPCs
   */
  getAllNpcs(): Map<string, NpcData> {
    return this.npcs;
  }

  /**
   * Get NPC by name
   */
  getNpc(name: string): NpcData | null {
    for (const [, npc] of this.npcs) {
      if (npc.config.name === name) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get NPC by ID
   */
  getNpcById(id: string): NpcData | null {
    return this.npcs.get(id) || null;
  }

  /**
   * Add NPC from config file
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<NpcData | null> {
    let config: CharacterConfig | undefined = this.npcConfigCache.get(configPath);
    if (!config) {
      const loaded = await loadNpcConfig(configPath);
      if (loaded) {
        config = loaded;
        this.npcConfigCache.set(configPath, config);
      }
    }

    if (!config) {
      // loadNpcConfig already logged the error, just return null
      return null;
    }

    const id = generateId();
    const npc = createNpcData(id, config, tileX, tileY, direction);
    this.npcs.set(id, npc);

    // Log NPC creation for debugging
    console.log(`[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), id=${id}, npcIni=${config.npcIni || 'none'}`);

    // Auto-load sprites if renderer is available
    if (this.characterRenderer && config.npcIni) {
      this.characterRenderer.loadCharacterSprites(id, config.npcIni)
        .catch((err: any) => console.warn(`[NpcManager] Failed to load sprites for NPC ${config!.name}:`, err));
    }

    return npc;
  }

  /**
   * Add NPC with existing config
   */
  addNpcWithConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): NpcData {
    const id = generateId();
    const npc = createNpcData(id, config, tileX, tileY, direction);
    this.npcs.set(id, npc);

    // Log NPC creation for debugging
    console.log(`[NpcManager] Created NPC (with config): ${config.name} at (${tileX}, ${tileY}), id=${id}, npcIni=${config.npcIni || 'none'}`);

    // Auto-load sprites if renderer is available
    if (this.characterRenderer && config.npcIni) {
      this.characterRenderer.loadCharacterSprites(id, config.npcIni)
        .catch((err: any) => console.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err));
    }

    return npc;
  }

  /**
   * Delete NPC by name
   */
  deleteNpc(name: string): boolean {
    for (const [id, npc] of this.npcs) {
      if (npc.config.name === name) {
        this.npcs.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Delete NPC by ID
   */
  deleteNpcById(id: string): boolean {
    return this.npcs.delete(id);
  }

  /**
   * Clear all NPCs
   */
  clearAllNpcs(): void {
    this.npcs.clear();
  }

  /**
   * Set NPC position
   */
  setNpcPosition(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.tilePosition = { x: tileX, y: tileY };
    npc.path = [];
    return true;
  }

  /**
   * Make NPC walk to position
   */
  npcGoto(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    return walkTo(npc, { x: tileX, y: tileY }, this.isWalkable);
  }

  /**
   * Get closest interactable NPC to a position
   */
  getClosestInteractableNpc(position: Vector2, maxDistance: number = 100): NpcData | null {
    let closest: NpcData | null = null;
    let closestDist = Infinity;

    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Only eventer NPCs are interactable
      if (npc.config.kind !== CharacterKind.Eventer) continue;

      const dist = distance(position, npc.pixelPosition);
      if (dist < closestDist && dist < maxDistance) {
        closest = npc;
        closestDist = dist;
      }
    }

    return closest;
  }

  /**
   * Get NPC at tile position
   */
  getNpcAtTile(tileX: number, tileY: number): NpcData | null {
    for (const [, npc] of this.npcs) {
      if (npc.tilePosition.x === tileX && npc.tilePosition.y === tileY) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Check if tile is blocked by NPC
   */
  isObstacle(tileX: number, tileY: number): boolean {
    for (const [, npc] of this.npcs) {
      if (npc.tilePosition.x === tileX && npc.tilePosition.y === tileY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Update all NPCs
   */
  update(deltaTime: number): void {
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;

      // Update movement
      updateCharacterMovement(npc, deltaTime, this.isWalkable);

      // Update animation
      updateCharacterAnimation(npc, deltaTime);

      // AI behavior (for fighters)
      if (!npc.isAIDisabled && npc.config.kind === CharacterKind.Fighter) {
        this.updateNpcAI(npc, deltaTime);
      }
    }
  }

  /**
   * Simple NPC AI update
   */
  private updateNpcAI(npc: NpcData, _deltaTime: number): void {
    // Patrol behavior if has patrol path
    if (npc.actionPathTilePositions && npc.actionPathTilePositions.length > 0) {
      if (npc.path.length === 0) {
        // Get next patrol point
        const nextPoint = npc.actionPathTilePositions.shift()!;
        npc.actionPathTilePositions.push(nextPoint); // Loop
        walkTo(npc, nextPoint, this.isWalkable);
      }
    }
  }

  /**
   * Get visible NPCs in area
   */
  getVisibleNpcs(centerX: number, centerY: number, radius: number): NpcData[] {
    const result: NpcData[] = [];
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      const dist = distance({ x: centerX, y: centerY }, npc.pixelPosition);
      if (dist <= radius) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Disable AI for NPC (used in cutscenes)
   */
  disableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = true;
    }
  }

  /**
   * Enable AI for NPC
   */
  enableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = false;
    }
  }

  /**
   * Hide NPC
   */
  hideNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isVisible = false;
    }
  }

  /**
   * Show NPC
   */
  showNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isVisible = true;
    }
  }

  /**
   * Set NPC action file for a specific state
   * Based on Character.SetNpcActionFile() in C#
   * This sets the ASF file for a specific character state
   */
  setNpcActionFile(name: string, stateType: number, asfFile: string): boolean {
    const npc = this.getNpc(name);
    if (!npc) {
      console.warn(`[NpcManager] NPC not found: ${name}`);
      return false;
    }

    // Store custom action files (state -> asf file)
    if (!npc.customActionFiles) {
      npc.customActionFiles = new Map();
    }
    npc.customActionFiles.set(stateType, asfFile);
    console.log(`[NpcManager] SetNpcActionFile: ${name}, state=${stateType}, file=${asfFile}`);

    // Notify character renderer to load the custom ASF
    if (this.characterRenderer && this.characterRenderer.setNpcActionFile) {
      this.characterRenderer.setNpcActionFile(npc.id, stateType, asfFile);

      // Preload the ASF if this is the current state
      if (npc.state === stateType && this.characterRenderer.preloadCustomActionFile) {
        this.characterRenderer.preloadCustomActionFile(npc.id, stateType, asfFile)
          .catch((err: any) => console.error(`Failed to preload custom action file:`, err));
      }
    }

    return true;
  }

  /**
   * Get custom action file for NPC state
   */
  getNpcActionFile(name: string, stateType: number): string | null {
    const npc = this.getNpc(name);
    if (!npc || !npc.customActionFiles) return null;
    return npc.customActionFiles.get(stateType) || null;
  }

  /**
   * Set NPC action type
   * Based on Character.SetNpcActionType() in C#
   */
  setNpcActionType(name: string, actionType: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.actionType = actionType;
    return true;
  }

  /**
   * Set NPC level
   */
  setNpcLevel(name: string, level: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.config.stats.level = level;
    return true;
  }

  /**
   * Set NPC direction
   */
  setNpcDirection(name: string, direction: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.direction = direction as any;
    return true;
  }

  /**
   * Set NPC state
   */
  setNpcState(name: string, state: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.state = state as any;
    return true;
  }

  /**
   * Load NPCs from a .npc file
   * Based on C#'s NpcManager.Load and Utils.GetNpcObjFilePath
   */
  async loadNpcFile(fileName: string): Promise<boolean> {
    console.log(`[NpcManager] Loading NPC file: ${fileName}`);

    // Try multiple paths like C# GetNpcObjFilePath
    const paths = [
      `/resources/save/game/${fileName}`,
      `/resources/ini/save/${fileName}`,
    ];

    for (const filePath of paths) {
      try {
        console.log(`[NpcManager] Trying: ${filePath}`);
        const response = await fetch(filePath);

        if (!response.ok) {
          continue;
        }

        // Check if it's actually an INI file (not Vite's HTML fallback)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          continue;
        }

        // Decode with GBK
        const buffer = await response.arrayBuffer();
        let decoder: TextDecoder;
        try {
          decoder = new TextDecoder("gbk");
        } catch {
          decoder = new TextDecoder("utf-8");
        }
        const content = decoder.decode(new Uint8Array(buffer));

        // Check if content is HTML
        if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
          continue;
        }

        console.log(`[NpcManager] Parsing NPC file from: ${filePath}`);
        await this.parseNpcFile(content);
        console.log(`[NpcManager] Loaded ${this.npcs.size} NPCs`);
        return true;
      } catch (error) {
        // Continue to next path
      }
    }

    console.error(`[NpcManager] Failed to load NPC file: ${fileName} (tried all paths)`);
    return false;
  }

  /**
   * Parse NPC file content
   */
  private async parseNpcFile(content: string): Promise<void> {
    const sections = this.parseIni(content);

    const loadPromises: Promise<void>[] = [];

    for (const sectionName in sections) {
      // Match NPC followed by digits (e.g., NPC000, NPC001, etc.)
      if (/^NPC\d+$/i.test(sectionName)) {
        const section = sections[sectionName];
        const promise = this.createNpcFromSection(section);
        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Create NPC from INI section (from .npc save files)
   * Based on C# Character(KeyDataCollection) constructor
   *
   * NPC save files contain inline NPC data with NpcIni referencing resource files in npcres/
   * This is different from loading character config files from ini/npc/
   */
  private async createNpcFromSection(section: Record<string, string>): Promise<void> {
    const name = section["Name"] || "";
    const npcIni = section["NpcIni"] || "";
    const mapX = parseInt(section["MapX"] || "0", 10);
    const mapY = parseInt(section["MapY"] || "0", 10);
    const dir = parseInt(section["Dir"] || "4", 10);
    const kind = parseInt(section["Kind"] || "0", 10);
    const walkSpeed = parseInt(section["WalkSpeed"] || "1", 10);
    const dialogRadius = parseInt(section["DialogRadius"] || "1", 10);
    const visionRadius = parseInt(section["VisionRadius"] || "10", 10);
    const scriptFile = section["ScriptFile"] || "";
    const pathFinder = section["PathFinder"] === "1";
    const action = parseInt(section["Action"] || "0", 10);
    const relation = parseInt(section["Relation"] || "0", 10);

    // When loading from .npc files, NpcIni directly references resource file in npcres/
    // e.g., "npc146-武当山下酒肆老板.ini" -> "ini/npcres/npc146-武当山下酒肆老板.ini"
    // We create the config directly from section data (like C# Character(KeyDataCollection))

    const config: CharacterConfig = {
      name: name,
      npcIni: npcIni, // Resource file reference for sprite loading
      kind: kind as any,
      relation: relation as any,
      scriptFile: scriptFile,
      stats: {
        name: name,
        life: 100,
        lifeMax: 100,
        mana: 100,
        manaMax: 100,
        thew: 100,
        thewMax: 100,
        attack: 10,
        defence: 10,
        evade: 0,
        exp: 0,
        level: 1,
        walkSpeed: walkSpeed,
        visionRadius: visionRadius,
        attackRadius: dialogRadius,
        dialogRadius: dialogRadius,
      },
      pathFinder: pathFinder,
    };

    // Create NPC with inline config
    const npc = this.addNpcWithConfig(config, mapX, mapY, dir as any);
    npc.actionType = action;

    console.log(`[NpcManager] Created NPC from section: ${name} at (${mapX}, ${mapY}), npcIni=${npcIni}`);
  }

  /**
   * Simple INI parser
   */
  private parseIni(content: string): Record<string, Record<string, string>> {
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

    return sections;
  }
}
