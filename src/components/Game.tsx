/**
 * Game Component - Main game view with map, characters, and UI
 * Refactored to use extracted hooks and components
 */
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import type { PlayerData } from "../engine/core/types";
import { GameManager } from "../engine/game/gameManager";
import { loadMap } from "../engine/map";
import { loadMapMpcs, createMapRenderer, type MapRenderer } from "../engine/renderer";
import { CharacterRenderer, getCharacterRenderer } from "../engine/characterRenderer";
import { ObjRenderer, getObjRenderer } from "../engine/objRenderer";
import { GameUI, LoadingOverlay, useGameLoop, useGameInput } from "./game";

/**
 * Game component public methods (exposed via ref)
 */
export interface GameHandle {
  getGameManager: () => GameManager | null;
  isCheatEnabled: () => boolean;
  isGodMode: () => boolean;
  toggleCheatMode: () => void;
  cheatFullAll: () => void;
  cheatLevelUp: () => void;
  cheatAddMoney: (amount?: number) => void;
  cheatToggleGodMode: () => void;
  cheatReduceLife: () => void;
  cheatKillAllEnemies: () => void;
  debugShowPosition: () => void;
  executeScript: (scriptPath: string) => Promise<string | null>;
  getPlayerStats: () => {
    level: number;
    life: number;
    lifeMax: number;
    thew: number;
    thewMax: number;
    mana: number;
    manaMax: number;
    exp: number;
    levelUpExp: number;
    money: number;
  } | null;
  getPlayerPosition: () => { x: number; y: number } | null;
  getLoadedResources: () => {
    mapName: string;
    mapPath: string;
    npcCount: number;
    objCount: number;
    npcFile: string;
    objFile: string;
  } | null;
}

interface GameProps {
  width?: number;
  height?: number;
}

