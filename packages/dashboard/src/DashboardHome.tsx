/**
 * Dashboard 首页
 */
import { trpc } from "@miu2d/shared";
import { Link, useParams } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import type { IconName } from "./icons";
import { DashboardIcons } from "./icons";

interface StatCardProps {
  label: string;
  count: number | undefined;
  icon: IconName;
  color: string;
}

function StatCard({ label, count, icon, color }: StatCardProps) {
  return (
    <div className="p-4 bg-[#252526] border border-widget-border rounded-lg">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {DashboardIcons[icon]}
        <span className="text-xs text-[#858585]">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">
        {count === undefined ? <span className="text-base text-[#555]">—</span> : count}
      </div>
    </div>
  );
}

export function DashboardHome() {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id ?? "";
  const basePath = `/dashboard/${gameSlug}`;

  const { data: npcs } = trpc.npc.list.useQuery({ gameId }, { enabled: !!gameId });
  const { data: goods } = trpc.goods.list.useQuery({ gameId }, { enabled: !!gameId });
  const { data: magic } = trpc.magic.list.useQuery({ gameId }, { enabled: !!gameId });
  const { data: scenes } = trpc.scene.list.useQuery({ gameId }, { enabled: !!gameId });
  const { data: players } = trpc.player.list.useQuery({ gameId }, { enabled: !!gameId });

  const quickLinks: { icon: IconName; label: string; path: string; color: string; desc: string }[] =
    [
      {
        icon: "game",
        label: "基础设置",
        path: `${basePath}/game/basic`,
        color: "#0098ff",
        desc: "游戏名称、路由、配置",
      },
      {
        icon: "character",
        label: "玩家角色",
        path: `${basePath}/player`,
        color: "#4ec9b0",
        desc: players ? `${players.length} 个角色` : "角色配置",
      },
      {
        icon: "npc",
        label: "NPC 编辑",
        path: `${basePath}/npcs`,
        color: "#dcdcaa",
        desc: npcs ? `${npcs.length} 个 NPC` : "NPC 配置",
      },
      {
        icon: "map",
        label: "场景编辑",
        path: `${basePath}/scenes`,
        color: "#ce9178",
        desc: scenes ? `${scenes.length} 个场景` : "地图场景",
      },
      {
        icon: "magic",
        label: "武功编辑",
        path: `${basePath}/magic`,
        color: "#c586c0",
        desc: magic ? `${magic.length} 个武功` : "武功技能",
      },
      {
        icon: "goods",
        label: "物品编辑",
        path: `${basePath}/goods`,
        color: "#b5cea8",
        desc: goods ? `${goods.length} 个物品` : "道具装备",
      },
    ];

  const moreLinks: { label: string; path: string; icon: IconName }[] = [
    { label: "商店管理", path: `${basePath}/shops`, icon: "shop" },
    { label: "对话系统", path: `${basePath}/talks`, icon: "dialog" },
    { label: "等级配置", path: `${basePath}/levels`, icon: "level" },
    { label: "数据统计", path: `${basePath}/statistics`, icon: "chart" },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* 游戏信息头部 */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {currentGame?.name ?? "游戏控制台"}
            </h1>
            {currentGame?.description && (
              <p className="text-sm text-[#858585] mb-2">{currentGame.description}</p>
            )}
            {currentGame?.slug && (
              <div className="flex items-center gap-4 flex-wrap mt-1">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#858585]">
                  游戏地址:
                  <code className="text-[#9cdcfe] bg-[#1a1a2e] px-2 py-0.5 rounded font-mono">
                    /game/{currentGame.slug}
                  </code>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#858585]">
                  编辑器:
                  <code className="text-[#9cdcfe] bg-[#1a1a2e] px-2 py-0.5 rounded font-mono">
                    /dashboard/{currentGame.slug}
                  </code>
                </span>
              </div>
            )}
          </div>
          {currentGame?.slug && (
            <a
              href={`/game/${currentGame.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg text-sm transition-colors shrink-0 ml-4"
            >
              {DashboardIcons.game}
              <span>开始游戏</span>
            </a>
          )}
        </div>

        {/* 快速入口 */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-3">
            快速入口
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-4 bg-[#252526] hover:bg-[#2a2d2e] border border-widget-border rounded-lg transition-colors group"
              >
                <span style={{ color: link.color }} className="flex-shrink-0">
                  {DashboardIcons[link.icon]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#cccccc] group-hover:text-white transition-colors">
                    {link.label}
                  </div>
                  <div className="text-xs text-[#858585] mt-0.5 truncate">{link.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 更多管理 */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-3">
            更多管理
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {moreLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[#252526] hover:bg-[#2a2d2e] border border-widget-border rounded-lg transition-colors text-sm text-[#858585] hover:text-[#cccccc] group"
              >
                <span className="text-[#555] group-hover:text-[#858585] transition-colors">
                  {DashboardIcons[item.icon]}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 项目统计 */}
        <div>
          <h2 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-3">
            项目统计
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="角色" count={players?.length} icon="character" color="#4ec9b0" />
            <StatCard label="NPC" count={npcs?.length} icon="npc" color="#dcdcaa" />
            <StatCard label="武功" count={magic?.length} icon="magic" color="#c586c0" />
            <StatCard label="物品" count={goods?.length} icon="goods" color="#b5cea8" />
            <StatCard label="场景" count={scenes?.length} icon="map" color="#ce9178" />
          </div>
        </div>
      </div>
    </div>
  );
}
