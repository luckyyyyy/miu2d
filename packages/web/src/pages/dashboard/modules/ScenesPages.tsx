/**
 * 场景编辑页面
 *
 * ScenesHomePage: 场景首页（未选中场景时显示）
 * SceneDetailPage: 场景详情页 - 中间地图预览 + 右侧子项编辑面板
 * ImportScenesModal: 批量导入弹窗（3 个拖拽区域）
 *
 * 所有非地图数据（脚本/陷阱/NPC/OBJ）存储在 scene.data JSONB 字段
 * URL 参数: ?kind=script&key=fileName.txt / ?kind=npc
 */

import { loadCharacterImage, loadNpcRes } from "@miu2d/engine/character";
import { setResourcePaths } from "@miu2d/engine/config";
import { ResourcePath } from "@miu2d/engine/config/resourcePaths";
import type { MiuMapData } from "@miu2d/engine/core/mapTypes";
import { getObjResFromCache } from "@miu2d/engine/obj/objConfigLoader";
import type { AsfData } from "@miu2d/engine/resource/asf";
import { getFrameCanvas, loadAsf } from "@miu2d/engine/resource/asf";
import { parseMMF } from "@miu2d/engine/resource/mmf";
import type { ApiDataResponse } from "@miu2d/engine/resource/resourceLoader";
import { setGameData } from "@miu2d/engine/resource/resourceLoader";
import type { SceneData, SceneNpcEntry, SceneObjEntry } from "@miu2d/types";
import { NpcKindValues, NpcRelationValues, ObjKindValues } from "@miu2d/types";
import type { MapMarker, MapViewerHandle, SidePanelTab } from "@miu2d/viewer";
import { MapViewer } from "@miu2d/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { NpcResourcePicker } from "../../../components/common/pickers/NpcResourcePicker";
import { FileSelectDialog } from "../../../components/common/ResourceFilePicker/FileSelectDialog";
import { ResourceFilePicker } from "../../../components/common/ResourceFilePicker/ResourceFilePicker";
import { ScriptEditor } from "../../../components/common/ScriptEditor";
import { useToast } from "../../../contexts/ToastContext";
import { useNpcSimulation } from "../../../hooks/useNpcSimulation";
import { trpc } from "../../../lib/trpc";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

// ============= 场景首页（未选中场景时） =============

export function ScenesHomePage() {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: scenes, isLoading } = trpc.scene.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-20">{DashboardIcons.map}</div>
        <h2 className="text-lg font-medium text-[#cccccc] mb-2">场景编辑器</h2>
        <p className="text-sm text-[#858585]">
          {isLoading
            ? "加载中..."
            : scenes?.length
              ? `共 ${scenes.length} 个场景，选择左侧场景开始编辑`
              : "还没有场景数据，点击左侧「批量导入」开始"}
        </p>
      </div>
    </div>
  );
}

// ============= 精灵加载工具 =============

interface SpriteInfo {
  /** 所有帧的画布（仅第一方向，作为回退） */
  frames: HTMLCanvasElement[];
  /** 帧间隔（毫秒） */
  interval: number;
  offsetX: number;
  offsetY: number;
  /** ASF 数据（用于 WebGL atlas 渲染） */
  asf: AsfData;
  /** 是否为 OBJ 类型 */
  isObj?: boolean;
  /** 行走状态 ASF 数据（NPC 专用，用于行走动画） */
  walkAsf?: AsfData;
}

/** 将 AsfData 转为 SpriteInfo（取第一方向所有帧 + 保留 ASF 引用） */
function asfToSpriteInfo(asf: AsfData, isObj = false): SpriteInfo {
  const fpd = asf.framesPerDirection || asf.frames.length;
  const frames = asf.frames.slice(0, fpd).map((f) => getFrameCanvas(f));
  return {
    frames,
    interval: asf.interval || 150,
    offsetX: asf.left,
    offsetY: asf.bottom,
    asf,
    isObj,
  };
}

/** 加载 NPC 精灵：从引擎缓存中获取 NpcRes → 取 Stand 状态 → loadCharacterImage */
async function loadNpcSprite(npcIni: string): Promise<SpriteInfo | null> {
  try {
    // 1. 查引擎缓存获取 NPC 资源映射（state → imagePath/soundPath）
    const stateMap = await loadNpcRes(npcIni);
    if (!stateMap) return null;
    // 2. 取 Stand (0) 或第一个有效状态的 imagePath
    const standInfo = stateMap.get(0) ?? stateMap.values().next().value;
    if (!standInfo?.imagePath) return null;
    // 3. 使用引擎 loadCharacterImage 加载 ASF/MPC（含 character/interlude 回退）
    const asf = await loadCharacterImage(standInfo.imagePath);
    if (!asf || asf.frames.length === 0) return null;
    const info = asfToSpriteInfo(asf, false);
    // 4. 尝试加载 Walk (2) 状态 ASF（用于行走动画）
    const walkInfo = stateMap.get(2); // CharacterState.Walk = 2
    if (walkInfo?.imagePath) {
      try {
        const walkAsf = await loadCharacterImage(walkInfo.imagePath);
        if (walkAsf && walkAsf.frames.length > 0) {
          info.walkAsf = walkAsf;
        }
      } catch {
        /* walk ASF optional, ignore */
      }
    }
    return info;
  } catch (e) {
    console.warn("[loadNpcSprite] failed:", npcIni, e);
    return null;
  }
}

/** 加载 OBJ 精灵：从引擎缓存中获取 ObjRes → 取 imagePath → loadAsf */
async function loadObjSprite(objFile: string): Promise<SpriteInfo | null> {
  try {
    // 1. 查引擎缓存获取 OBJ 资源（objRes 缓存按 objres 文件名索引，与 e.objFile 一致）
    const resInfo = getObjResFromCache(objFile);
    if (!resInfo?.imagePath) return null;
    // 2. 使用引擎方式加载（与 obj.ts 一致：asfObject 目录）
    const asf = await loadAsf(ResourcePath.asfObject(resInfo.imagePath));
    if (!asf || asf.frames.length === 0) return null;
    return asfToSpriteInfo(asf, true);
  } catch (e) {
    console.warn("[loadObjSprite] failed:", objFile, e);
    return null;
  }
}

/**
 * Hook: 通过 tRPC data.getAll 加载游戏数据，
 * 然后注入引擎缓存，使 loadNpcRes/getObjConfigFromCache 可直接使用
 */
function useGameData(gameSlug: string | undefined) {
  const [ready, setReady] = useState(false);
  const { data: gameData } = trpc.data.getAll.useQuery(
    { gameSlug: gameSlug! },
    { enabled: !!gameSlug }
  );

  useEffect(() => {
    if (!gameSlug || !gameData) return;
    setResourcePaths({ root: `/game/${gameSlug}/resources` });
    setGameData(gameSlug, gameData as ApiDataResponse)
      .then(() => {
        setReady(true);
      })
      .catch((e) => console.error("[useGameData] failed:", e));
  }, [gameSlug, gameData]);

  return ready;
}

/**
 * Hook: 引擎数据就绪后，根据 NPC/OBJ 条目自动加载精灵缓存
 * NPC: loadNpcRes(npcIni) → stand imagePath → loadCharacterImage
 * OBJ: getObjConfigFromCache(objFile) → image → loadAsf (asfObject)
 */
