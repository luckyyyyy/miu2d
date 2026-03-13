/**
 * 新游戏脚本面板 和 UI 设置面板
 * NewGameScriptPanel, UISettingsPanel
 */

import type { GameConfigDataFull } from "@miu2d/types";
import { useCallback } from "react";
import { ScriptEditor } from "../../components/common";
import { SectionTitle } from "./FormComponents";

export function NewGameScriptPanel({
  config,
  updateConfig,
}: {
  config: GameConfigDataFull;
  updateConfig: <K extends keyof GameConfigDataFull>(k: K, v: GameConfigDataFull[K]) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <SectionTitle desc="新游戏开始时执行的脚本内容（JXQY 脚本语法）" />
      <div className="border border-widget-border rounded flex-1 min-h-0">
        <ScriptEditor
          value={config.newGameScript}
          onChange={(v) => updateConfig("newGameScript", v)}
          height="100%"
          className="h-full"
        />
      </div>
    </div>
  );
}

export function UISettingsPanel({
  config,
  updateConfig,
}: {
  config: GameConfigDataFull;
  updateConfig: <K extends keyof GameConfigDataFull>(k: K, v: GameConfigDataFull[K]) => void;
}) {
  // 将 uiTheme 对象序列化为 JSON 字符串供编辑器显示
  const jsonStr =
    config.uiTheme && typeof config.uiTheme === "object"
      ? JSON.stringify(config.uiTheme, null, 2)
      : "";

  const handleJsonChange = useCallback(
    (v: string) => {
      if (!v.trim()) {
        updateConfig("uiTheme", null);
        return;
      }
      try {
        const parsed = JSON.parse(v);
        updateConfig("uiTheme", parsed);
      } catch {
        // JSON 格式错误时仍保存原文，下次打开会重新序列化（丢弃不合法的部分）
        // 不阻塞编辑，Monaco 会标红语法错误
      }
    },
    [updateConfig]
  );

  return (
    <div className="flex flex-col h-full">
      <SectionTitle desc="UI 主题配置（JSON 格式）。定义游戏界面各面板的位置、大小和图片资源。" />
      <div className="border border-widget-border rounded flex-1 min-h-0">
        <ScriptEditor
          value={jsonStr}
          onChange={handleJsonChange}
          language="json"
          height="100%"
          className="h-full"
        />
      </div>
    </div>
  );
}
