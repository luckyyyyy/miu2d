/**
 * 数据统计页面
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";

export function StatisticsHomePage() {
  const { gameId } = useParams();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">数据统计</h1>

        {/* 概览卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "总玩家数", value: "1,234", change: "+12%" },
            { label: "今日活跃", value: "567", change: "+5%" },
            { label: "平均游戏时长", value: "45分钟", change: "+8%" },
            { label: "完成度", value: "23%", change: "-" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 bg-[#252526] border border-[#454545] rounded-lg"
            >
              <p className="text-sm text-[#858585] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#4ec9b0] mt-1">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">玩家活跃趋势</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">关卡完成分布</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerDataPage() {
  // 模拟玩家数据
  const players = [
    { id: "p001", name: "玩家A", level: 25, playtime: "12小时", lastLogin: "2小时前" },
    { id: "p002", name: "玩家B", level: 18, playtime: "8小时", lastLogin: "1天前" },
    { id: "p003", name: "玩家C", level: 42, playtime: "36小时", lastLogin: "30分钟前" },
    { id: "p004", name: "玩家D", level: 12, playtime: "4小时", lastLogin: "3天前" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">玩家数据</h1>

        {/* 搜索和筛选 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
              {DashboardIcons.search}
            </span>
            <input
              type="text"
              placeholder="搜索玩家..."
              className="w-full pl-10 pr-4 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white placeholder-[#858585] focus:outline-none focus:border-[#0098ff]"
            />
          </div>
          <select className="px-4 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]">
            <option value="">全部等级</option>
            <option value="1-10">1-10级</option>
            <option value="11-20">11-20级</option>
            <option value="21-30">21-30级</option>
            <option value="30+">30级以上</option>
          </select>
        </div>

        {/* 玩家列表 */}
        <div className="bg-[#252526] border border-[#454545] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-[#858585] border-b border-[#454545]">
                <th className="px-4 py-3">玩家名</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">游戏时长</th>
                <th className="px-4 py-3">最后登录</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr
                  key={player.id}
                  className="border-b border-[#454545] last:border-0 hover:bg-[#2a2d2e] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#858585]">{DashboardIcons.user}</span>
                      <span className="text-[#cccccc]">{player.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#4ec9b0]">Lv.{player.level}</td>
                  <td className="px-4 py-3 text-[#858585]">{player.playtime}</td>
                  <td className="px-4 py-3 text-[#858585]">{player.lastLogin}</td>
                  <td className="px-4 py-3">
                    <button className="text-[#0098ff] hover:underline text-sm">
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PlayerSavesPage() {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const savesQuery = trpc.save.adminList.useQuery(
    { gameSlug, page, pageSize: 20 },
    { enabled: !!gameSlug },
  );

  const saveDetailQuery = trpc.save.adminGet.useQuery(
    { saveId: selectedSaveId! },
    { enabled: !!selectedSaveId },
  );

  const deleteMutation = trpc.save.adminDelete.useMutation({
    onSuccess: () => {
      utils.save.adminList.invalidate();
      setConfirmDelete(null);
      setSelectedSaveId(null);
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN");
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = Date.now();
      const then = new Date(dateStr).getTime();
      const diff = now - then;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "刚刚";
      if (minutes < 60) return `${minutes}分钟前`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}天前`;
      return formatDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  // 客户端过滤（简单搜索）
  const filteredItems = savesQuery.data?.items.filter((save) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (save.userName ?? "").toLowerCase().includes(q) ||
      save.name.toLowerCase().includes(q) ||
      (save.playerName ?? "").toLowerCase().includes(q) ||
      (save.mapName ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = savesQuery.data ? Math.ceil(savesQuery.data.total / 20) : 1;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl">
        {/* 标题和统计 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">玩家存档管理</h1>
            <p className="text-sm text-[#858585] mt-1">
              查看和管理所有玩家的存档数据
              {savesQuery.data && (
                <span className="ml-2">
                  · 共 <span className="text-[#4ec9b0]">{savesQuery.data.total}</span> 个存档
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 搜索 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
              {DashboardIcons.search}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索玩家名、存档名、角色名、地图..."
              className="w-full pl-10 pr-4 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm placeholder-[#858585] focus:outline-none focus:border-[#0098ff]"
            />
          </div>
          <button
            onClick={() => savesQuery.refetch()}
            className="px-3 py-2 text-sm bg-[#3c3c3c] border border-[#454545] rounded text-[#cccccc] hover:bg-[#454545] transition-colors"
          >
            刷新
          </button>
        </div>

        {/* 存档卡片网格 */}
        {savesQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#252526] border border-[#454545] rounded-lg p-4 animate-pulse">
                <div className="h-32 bg-[#3c3c3c] rounded mb-3" />
                <div className="h-4 bg-[#3c3c3c] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#3c3c3c] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems?.length === 0 ? (
          <div className="bg-[#252526] border border-[#454545] rounded-lg p-12 text-center">
            <div className="text-[#858585] text-4xl mb-3">📂</div>
            <p className="text-[#858585]">{search ? "没有匹配的存档" : "暂无存档"}</p>
            <p className="text-[#555] text-sm mt-1">
              {search ? "尝试修改搜索关键词" : "玩家在游戏中存档后将显示在这里"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems?.map((save) => (
              <div
                key={save.id}
                className="bg-[#252526] border border-[#454545] rounded-lg overflow-hidden hover:border-[#0098ff]/50 transition-colors group"
              >
                {/* 截图预览 */}
                <div
                  className="h-36 bg-[#1a1a1a] relative cursor-pointer"
                  onClick={() => setSelectedSaveId(save.id)}
                >
                  {save.screenshot ? (
                    <img
                      src={save.screenshot}
                      alt={save.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-12 opacity-30">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                      </svg>
                    </div>
                  )}
                  {/* 分享状态角标 */}
                  {save.isShared && (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-green-600/80 text-white rounded">
                      已分享
                    </span>
                  )}
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-sm bg-black/50 px-3 py-1.5 rounded">查看详情</span>
                  </div>
                </div>

                {/* 信息区域 */}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#cccccc] font-medium text-sm truncate">{save.name}</h3>
                      <p className="text-[#858585] text-xs mt-0.5 flex items-center gap-1">
                        <span className="text-[#4ec9b0]">{save.userName ?? "未知用户"}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(save.updatedAt)}</span>
                      </p>
                    </div>
                  </div>

                  {/* 角色信息标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {save.playerName && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#cccccc] rounded border border-[#454545]">
                        👤 {save.playerName}
                      </span>
                    )}
                    {save.level != null && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#4ec9b0] rounded border border-[#454545]">
                        Lv.{save.level}
                      </span>
                    )}
                    {save.mapName && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#858585] rounded border border-[#454545]">
                        📍 {save.mapName}
                      </span>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSaveId(save.id)}
                      className="flex-1 px-2 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                    >
                      查看数据
                    </button>
                    <a
                      href={`/game/${gameSlug}?loadSave=${save.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-2 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#454545] text-[#cccccc] rounded transition-colors text-center"
                    >
                      读档测试
                    </a>
                    <button
                      onClick={() => setConfirmDelete(save.id)}
                      className="px-2 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#5a1d1d] text-[#858585] hover:text-[#f48771] rounded transition-colors"
                      title="删除存档"
                    >
                      {DashboardIcons.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-[#3c3c3c] text-[#cccccc] rounded disabled:opacity-40 hover:bg-[#454545] transition-colors"
            >
              上一页
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded transition-colors ${
                      page === pageNum
                        ? "bg-[#0e639c] text-white"
                        : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#454545]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm bg-[#3c3c3c] text-[#cccccc] rounded disabled:opacity-40 hover:bg-[#454545] transition-colors"
            >
              下一页
            </button>
          </div>
        )}

        {/* 存档数据详情弹窗 */}
        {selectedSaveId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelectedSaveId(null)}
          >
            <div
              className="bg-[#1e1e1e] border border-[#454545] rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 弹窗头部 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#454545] shrink-0">
                <div>
                  <h3 className="text-white font-medium">存档详情</h3>
                  {saveDetailQuery.data && (
                    <p className="text-xs text-[#858585] mt-0.5">
                      {saveDetailQuery.data.userName} · {saveDetailQuery.data.name} · {formatDate(saveDetailQuery.data.updatedAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSaveId(null)}
                  className="text-[#858585] hover:text-white transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="flex-1 overflow-auto p-5">
                {saveDetailQuery.isLoading ? (
                  <div className="text-[#858585] text-center py-8">加载中...</div>
                ) : saveDetailQuery.data ? (
                  <div className="space-y-4">
                    {/* 摘要信息 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#252526] border border-[#454545] rounded p-3">
                        <p className="text-[#858585] text-xs mb-1">玩家</p>
                        <p className="text-[#cccccc] text-sm font-medium">{saveDetailQuery.data.userName ?? "未知"}</p>
                      </div>
                      <div className="bg-[#252526] border border-[#454545] rounded p-3">
                        <p className="text-[#858585] text-xs mb-1">角色名</p>
                        <p className="text-[#cccccc] text-sm font-medium">{saveDetailQuery.data.playerName ?? "-"}</p>
                      </div>
                      <div className="bg-[#252526] border border-[#454545] rounded p-3">
                        <p className="text-[#858585] text-xs mb-1">等级</p>
                        <p className="text-[#4ec9b0] text-sm font-medium">{saveDetailQuery.data.level ? `Lv.${saveDetailQuery.data.level}` : "-"}</p>
                      </div>
                      <div className="bg-[#252526] border border-[#454545] rounded p-3">
                        <p className="text-[#858585] text-xs mb-1">地图</p>
                        <p className="text-[#cccccc] text-sm font-medium">{saveDetailQuery.data.mapName ?? "-"}</p>
                      </div>
                    </div>

                    {/* 截图 */}
                    {saveDetailQuery.data.screenshot && (
                      <div>
                        <p className="text-[#858585] text-xs mb-2">截图</p>
                        <img
                          src={saveDetailQuery.data.screenshot}
                          alt="存档截图"
                          className="max-w-md rounded border border-[#454545]"
                        />
                      </div>
                    )}

                    {/* JSON 数据 */}
                    <div>
                      <p className="text-[#858585] text-xs mb-2">完整存档数据</p>
                      <pre className="text-xs text-[#cccccc] bg-[#1a1a1a] p-4 rounded border border-[#333] overflow-auto max-h-[40vh] whitespace-pre-wrap font-mono">
                        {JSON.stringify(saveDetailQuery.data.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-[#858585] text-center py-8">加载失败</div>
                )}
              </div>

              {/* 弹窗底部操作 */}
              {saveDetailQuery.data && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#454545] shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#858585]">
                      ID: {saveDetailQuery.data.id}
                    </span>
                    {saveDetailQuery.data.isShared && saveDetailQuery.data.shareCode && (
                      <span className="text-xs text-green-400">
                        分享码: {saveDetailQuery.data.shareCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/game/${gameSlug}?loadSave=${saveDetailQuery.data.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                    >
                      读档测试
                    </a>
                    <button
                      onClick={() => setConfirmDelete(saveDetailQuery.data!.id)}
                      className="px-3 py-1.5 text-sm bg-[#5a1d1d] hover:bg-[#742a2a] text-[#f48771] rounded transition-colors"
                    >
                      删除存档
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {confirmDelete && (
          <div
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="bg-[#1e1e1e] border border-[#454545] rounded-lg w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white font-medium mb-2">确认删除</h3>
              <p className="text-[#858585] text-sm mb-4">
                此操作将永久删除该存档，无法恢复。确定要继续吗？
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#454545] text-[#cccccc] rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ saveId: confirmDelete })}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-[#5a1d1d] hover:bg-[#742a2a] text-[#f48771] rounded transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