function useSpriteCache(
  npcEntries: SceneNpcEntry[],
  objEntries: SceneObjEntry[],
  gameDataReady: boolean
): Map<string, SpriteInfo> {
  const [sprites, setSprites] = useState<Map<string, SpriteInfo>>(new Map());
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!gameDataReady) return;
    let cancelled = false;

    const toLoad: { cacheKey: string; loader: () => Promise<SpriteInfo | null> }[] = [];
    const seenNpc = new Set<string>();
    for (const e of npcEntries) {
      if (!e.npcIni || seenNpc.has(e.npcIni) || loadedRef.current.has(`npc:${e.npcIni}`)) continue;
      seenNpc.add(e.npcIni);
      toLoad.push({ cacheKey: `npc:${e.npcIni}`, loader: () => loadNpcSprite(e.npcIni) });
    }
    const seenObj = new Set<string>();
    for (const e of objEntries) {
      if (!e.objFile || seenObj.has(e.objFile) || loadedRef.current.has(`obj:${e.objFile}`))
        continue;
      seenObj.add(e.objFile);
      toLoad.push({ cacheKey: `obj:${e.objFile}`, loader: () => loadObjSprite(e.objFile) });
    }

    if (toLoad.length === 0) return;

    (async () => {
      const results = await Promise.allSettled(toLoad.map((t) => t.loader()));
      if (cancelled) return;
      setSprites((prev) => {
        const next = new Map(prev);
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const { cacheKey } = toLoad[i];
          if (r.status === "fulfilled" && r.value) {
            next.set(cacheKey, r.value);
          }
          loadedRef.current.add(cacheKey);
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [npcEntries, objEntries, gameDataReady]);

  return sprites;
}

// ============= 场景详情页 =============

export function SceneDetailPage() {
  const { sceneId } = useParams();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const kind = searchParams.get("kind"); // "script" | "trap" | "npc" | "obj"
  const itemKey = searchParams.get("key"); // file name for scripts/traps
  // NPC/OBJ 使用独立的 URL 参数，互不干扰
  const npcKey = searchParams.get("npcKey");
  const objKey = searchParams.get("objKey");
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;
  const gameSlug = currentGame?.slug;

  const { data: scene, refetch: refetchScene } = trpc.scene.get.useQuery(
    { gameId: gameId!, id: sceneId! },
    { enabled: !!gameId && !!sceneId }
  );

  // 地图数据加载
  const [mapData, setMapData] = useState<MiuMapData | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapName = scene?.mapFileName?.replace(/\.(map|mmf)$/i, "") ?? null;
  const resourceRoot = gameSlug ? `/game/${gameSlug}/resources` : undefined;

  // MapViewer ref for panTo
  const mapViewerRef = useRef<MapViewerHandle>(null);

  // 右侧面板 tab: "map" | "npc" | "obj"
  type RightTab = "map" | "npc" | "obj";
  const [rightTab, setRightTab] = useState<RightTab>("map");
  // hover 预览时保存的相机位置
  const savedCameraRef = useRef<{ mapX: number; mapY: number } | null>(null);

  // NPC/OBJ 选中索引（独立，互不干扰）
  const [selectedNpcIdx, setSelectedNpcIdx] = useState<number | null>(null);
  const [selectedObjIdx, setSelectedObjIdx] = useState<number | null>(null);
  /** NPC/OBJ 编辑面板传入的条目（用于拖拽后实时更新坐标） */
  const [localNpcEntries, setLocalNpcEntries] = useState<SceneNpcEntry[] | null>(null);
  const [localObjEntries, setLocalObjEntries] = useState<SceneObjEntry[] | null>(null);
  /** NPC 条目数量 ref（用于 marker click/drag 回调中区分 NPC/OBJ） */
  const npcCountRef = useRef(0);

  /** 拖拽位置更新（推送给面板，同步其内部 entries 的坐标） */
  const [npcDragUpdate, setNpcDragUpdate] = useState<{
    index: number;
    mapX: number;
    mapY: number;
  } | null>(null);
  const [objDragUpdate, setObjDragUpdate] = useState<{
    index: number;
    mapX: number;
    mapY: number;
  } | null>(null);

  // 场景切换时清除旧地图数据和标记选中
  useEffect(() => {
    setMapData(null);
    setMapError(null);
    setMapLoading(false);
    setSelectedNpcIdx(null);
    setSelectedObjIdx(null);
    setLocalNpcEntries(null);
    setLocalObjEntries(null);
  }, []);

  // 加载地图 MMF
  useEffect(() => {
    if (!scene?.mapFileName || !resourceRoot) return;
    const mapFileName = scene.mapFileName;

    let cancelled = false;
    const doLoad = async () => {
      setMapLoading(true);
      setMapError(null);
      setMapData(null);
      try {
        const res = await fetch(`${resourceRoot}/map/${mapFileName}`);
        if (cancelled) return;
        if (!res.ok) {
          setMapError(`地图文件加载失败: ${res.status}`);
          return;
        }
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const data = parseMMF(buffer, mapFileName);
        if (data) {
          setMapData(data);
        } else {
          setMapError("无法解析地图文件");
        }
      } catch (e) {
        if (!cancelled) {
          setMapError(e instanceof Error ? e.message : "加载地图失败");
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };
    doLoad();
    return () => {
      cancelled = true;
    };
  }, [scene?.mapFileName, resourceRoot]);

  const handleMarkerClick = useCallback((index: number) => {
    if (index < npcCountRef.current) {
      setSelectedNpcIdx(index);
      setSelectedObjIdx(null);
      setRightTab("npc");
    } else {
      setSelectedObjIdx(index - npcCountRef.current);
      setSelectedNpcIdx(null);
      setRightTab("obj");
    }
  }, []);

  const handleEmptyClick = useCallback(() => {
    setSelectedNpcIdx(null);
    setSelectedObjIdx(null);
  }, []);

  const handleMarkerDrag = useCallback((index: number, mapX: number, mapY: number) => {
    if (index < npcCountRef.current) {
      setLocalNpcEntries((prev) => {
        const current = prev ?? npcEntriesRef.current;
        const next = [...current];
        if (index < next.length) {
          next[index] = { ...next[index], mapX, mapY };
        }
        return next;
      });
      setNpcDragUpdate({ index, mapX, mapY });
    } else {
      const objIdx = index - npcCountRef.current;
      setLocalObjEntries((prev) => {
        const current = prev ?? objEntriesRef.current;
        const next = [...current];
        if (objIdx < next.length) {
          next[objIdx] = { ...next[objIdx], mapX, mapY };
        }
        return next;
      });
      setObjDragUpdate({ index: objIdx, mapX, mapY });
    }
  }, []);

  const sceneData = useMemo(() => (scene?.data ?? {}) as SceneData, [scene?.data]);

  // NPC/OBJ 条目：始终同时显示（npcKey 和 objKey 独立）
  const npcEntries: SceneNpcEntry[] = useMemo(
    () => localNpcEntries ?? (npcKey ? (sceneData.npc?.[npcKey]?.entries ?? []) : []),
    [localNpcEntries, npcKey, sceneData]
  );
  const objEntries: SceneObjEntry[] = useMemo(
    () => localObjEntries ?? (objKey ? (sceneData.obj?.[objKey]?.entries ?? []) : []),
    [localObjEntries, objKey, sceneData]
  );
  npcCountRef.current = npcEntries.length;

  // latest-value refs（用于稳定的回调，避免 useCallback 依赖变化导致 sidePanelTabs 重建）
  const npcEntriesRef = useRef(npcEntries);
  npcEntriesRef.current = npcEntries;
  const objEntriesRef = useRef(objEntries);
  objEntriesRef.current = objEntries;
  const selectedNpcIdxRef = useRef(selectedNpcIdx);
  selectedNpcIdxRef.current = selectedNpcIdx;
  const selectedObjIdxRef = useRef(selectedObjIdx);
  selectedObjIdxRef.current = selectedObjIdx;

  // 加载引擎数据（/api/data），使 NpcRes / ObjConfig 缓存就绪
  const gameDataReady = useGameData(gameSlug);

  // 加载精灵（hook 必须在早返回之前）
  const spriteCache = useSpriteCache(npcEntries, objEntries, gameDataReady);

  // NPC AI 模拟（复用引擎随机行走 / 循环行走算法）
  const { getMarkerPosition } = useNpcSimulation(npcEntries, mapData, mapViewerRef);

  // 选中 NPC/OBJ 时镜头跟随（使用 ref 保持回调稳定，避免 sidePanelTabs 级联重建）
  const handleSelectNpc = useCallback((idx: number | null) => {
    setSelectedNpcIdx(idx);
    if (idx !== null) setSelectedObjIdx(null);
    if (idx !== null && npcEntriesRef.current[idx]) {
      mapViewerRef.current?.panTo(npcEntriesRef.current[idx].mapX, npcEntriesRef.current[idx].mapY);
    }
  }, []);
  const handleSelectObj = useCallback((idx: number | null) => {
    setSelectedObjIdx(idx);
    if (idx !== null) setSelectedNpcIdx(null);
    if (idx !== null && objEntriesRef.current[idx]) {
      mapViewerRef.current?.panTo(objEntriesRef.current[idx].mapX, objEntriesRef.current[idx].mapY);
    }
  }, []);

  // 稳定的 onEntriesChange 回调（setLocal*Entries 本身就是稳定的 state setter）
  const handleNpcEntriesChange = useCallback((e: (SceneNpcEntry | SceneObjEntry)[] | null) => {
    setLocalNpcEntries(e as SceneNpcEntry[] | null);
  }, []);
  const handleObjEntriesChange = useCallback((e: (SceneNpcEntry | SceneObjEntry)[] | null) => {
    setLocalObjEntries(e as SceneObjEntry[] | null);
  }, []);

  // hover 预览：鼠标移入时临时平移镜头，缩放低于 100% 时自动放大到 100%（不恢复）
  // 当有选中的 NPC 或 OBJ 时，不跟踪 hover
  const handleHoverEntry = useCallback((mapX: number, mapY: number) => {
    if (selectedNpcIdxRef.current !== null || selectedObjIdxRef.current !== null) return;
    const renderer = mapViewerRef.current;
    if (!renderer) return;
    if (!savedCameraRef.current) {
      savedCameraRef.current = { mapX: -1, mapY: -1 };
      if (renderer.getZoom() < 1) {
        renderer.setZoom(1);
      }
    }
    renderer.panTo(mapX, mapY);
  }, []);
  const handleHoverLeave = useCallback(() => {
    if (savedCameraRef.current) {
      savedCameraRef.current = null;
    }
  }, []);

  // ============= 拖放 NPC/OBJ 到地图 =============
  const updateMutationForDrop = trpc.scene.update.useMutation({
    onSuccess: () => {
      refetchScene();
      toast.success("已添加到地图");
    },
    onError: (err) => toast.error(`添加失败: ${err.message}`),
  });

  const handleMapDrop = useCallback(
    (mapX: number, mapY: number, data: DataTransfer) => {
      const npcJson = data.getData("application/miu2d-npc");
      const objJson = data.getData("application/miu2d-obj");

      if (npcJson) {
        if (!npcKey) {
          toast.error("请先在左侧场景树中选中一个 NPC 文件，再拖放添加");
          return;
        }
        try {
          const npcInfo = JSON.parse(npcJson) as {
            id: string;
            key: string;
            name: string;
            kind: string;
            relation: string;
            npcIni: string;
          };
          const newEntry: SceneNpcEntry = {
            ...createDefaultNpcEntry(),
            name: npcInfo.name,
            npcIni: npcInfo.npcIni,
            kind: NpcKindValues[npcInfo.kind as keyof typeof NpcKindValues] ?? 0,
            relation: NpcRelationValues[npcInfo.relation as keyof typeof NpcRelationValues] ?? 0,
            mapX: mapX,
            mapY: mapY,
          };
          const currentData = { ...sceneData };
          const npcData = currentData.npc?.[npcKey] ?? { key: npcKey, entries: [] };
          const updatedEntries = [...npcData.entries, newEntry];
          currentData.npc = {
            ...(currentData.npc ?? {}),
            [npcKey]: { ...npcData, entries: updatedEntries },
          };
          updateMutationForDrop.mutate({
            gameId: gameId!,
            id: sceneId!,
            data: currentData as Record<string, unknown>,
          });
          // 也更新本地状态以立即显示
          setLocalNpcEntries(updatedEntries);
        } catch {
          toast.error("拖放数据解析失败");
        }
        return;
      }

      if (objJson) {
        if (!objKey) {
          toast.error("请先在左侧场景树中选中一个 OBJ 文件，再拖放添加");
          return;
        }
        try {
          const objInfo = JSON.parse(objJson) as {
            id: string;
            key: string;
            name: string;
            kind: string;
            objFile: string;
          };
          const newEntry: SceneObjEntry = {
            ...createDefaultObjEntry(),
            objName: objInfo.name,
            objFile: objInfo.objFile,
            kind: ObjKindValues[objInfo.kind as keyof typeof ObjKindValues] ?? 0,
            mapX: mapX,
            mapY: mapY,
          };
          const currentData = { ...sceneData };
          const objData = currentData.obj?.[objKey] ?? { key: objKey, entries: [] };
          const updatedEntries = [...objData.entries, newEntry];
          currentData.obj = {
            ...(currentData.obj ?? {}),
            [objKey]: { ...objData, entries: updatedEntries },
          };
          updateMutationForDrop.mutate({
            gameId: gameId!,
            id: sceneId!,
            data: currentData as Record<string, unknown>,
          });
          setLocalObjEntries(updatedEntries);
        } catch {
          toast.error("拖放数据解析失败");
        }
      }
    },
    [npcKey, objKey, sceneData, gameId, sceneId, updateMutationForDrop, toast]
  );

  const hasNpcTab = !!npcKey;
  const hasObjTab = !!objKey;
  const mapFileName = scene?.mapFileName ?? "";

  // 构建 sidePanelTabs（注入 MapViewer 右侧面板）— 必须在 early return 之前
  const sidePanelTabs = useMemo((): SidePanelTab[] => {
    if (!scene) return [];
    const tabs: SidePanelTab[] = [];
    if (hasNpcTab) {
      tabs.push({
        id: "npc",
        label: `NPC (${npcEntries.length})`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-npc-${npcKey}`}
            kind="npc"
            itemKey={npcKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            selectedIdx={selectedNpcIdx}
            onSelectIdx={handleSelectNpc}
            onEntriesChange={handleNpcEntriesChange}
            dragUpdate={npcDragUpdate}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }
    if (hasObjTab) {
      tabs.push({
        id: "obj",
        label: `\u7269\u4ef6 (${objEntries.length})`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-obj-${objKey}`}
            kind="obj"
            itemKey={objKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            selectedIdx={selectedObjIdx}
            onSelectIdx={handleSelectObj}
            onEntriesChange={handleObjEntriesChange}
            dragUpdate={objDragUpdate}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }
    return tabs;
  }, [
    scene,
    hasNpcTab,
    hasObjTab,
    npcKey,
    objKey,
    npcEntries.length,
    objEntries.length,
    sceneId,
    sceneData,
    gameId,
    gameSlug,
    mapFileName,
    refetchScene,
    selectedNpcIdx,
    selectedObjIdx,
    handleSelectNpc,
    handleSelectObj,
    handleNpcEntriesChange,
    handleObjEntriesChange,
    npcDragUpdate,
    objDragUpdate,
    handleHoverEntry,
    handleHoverLeave,
  ]);

  // 标记数组必须 memoize：markers 是 drawMap 的依赖，身份变化会重建整个动画循环
  const allMarkers = useMemo((): MapMarker[] => {
    const npcM: MapMarker[] = npcEntries.map((e, i) => {
      const s = spriteCache.get(`npc:${e.npcIni}`);
      // 根据 relation + kind 决定选中描边颜色，与引擎 interactionManager 一致
      // Enemy(relation=1) → 红色, FighterFriend(kind=1|3 && relation=0) → 绿色
      // NoneFighter(relation=3 && kind=1) → 蓝色, 默认 → 黄色
      let selColor = "rgba(255, 255, 0, 0.8)"; // default: yellow
      if (e.relation === 1) {
        selColor = "rgba(255, 0, 0, 0.8)"; // enemy: red
      } else if ((e.kind === 1 || e.kind === 3) && e.relation === 0) {
        selColor = "rgba(0, 255, 0, 0.8)"; // fighter friend: green
      } else if (e.relation === 3 && e.kind === 1) {
        selColor = "rgba(0, 0, 255, 0.8)"; // none fighter: blue
      }
      return {
        mapX: e.mapX,
        mapY: e.mapY,
        label: e.name || `N${i}`,
        color: "#4fc3f7",
        selected: selectedNpcIdx === i,
        selectedColor: selColor,
        direction: e.dir ?? 0,
        sprite: s
          ? {
              frames: s.frames,
              interval: s.interval,
              offsetX: s.offsetX,
              offsetY: s.offsetY,
              asf: s.asf,
              isObj: false,
              walkAsf: s.walkAsf,
            }
          : undefined,
      };
    });
    const objM: MapMarker[] = objEntries.map((e, i) => {
      const s = spriteCache.get(`obj:${e.objFile}`);
      return {
        mapX: e.mapX,
        mapY: e.mapY,
        label: e.objName || `O${i}`,
        color: "#81c784",
        selected: selectedObjIdx === i,
        sprite: s
          ? {
              frames: s.frames,
              interval: s.interval,
              offsetX: s.offsetX,
              offsetY: s.offsetY,
              asf: s.asf,
              isObj: true,
              objOffX: e.offX ?? 0,
              objOffY: e.offY ?? 0,
            }
          : undefined,
      };
    });
    return [...npcM, ...objM];
  }, [npcEntries, objEntries, selectedNpcIdx, selectedObjIdx, spriteCache]);

  // 用于 onTabChange 回调的稳定引用
  const handleRightTabChange = useCallback((id: string) => {
    setRightTab(id as RightTab);
  }, []);

  if (!scene) {
    return <div className="h-full flex items-center justify-center text-[#858585]">加载中...</div>;
  }

  return (
    <div className="flex h-full">
      {/* 地图预览（右侧面板由 MapViewer 内置 Tab 管理） */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-panel-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#858585]">{DashboardIcons.map}</span>
            <span className="text-sm text-white font-medium">{scene.name}</span>
            <span className="text-xs text-[#858585]">({scene.key})</span>
          </div>
          <div className="text-xs text-[#858585]">{scene.mapFileName}</div>
        </div>

        <div className="flex-1 relative min-h-0">
          <MapViewer
            ref={mapViewerRef}
            rendererBackend="canvas2d"
            mmfData={mapData}
            mapName={mapName}
            fileName={scene.mapFileName}
            isLoading={mapLoading}
            error={mapError}
            resourceRoot={resourceRoot}
            markers={allMarkers}
            onMarkerClick={handleMarkerClick}
            onMarkerDrag={handleMarkerDrag}
            onEmptyClick={handleEmptyClick}
            onDrop={handleMapDrop}
            getMarkerPosition={getMarkerPosition}
            sidePanelTabs={sidePanelTabs}
            activeTabId={rightTab}
            onTabChange={handleRightTabChange}
          />
        </div>
      </div>

      {/* \u811a\u672c/\u9677\u9631\u7f16\u8f91\u5668\uff08\u975e NPC/OBJ \u6a21\u5f0f\uff09 */}
      {kind && kind !== "npc" && kind !== "obj" && (
        <SceneItemEditorPanel
          key={`${sceneId}-${kind}-${itemKey ?? ""}`}
          kind={kind}
          itemKey={itemKey}
          sceneData={sceneData}
          sceneId={sceneId!}
          gameId={gameId!}
          gameSlug={gameSlug!}
          mapFileName={scene.mapFileName}
          onSaved={refetchScene}
        />
      )}
    </div>
  );
}

// ============= 默认条目 =============

function createDefaultNpcEntry(): SceneNpcEntry {
  return {
    name: "",
    kind: 0,
    npcIni: "",
    dir: 0,
    mapX: 0,
    mapY: 0,
    action: 0,
    walkSpeed: 1,
    dialogRadius: 1,
    scriptFile: "",
    visionRadius: 10,
    relation: 0,
    group: 0,
    fixedPos: "",
  };
}
function createDefaultObjEntry(): SceneObjEntry {
  return {
    objName: "",
    objFile: "",
    wavFile: "",
    scriptFile: "",
    kind: 0,
    dir: 0,
    lum: 0,
    mapX: 0,
    mapY: 0,
    offX: 0,
    offY: 0,
    damage: 0,
    frame: 0,
  };
}

const NPC_KIND_LABELS: Record<number, string> = {
  0: "普通",
  1: "战斗",
  3: "伙伴",
  4: "地面动物",
  5: "事件NPC",
  6: "怕人动物",
  7: "飞行",
};
const OBJ_KIND_LABELS: Record<number, string> = {
  0: "动态",
  1: "静态",
  2: "尸体",
  3: "循环音效",
  4: "随机音效",
  5: "门",
  6: "陷阱",
  7: "掉落",
};
const DIRECTION_LABELS: Record<number, string> = {
  0: "↓ 南",
  1: "↙ 西南",
  2: "← 西",
  3: "↖ 西北",
  4: "↑ 北",
  5: "↗ 东北",
  6: "→ 东",
  7: "↘ 东南",
};
const RELATION_LABELS: Record<number, string> = { 0: "友好", 1: "敌对", 2: "中立", 3: "无阵营" };
const ACTION_LABELS: Record<number, string> = { 0: "站立", 1: "随机走", 2: "循环走" };

/** 虚拟滚动折叠态行高 */
const ITEM_HEIGHT = 34;

// ============= 场景编辑面板 =============

/**
 * 从 scene.data 读取内容，保存时更新 scene.data
 * - script/trap: 文本内容，用 Monaco 编辑器
 * - npc/obj: 结构化条目列表
 */
function SceneItemEditorPanel({
  kind,
  itemKey,
  sceneData,
  sceneId,
  gameId,
  gameSlug,
  mapFileName,
  onSaved,
  selectedIdx,
  onSelectIdx,
  onEntriesChange,
  dragUpdate,
  onHoverEntry,
  onHoverLeave,
}: {
  kind: string;
  itemKey: string | null;
  sceneData: SceneData;
  sceneId: string;
  gameId: string;
  gameSlug: string;
  mapFileName: string;
  onSaved: () => void;
  selectedIdx?: number | null;
  onSelectIdx?: (idx: number | null) => void;
  onEntriesChange?: (entries: (SceneNpcEntry | SceneObjEntry)[] | null) => void;
  dragUpdate?: { index: number; mapX: number; mapY: number } | null;
  onHoverEntry?: (mapX: number, mapY: number) => void;
  onHoverLeave?: () => void;
}) {
  const isStructured = kind === "npc" || kind === "obj";
  const updateMutation = trpc.scene.update.useMutation();
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const toast = useToast();
  const { gameId: routeGameId } = useParams();

  // 脚本/陷阱：文本内容
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  // NPC/OBJ：结构化条目
  const [entries, setEntries] = useState<(SceneNpcEntry | SceneObjEntry)[]>([]);
  const [originalEntries, setOriginalEntries] = useState("[]");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDirty = isStructured
    ? JSON.stringify(entries) !== originalEntries
    : content !== originalContent;

  // 稳定 ref：避免 onEntriesChange 身份变化触发 effect 级联重建
  const onEntriesChangeRef = useRef(onEntriesChange);
  onEntriesChangeRef.current = onEntriesChange;

  // 从 scene.data 加载内容（无需 S3 请求）
  useEffect(() => {
    if (isStructured) {
      const fileKey = itemKey ?? "";
      const data =
        kind === "npc"
          ? (sceneData.npc?.[fileKey]?.entries ?? [])
          : (sceneData.obj?.[fileKey]?.entries ?? []);
      setEntries(data);
      setOriginalEntries(JSON.stringify(data));
      onEntriesChangeRef.current?.(data);
    } else {
      const store = kind === "trap" ? sceneData.traps : sceneData.scripts;
      const text = (itemKey && store?.[itemKey]) ?? "";
      setContent(text);
      setOriginalContent(text);
    }
  }, [kind, itemKey, sceneData, isStructured]);

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    setSaveMessage("");
    try {
      // 构建更新后的 scene.data
      const newData: SceneData = { ...sceneData };

      if (isStructured) {
        const fileKey = itemKey ?? "";
        if (kind === "npc") {
          newData.npc = {
            ...(sceneData.npc ?? {}),
            [fileKey]: { key: fileKey, entries: entries as SceneNpcEntry[] },
          };
        } else {
          newData.obj = {
            ...(sceneData.obj ?? {}),
            [fileKey]: { key: fileKey, entries: entries as SceneObjEntry[] },
          };
        }
      } else if (itemKey) {
        const field = kind === "trap" ? "traps" : "scripts";
        newData[field] = { ...(sceneData[field] ?? {}), [itemKey]: content };
      }

      await updateMutation.mutateAsync({
        gameId,
        id: sceneId,
        data: newData as Record<string, unknown>,
      });

      if (isStructured) {
        setOriginalEntries(JSON.stringify(entries));
      } else {
        setOriginalContent(content);
      }
      setSaveMessage("已保存");
      onSaved();
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (e) {
      setSaveMessage(`保存失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  /** 删除整个子项文件（从 scene.data JSONB 中移除该 key） */
  const handleDeleteFile = async () => {
    if (!itemKey) return;
    setIsDeleting(true);
    try {
      const newData: SceneData = { ...sceneData };
      if (kind === "script") {
        const { [itemKey]: _, ...rest } = sceneData.scripts ?? {};
        newData.scripts = rest;
      } else if (kind === "trap") {
        const { [itemKey]: _, ...rest } = sceneData.traps ?? {};
        newData.traps = rest;
      } else if (kind === "npc") {
        const { [itemKey]: _, ...rest } = sceneData.npc ?? {};
        newData.npc = rest;
      } else {
        const { [itemKey]: _, ...rest } = sceneData.obj ?? {};
        newData.obj = rest;
      }

      await updateMutation.mutateAsync({
        gameId,
        id: sceneId,
        data: newData as Record<string, unknown>,
      });

      toast.success(`已删除「${itemKey}」`);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onSaved();
      // 导航回场景页（清除当前子项的 URL 参数）
      navigate(`/dashboard/${routeGameId}/scenes/${sceneId}`);
    } catch (e) {
      toast.error(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteFile(false);
    }
  };

  const updateEntry = (index: number, field: string, value: string | number) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as SceneNpcEntry | SceneObjEntry;
      return next;
    });
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      kind === "npc" ? createDefaultNpcEntry() : createDefaultObjEntry(),
    ]);
  };

  const deleteEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  // 同步 entries 到父组件（用于地图标记渲染）
  useEffect(() => {
    if (isStructured) {
      onEntriesChangeRef.current?.(entries);
    }
  }, [entries, isStructured]);

  // 地图拖拽位置同步：父组件拖拽移动了 marker 后，将新坐标合并到面板内部 entries
  useEffect(() => {
    if (!dragUpdate || !isStructured) return;
    const { index, mapX, mapY } = dragUpdate;
    setEntries((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], mapX, mapY } as SceneNpcEntry | SceneObjEntry;
      return next;
    });
  }, [dragUpdate, isStructured]);

  const setSelectedIdx = onSelectIdx ?? (() => {});

  const displayName = isStructured
    ? (itemKey ?? (kind === "npc" ? "NPC" : "OBJ"))
    : (itemKey ?? "");

  const kindLabel =
    kind === "npc" ? "NPC" : kind === "obj" ? "物件" : kind === "trap" ? "陷阱" : "脚本";

  // embedded = rendered inside a tab container (no width/border needed)
  const embedded = !!(onHoverEntry || onHoverLeave);

  // ===== 虚拟滚动 =====
  const EXPANDED_EXTRA = kind === "npc" ? 370 : 380; // 展开态额外高度（含分组标题）
  const OVERSCAN = 5;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 监听滚动容器尺寸
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(() => {
      if (scrollContainerRef.current) setContainerHeight(scrollContainerRef.current.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleVirtualScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  }, []);

  // 选中变更时滚动到对应位置（用 rAF 确保 DOM 已布局）
  useEffect(() => {
    if (!isStructured) return;
    if (
      selectedIdx === null ||
      selectedIdx === undefined ||
      selectedIdx < 0 ||
      selectedIdx >= entries.length
    )
      return;
    const raf = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const itemTop = selectedIdx * ITEM_HEIGHT;
      const itemBottom = itemTop + ITEM_HEIGHT;
      const { scrollTop: st, clientHeight: ch } = container;
      if (ch === 0 || itemTop < st || itemBottom > st + ch) {
        container.scrollTo({ top: Math.max(0, itemTop - ch / 3), behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedIdx, entries.length, isStructured]);

  // 计算虚拟滚动可见区域
  const { vStartIdx, vEndIdx, vTopPad, vBottomPad, vTotalHeight } = useMemo(() => {
    const hasSelected =
      selectedIdx !== null &&
      selectedIdx !== undefined &&
      selectedIdx >= 0 &&
      selectedIdx < entries.length;
    const total = entries.length * ITEM_HEIGHT + (hasSelected ? EXPANDED_EXTRA : 0);
    if (entries.length === 0 || containerHeight === 0) {
      return {
        vStartIdx: 0,
        vEndIdx: entries.length,
        vTopPad: 0,
        vBottomPad: 0,
        vTotalHeight: total,
      };
    }
    const getTop = (i: number) => {
      let t = i * ITEM_HEIGHT;
      if (hasSelected && i > selectedIdx!) t += EXPANDED_EXTRA;
      return t;
    };
    const getH = (i: number) => (i === selectedIdx ? ITEM_HEIGHT + EXPANDED_EXTRA : ITEM_HEIGHT);
    let start = 0;
    for (let i = 0; i < entries.length; i++) {
      if (getTop(i) + getH(i) > scrollTop) {
        start = i;
        break;
      }
    }
    start = Math.max(0, start - OVERSCAN);
    let end = entries.length;
    for (let i = start; i < entries.length; i++) {
      if (getTop(i) > scrollTop + containerHeight) {
        end = i;
        break;
      }
    }
    end = Math.min(entries.length, end + OVERSCAN);
    const tp = getTop(start);
    const bp = Math.max(0, total - (end < entries.length ? getTop(end) : total));
    return { vStartIdx: start, vEndIdx: end, vTopPad: tp, vBottomPad: bp, vTotalHeight: total };
  }, [entries.length, containerHeight, scrollTop, selectedIdx, EXPANDED_EXTRA]);

  return (
    <div
      className={
        embedded
          ? "flex flex-col flex-1 min-h-0"
          : "w-[420px] bg-[#252526] border-l border-panel-border flex flex-col shrink-0"
      }
    >
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#858585] shrink-0">
            {isStructured ? DashboardIcons.file : DashboardIcons.script}
          </span>
          <span className="text-sm text-white truncate">{displayName}</span>
          {isDirty && <span className="text-xs text-yellow-400 shrink-0">●</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {saveMessage && (
            <span
              className={`text-xs ${saveMessage.startsWith("已") ? "text-green-400" : "text-red-400"}`}
            >
              {saveMessage}
            </span>
          )}
          {/* 删除整个文件按钮 */}
          {itemKey && (
            <button
              type="button"
              onClick={() => setConfirmDeleteFile(true)}
              className="px-2 py-1 text-xs text-[#666] hover:text-red-400 transition-colors"
              title={`删除 ${itemKey}`}
            >
              {DashboardIcons.delete}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="px-2 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 删除确认条 */}
      {confirmDeleteFile && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#3c1f1f] border-b border-[#5c2020] shrink-0">
          <span className="text-xs text-red-300 flex-1 truncate">
            确认删除「{itemKey}」？此操作不可撤销
          </span>
          <button
            type="button"
            onClick={handleDeleteFile}
            disabled={isDeleting}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {isDeleting ? "删除中..." : "确认删除"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteFile(false)}
            className="px-2 py-0.5 text-xs text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isStructured ? (
          <>
            {/* 固定表头 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-panel-border shrink-0">
              <span className="text-xs text-[#858585]">
                共 {entries.length} 个{kind === "npc" ? "NPC" : "物件"}
              </span>
              <button
                type="button"
                onClick={addEntry}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
              >
                + 新增
              </button>
            </div>

            {/* 虚拟滚动列表 */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto"
              onScroll={handleVirtualScroll}
            >
              {entries.length > 0 ? (
                <>
                  <div style={{ height: vTopPad }} />
                  {entries.slice(vStartIdx, vEndIdx).map((entry, i) => {
                    const idx = vStartIdx + i;
                    return (
                      <div
                        key={idx}
                        className="border-b border-panel-border cursor-pointer transition-colors"
                        onMouseEnter={() => onHoverEntry?.(entry.mapX, entry.mapY)}
                        onMouseLeave={() => onHoverLeave?.()}
                      >
                        <div
                          className={`flex items-center justify-between px-3 py-1.5 ${
                            (selectedIdx ?? null) === idx ? "bg-[#094771]" : "hover:bg-[#2a2d2e]"
                          }`}
                          onClick={() => setSelectedIdx((selectedIdx ?? null) === idx ? null : idx)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-[#555] w-5 text-right shrink-0">
                              {idx}
                            </span>
                            <span className="text-sm text-[#cccccc] truncate">
                              {kind === "npc"
                                ? (entry as SceneNpcEntry).name || "(未命名)"
                                : (entry as SceneObjEntry).objName || "(未命名)"}
                            </span>
                            <span className="text-xs text-[#666]">
                              ({entry.mapX},{entry.mapY})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry(idx);
                            }}
                            className="p-0.5 text-[#555] hover:text-red-400 transition-colors shrink-0"
                            title="删除"
                          >
                            {DashboardIcons.close}
                          </button>
                        </div>

                        {(selectedIdx ?? null) === idx && (
                          <div
                            className="px-3 pb-2 pt-1.5 space-y-1.5 bg-[#1e1e1e]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {kind === "npc" ? (
                              <NpcEntryEditor
                                entry={entry as SceneNpcEntry}
                                onChange={(f, v) => updateEntry(idx, f, v)}
                                gameId={gameId}
                                gameSlug={gameSlug}
                                sceneData={sceneData}
                              />
                            ) : (
                              <ObjEntryEditor
                                entry={entry as SceneObjEntry}
                                onChange={(f, v) => updateEntry(idx, f, v)}
                                gameId={gameId}
                                gameSlug={gameSlug}
                                sceneData={sceneData}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ height: vBottomPad }} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-[#858585]">
                  <p className="text-sm mb-2">暂无{kind === "npc" ? "NPC" : "物件"}</p>
                  <button
                    type="button"
                    onClick={addEntry}
                    className="text-xs text-[#0098ff] hover:underline"
                  >
                    点击新增
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 脚本/陷阱：Monaco 编辑器 */
          <ScriptEditor
            value={content}
            onChange={(v) => setContent(v)}
            height="100%"
            minimap={false}
            fontSize={13}
            className="flex-1"
          />
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-panel-border text-xs text-[#858585] shrink-0">
        <span>{kindLabel}</span>
        <span>{itemKey ?? ""}</span>
      </div>
    </div>
  );
}

// ============= NPC/OBJ 字段编辑器 =============

/** 分组标题 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#666] uppercase tracking-wider pt-1 pb-0.5 border-b border-panel-border mb-1">
      {children}
    </div>
  );
}

/** 字段行容器 — 与 ResourceFilePicker 外观一致 */
const fieldBoxCls =
  "bg-[#2d2d2d] border border-widget-border rounded h-9 flex items-center px-2 gap-2 transition-colors focus-within:border-[#0098ff]";
const labelTagCls =
  "text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded shrink-0";
const inputCls = "flex-1 bg-transparent text-[#cccccc] text-xs outline-none min-w-0";
const numInputCls = "bg-transparent text-[#cccccc] text-xs outline-none w-14 flex-none text-center";
const selectCls =
  "flex-1 bg-transparent text-[#cccccc] text-xs outline-none cursor-pointer min-w-0 [&>option]:bg-[#2d2d2d] [&>option]:text-[#cccccc]";

/** 数字输入组件 — 文本模式，失焦时校验为数字 */
function NumInput({
  value,
  onChange,
  title,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  title?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const prevValue = useRef(value);
  // 外部 value 变化时同步（非聚焦态）
  useEffect(() => {
    if (value !== prevValue.current) {
      setText(String(value));
      prevValue.current = value;
    }
  }, [value]);
  const handleBlur = useCallback(() => {
    const n = Number(text);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      const rounded = Math.round(n);
      onChange(rounded);
      setText(String(rounded));
      prevValue.current = rounded;
    } else {
      // 非法值回退
      setText(String(value));
    }
  }, [text, value, onChange]);
  return (
    <input
      className={className ?? numInputCls}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      title={title}
    />
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={fieldBoxCls}>
      <span className={labelTagCls}>{label}</span>
      {children}
    </div>
  );
}

/** 脚本选择器 — 弹出两个 tab：当前地图脚本 / 公共脚本资源 */
function ScriptFieldPicker({
  value,
  onChange,
  sceneData,
  gameId,
  gameSlug,
}: {
  value: string;
  onChange: (v: string) => void;
  sceneData: SceneData;
  gameId: string;
  gameSlug: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "public">("map");

  const scriptNames = useMemo(
    () => Object.keys(sceneData.scripts ?? {}).sort(),
    [sceneData.scripts]
  );

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setDialogOpen(false);
    },
    [onChange]
  );

  const openDialog = useCallback(() => {
    setActiveTab("map");
    setDialogOpen(true);
  }, []);

  /* Tab 栏注入 FileSelectDialog 标题下方 */
  const tabBar = useMemo(
    () => (
      <div className="flex border-b border-widget-border shrink-0">
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "map"
              ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
              : "text-[#858585] hover:text-[#cccccc] border-transparent"
          }`}
          onClick={() => setActiveTab("map")}
        >
          当前地图
        </button>
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "public"
              ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
              : "text-[#858585] hover:text-[#cccccc] border-transparent"
          }`}
          onClick={() => setActiveTab("public")}
        >
          公共脚本
        </button>
      </div>
    ),
    [activeTab]
  );

  /* "当前地图" tab 的自定义内容 */
  const mapContent = useMemo(
    () => (
      <div className="overflow-y-auto flex-1 p-1.5 min-h-[250px]">
        {scriptNames.length === 0 ? (
          <div className="text-xs text-[#666] text-center py-8">当前地图无脚本条目</div>
        ) : (
          scriptNames.map((name) => (
            <button
              type="button"
              key={name}
              className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                name === value ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#2d2d2d]"
              }`}
              onClick={() => handleSelect(name)}
            >
              {DashboardIcons.script} <span className="ml-1">{name}</span>
            </button>
          ))
        )}
      </div>
    ),
    [scriptNames, value, handleSelect]
  );

  return (
    <>
      {/* 字段行 — 外观与 ResourceFilePicker inlineLabel 一致 */}
      <div className={`${fieldBoxCls} cursor-pointer hover:border-[#0098ff]`} onClick={openDialog}>
        <span className={labelTagCls}>脚本</span>
        <span className="flex-1 text-xs text-[#cccccc] truncate min-w-0">
          {value || <span className="text-[#666]">未选择</span>}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-[#666] hover:text-[#ccc] shrink-0 text-sm leading-none"
            title="清除"
          >
            ×
          </button>
        )}
      </div>

      {/* 统一弹窗 — 注入 tab 栏和当前地图内容到 FileSelectDialog */}
      <FileSelectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        fieldName="scriptFile"
        currentValue={value}
        extensions={[".txt"]}
        title="选择脚本"
        headerExtra={tabBar}
        customContent={activeTab === "map" ? mapContent : undefined}
      />
    </>
  );
}

