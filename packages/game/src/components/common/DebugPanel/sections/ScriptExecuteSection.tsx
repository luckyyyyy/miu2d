/**
 * 执行脚本区块 — 支持 TXT (DSL) / Lua 双模式 tab 切换
 */

import { logger } from "@miu2d/engine/core/logger";
import { LUA_LANGUAGE_ID } from "@miu2d/shared/lib/monaco/luaLanguage";
import type { OnMount } from "@monaco-editor/react";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { ScriptEditor } from "../../ScriptEditor/index";
import {
  btnClass,
  btnPrimary,
  LS_SCRIPT_CONTENT,
  LS_SCRIPT_CONTENT_LUA,
  LS_SCRIPT_HISTORY,
  LS_SCRIPT_HISTORY_LUA,
  LS_SCRIPT_TAB,
  MAX_HISTORY,
} from "../constants";
import { Section } from "../Section";

type ScriptTab = "txt" | "lua";

interface ScriptExecuteSectionProps {
  isScriptRunning: boolean;
  onExecuteScript: (script: string) => Promise<string | null>;
  onExecuteLuaScript?: (script: string) => Promise<string | null>;
}

// --- helpers for per-tab localStorage keys ---
const contentKey = (tab: ScriptTab) =>
  tab === "lua" ? LS_SCRIPT_CONTENT_LUA : LS_SCRIPT_CONTENT;
const historyKey = (tab: ScriptTab) =>
  tab === "lua" ? LS_SCRIPT_HISTORY_LUA : LS_SCRIPT_HISTORY;

const readLS = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const readLSJson = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

