/**
 * Dashboard 顶部栏
 */
import { useState } from "react";
import { DashboardIcons } from "./icons";
import { GameSelectorWithData } from "./GameSelector";
import { useAuth } from "../../contexts";

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <header className="flex h-10 items-center justify-between border-b border-[#1e1e1e] bg-[#3c3c3c] px-2">
      <div className="flex items-center gap-2">
        {/* 游戏空间选择器 */}
        <GameSelectorWithData
          onCreateGame={() => setShowCreateModal(true)}
        />
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-2">
        {/* 搜索按钮 */}
        <button
          type="button"
          className="p-1.5 rounded hover:bg-[#4a4a4a] text-[#858585] hover:text-white transition-colors"
          title="搜索"
        >
          {DashboardIcons.search}
        </button>

        {/* 用户菜单 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#4a4a4a] transition-colors"
          >
            <span className="text-[#858585]">{DashboardIcons.user}</span>
            <span className="text-sm text-[#cccccc]">
              {user?.name || "用户"}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#252526] border border-[#454545] rounded-md shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-[#454545]">
                <div className="text-sm text-white">{user?.name}</div>
                <div className="text-xs text-[#858585]">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  // TODO: 跳转到个人设置
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-[#2a2d2e] transition-colors text-sm"
              >
                {DashboardIcons.settings}
                <span>账号设置</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-[#2a2d2e] transition-colors text-sm text-red-400"
              >
                {DashboardIcons.back}
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 创建游戏模态框 - TODO */}
      {showCreateModal && (
        <CreateGameModal onClose={() => setShowCreateModal(false)} />
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      // TODO: 调用 API 创建游戏
      console.log("创建游戏:", { name, description });
      onClose();
    } catch (error) {
      console.error("创建游戏失败:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-[#252526] border border-[#454545] rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
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
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#0098ff]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[#bbbbbb] mb-1">
              游戏描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入游戏描述（可选）"
              rows={3}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#0098ff] resize-none"
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              {isSubmitting ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