function NpcEntryEditor({
  entry,
  onChange,
  gameId,
  gameSlug,
  sceneData,
}: {
  entry: SceneNpcEntry;
  onChange: (field: string, value: string | number) => void;
  gameId: string;
  gameSlug: string;
  sceneData: SceneData;
}) {
  return (
    <div className="space-y-1.5">
      {/* 基本信息 */}
      <SectionLabel>基本信息</SectionLabel>
      <FieldRow label="名称">
        <input
          className={inputCls}
          value={entry.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="类型">
        <select
          className={selectCls}
          value={entry.kind}
          onChange={(e) => onChange("kind", Number(e.target.value))}
        >
          {Object.entries(NPC_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <NpcResourcePicker
        label="外观"
        value={entry.npcIni}
        onChange={(v) => onChange("npcIni", v ?? "")}
        gameId={gameId}
        gameSlug={gameSlug}
        inlineLabel
      />

      {/* 位置 */}
      <SectionLabel>位置与方向</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>X</span>
        <NumInput value={entry.mapX} onChange={(v) => onChange("mapX", v)} />
        <span className={labelTagCls}>Y</span>
        <NumInput value={entry.mapY} onChange={(v) => onChange("mapY", v)} />
        <span className={labelTagCls}>朝向</span>
        <select
          className={`${selectCls} w-20 flex-none flex-0`}
          value={entry.dir}
          onChange={(e) => onChange("dir", Number(e.target.value))}
        >
          {Object.entries(DIRECTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* 行为 */}
      <SectionLabel>行为</SectionLabel>
      <FieldRow label="动作">
        <select
          className={selectCls}
          value={entry.action}
          onChange={(e) => onChange("action", Number(e.target.value))}
        >
          {Object.entries(ACTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <ScriptFieldPicker
        value={entry.scriptFile}
        onChange={(v) => onChange("scriptFile", v)}
        sceneData={sceneData}
        gameId={gameId}
        gameSlug={gameSlug}
      />
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>对话</span>
        <NumInput
          value={entry.dialogRadius}
          onChange={(v) => onChange("dialogRadius", v)}
          title="对话半径"
        />
        <span className={labelTagCls}>视野</span>
        <NumInput
          value={entry.visionRadius}
          onChange={(v) => onChange("visionRadius", v)}
          title="视野半径"
        />
      </div>

      {/* 阵营 */}
      <SectionLabel>阵营</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>关系</span>
        <select
          className={selectCls}
          value={entry.relation}
          onChange={(e) => onChange("relation", Number(e.target.value))}
        >
          {Object.entries(RELATION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className={labelTagCls}>组</span>
        <NumInput value={entry.group} onChange={(v) => onChange("group", v)} />
      </div>
    </div>
  );
}

function ObjEntryEditor({
  entry,
  onChange,
  gameId,
  gameSlug,
  sceneData,
}: {
  entry: SceneObjEntry;
  onChange: (field: string, value: string | number) => void;
  gameId: string;
  gameSlug: string;
  sceneData: SceneData;
}) {
  return (
    <div className="space-y-1.5">
      {/* 基本信息 */}
      <SectionLabel>基本信息</SectionLabel>
      <FieldRow label="名称">
        <input
          className={inputCls}
          value={entry.objName}
          onChange={(e) => onChange("objName", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="类型">
        <select
          className={selectCls}
          value={entry.kind}
          onChange={(e) => onChange("kind", Number(e.target.value))}
        >
          {Object.entries(OBJ_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <ResourceFilePicker
        label="资源"
        value={entry.objFile}
        onChange={(v) => onChange("objFile", v ?? "")}
        fieldName="objFile"
        gameId={gameId}
        gameSlug={gameSlug}
        extensions={[".obj"]}
        inlineLabel
      />

      {/* 位置 */}
      <SectionLabel>位置与方向</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>X</span>
        <NumInput value={entry.mapX} onChange={(v) => onChange("mapX", v)} />
        <span className={labelTagCls}>Y</span>
        <NumInput value={entry.mapY} onChange={(v) => onChange("mapY", v)} />
        <span className={labelTagCls}>朝向</span>
        <select
          className={`${selectCls} w-20 flex-none flex-0`}
          value={entry.dir}
          onChange={(e) => onChange("dir", Number(e.target.value))}
        >
          {Object.entries(DIRECTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>偏移X</span>
        <NumInput value={entry.offX} onChange={(v) => onChange("offX", v)} />
        <span className={labelTagCls}>偏移Y</span>
        <NumInput value={entry.offY} onChange={(v) => onChange("offY", v)} />
      </div>

      {/* 资源 */}
      <SectionLabel>资源</SectionLabel>
      <ResourceFilePicker
        label="音效"
        value={entry.wavFile}
        onChange={(v) => onChange("wavFile", v ?? "")}
        fieldName="wavFile"
        gameId={gameId}
        gameSlug={gameSlug}
        extensions={[".wav", ".ogg", ".mp3"]}
        inlineLabel
      />
      <ScriptFieldPicker
        value={entry.scriptFile}
        onChange={(v) => onChange("scriptFile", v)}
        sceneData={sceneData}
        gameId={gameId}
        gameSlug={gameSlug}
      />

      {/* 属性 */}
      <SectionLabel>属性</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>亮度</span>
        <NumInput value={entry.lum} onChange={(v) => onChange("lum", v)} />
        <span className={labelTagCls}>伤害</span>
        <NumInput value={entry.damage} onChange={(v) => onChange("damage", v)} />
        <span className={labelTagCls}>帧</span>
        <NumInput value={entry.frame} onChange={(v) => onChange("frame", v)} />
      </div>
    </div>
  );
}

// ============= 批量导入弹窗 =============

interface DropZoneFile {
  file: File;
  relativePath: string;
}

function useDropZone(accept?: string) {
  const [files, setFiles] = useState<DropZoneFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filterByExt = useCallback(
    (list: DropZoneFile[]): DropZoneFile[] => {
      if (!accept) return list;
      const exts = accept.split(",").map((e) => e.trim().toLowerCase());
      return list.filter(({ file }) => exts.some((ext) => file.name.toLowerCase().endsWith(ext)));
    },
    [accept]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      const droppedFiles: DropZoneFile[] = [];

      if (items) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }

        if (entries.length > 0 && entries.some((entry) => entry.isDirectory)) {
          const readEntries = async (entry: FileSystemEntry, basePath: string): Promise<void> => {
            if (entry.isFile) {
              const fileEntry = entry as FileSystemFileEntry;
              await new Promise<void>((resolve) => {
                fileEntry.file((file) => {
                  droppedFiles.push({ file, relativePath: basePath + file.name });
                  resolve();
                });
              });
            } else if (entry.isDirectory) {
              const dirEntry = entry as FileSystemDirectoryEntry;
              const reader = dirEntry.createReader();
              const subEntries = await new Promise<FileSystemEntry[]>((resolve) => {
                reader.readEntries(resolve);
              });
              for (const sub of subEntries) {
                await readEntries(sub, `${basePath + entry.name}/`);
              }
            }
          };

          Promise.all(entries.map((entry) => readEntries(entry, ""))).then(() =>
            setFiles((prev) => [...prev, ...filterByExt(droppedFiles)])
          );
          return;
        }
      }

      const fileList = e.dataTransfer.files;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        droppedFiles.push({ file, relativePath: file.name });
      }
      setFiles((prev) => [...prev, ...filterByExt(droppedFiles)]);
    },
    [filterByExt]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      const newFiles: DropZoneFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const path =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        newFiles.push({ file, relativePath: path });
      }
      setFiles((prev) => [...prev, ...filterByExt(newFiles)]);
    },
    [filterByExt]
  );

  const clear = useCallback(() => setFiles([]), []);

  return {
    files,
    isDragging,
    inputRef,
    clear,
    dragHandlers: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
      },
      onDragLeave: () => setIsDragging(false),
      onDrop: handleDrop,
    },
    handleFileInput,
  };
}

export function ImportScenesModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const mapZone = useDropZone(".mmf");
  const scriptZone = useDropZone(".txt");
  const saveZone = useDropZone(".npc,.obj");

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const importFileMutation = trpc.scene.importFile.useMutation();

  const fileToBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const handleImport = async () => {
    if (!gameId) return;
    setIsImporting(true);

    const stats = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    type ImportTask = { zone: "map" | "script" | "save"; file: File; relativePath: string };
    const tasks: ImportTask[] = [];
    for (const f of mapZone.files)
      tasks.push({ zone: "map", file: f.file, relativePath: f.relativePath });
    for (const f of scriptZone.files)
      tasks.push({ zone: "script", file: f.file, relativePath: f.relativePath });
    for (const f of saveZone.files)
      tasks.push({ zone: "save", file: f.file, relativePath: f.relativePath });

    setTotal(tasks.length);
    setCurrent(0);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setCurrent(i + 1);
      setProgress(`(${i + 1}/${tasks.length}) ${task.file.name}`);

      try {
        let content: string;
        let dirName: string | undefined;

        if (task.zone === "map") {
          content = await fileToBase64(task.file);
        } else {
          content = await task.file.text();
        }

        if (task.zone === "script") {
          const parts = task.relativePath.split("/");
          dirName = parts.length > 1 ? parts[parts.length - 2] : undefined;
        }

        const res = await importFileMutation.mutateAsync({
          gameId,
          zone: task.zone,
          fileName: task.file.name,
          dirName,
          content,
        });

        if (res.action === "created") stats.created++;
        else if (res.action === "updated") stats.updated++;
        else if (res.action === "skipped") stats.skipped++;
        else if (res.action === "error") stats.errors.push(`${task.file.name}: ${res.error}`);
      } catch (e) {
        stats.errors.push(`${task.file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    setResult(stats);
    setProgress("导入完成！");
    setIsImporting(false);
    onSuccess();
  };

  const totalFiles = mapZone.files.length + scriptZone.files.length + saveZone.files.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e1e] border border-widget-border rounded-lg w-[900px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border">
          <h2 className="text-lg font-medium text-white">批量导入场景</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="space-y-4">
              <h3 className="text-white font-medium mb-3">导入结果</h3>
              <div className="grid grid-cols-3 gap-2 text-sm text-[#cccccc]">
                <div className="bg-[#252526] px-3 py-2 rounded">
                  创建: <span className="text-green-400">{result.created}</span>
                </div>
                <div className="bg-[#252526] px-3 py-2 rounded">
                  更新: <span className="text-blue-400">{result.updated}</span>
                </div>
                <div className="bg-[#252526] px-3 py-2 rounded">
                  跳过: <span className="text-yellow-400">{result.skipped}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-yellow-400 text-sm mb-1">错误信息:</h4>
                  <div className="bg-[#1a1a1a] p-3 rounded max-h-32 overflow-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-400">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[#858585] mb-4">
                将文件拖拽到对应区域，或点击选择文件。地图文件上传到文件系统，其他数据解析为 JSON
                存入场景。
              </p>

              <DropZoneArea
                label="地图文件 (*.mmf)"
                icon="map"
                zone={mapZone}
                accept=".mmf"
                isDirectory={false}
              />

              <DropZoneArea
                label="脚本目录 (script/map/*/*.txt)"
                icon="script"
                zone={scriptZone}
                accept=".txt"
                isDirectory
              />

              <DropZoneArea
                label="NPC/OBJ 文件 (*.npc, *.obj)"
                icon="file"
                zone={saveZone}
                accept=".npc,.obj"
                isDirectory={false}
              />

              {progress && (
                <div className="space-y-2">
                  <div className="text-sm text-[#858585] bg-[#252526] px-4 py-2 rounded">
                    {progress}
                  </div>
                  {total > 0 && (
                    <div className="w-full bg-[#1a1a1a] rounded-full h-2">
                      <div
                        className="bg-[#0e639c] h-2 rounded-full transition-all duration-200"
                        style={{ width: `${(current / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-panel-border">
          <span className="text-xs text-[#858585]">
            {result ? "完成" : `已选择 ${totalFiles} 个文件`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
            >
              {result ? "关闭" : "取消"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || totalFiles === 0}
                className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {isImporting ? `导入中 (${current}/${total})...` : "开始导入"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= 拖拽区域组件 =============

function DropZoneArea({
  label,
  icon,
  zone,
  accept,
  isDirectory,
}: {
  label: string;
  icon: keyof typeof DashboardIcons;
  zone: ReturnType<typeof useDropZone>;
  accept: string;
  isDirectory: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#858585]">{DashboardIcons[icon]}</span>
        <span className="text-sm text-[#cccccc]">{label}</span>
        {zone.files.length > 0 && (
          <>
            <span className="text-xs text-green-400">({zone.files.length} 个文件)</span>
            <button
              type="button"
              onClick={zone.clear}
              className="text-xs text-red-400 hover:text-red-300 ml-auto"
            >
              清除
            </button>
          </>
        )}
      </div>
      <div
        {...zone.dragHandlers}
        className={`relative border-2 border-dashed rounded-lg transition-colors ${
          zone.isDragging
            ? "border-[#0098ff] bg-[#0098ff]/10"
            : zone.files.length > 0
              ? "border-green-600/50 bg-green-600/5"
              : "border-widget-border hover:border-[#666]"
        }`}
      >
        {zone.files.length === 0 ? (
          <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
            <span className="text-[#858585] text-2xl mb-1">{DashboardIcons.upload}</span>
            <span className="text-xs text-[#858585]">
              {isDirectory ? "拖拽文件夹到此处或点击选择" : "拖拽文件到此处或点击选择"}
            </span>
            <input
              ref={zone.inputRef}
              type="file"
              accept={accept}
              multiple
              {...(isDirectory ? ({ webkitdirectory: "" } as Record<string, string>) : {})}
              onChange={zone.handleFileInput}
              className="hidden"
            />
          </label>
        ) : (
          <div className="p-3">
            <div className="max-h-24 overflow-y-auto space-y-0.5">
              {zone.files.slice(0, 20).map(({ relativePath }, i) => (
                <div key={i} className="text-xs text-[#cccccc] truncate">
                  {relativePath}
                </div>
              ))}
              {zone.files.length > 20 && (
                <div className="text-xs text-[#858585]">
                  ...还有 {zone.files.length - 20} 个文件
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
