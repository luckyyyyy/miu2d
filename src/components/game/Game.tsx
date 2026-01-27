/**
 * Game - 游戏主组件
 *
 * 架构特点:
 * 1. 游戏引擎是单例，独立于React
 * 2. React只负责画布、镜头和UI渲染
 * 3. 游戏循环在引擎中运行，不在React中
 * 4. UI通过事件订阅获取状态更新
 * 5. 窗口调整时只重新获取状态并绘制
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from "react";
import { useGameEngine } from "../../hooks";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";
import { GameUI } from "./GameUI";
import { LoadingOverlay } from "./LoadingOverlay";
import type { GameEngine } from "../../engine/game/gameEngine";

/**
 * Game component public methods (exposed via ref)
 */
export interface GameHandle {
  getEngine: () => GameEngine | null;
  isCheatEnabled: () => boolean;
  isGodMode: () => boolean;
  toggleCheatMode: () => void;
  cheatFullAll: () => void;
  cheatSetLevel: (level: number) => void;
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

export interface GameProps {
  width?: number;
  height?: number;
}

/**
 * Game Component
 */
export const Game = forwardRef<GameHandle, GameProps>(
  ({ width = 800, height = 600 }, ref) => {
    const canvasRef = useRef<GameCanvasHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 使用游戏引擎 hook
    const { engine, state, loadProgress, loadingText, isReady } = useGameEngine({
      width,
      height,
      autoStart: true,
    });

    // UI强制更新（用于部分需要刷新的场景）
    const [, setForceUpdate] = useState({});
    const forceUpdate = () => setForceUpdate({});

    // 键盘事件处理（在游戏容器上监听，避免影响debug面板等其他区域）
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!engine) return;

        // 阻止默认行为（防止方向键滚动页面等）
        e.preventDefault();
        engine.handleKeyDown(e.code, e.shiftKey);
      },
      [engine]
    );

    const handleKeyUp = useCallback(
      (e: React.KeyboardEvent) => {
        if (!engine) return;

        e.preventDefault();
        engine.handleKeyUp(e.code);
        engine.updateModifierKeys(e.shiftKey, e.altKey, e.ctrlKey);
      },
      [engine]
    );

    // 点击游戏区域时获取焦点（让键盘事件能够被捕获）
    const handleContainerClick = useCallback(() => {
      containerRef.current?.focus();
    }, []);

    // Expose methods via ref for external control (DebugPanel)
    useImperativeHandle(
      ref,
      () => ({
        getEngine: () => engine,
        isCheatEnabled: () => engine?.isCheatEnabled() ?? false,
        isGodMode: () => engine?.isGodMode() ?? false,
        toggleCheatMode: () => {
          engine?.toggleCheatMode();
          forceUpdate();
        },
        cheatFullAll: () => {
          engine?.getGameManager()?.getCheatManager().handleInput("KeyA", true);
          forceUpdate();
        },
        cheatSetLevel: (level: number) => {
          engine?.getGameManager()?.getCheatManager().cheatSetLevel(level);
          forceUpdate();
        },
        cheatAddMoney: (amount?: number) => {
          engine?.getGameManager()?.getCheatManager().cheatAddMoney(amount ?? 1000);
          engine?.getGameManager()?.incrementGoodsVersion();
          forceUpdate();
        },
        cheatToggleGodMode: () => {
          engine?.getGameManager()?.getCheatManager().handleInput("KeyG", true);
          forceUpdate();
        },
        cheatReduceLife: () => {
          engine?.getGameManager()?.getCheatManager().handleInput("KeyU", true);
          forceUpdate();
        },
        cheatKillAllEnemies: () => {
          engine?.getGameManager()?.getCheatManager().handleInput("Backspace", true);
          forceUpdate();
        },
        debugShowPosition: () => {
          engine?.getGameManager()?.getCheatManager().handleInput("KeyP", true);
          forceUpdate();
        },
        executeScript: async (scriptContent: string) => {
          if (!engine) return "引擎未初始化";
          const result = await engine.executeScript(scriptContent);
          forceUpdate();
          return result;
        },
        getPlayerStats: () => engine?.getPlayerStats() ?? null,
        getPlayerPosition: () => engine?.getPlayerPosition() ?? null,
        getLoadedResources: () => {
          const gm = engine?.getGameManager();
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
      }),
      [engine]
    );

    const isLoading = state === "loading" || !isReady;

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          outline: "none",
          userSelect: "none",
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={handleContainerClick}
      >
        {/* Game Canvas */}
        <GameCanvas ref={canvasRef} engine={engine} width={width} height={height} />

        {/* Loading Overlay */}
        <LoadingOverlay isLoading={isLoading} progress={loadProgress} text={loadingText} />

        {/* Game UI Components */}
        {!isLoading && <GameUI engine={engine} width={width} height={height} />}
      </div>
    );
  }
);

Game.displayName = "Game";