export const ScriptExecuteSection: React.FC<ScriptExecuteSectionProps> = ({
  isScriptRunning,
  onExecuteScript,
  onExecuteLuaScript,
}) => {
  // 当前 tab
  const [activeTab, setActiveTab] = useState<ScriptTab>(() =>
    (readLS(LS_SCRIPT_TAB, "txt") as ScriptTab) === "lua" ? "lua" : "txt",
  );

  // 每个 tab 独立的脚本内容
  const [txtContent, setTxtContent] = useState(() => readLS(LS_SCRIPT_CONTENT, ""));
  const [luaContent, setLuaContent] = useState(() => readLS(LS_SCRIPT_CONTENT_LUA, ""));

  // 每个 tab 独立的历史记录
  const [txtHistory, setTxtHistory] = useState<string[]>(() =>
    readLSJson(LS_SCRIPT_HISTORY, []),
  );
  const [luaHistory, setLuaHistory] = useState<string[]>(() =>
    readLSJson(LS_SCRIPT_HISTORY_LUA, []),
  );

  const [isExecuting, setIsExecuting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const executeRef = useRef<() => void>(null);

  // --- derived ---
  const scriptContent = activeTab === "lua" ? luaContent : txtContent;
  const userScriptHistory = activeTab === "lua" ? luaHistory : txtHistory;

  const showToast = useCallback((message: string, duration = 1500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), duration);
  }, []);

  // 保存脚本内容到 localStorage
  const handleScriptContentChange = useCallback(
    (value: string) => {
      if (activeTab === "lua") {
        setLuaContent(value);
      } else {
        setTxtContent(value);
      }
      try {
        localStorage.setItem(contentKey(activeTab), value);
      } catch {
        // ignore
      }
    },
    [activeTab],
  );

  // 添加到历史记录
  const addToHistory = useCallback(
    (script: string) => {
      const trimmed = script.trim();
      if (!trimmed) return;
      const setter = activeTab === "lua" ? setLuaHistory : setTxtHistory;
      setter((prev) => {
        const filtered = prev.filter((s) => s !== trimmed);
        const newHistory = [trimmed, ...filtered].slice(0, MAX_HISTORY);
        try {
          localStorage.setItem(historyKey(activeTab), JSON.stringify(newHistory));
        } catch {
          // ignore
        }
        return newHistory;
      });
    },
    [activeTab],
  );

  const restoreFromHistory = (script: string) => handleScriptContentChange(script);

  const clearHistory = () => {
    if (activeTab === "lua") {
      setLuaHistory([]);
    } else {
      setTxtHistory([]);
    }
    try {
      localStorage.removeItem(historyKey(activeTab));
    } catch {
      // ignore
    }
  };

  // 切换 tab
  const switchTab = (tab: ScriptTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(LS_SCRIPT_TAB, tab);
    } catch {
      // ignore
    }
  };

  const handleExecuteScript = useCallback(async () => {
    if (!scriptContent.trim()) return;
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    const executor =
      activeTab === "lua" ? onExecuteLuaScript : onExecuteScript;
    if (!executor) {
      showToast("✗ 该模式不可用", 2000);
      return;
    }
    setIsExecuting(true);
    try {
      const error = await executor(scriptContent.trim());
      if (error) {
        logger.warn(`[DebugPanel] 脚本执行返回错误: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        showToast(`✗ 脚本错误: ${error}`, 3000);
      } else {
        addToHistory(scriptContent.trim());
        await new Promise((resolve) => setTimeout(resolve, 100));
        showToast("✓ 脚本执行完成");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error(`[DebugPanel] 脚本执行异常: ${errorMsg}`);
      showToast(`✗ 脚本异常: ${errorMsg}`, 3000);
    } finally {
      setIsExecuting(false);
    }
  }, [scriptContent, isScriptRunning, activeTab, onExecuteScript, onExecuteLuaScript, addToHistory, showToast]);

  executeRef.current = handleExecuteScript;

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editor.addAction({
      id: "execute-script",
      label: "Execute Script",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        executeRef.current?.();
      },
    });
  }, []);

  const placeholder =
    activeTab === "lua"
      ? 'Talk(0, "测试")\nSetMoney(10000)'
      : 'Talk(0,"测试")\nSetMoney(10000)';

  return (
    <>
      <Section title="执行脚本">
        {/* Tab 栏 */}
        <div className="flex items-center gap-0 mb-1 border-b border-[#2d2d2d]">
          <button
            type="button"
            onClick={() => switchTab("txt")}
            className={`px-3 py-1 text-[11px] transition-colors border-b-2 ${
              activeTab === "txt"
                ? "text-[#d4d4d4] border-[#007acc]"
                : "text-[#969696] border-transparent hover:text-[#d4d4d4]"
            }`}
          >
            TXT 脚本
          </button>
          <button
            type="button"
            onClick={() => switchTab("lua")}
            className={`px-3 py-1 text-[11px] transition-colors border-b-2 ${
              activeTab === "lua"
                ? "text-[#d4d4d4] border-[#007acc]"
                : "text-[#969696] border-transparent hover:text-[#d4d4d4]"
            }`}
          >
            Lua 脚本
          </button>
        </div>

        <div className="space-y-1">
          <ScriptEditor
            key={activeTab}
            value={scriptContent}
            onChange={handleScriptContentChange}
            language={activeTab === "lua" ? LUA_LANGUAGE_ID : undefined}
            height={180}
            fontSize={12}
            minimap={false}
            wordWrap="on"
            onMount={handleEditorMount}
            options={{
              glyphMargin: false,
              folding: false,
              lineNumbersMinChars: 3,
              lineDecorationsWidth: 4,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: { vertical: "hidden", horizontal: "auto" },
              padding: { top: 4, bottom: 4 },
              placeholder,
            }}
            className="border border-[#333] rounded"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleExecuteScript}
              disabled={isExecuting || !scriptContent.trim()}
              className={`${btnPrimary} flex-1`}
            >
              {isExecuting ? "执行中..." : "执行 (Ctrl+Enter)"}
            </button>
            <button
              type="button"
              onClick={() => handleScriptContentChange("")}
              className={`${btnClass} px-3`}
            >
              清空
            </button>
          </div>
        </div>

        {/* 历史记录 */}
        {userScriptHistory.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#969696]">
                历史记录 ({userScriptHistory.length})
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[9px] text-[#7a7a7a] hover:text-[#f87171] transition-colors"
              >
                清空
              </button>
            </div>
            <div
              className="max-h-24 overflow-y-auto bg-[#1e1e1e] border border-[#333] rounded"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
            >
              {userScriptHistory.map((script, idx) => (
                <div
                  key={`history-${idx}-${script.slice(0, 20)}`}
                  onClick={() => restoreFromHistory(script)}
                  className="px-2 py-1 text-[10px] font-mono text-[#969696] hover:bg-[#2a2d2e] hover:text-[#d4d4d4] cursor-pointer border-b border-[#2d2d2d] last:border-b-0 truncate"
                  title={script}
                >
                  {script.length > 50 ? `${script.slice(0, 50)}...` : script}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Toast 通知 */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
          <div className="bg-[#252526] text-[#4ade80] px-4 py-2 rounded-lg shadow-lg border border-[#333] text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
};
