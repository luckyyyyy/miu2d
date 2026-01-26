/**
 * useGameInput - Custom hook for handling game input
 * Extracted from Game.tsx for better code organization
 * Based on C# Player.cs input handling
 */
import { useCallback, useRef } from "react";
import type { InputState } from "../../engine/core/types";
import { pixelToTile } from "../../engine/core/utils";
import type { GameManager } from "../../engine/game/gameManager";
import type { MapRenderer } from "../../engine/renderer";

// 需要阻止默认行为的按键
const PREVENT_DEFAULT_KEYS = new Set([
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "Tab", "Escape", "Space",
]);

interface UseGameInputParams {
  gameManagerRef: React.RefObject<GameManager | null>;
  mapRendererRef: React.RefObject<MapRenderer | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * Custom hook for handling game input (keyboard and mouse)
 * C# Reference: Player.cs Update() method
 */
export function useGameInput({
  gameManagerRef,
  mapRendererRef,
  canvasRef,
}: UseGameInputParams) {
  // Input state - matches C# Player.cs input tracking
  const inputRef = useRef<InputState>({
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    isMouseDown: false, // C#: mouseState.LeftButton == ButtonState.Pressed
    isRightMouseDown: false,
    clickedTile: null,
    isShiftDown: false, // C#: keyboardState.IsKeyDown(Keys.LeftShift/RightShift)
    isAltDown: false, // C#: keyboardState.IsKeyDown(Keys.LeftAlt/RightAlt)
    isCtrlDown: false, // C#: keyboardState.IsKeyDown(Keys.LeftControl/RightControl)
  });

  // Update modifier key states
  const updateModifierKeys = useCallback((e: KeyboardEvent | React.KeyboardEvent | MouseEvent | React.MouseEvent) => {
    inputRef.current.isShiftDown = e.shiftKey;
    inputRef.current.isAltDown = e.altKey;
    inputRef.current.isCtrlDown = e.ctrlKey;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 阻止浏览器默认行为（如 F1 帮助、F5 刷新、Tab 切换焦点等）
    if (PREVENT_DEFAULT_KEYS.has(e.code) || PREVENT_DEFAULT_KEYS.has(e.key)) {
      e.preventDefault();
    }

    inputRef.current.keys.add(e.code);
    updateModifierKeys(e);

    if (gameManagerRef.current) {
      // Pass shift key state for cheat detection
      gameManagerRef.current.handleKeyDown(e.code, e.shiftKey);
    }
  }, [gameManagerRef, updateModifierKeys]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    inputRef.current.keys.delete(e.code);
    updateModifierKeys(e);
  }, [updateModifierKeys]);

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
      updateModifierKeys(e);

      // C# style: Update clickedTile while mouse is held down
      // This enables continuous walking by holding mouse button
      if (inputRef.current.isMouseDown) {
        inputRef.current.clickedTile = pixelToTile(worldX, worldY);
      }
    },
    [canvasRef, mapRendererRef, updateModifierKeys]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    updateModifierKeys(e);

    if (e.button === 0) {
      inputRef.current.isMouseDown = true;
      // Immediately set clicked tile for instant response
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && mapRendererRef.current) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldX = x + mapRendererRef.current.camera.x;
        const worldY = y + mapRendererRef.current.camera.y;
        inputRef.current.clickedTile = pixelToTile(worldX, worldY);
        inputRef.current.mouseWorldX = worldX;
        inputRef.current.mouseWorldY = worldY;
      }
    } else if (e.button === 2) {
      inputRef.current.isRightMouseDown = true;
    }
  }, [canvasRef, mapRendererRef, updateModifierKeys]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    updateModifierKeys(e);

    if (e.button === 0) {
      inputRef.current.isMouseDown = false;
      inputRef.current.clickedTile = null; // Clear clicked tile when mouse released
    } else if (e.button === 2) {
      inputRef.current.isRightMouseDown = false;
    }
  }, [updateModifierKeys]);

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
      updateModifierKeys(e);

      if (gameManagerRef.current) {
        gameManagerRef.current.handleClick(worldX, worldY, e.button === 0 ? "left" : "right");
      }
    },
    [canvasRef, mapRendererRef, gameManagerRef, updateModifierKeys]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    inputRef,
    handleKeyDown,
    handleKeyUp,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleClick,
    handleContextMenu,
  };
}
