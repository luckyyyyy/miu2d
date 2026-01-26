/**
 * useGameLoop - Custom hook for the game loop
 * Extracted from Game.tsx for better code organization
 */
import { useEffect, useRef } from "react";
import type { InputState, NpcData, Vector2 } from "../../engine/core/types";
import { CharacterState } from "../../engine/core/types";
import type { GameManager } from "../../engine/game/gameManager";
import { renderMapInterleaved, type MapRenderer } from "../../engine/renderer";
import type { CharacterRenderer } from "../../engine/characterRenderer";
import type { ObjRenderer } from "../../engine/objRenderer";

interface UseGameLoopParams {
  gameManagerRef: React.RefObject<GameManager | null>;
  mapRendererRef: React.RefObject<MapRenderer | null>;
  characterRendererRef: React.RefObject<CharacterRenderer | null>;
  objRendererRef: React.RefObject<ObjRenderer | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  inputRef: React.RefObject<InputState>;
  width: number;
  height: number;
  forceUpdate: () => void;
}

/**
 * Draw character placeholder (fallback when sprites not loaded)
 */
export const drawCharacterPlaceholder = (
  ctx: CanvasRenderingContext2D,
  character: { pixelPosition: Vector2; direction: number; state: CharacterState; config: { name: string } },
  camera: { x: number; y: number },
  width: number,
  height: number
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

/**
 * Custom hook for the game loop
 */
export function useGameLoop({
  gameManagerRef,
  mapRendererRef,
  characterRendererRef,
  objRendererRef,
  canvasRef,
  inputRef,
  width,
  height,
  forceUpdate,
}: UseGameLoopParams) {
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

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

      // Get player for camera and rendering
      const player = gameManager.getPlayerController().getPlayer();

      // Update camera - check if script is controlling it
      if (gameManager.isCameraMovingByScript()) {
        // MoveScreen command is controlling the camera
        const newCameraPos = gameManager.updateCameraMovement(
          renderer.camera.x,
          renderer.camera.y,
          cappedDeltaTime * 1000 // Convert to milliseconds
        );
        if (newCameraPos) {
          renderer.camera.x = newCameraPos.x;
          renderer.camera.y = newCameraPos.y;
        }
      } else {
        // Normal camera follow player
        const targetCameraX = player.pixelPosition.x - width / 2;
        const targetCameraY = player.pixelPosition.y - height / 2;

        // Smooth camera follow
        renderer.camera.x += (targetCameraX - renderer.camera.x) * 0.1;
        renderer.camera.y += (targetCameraY - renderer.camera.y) * 0.1;
      }

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
          drawCharacterPlaceholder(ctx, npc, renderer.camera, width, height);
        }
        drawCharacterPlaceholder(ctx, player, renderer.camera, width, height);
      }

      // Draw screen effects (fade in/out, color tinting)
      gameManager.drawScreenEffects(ctx, width, height);

      // Force UI update
      forceUpdate();

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameManagerRef, mapRendererRef, characterRendererRef, objRendererRef, canvasRef, inputRef, width, height, forceUpdate]);

  return { animationFrameRef };
}
