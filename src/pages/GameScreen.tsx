/**
 * GameScreen - 游戏页面
 *
 * 特点:
 * - 游戏逻辑在单例引擎中运行
 * - React只负责画布和UI
 * - 窗口调整时只更新尺寸
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Game, DebugPanel } from "../components";
import type { GameHandle } from "../components";

export default function GameScreen() {
  const navigate = useNavigate();
  const gameRef = useRef<GameHandle>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [, forceUpdate] = useState({});

  // 窗口尺寸
  const [windowSize, setWindowSize] = useState(() => ({
    width: Math.min(window.innerWidth - (showDebug ? 280 : 0), 1280),
    height: Math.min(window.innerHeight - 20, 720),
  }));

  // 监听窗口大小变化
  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: Math.min(window.innerWidth - (showDebug ? 280 : 0), 1280),
        height: Math.min(window.innerHeight - 20, 720),
      });
    };
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [showDebug]);

  // 定期更新调试面板
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 默认启用作弊模式
  useEffect(() => {
    const engine = gameRef.current?.getEngine();
    if (engine && !engine.isCheatEnabled()) {
      engine.toggleCheatMode();
    }
  });

  return (
    <div className="w-full h-full flex">
      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center relative">
        <Game
          ref={gameRef}
          width={windowSize.width}
          height={windowSize.height}
        />

        {/* Return to title button */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-[100] px-4 py-2 bg-gray-500 text-white border-none rounded-lg cursor-pointer text-sm transition-colors pointer-events-auto hover:bg-gray-600"
        >
          ← 返回标题
        </button>

        {/* Toggle Debug Panel button */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="absolute top-4 right-4 z-[100] px-3 py-2 bg-gray-700 text-white border-none rounded-lg cursor-pointer text-sm transition-colors pointer-events-auto hover:bg-gray-600"
          title={showDebug ? "隐藏调试面板" : "显示调试面板"}
        >
          {showDebug ? "🔧 ✓" : "🔧"}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="w-[280px] bg-[#0d0d1a] p-2 overflow-y-auto">
          <DebugPanel
            isGodMode={gameRef.current?.isGodMode() ?? false}
            playerStats={gameRef.current?.getPlayerStats() ?? undefined}
            playerPosition={gameRef.current?.getPlayerPosition() ?? undefined}
            loadedResources={gameRef.current?.getLoadedResources() ?? undefined}
            gameVariables={gameRef.current?.getEngine()?.getGameManager()?.getVariables() ?? undefined}
            xiuLianMagic={gameRef.current?.getEngine()?.getGameManager()?.getMagicListManager().getItemInfo(49) ?? undefined}
            onFullAll={() => gameRef.current?.cheatFullAll()}
            onSetLevel={(level) => gameRef.current?.cheatSetLevel(level)}
            onAddMoney={(amount) => gameRef.current?.cheatAddMoney(amount)}
            onToggleGodMode={() => gameRef.current?.cheatToggleGodMode()}
            onReduceLife={() => gameRef.current?.cheatReduceLife()}
            onKillAllEnemies={() => gameRef.current?.cheatKillAllEnemies()}
            onExecuteScript={(path) => gameRef.current?.executeScript(path) ?? Promise.resolve("Game not initialized")}
            onAddItem={async (itemFile) => {
              const gm = gameRef.current?.getEngine()?.getGameManager();
              if (gm) {
                const result = await gm.getGoodsListManager().addGoodToList(itemFile);
                if (result.success && result.good) {
                  gm.getGuiManager().showMessage(`获得物品: ${result.good.name}`);
                }
                forceUpdate({});
              }
            }}
            onAddMagic={async (magicFile) => {
              const gm = gameRef.current?.getEngine()?.getGameManager();
              if (gm) {
                const [isNew, , magic] = await gm.getMagicListManager().addMagicToList(magicFile);
                if (magic) {
                  gm.getGuiManager().showMessage(isNew ? `习得武功: ${magic.name}` : `已拥有: ${magic.name}`);
                }
                forceUpdate({});
              }
            }}
            onAddAllMagics={async () => {
              const gm = gameRef.current?.getEngine()?.getGameManager();
              if (gm) {
                const allMagics = [
                  "player-magic-长剑.ini",
                  "player-magic-风火雷.ini",
                  "player-magic-银钩铁划.ini",
                  "player-magic-沧海月明.ini",
                  "player-magic-烈火情天.ini",
                  "player-magic-蚀骨血仞.ini",
                  "player-magic-镇狱破天劲.ini",
                  "player-magic-孤烟逐云.ini",
                  "player-magic-潮起月盈.ini",
                  "player-magic-漫天花雨.ini",
                  "player-magic-云生结海.ini",
                  "player-magic-推山填海.ini",
                  "player-magic-绝情断意剑.ini",
                  "player-magic-逆转心经.ini",
                  "player-magic-醉蝶狂舞.ini",
                  "player-magic-金钟罩.ini",
                  "player-magic-武道德经.ini",
                  "player-magic-清心咒.ini",
                  "player-magic-魂牵梦绕.ini",
                ];
                let addedCount = 0;
                for (const file of allMagics) {
                  const [isNew] = await gm.getMagicListManager().addMagicToList(file);
                  if (isNew) addedCount++;
                }
                gm.getGuiManager().showMessage(`习得 ${addedCount} 门武功`);
                forceUpdate({});
              }
            }}
            onXiuLianLevelUp={() => {
              const gm = gameRef.current?.getEngine()?.getGameManager();
              if (gm) {
                const mlm = gm.getMagicListManager();
                const xiuLian = mlm.getItemInfo(49);
                if (xiuLian?.magic) {
                  const newLevel = Math.min(xiuLian.level + 1, xiuLian.magic.maxLevel || 10);
                  if (newLevel > xiuLian.level) {
                    mlm.setMagicLevel(xiuLian.magic.fileName, newLevel);
                    gm.getGuiManager().showMessage(`${xiuLian.magic.name} 升至 ${newLevel} 级`);
                  }
                }
                forceUpdate({});
              }
            }}
            onXiuLianLevelDown={() => {
              const gm = gameRef.current?.getEngine()?.getGameManager();
              if (gm) {
                const mlm = gm.getMagicListManager();
                const xiuLian = mlm.getItemInfo(49);
                if (xiuLian?.magic) {
                  const newLevel = Math.max(xiuLian.level - 1, 1);
                  if (newLevel < xiuLian.level) {
                    mlm.setMagicLevel(xiuLian.magic.fileName, newLevel);
                    gm.getGuiManager().showMessage(`${xiuLian.magic.name} 降至 ${newLevel} 级`);
                  }
                }
                forceUpdate({});
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
