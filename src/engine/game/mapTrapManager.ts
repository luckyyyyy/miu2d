/**
 * Map Trap Manager - Handles trap configuration and triggering
 * Extracted from GameManager
 *
 * Based on C#'s MapBase trap management (LoadTrap, SetMapTrap, RunTileTrapScript)
 */
import type { Vector2 } from "../core/types";
import type { JxqyMapData } from "../types";
import type { ScriptExecutor } from "../script/executor";

/**
 * Manages trap configurations and triggering for maps
 */
export class MapTrapManager {
  // Trap management (like C#'s _ingnoredTrapsIndex and _traps)
  private ignoredTrapIndices: Set<number> = new Set();
  private mapTraps: Map<string, Map<number, string>> = new Map(); // mapName -> (trapIndex -> scriptFile)
  private isInRunMapTrap: boolean = false; // C#'s _isInRunMapTrap - prevents trap re-triggering

  /**
   * Clear ignored trap indices (called when loading a new map)
   */
  clearIgnoredTraps(): void {
    this.ignoredTrapIndices.clear();
  }

  /**
   * Clear all trap mappings and ignored list
   */
  clearAll(): void {
    this.ignoredTrapIndices.clear();
    this.mapTraps.clear();
  }

  /**
   * Check if currently executing a trap script
   */
  isInTrapExecution(): boolean {
    return this.isInRunMapTrap;
  }

  /**
   * Set trap execution flag
   */
  setInTrapExecution(value: boolean): void {
    this.isInRunMapTrap = value;
  }

  /**
   * Load trap configuration from Traps.ini
   * Based on C#'s MapBase.LoadTrap
   */
  async loadTraps(basePath: string, parseIni: (content: string) => Record<string, Record<string, string>>): Promise<void> {
    try {
      const trapsPath = `${basePath}/Traps.ini`;
      console.log(`[MapTrapManager] Loading traps from: ${trapsPath}`);

      const response = await fetch(trapsPath);
      if (!response.ok) {
        console.warn(`[MapTrapManager] Traps.ini not found at ${trapsPath}, using defaults`);
        return;
      }

      const content = await response.text();
      const sections = parseIni(content);

      // Clear existing trap mappings and ignored list (like C# does)
      this.ignoredTrapIndices.clear();
      this.mapTraps.clear();

      // Load trap mappings for each map
      for (const mapName in sections) {
        const trapMapping = new Map<number, string>();
        const section = sections[mapName];

        for (const key in section) {
          const trapIndex = parseInt(key, 10);
          const scriptFile = section[key];
          if (!isNaN(trapIndex)) {
            trapMapping.set(trapIndex, scriptFile);
          }
        }

        if (trapMapping.size > 0) {
          this.mapTraps.set(mapName, trapMapping);
        }
      }

      console.log(`[MapTrapManager] Loaded trap config for ${this.mapTraps.size} maps`);
    } catch (error) {
      console.error(`[MapTrapManager] Error loading traps:`, error);
    }
  }

  /**
   * Set trap script for a map (called by SetTrap/SetMapTrap script commands)
   * Based on C#'s MapBase.SetMapTrap
   */
  setMapTrap(trapIndex: number, trapFileName: string, currentMapName: string, targetMapName?: string): void {
    const targetMap = targetMapName || currentMapName;
    if (!targetMap) return;

    // If setting for current map, remove from ignored list (re-activate)
    if (!targetMapName || targetMapName === currentMapName) {
      this.ignoredTrapIndices.delete(trapIndex);
    }

    // Get or create trap mapping for this map
    if (!this.mapTraps.has(targetMap)) {
      this.mapTraps.set(targetMap, new Map());
    }
    const traps = this.mapTraps.get(targetMap)!;

    if (!trapFileName) {
      // Remove trap
      traps.delete(trapIndex);
    } else {
      // Set/update trap
      traps.set(trapIndex, trapFileName);
    }
  }

