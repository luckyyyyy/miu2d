/**
 * 底部面板：显示数据库中的 NPC 和 OBJ 列表
 * 作为素材面板，用于将来拖拽添加到地图
 * 可折叠，编辑器风格，支持拖拽调整高度
 */

import { trpc } from "@miu2d/shared";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { LazyAsfIcon } from "../../components/common/LazyAsfIcon";
import { useDashboard } from "../../DashboardContext";
import { DashboardIcons } from "../../icons";
import { NPC_RELATION_COLORS, NPC_RELATION_LABELS, OBJ_KIND_LABELS } from "./scene-list-constants";

export function SceneEntryListPanels({ sceneId, gameId }: { sceneId: string; gameId: string }) {
  const { currentGame } = useDashboard();
  const gameSlug = currentGame?.slug;

  const [npcCollapsed, setNpcCollapsed] = useState(false);
  const [objCollapsed, setObjCollapsed] = useState(false);
  const [npcSearch, setNpcSearch] = useState("");
  const [objSearch, setObjSearch] = useState("");

  // 拖拽调整高度
  const [panelHeight, setPanelHeight] = useState(280);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = startYRef.current - ev.clientY;
        setPanelHeight(Math.max(80, Math.min(600, startHeightRef.current + delta)));
      };
      const onUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelHeight],
  );

  // 从数据库加载 NPC 和 OBJ 列表
  const { data: npcList, isLoading: npcLoading } = trpc.npc.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );
  const { data: objList, isLoading: objLoading } = trpc.obj.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  // 搜索过滤
  const filteredNpcs = useMemo(() => {
    if (!npcList) return [];
    if (!npcSearch.trim()) return npcList;
    const q = npcSearch.trim().toLowerCase();
    return npcList.filter(
      (n) => n.name.toLowerCase().includes(q) || n.key.toLowerCase().includes(q),
    );
  }, [npcList, npcSearch]);

  const filteredObjs = useMemo(() => {
    if (!objList) return [];
    if (!objSearch.trim()) return objList;
    const q = objSearch.trim().toLowerCase();
    return objList.filter(
      (o) => o.name.toLowerCase().includes(q) || o.key.toLowerCase().includes(q),
    );
  }, [objList, objSearch]);

  const bothCollapsed = npcCollapsed && objCollapsed;

  return (
    <div
      className="shrink-0 border-t border-panel-border flex flex-col"
      style={{ height: bothCollapsed ? "auto" : panelHeight }}
    >
      {/* 拖拽手柄 */}
      {!bothCollapsed && (
        <div
          className="h-[3px] shrink-0 cursor-ns-resize hover:bg-focus-border active:bg-focus-border transition-colors"
          onMouseDown={handleDragStart}
        />
      )}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* NPC 列表 */}
        <CollapsibleDbList
          label="NPC 列表"
          icon={DashboardIcons.npc}
          count={npcList?.length ?? 0}
          collapsed={npcCollapsed}
          onToggle={() => setNpcCollapsed((v) => !v)}
          search={npcSearch}
          onSearchChange={setNpcSearch}
          isLoading={npcLoading}
        >
          {filteredNpcs.map((npc) => (
            <NpcDbRow key={npc.id} npc={npc} gameSlug={gameSlug} />
          ))}
          {filteredNpcs.length === 0 && !npcLoading && (
            <div className="px-3 py-2 text-xs text-[#555]">
              {npcSearch ? "无匹配结果" : "暂无 NPC"}
            </div>
          )}
        </CollapsibleDbList>

        {/* OBJ 列表 */}
        <CollapsibleDbList
          label="OBJ 列表"
          icon={DashboardIcons.obj}
          count={objList?.length ?? 0}
          collapsed={objCollapsed}
          onToggle={() => setObjCollapsed((v) => !v)}
          search={objSearch}
          onSearchChange={setObjSearch}
          isLoading={objLoading}
        >
          {filteredObjs.map((obj) => (
            <ObjDbRow key={obj.id} obj={obj} gameSlug={gameSlug} />
          ))}
          {filteredObjs.length === 0 && !objLoading && (
            <div className="px-3 py-2 text-xs text-[#555]">
              {objSearch ? "无匹配结果" : "暂无 OBJ"}
            </div>
          )}
        </CollapsibleDbList>
      </div>
    </div>
  );
}

