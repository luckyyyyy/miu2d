/**
 * GameMenuPanel - 游戏菜单面板（存档 + 设置 合一）
 *
 * 以 Tab 标签页切换。GlassModal 风格居中弹窗。
 */

import { useAnimatedVisibility, useAuth } from "@miu2d/shared";
import { useEffect, useState } from "react";
import { SettingsPanel, type SettingsPanelProps } from "./common/SidePanel";
import { WebSaveLoadPanel } from "./WebSaveLoadPanel";

export type MenuTab = "save" | "settings";

export interface GameMenuPanelProps {
  visible: boolean;
  onClose: () => void;
  activeTab: MenuTab;
  onTabChange: (tab: MenuTab) => void;
  logoUrl?: string;

  // ---- save props ----
  gameSlug: string;
  canSave: boolean;
  saveBlockedReason?: string;
  onCollectSaveData: () => {
    data: Record<string, unknown>;
    screenshot?: string;
    mapName?: string;
    level?: number;
    playerName?: string;
  } | null;
  onLoadSaveData: (data: Record<string, unknown>) => Promise<boolean>;

  // ---- settings props ----
  settingsProps: SettingsPanelProps;
}

const TABS: { key: MenuTab; label: string }[] = [
  { key: "save", label: "存档" },
  { key: "settings", label: "设置" },
];

export function GameMenuPanel({
  visible,
  onClose,
  activeTab,
  onTabChange,
  logoUrl,
  gameSlug,
  canSave,
  saveBlockedReason,
  onCollectSaveData,
  onLoadSaveData,
  settingsProps,
}: GameMenuPanelProps) {
  const { shouldRender, transitionStyle } = useAnimatedVisibility(visible);
  const { isAuthenticated } = useAuth();
  const [showFeedback, setShowFeedback] = useState(false);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showFeedback) {
          setShowFeedback(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose, showFeedback]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ opacity: transitionStyle.opacity, transition: transitionStyle.transition }}
      />

      <div
        className="relative w-[520px] h-[520px] flex flex-col rounded-2xl overflow-hidden
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
        style={transitionStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab 头部 */}
        <div className="flex items-center border-b border-white/10 flex-shrink-0">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="w-6 h-6 ml-4 mr-1 rounded object-contain flex-shrink-0 opacity-80"
            />
          )}
          <div className="flex flex-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key ? "text-white/90" : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-400/80 rounded-full" />
                )}
              </button>
            ))}
          </div>
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="px-2.5 py-1 text-xs text-white/40 hover:text-white/70 hover:bg-white/10 rounded-md transition-colors mr-1"
            >
              反馈Bug
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors mr-3"
          >
            ✕
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "save" && (
            <WebSaveLoadPanel
              embedded
              gameSlug={gameSlug}
              visible={visible}
              canSave={canSave}
              saveBlockedReason={saveBlockedReason}
              onCollectSaveData={onCollectSaveData}
              onLoadSaveData={onLoadSaveData}
              onClose={onClose}
            />
          )}
          {activeTab === "settings" && <SettingsPanel {...settingsProps} />}
        </div>
      </div>

      {/* 反馈弹窗 */}
      {showFeedback && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setShowFeedback(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-[320px] p-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors text-xs"
            >
              ✕
            </button>
            <p className="text-white/80 text-sm mb-1">遇到问题？</p>
            <p className="text-white/40 text-xs mb-4">剧情走不下去、遇到Bug，微信扫码反馈</p>
            <img
              src="https://williamchan.me/assets/qrcode.jpg"
              alt="微信反馈二维码"
              className="mx-auto w-40 h-40 rounded-lg"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