  /**
   * Get trap script file name for a given index
   * Checks custom trap mapping first (from SetTrap/SetMapTrap), then defaults
   */
  getTrapScriptFileName(trapIndex: number, currentMapName: string): string | null {
    // Check if trap is in ignored list
    if (this.ignoredTrapIndices.has(trapIndex)) {
      return null;
    }

    // Check if there's a custom trap mapping for current map
    const mapTraps = this.mapTraps.get(currentMapName);

    if (mapTraps && mapTraps.has(trapIndex)) {
      const customScript = mapTraps.get(trapIndex)!;
      console.log(`[MapTrapManager] Using custom trap script: ${customScript}`);
      // Empty string means trap is removed
      if (customScript === "") return null;
      return customScript;
    }

    // Default trap file naming
    const defaultScript = `Trap${trapIndex.toString().padStart(2, "0")}.txt`;
    console.log(`[MapTrapManager] Using default trap script: ${defaultScript}`);
    return defaultScript;
  }

  /**
   * Check and trigger trap at tile
   * Based on C#'s MapBase.RunTileTrapScript
   *
   * @returns true if a trap was triggered
   */
  checkTrap(
    tile: Vector2,
    mapData: JxqyMapData | null,
    currentMapName: string,
    scriptExecutor: ScriptExecutor,
    getScriptBasePath: () => string
  ): boolean {
    if (!mapData) {
      return false;
    }

    // C#: Don't run trap if already in trap script execution
    if (this.isInRunMapTrap) {
      return false;
    }

    // Don't run traps if waiting for input (dialog, selection, etc.)
    if (scriptExecutor.isWaitingForInput()) {
      return false;
    }

    const tileIndex = tile.x + tile.y * mapData.mapColumnCounts;
    const tileInfo = mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // Get trap script file name (handles ignored traps and custom mappings)
      const trapScriptName = this.getTrapScriptFileName(trapIndex, currentMapName);
      if (!trapScriptName) {
        return false;
      }

      // Add to ignored list so it won't trigger again (until re-activated by SetTrap)
      this.ignoredTrapIndices.add(trapIndex);

      // Set flag to prevent re-triggering during map transitions
      this.isInRunMapTrap = true;

      const basePath = getScriptBasePath();
      const scriptPath = `${basePath}/${trapScriptName}`;
      console.log(`[MapTrapManager] Triggering trap script: ${scriptPath}`);
      scriptExecutor.runScript(scriptPath);

      return true;
    }

    return false;
  }

  /**
   * Log trap info for debugging
   */
  debugLogTraps(mapData: JxqyMapData | null, currentMapName: string): void {
    if (!mapData) return;

    // Show trap tiles from map file
    const trapsInMap: { tile: string; trapIndex: number }[] = [];
    for (let i = 0; i < mapData.tileInfos.length; i++) {
      const tileInfo = mapData.tileInfos[i];
      if (tileInfo.trapIndex > 0) {
        const x = i % mapData.mapColumnCounts;
        const y = Math.floor(i / mapData.mapColumnCounts);
        trapsInMap.push({ tile: `(${x},${y})`, trapIndex: tileInfo.trapIndex });
      }
    }

    // Show trap scripts configured for this map
    const mapTraps = this.mapTraps.get(currentMapName);
    if (mapTraps && mapTraps.size > 0) {
      console.log(`[MapTrapManager] Trap scripts for "${currentMapName}":`);
      mapTraps.forEach((scriptFile, trapIndex) => {
        console.log(`[MapTrapManager]   Trap ${trapIndex} -> ${scriptFile}`);
      });
    } else {
      console.log(`[MapTrapManager] No trap scripts configured for "${currentMapName}"`);
    }
  }
}

// Singleton instance
let trapManagerInstance: MapTrapManager | null = null;

export function getMapTrapManager(): MapTrapManager {
  if (!trapManagerInstance) {
    trapManagerInstance = new MapTrapManager();
  }
  return trapManagerInstance;
}