export const Game = forwardRef<GameHandle, GameProps>(({
  width = 800,
  height = 600,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const mapRendererRef = useRef<MapRenderer | null>(null);
  const characterRendererRef = useRef<CharacterRenderer | null>(null);
  const objRendererRef = useRef<ObjRenderer | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("加载地图...");

  // Force re-render for UI updates
  const [, setForceUpdate] = useState({});
  const forceUpdate = () => setForceUpdate({});

  // Input handling hook
  const {
    inputRef,
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleClick,
    handleContextMenu,
  } = useGameInput({
    gameManagerRef,
    mapRendererRef,
    canvasRef,
  });

  // Expose methods via ref for external control (DebugPanel)
  useImperativeHandle(ref, () => ({
    getGameManager: () => gameManagerRef.current,
    isCheatEnabled: () => gameManagerRef.current?.isCheatEnabled() ?? false,
    isGodMode: () => gameManagerRef.current?.isGodMode() ?? false,
    toggleCheatMode: () => {
      gameManagerRef.current?.getCheatManager().toggleCheatMode();
      forceUpdate();
    },
    cheatFullAll: () => {
      gameManagerRef.current?.getCheatManager().handleInput("KeyA", true);
      forceUpdate();
    },
    cheatLevelUp: () => {
      gameManagerRef.current?.getCheatManager().handleInput("KeyL", true);
      forceUpdate();
    },
    cheatAddMoney: (amount?: number) => {
      gameManagerRef.current?.getCheatManager().cheatAddMoney(amount ?? 1000);
      gameManagerRef.current?.incrementGoodsVersion(); // Trigger UI update for money display
      forceUpdate();
    },
    cheatToggleGodMode: () => {
      gameManagerRef.current?.getCheatManager().handleInput("KeyG", true);
      forceUpdate();
    },
    cheatReduceLife: () => {
      gameManagerRef.current?.getCheatManager().handleInput("KeyU", true);
      forceUpdate();
    },
    cheatKillAllEnemies: () => {
      gameManagerRef.current?.getCheatManager().handleInput("Backspace", true);
      forceUpdate();
    },
    debugShowPosition: () => {
      gameManagerRef.current?.getCheatManager().handleInput("KeyP", true);
      forceUpdate();
    },
    executeScript: async (scriptPath: string) => {
      if (!gameManagerRef.current) {
        return "Game manager not initialized";
      }
      const result = await gameManagerRef.current.executeScript(scriptPath);
      forceUpdate();
      return result;
    },
    getPlayerStats: () => {
      const player = gameManagerRef.current?.getPlayer();
      if (!player?.config.stats) return null;
      const stats = player.config.stats;
      return {
        level: stats.level,
        life: stats.life,
        lifeMax: stats.lifeMax,
        thew: stats.thew,
        thewMax: stats.thewMax,
        mana: stats.mana,
        manaMax: stats.manaMax,
        exp: stats.exp,
        levelUpExp: stats.levelUpExp,
        money: player.money, // Money is on Player, not CharacterStats (like C#)
      };
    },
    getPlayerPosition: () => {
      const player = gameManagerRef.current?.getPlayer();
      if (!player) return null;
      return { x: player.tilePosition.x, y: player.tilePosition.y };
    },
    getLoadedResources: () => {
      const gm = gameManagerRef.current;
      if (!gm) return null;
      return {
        mapName: gm.getCurrentMapName(),
        mapPath: gm.getCurrentMapPath(),
        npcCount: gm.getNpcManager().getAllNpcs().size,
        objCount: gm.getObjManager().getAllObjs().length,
        npcFile: gm.getNpcManager().getFileName(),
        objFile: gm.getObjManager().getFileName(),
      };
    },
  }), []);

  // Initialize game
  useEffect(() => {
    const initGame = async () => {
      // Initialize global resources (TalkTextList, etc.)
      setLoadingText("加载对话数据...");
      await GameManager.initializeGlobalResources();

      // Create character renderer
      const charRenderer = getCharacterRenderer();
      characterRendererRef.current = charRenderer;
      const objRenderer = getObjRenderer();
      objRendererRef.current = objRenderer;

      // Create map renderer
      const renderer = createMapRenderer();
      renderer.camera = { x: 0, y: 0, width, height };
      mapRendererRef.current = renderer;

      // Create game manager
      const gameManager = new GameManager({
        onMapChange: async (mapPath) => {
          setIsLoading(true);
          setLoadingText("加载地图...");

          // Build full map URL - mapPath may be just filename or relative path
          let fullMapPath = mapPath;
          if (!mapPath.startsWith("/")) {
            const mapName = mapPath.replace(".map", "");
            fullMapPath = `/resources/map/${mapName}.map`;
          }
          console.log(`[Game] Loading map from: ${fullMapPath} (original: ${mapPath})`);

          const mapData = await loadMap(fullMapPath);
          if (mapData && mapRendererRef.current) {
            const mapName = fullMapPath.split("/").pop()?.replace(".map", "") || "";

            // Update map renderer with new map data (including collision data)
            mapRendererRef.current.mapData = mapData;

            // Load new map MPCs
            await loadMapMpcs(
              mapRendererRef.current,
              mapData,
              mapName,
              (progress) => setLoadProgress(progress)
            );

            // Update game manager's map name for script path resolution
            gameManager.setCurrentMapName(mapName);

            console.log(`[Game] Map switched to: ${mapName}`);
          }
          setIsLoading(false);
          return mapData;
        },
      });
      gameManagerRef.current = gameManager;

      // Connect character renderer to game manager for custom action files
      gameManager.setCharacterRenderer(charRenderer);

      // Load player sprites (required before running script)
      setLoadingText("加载角色...");
      await charRenderer.loadPlayerSprites("npc006");

      // Run game initialization script
      setLoadingText("执行初始化脚本...");
      console.log("[Game] Running game initialization...");
      try {
        await gameManager.initGame();
        console.log("[Game] Game initialization completed");
      } catch (e) {
        console.error("[Game] Failed to initialize game:", e);
        throw e;
      }

      setIsLoading(false);
    };

    initGame();

    return () => {
      // Cleanup handled by useGameLoop
    };
  }, [width, height]);

  // Game loop hook
  useGameLoop({
    gameManagerRef,
    mapRendererRef,
    characterRendererRef,
    objRendererRef,
    canvasRef,
    inputRef,
    width,
    height,
    forceUpdate,
  });

  // Get GUI state for rendering
  const guiState = gameManagerRef.current?.getGuiManager().getState();
  const player = gameManagerRef.current?.getPlayerController().getPlayer() as PlayerData | undefined;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        outline: "none",
        userSelect: "none",
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: "block",
          background: "#1a1a2e",
          cursor: "pointer",
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Loading Overlay */}
      <LoadingOverlay
        isLoading={isLoading}
        progress={loadProgress}
        text={loadingText}
      />

      {/* Game UI Components */}
      <GameUI
        isLoading={isLoading}
        width={width}
        height={height}
        guiState={guiState}
        player={player}
        gameManager={gameManagerRef.current}
      />
    </div>
  );
});

// Display name for debugging
Game.displayName = "Game";