/** 可折叠数据库列表容器 */
function CollapsibleDbList({
  label,
  icon,
  count,
  collapsed,
  onToggle,
  search,
  onSearchChange,
  isLoading,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col min-h-0 ${collapsed ? "" : "flex-1"}`}>
      {/* 折叠头部 */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 h-[22px] px-2 text-xs font-medium bg-[#2d2d2d] hover:bg-[#323232] transition-colors shrink-0 border-b border-panel-border select-none w-full text-left"
      >
        <span
          className={`text-[#858585] text-[10px] transition-transform inline-block ${collapsed ? "" : "rotate-90"}`}
        >
          {DashboardIcons.chevronRight}
        </span>
        <span className="text-[#858585]">{icon}</span>
        <span className="text-[#cccccc] uppercase tracking-wide">{label}</span>
        <span className="text-[#555] ml-auto font-normal">{count}</span>
      </button>

      {/* 搜索框 + 条目列表 */}
      {!collapsed && (
        <>
          <div className="px-1.5 py-1 border-b border-panel-border shrink-0">
            <input
              className="w-full bg-[#3c3c3c] border border-[#555] rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none focus:border-focus-border placeholder-[#666]"
              placeholder="搜索..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-[#858585]">加载中...</div>
            ) : (
              children
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** 数据库 NPC 行 */
function NpcDbRow({
  npc,
  gameSlug,
}: {
  npc: {
    id: string;
    key: string;
    name: string;
    kind: string;
    relation: string;
    level?: number | null;
    npcIni: string;
    icon?: string | null;
  };
  gameSlug: string | undefined;
}) {
  const relationColor = NPC_RELATION_COLORS[npc.relation] ?? "#999";
  const relationLabel = NPC_RELATION_LABELS[npc.relation] ?? npc.relation;

  return (
    <div
      className="flex items-center gap-1.5 w-full py-[3px] px-2 text-xs hover:bg-[#2a2d2e] text-[#cccccc] cursor-grab active:cursor-grabbing transition-colors"
      title={`${npc.name} (${npc.key})\n${relationLabel} · ${npc.kind}\n拖拽到地图添加`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/miu2d-npc",
          JSON.stringify({
            id: npc.id,
            key: npc.key,
            name: npc.name,
            kind: npc.kind,
            relation: npc.relation,
            npcIni: npc.npcIni,
          }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <LazyAsfIcon
        iconPath={npc.icon ?? undefined}
        gameSlug={gameSlug}
        size={20}
        prefix="asf/character/"
        fallback="🧙"
      />
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: relationColor }}
        title={relationLabel}
      />
      <span className="truncate flex-1">{npc.name}</span>
      {npc.level != null && (
        <span className="text-[10px] shrink-0 text-[#569cd6]">Lv.{npc.level}</span>
      )}
      <span className="text-[10px] shrink-0 text-[#555]">
        {npc.kind === "Fighter" ? "战斗" : "普通"}
      </span>
    </div>
  );
}

/** 数据库 OBJ 行 */
function ObjDbRow({
  obj,
  gameSlug,
}: {
  obj: {
    id: string;
    key: string;
    name: string;
    kind: string;
    objFile: string;
    icon?: string | null;
  };
  gameSlug: string | undefined;
}) {
  const kindLabel = OBJ_KIND_LABELS[obj.kind] ?? obj.kind;

  return (
    <div
      className="flex items-center gap-1.5 w-full py-[3px] px-2 text-xs hover:bg-[#2a2d2e] text-[#cccccc] cursor-grab active:cursor-grabbing transition-colors"
      title={`${obj.name} (${obj.key})\n${kindLabel}\n拖拽到地图添加`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/miu2d-obj",
          JSON.stringify({
            id: obj.id,
            key: obj.key,
            name: obj.name,
            kind: obj.kind,
            objFile: obj.objFile,
          }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <LazyAsfIcon
        iconPath={obj.icon ?? undefined}
        gameSlug={gameSlug}
        size={20}
        prefix="asf/object/"
        fallback="📦"
      />
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#81c784]" />
      <span className="truncate flex-1">{obj.name}</span>
      <span className="text-[10px] shrink-0 text-[#555]">{kindLabel}</span>
    </div>
  );
}
