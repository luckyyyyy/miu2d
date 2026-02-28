/**
 * Dashboard 顶部栏
 */

import { trpc, useAuth } from "@miu2d/shared";
import { Avatar } from "@miu2d/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AccountSettingsModal } from "./components/AccountSettingsModal";
import { ImportAllModal } from "./components/ImportAllModal";
import { useDashboard } from "./DashboardContext";
import { GameSelectorWithData } from "./GameSelector";
import { DashboardIcons } from "./icons";

export function DashboardHeader() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { showImportAll, setShowImportAll } = useDashboard();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  return (
    <header className="flex h-10 items-center justify-between border-b border-panel-border bg-[#3c3c3c] px-2">
      <div className="flex items-center gap-2">
        {/* 游戏空间选择器（logo 集成在内部） */}
        <GameSelectorWithData onCreateGame={() => setShowCreateModal(true)} />
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-2">
        {/* 搜索按钮 */}
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#4a4a4a] text-[#858585] hover:text-white transition-colors"
          title={t("nav.features")}
        >
          {DashboardIcons.search}
        </button>

        {/* 批量导入按钮 */}
        <button
          type="button"
          onClick={() => setShowImportAll(true)}
          className="p-1.5 rounded hover:bg-[#4a4a4a] text-[#858585] hover:text-white transition-colors"
          title="批量导入资源"
        >
          {DashboardIcons.upload}
        </button>

        {/* 用户菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-[#4a4a4a] transition-colors"
          >
            <Avatar name={user?.name || "?"} avatarUrl={user?.settings?.avatarUrl} size={24} />
            <span className="text-sm text-[#cccccc] max-w-[100px] truncate">
              {user?.name || "—"}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#252526] border border-widget-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-3 border-b border-widget-border flex items-center gap-3">
                <Avatar name={user?.name || "?"} avatarUrl={user?.settings?.avatarUrl} size={36} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user?.name}</div>
                  <div className="text-xs text-[#858585] truncate">{user?.email}</div>
                </div>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowSettings(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[#2a2d2e] transition-colors text-sm text-[#cccccc]"
                >
                  {DashboardIcons.settings}
                  <span>{t("settings.title")}</span>
                </button>
                <div className="my-1 border-t border-widget-border" />
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[#2a2d2e] transition-colors text-sm text-red-400"
                >
                  {DashboardIcons.back}
                  <span>{t("auth.logout")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建游戏模态框 - TODO */}
      {showCreateModal && <CreateGameModal onClose={() => setShowCreateModal(false)} />}

      {/* 账号设置弹窗 */}
      {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}

      {/* 批量导入弹窗 */}
      {showImportAll && (
        <ImportAllModal
          onClose={() => setShowImportAll(false)}
          onSuccess={() => {}}
        />
      )}
    </header>
  );
}

interface CreateGameModalProps {
  onClose: () => void;
}

function CreateGameModal({ onClose }: CreateGameModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (newGame) => {
      utils.game.list.invalidate();
      onClose();
      navigate(`/dashboard/${newGame.slug}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createGameMutation.mutate({ name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-[#252526] border border-widget-border rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-widget-border">
          <h2 className="text-lg font-medium">创建新游戏</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1">
              游戏名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入游戏名称"
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white placeholder-[#858585] focus:outline-none focus:border-focus-border"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1">游戏描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入游戏描述（可选）"
              rows={3}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white placeholder-[#858585] focus:outline-none focus:border-focus-border resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createGameMutation.isPending || !name.trim()}
              className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              {createGameMutation.isPending ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
