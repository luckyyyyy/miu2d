/**
 * Game Component - Main game view with map, characters, and UI
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import type { InputState, Vector2, NpcData } from "../engine/core/types";
import type { JxqyMapData } from "../engine/types";
import { TILE_WIDTH, TILE_HEIGHT, CharacterState } from "../engine/core/types";
import { tileToPixel, pixelToTile } from "../engine/core/utils";
import { GameManager } from "../engine/game/gameManager";
import { loadMap } from "../engine/map";
import { loadMapMpcs, createMapRenderer, renderMap, renderMapInterleaved, renderLayer, getViewTileRange, type MapRenderer } from "../engine/renderer";
import { CharacterRenderer, getCharacterRenderer, resetCharacterRenderer } from "../engine/characterRenderer";
import { ObjRenderer, getObjRenderer, resetObjRenderer } from "../engine/objRenderer";
import { DialogUI, SelectionUI, TopGui, BottomGui, BottomStateGui } from "./ui";

interface GameProps {
  width?: number;
  height?: number;
}

export const Game: React.FC<GameProps> = ({
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const mapRendererRef = useRef<MapRenderer | null>(null);
  const characterRendererRef = useRef<CharacterRenderer | null>(null);
  const objRendererRef = useRef<ObjRenderer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Input state
  const inputRef = useRef<InputState>({
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    isMouseDown: false,
    isRightMouseDown: false,
    clickedTile: null,
  });

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("加载地图...");

  // Force re-render for UI updates
  const [, forceUpdate] = useState({});

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
          // Script uses format like: map_001_凌绝峰连接地图.map
          // We need: /resources/map/map_001_凌绝峰连接地图.map
          let fullMapPath = mapPath;
          if (!mapPath.startsWith("/")) {
            // Extract map name without extension for folder lookup
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

      // Run game initialization script - this will load the starting map via LoadMap command
      setLoadingText("执行初始化脚本...");
      console.log("[Game] Running game initialization...");
      try {
        // The script system will handle loading the initial map
        // Begin.txt in the starting map will set player position, load resources, etc.
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Game loop
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (!gameManagerRef.current || !mapRendererRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Calculate delta time
      const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = timestamp;

      // Cap delta time to prevent large jumps
      const cappedDeltaTime = Math.min(deltaTime, 0.1);

      const gameManager = gameManagerRef.current;
      const renderer = mapRendererRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Process click if pending
      const input = inputRef.current;

      // Update game
      gameManager.update(cappedDeltaTime, input);

      // Clear click after processing
      input.clickedTile = null;

      // Update camera to follow player
      const player = gameManager.getPlayerController().getPlayer();
      const targetCameraX = player.pixelPosition.x - width / 2;
      const targetCameraY = player.pixelPosition.y - height / 2;

      // Smooth camera follow
      renderer.camera.x += (targetCameraX - renderer.camera.x) * 0.1;
      renderer.camera.y += (targetCameraY - renderer.camera.y) * 0.1;

      // Clamp camera to map bounds
      const mapData = gameManager.getMapData();
      if (mapData) {
        renderer.camera.x = Math.max(0, Math.min(renderer.camera.x, mapData.mapPixelWidth - width));
        renderer.camera.y = Math.max(0, Math.min(renderer.camera.y, mapData.mapPixelHeight - height));
      }

      // Clear canvas
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      // Prepare character/object renderers
      const charRenderer = characterRendererRef.current;
      const objRenderer = objRendererRef.current;

      // Get all NPCs early for animation update
      const allNpcs = gameManager.getNpcManager().getAllNpcs();

      // Update player animation
      if (charRenderer) {
        charRenderer.updateAnimation("player", player.state, cappedDeltaTime, player.direction);
        // Update all NPC animations
        charRenderer.updateAllNpcAnimations(allNpcs, cappedDeltaTime);
      }

      // Draw map with interleaved character rendering (C# style)
      if (!renderer.isLoading && renderer.mapData) {
        // Get objects for interleaved drawing
        const allObjs = gameManager.getObjManager().getObjsInView({
          x: renderer.camera.x,
          y: renderer.camera.y,
          width,
          height,
        });

        // Group NPCs and objects by their tile row
        const npcsByRow = new Map<number, NpcData[]>();
        for (const [, npc] of allNpcs) {
          if (!npc.isVisible) continue;
          const row = npc.tilePosition.y;
          if (!npcsByRow.has(row)) npcsByRow.set(row, []);
          npcsByRow.get(row)!.push(npc);
        }

        // Add player to the appropriate row
        const playerRow = player.tilePosition.y;

        // Use interleaved rendering
        renderMapInterleaved(ctx, renderer, (row: number, _startCol: number, _endCol: number) => {
          // Draw NPCs at this row
          const npcsAtRow = npcsByRow.get(row);
          if (npcsAtRow && charRenderer) {
            for (const npc of npcsAtRow) {
              charRenderer.drawNpc(ctx, npc, renderer.camera.x, renderer.camera.y);
            }
          }

          // Draw objects at this row
          if (objRenderer) {
            for (const obj of allObjs) {
              if (obj.tilePosition.y === row) {
                objRenderer.drawObj(ctx, obj, renderer.camera.x, renderer.camera.y);
              }
            }
          }

          // Draw player at their row
          if (row === playerRow && charRenderer) {
            charRenderer.drawPlayer(ctx, player, renderer.camera.x, renderer.camera.y);
          }
        });
      }

      // Fallback drawing if renderer not loaded
      if (!charRenderer) {
        const npcs = gameManager.getNpcManager().getAllNpcs();
        for (const [, npc] of npcs) {
          if (!npc.isVisible) continue;
          drawCharacterPlaceholder(ctx, npc, renderer.camera);
        }
        drawCharacterPlaceholder(ctx, player, renderer.camera);
      }

      // Draw screen effects (fade in/out, color tinting)
      gameManager.drawScreenEffects(ctx, width, height);

      // Force UI update
      forceUpdate({});

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height]);

  // Draw character placeholder (fallback when sprites not loaded)
  const drawCharacterPlaceholder = (
    ctx: CanvasRenderingContext2D,
    character: { pixelPosition: Vector2; direction: number; state: CharacterState; config: { name: string } },
    camera: { x: number; y: number }
  ) => {
    const screenX = character.pixelPosition.x - camera.x;
    const screenY = character.pixelPosition.y - camera.y;

    // Skip if off-screen
    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) {
      return;
    }

    // Draw character circle
    ctx.save();
    ctx.translate(screenX, screenY);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const isPlayer = character.config.name === "杨影枫";
    const color = isPlayer ? "#4a90d9" : "#d9a04a";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -20, 15, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    const dirAngles = [
      -Math.PI / 2, // North
      -Math.PI / 4, // NorthEast
      0, // East
      Math.PI / 4, // SouthEast
      Math.PI / 2, // South
      (3 * Math.PI) / 4, // SouthWest
      Math.PI, // West
      (-3 * Math.PI) / 4, // NorthWest
    ];
    const angle = dirAngles[character.direction] || 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(Math.cos(angle) * 12, -20 + Math.sin(angle) * 12);
    ctx.stroke();

    // Name tag
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(character.config.name, 0, -40);

    // Walking animation indicator
    if (character.state === CharacterState.Walk) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(0, -20, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Input handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    inputRef.current.keys.add(e.code);

    if (gameManagerRef.current) {
      gameManagerRef.current.handleKeyDown(e.code);
    }
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    inputRef.current.keys.delete(e.code);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !mapRendererRef.current) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldX = x + mapRendererRef.current.camera.x;
      const worldY = y + mapRendererRef.current.camera.y;

      inputRef.current.mouseX = x;
      inputRef.current.mouseY = y;
      inputRef.current.mouseWorldX = worldX;
      inputRef.current.mouseWorldY = worldY;
    },
    []
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      inputRef.current.isMouseDown = true;
    } else if (e.button === 2) {
      inputRef.current.isRightMouseDown = true;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      inputRef.current.isMouseDown = false;
    } else if (e.button === 2) {
      inputRef.current.isRightMouseDown = false;
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !mapRendererRef.current) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldX = x + mapRendererRef.current.camera.x;
      const worldY = y + mapRendererRef.current.camera.y;

      const tile = pixelToTile(worldX, worldY);
      inputRef.current.clickedTile = tile;
      inputRef.current.mouseWorldX = worldX;
      inputRef.current.mouseWorldY = worldY;

      if (gameManagerRef.current) {
        gameManagerRef.current.handleClick(worldX, worldY, e.button === 0 ? "left" : "right");
      }
    },
    []
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Get GUI state for rendering
  const guiState = gameManagerRef.current?.getGuiManager().getState();
  const player = gameManagerRef.current?.getPlayerController().getPlayer();

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        outline: "none",
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
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 20 }}>加载中...</div>
          <div
            style={{
              width: 200,
              height: 8,
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                width: `${loadProgress * 100}%`,
                height: "100%",
                background: "#4a90d9",
                borderRadius: 4,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: "#888" }}>
            {Math.round(loadProgress * 100)}%
          </div>
        </div>
      )}

      {/* Top GUI - buttons for State, Equip, Goods, Magic etc. */}
      {!isLoading && (
        <TopGui
          screenWidth={width}
          onStateClick={() => console.log("Open State panel")}
          onEquipClick={() => console.log("Open Equip panel")}
          onXiuLianClick={() => console.log("Open XiuLian panel")}
          onGoodsClick={() => console.log("Open Goods panel")}
          onMagicClick={() => console.log("Open Magic panel")}
          onMemoClick={() => console.log("Open Memo panel")}
          onSystemClick={() => console.log("Open System panel")}
        />
      )}

      {/* Bottom State GUI - Life/Thew/Mana orbs */}
      {!isLoading && player && (
        <BottomStateGui
          life={player.config.stats?.life ?? 1000}
          maxLife={player.config.stats?.lifeMax ?? 1000}
          thew={player.config.stats?.thew ?? 1000}
          maxThew={player.config.stats?.thewMax ?? 1000}
          mana={player.config.stats?.mana ?? 1000}
          maxMana={player.config.stats?.manaMax ?? 1000}
          screenWidth={width}
          screenHeight={height}
        />
      )}

      {/* Bottom GUI - Hotbar for items and skills */}
      {!isLoading && (
        <BottomGui
          items={[null, null, null, null, null, null, null, null]}
          screenWidth={width}
          screenHeight={height}
          onItemClick={(index) => console.log("Hotbar item click:", index)}
          onItemRightClick={(index) => console.log("Hotbar item right-click:", index)}
        />
      )}

      {/* Dialog */}
      {guiState?.dialog?.isVisible && (
        <DialogUI
          state={guiState.dialog}
          onClose={() => gameManagerRef.current?.getGuiManager().handleDialogClick()}
        />
      )}

      {/* Selection */}
      {guiState?.selection?.isVisible && (
        <SelectionUI
          state={guiState.selection}
          onSelect={(index) => gameManagerRef.current?.getGuiManager().selectByIndex(index)}
        />
      )}

      {/* Controls hint */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 16,
          background: "rgba(0, 0, 0, 0.6)",
          color: "#888",
          padding: "8px 12px",
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        <div>WASD / 方向键: 移动</div>
        <div>点击: 移动/交互</div>
        <div>空格: 确认对话</div>
        <div>I: 物品 | M: 武功</div>
      </div>
    </div>
  );
};
