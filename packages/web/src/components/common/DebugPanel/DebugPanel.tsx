/**
 * Debug Panel - 调试面板 UI 组件
 * Based on JxqyHD Helper/cheat.txt
 *
 * VSCode 风格简洁设计
 */

import type React from "react";
import {
  CharacterSection,
  GameDebugSection,
  GameInfoSection,
  PerformanceSection,
  ResourceSection,
  ScriptExecuteSection,
  ScriptInfoSection,
  XiuLianSection,
} from "./sections";
import type { DebugPanelProps } from "./types";

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isGodMode,
  playerStats,
  playerPosition,
  loadedResources,
  resourceStats,
  performanceStats,
  gameVariables,
  xiuLianMagic,
  triggeredTrapIds,
  currentScriptInfo,
  scriptHistory,
  onClose,
  onFullAll,
  onSetLevel,
  onAddMoney,
  onToggleGodMode,
  onKillAllEnemies,
  onExecuteScript,
  onAddItem,
  onAddMagic,
  onAddAllMagics,
  onXiuLianLevelUp,
  onXiuLianLevelDown,
  onReduceLife,
  onReloadMagicConfig,
}) => {
  // 检查脚本是否正在执行
  const isScriptRunning = !!(currentScriptInfo && !currentScriptInfo.isCompleted);

  return (
    <div className="w-full h-full flex flex-col text-white/80 text-xs font-sans">
      <div
        className="flex-1 overflow-y-auto px-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}
      >
        {/* 性能统计 */}
        {performanceStats && <PerformanceSection performanceStats={performanceStats} />}

        {/* 角色状态 */}
        {playerStats && (
          <CharacterSection playerStats={playerStats} playerPosition={playerPosition} />
        )}

        {/* 游戏信息（地图信息 + 游戏变量） */}
        <GameInfoSection
          loadedResources={loadedResources}
          triggeredTrapIds={triggeredTrapIds}
          gameVariables={gameVariables}
        />

        {/* 资源加载统计 */}
        {resourceStats && <ResourceSection resourceStats={resourceStats} />}

        {/* 游戏调试（快捷操作 + 物品/武功） */}
        <GameDebugSection
          isGodMode={isGodMode}
          onFullAll={onFullAll}
          onToggleGodMode={onToggleGodMode}
          onKillAllEnemies={onKillAllEnemies}
          onSetLevel={onSetLevel}
          onAddMoney={onAddMoney}
          onReduceLife={onReduceLife}
          onAddItem={onAddItem}
          onAddMagic={onAddMagic}
          onAddAllMagics={onAddAllMagics}
          onReloadMagicConfig={onReloadMagicConfig}
        />

        {/* 修炼武功 */}
        {xiuLianMagic?.magic && (
          <XiuLianSection
            xiuLianMagic={xiuLianMagic}
            onXiuLianLevelUp={onXiuLianLevelUp}
            onXiuLianLevelDown={onXiuLianLevelDown}
          />
        )}

        {/* 脚本（当前脚本 + 脚本历史） */}
        <ScriptInfoSection
          currentScriptInfo={currentScriptInfo ?? null}
          scriptHistory={scriptHistory}
          isScriptRunning={isScriptRunning}
          onExecuteScript={onExecuteScript}
        />

        {/* 执行脚本 */}
        {onExecuteScript && (
          <ScriptExecuteSection
            isScriptRunning={isScriptRunning}
            onExecuteScript={onExecuteScript}
          />
        )}
      </div>
    </div>
  );
};
