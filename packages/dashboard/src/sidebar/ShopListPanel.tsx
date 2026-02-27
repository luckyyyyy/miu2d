/**
 * 商店列表侧边栏面板
 */

import { trpc } from "@miu2d/shared";
import { NavLink, useNavigate } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function ShopListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;

  const {
    data: shopList,
    isLoading,
    refetch,
  } = trpc.shop.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: (data) => {
      refetch();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    if (!gameId) return;
    createMutation.mutate({
      gameId,
      key: `shop_${Date.now()}.ini`,
      name: "新商店",
    });
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            商店列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setShowImportAll(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>批量导入</span>
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建商店</span>
          </button>
        </div>

        {/* 商店列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !shopList || shopList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无商店</div>
          ) : (
            shopList.map((shop) => (
              <NavLink
                key={shop.id}
                to={`${basePath}/${shop.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <span className="text-lg">🏪</span>
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{shop.name}</span>
                  <span className="text-xs text-[#858585] truncate block">{shop.key}</span>
                </div>
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-[#3c3c3c] text-[#0098ff] font-mono">
                  {shop.itemCount}
                </span>
              </NavLink>
            ))
          )}
        </div>
      </div>

    </>
  );
}
