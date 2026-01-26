import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Game, DebugPanel } from "../components";
import type { GameHandle } from "../components";

export default function GameScreen() {
  const navigate = useNavigate();
  const gameRef = useRef<GameHandle>(null);
  const [showDebug, setShowDebug] = useState(true);
  // Force re-render for debug panel updates
  const [, forceUpdate] = useState({});

  // Initialize with actual window size to prevent double initialization
  const [windowSize, setWindowSize] = useState(() => ({
    width: Math.min(window.innerWidth - (showDebug ? 280 : 0), 1280),
    height: Math.min(window.innerHeight - 20, 720),
  }));

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

  // Update debug panel periodically
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Enable cheat mode by default (silent, no message)
  useEffect(() => {
    const gm = gameRef.current?.getGameManager();
    if (gm && !gm.isCheatEnabled()) {
      gm.getCheatManager().toggleCheatMode(true); // silent=true
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

      {/* Debug Panel - Outside game area */}
      {showDebug && (
        <div className="w-[280px] bg-[#0d0d1a] p-2 overflow-y-auto">
          <DebugPanel
            isGodMode={gameRef.current?.isGodMode() ?? false}
            playerStats={gameRef.current?.getPlayerStats() ?? undefined}
            playerPosition={gameRef.current?.getPlayerPosition() ?? undefined}
            loadedResources={gameRef.current?.getLoadedResources() ?? undefined}
            gameVariables={gameRef.current?.getGameManager()?.getVariables() ?? undefined}
            onFullAll={() => gameRef.current?.cheatFullAll()}
            onLevelUp={() => gameRef.current?.cheatLevelUp()}
            onAddMoney={(amount) => gameRef.current?.cheatAddMoney(amount)}
            onToggleGodMode={() => gameRef.current?.cheatToggleGodMode()}
            onReduceLife={() => gameRef.current?.cheatReduceLife()}
            onKillAllEnemies={() => gameRef.current?.cheatKillAllEnemies()}
            onExecuteScript={(path) => gameRef.current?.executeScript(path) ?? Promise.resolve("Game not initialized")}
            onAddItem={async (itemFile) => {
              const gm = gameRef.current?.getGameManager();
              if (gm) {
                const result = await gm.getGoodsListManager().addGoodToList(itemFile);
                if (result.success && result.good) {
                  gm.getGuiManager().showMessage(`获得物品: ${result.good.name}`);
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
