/**
 * Dashboard 侧边栏面板
 * 根据当前选中的模块显示不同的子菜单
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { NavLink, useParams, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import { DashboardIcons } from "./icons";
import { trpc } from "../../lib/trpc";
import { getFrameCanvas } from "@miu2d/engine/resource/asf";
import { initWasm } from "@miu2d/engine/wasm/wasmManager";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasmAsfDecoder";

interface TreeNode {
  id: string;
  label: string;
  path?: string;
  icon?: keyof typeof DashboardIcons;
  children?: TreeNode[];
}

// 游戏编辑模块的子菜单
const gameSettingsTree: TreeNode[] = [
  { id: "config", label: "基础配置", path: "config", icon: "settings" },
  { id: "newgame", label: "新游戏触发脚本", path: "newgame", icon: "script" },
  { id: "player", label: "游戏主角", path: "player", icon: "character" },
];

// 场景编辑模块的子菜单
const scenesTree: TreeNode[] = [
  {
    id: "maps",
    label: "地图编辑器",
    icon: "map",
    children: [
      { id: "map-editor", label: "地图编辑", path: "map-editor" },
      { id: "mpc-files", label: "MPC地图文件", path: "mpc" },
    ],
  },
  {
    id: "dialogs",
    label: "对话管理",
    icon: "dialog",
    path: "dialogs",
  },
  {
    id: "map-npcs",
    label: "地图NPC",
    icon: "npc",
    path: "map-npcs",
  },
  {
    id: "map-objects",
    label: "地图物品",
    icon: "goods",
    path: "map-objects",
  },
  {
    id: "scene-scripts",
    label: "场景脚本",
    icon: "script",
    path: "scene-scripts",
  },
];

// 数据统计模块的子菜单
const statisticsTree: TreeNode[] = [
  { id: "player-data", label: "玩家数据", path: "player-data", icon: "user" },
  { id: "player-saves", label: "玩家存档", path: "player-saves", icon: "save" },
];

interface SidebarPanelProps {
  title: string;
  children: React.ReactNode;
}

function SidebarPanel({ title, children }: SidebarPanelProps) {
  const { sidebarCollapsed } = useDashboard();

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]">
      <div className="flex h-9 items-center px-4 text-xs font-medium uppercase tracking-wide text-[#bbbbbb] border-b border-[#1e1e1e]">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto py-1">{children}</div>
    </div>
  );
}

interface TreeItemProps {
  node: TreeNode;
  basePath: string;
  level?: number;
}

function TreeItem({ node, basePath, level = 0 }: TreeItemProps) {
  const { expandedNodes, toggleNode } = useDashboard();
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const fullPath = node.path ? `${basePath}/${node.path}` : basePath;

  const paddingLeft = 12 + level * 16;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleNode(node.id)}
          className="flex w-full items-center gap-1 py-1 pr-2 text-left text-sm hover:bg-[#2a2d2e] transition-colors"
          style={{ paddingLeft }}
        >
          <span
            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
          >
            {DashboardIcons.chevronRight}
          </span>
          {node.icon && (
            <span className="text-[#858585]">{DashboardIcons[node.icon]}</span>
          )}
          <span className="truncate">{node.label}</span>
        </button>
        {isExpanded && (
          <div>
            {node.children!.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                basePath={basePath}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={fullPath}
      className={({ isActive }) =>
        `flex items-center gap-2 py-1 pr-2 text-sm transition-colors ${
          isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
        }`
      }
      style={{ paddingLeft: paddingLeft + 16 }}
    >
      {node.icon && (
        <span className="text-[#858585]">{DashboardIcons[node.icon]}</span>
      )}
      <span className="truncate">{node.label}</span>
    </NavLink>
  );
}

function TreeView({ nodes, basePath }: { nodes: TreeNode[]; basePath: string }) {
  return (
    <div>
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} basePath={basePath} />
      ))}
    </div>
  );
}

// 通用列表面板（用于角色、NPC、物品等的动态列表）
interface ListPanelProps {
  title: string;
  basePath: string;
  items: { id: string; name: string }[];
  isLoading?: boolean;
  onAdd?: () => void;
}

function ListPanel({ title, basePath, items, isLoading, onAdd }: ListPanelProps) {
  const { sidebarCollapsed } = useDashboard();

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]">
      <div className="flex h-9 items-center justify-between px-4 border-b border-[#1e1e1e]">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
          {title}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
            title="添加"
          >
            {DashboardIcons.add}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-2 text-sm text-[#858585]">暂无数据</div>
        ) : (
          items.map((item) => (
            <NavLink
              key={item.id}
              to={`${basePath}/${item.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-1 text-sm transition-colors ${
                  isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                }`
              }
            >
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))
        )}
      </div>
    </div>
  );
}

// WASM 初始化状态（全局单例）
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmInit(): Promise<boolean> {
  if (wasmInitialized) return true;
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm().then(() => {
      wasmInitialized = true;
    }).catch((err) => {
      console.error("Failed to init ASF WASM:", err);
    });
  }
  await wasmInitPromise;
  return wasmInitialized;
}

// ASF 图标缓存
const asfIconCache = new Map<string, string>();

// 武功图标组件 - 加载并显示 ASF 第一帧
function MagicIcon({ iconPath, gameSlug, size = 32 }: { iconPath?: string | null; gameSlug?: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadedPathRef = useRef<string | null>(null);

  const sizeStyle = { width: size, height: size };

  useEffect(() => {
    if (!iconPath || !gameSlug) {
      setDataUrl(null);
      loadedPathRef.current = null;
      return;
    }

    let resourcePath = iconPath;
    if (!resourcePath.startsWith("asf/")) {
      resourcePath = `asf/magic/${resourcePath}`;
    }
    const cacheKey = `${gameSlug}:${resourcePath}`;

    if (cacheKey === loadedPathRef.current && dataUrl) {
      return;
    }

    const cached = asfIconCache.get(cacheKey);
    if (cached) {
      loadedPathRef.current = cacheKey;
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDataUrl(null);

    const loadIcon = async () => {
      try {
        const ready = await ensureWasmInit();
        if (!ready || cancelled) return;

        const encodedPath = resourcePath.split('/').map(encodeURIComponent).join('/');
        const url = `/game/${gameSlug}/resources/${encodedPath}`;
        const response = await fetch(url);
        if (!response.ok || cancelled) return;

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const decodedAsf = decodeAsfWasm(buffer);
        if (!decodedAsf || !decodedAsf.frames || decodedAsf.frames.length === 0 || cancelled) return;

        const canvas = getFrameCanvas(decodedAsf.frames[0]);
        if (!canvas || cancelled) return;

        const url2 = canvas.toDataURL();
        asfIconCache.set(cacheKey, url2);
        loadedPathRef.current = cacheKey;
        setDataUrl(url2);
      } catch (err) {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadIcon();

    return () => {
      cancelled = true;
    };
  }, [iconPath, gameSlug, dataUrl]);

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt=""
        className="flex-shrink-0 object-contain"
        style={{ ...sizeStyle, imageRendering: "pixelated" }}
      />
    );
  }

  if (isLoading) {
    return <span className="flex-shrink-0 animate-pulse bg-[#3c3c3c] rounded" style={sizeStyle} />;
  }

  return (
    <span className="flex-shrink-0 flex items-center justify-center text-[#888]" style={sizeStyle}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: size * 0.875, height: size * 0.875 }}>
        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

// 武功列表面板 - 使用 tRPC 查询真实数据，包含操作按钮
function MagicListPanel({ basePath }: { basePath: string }) {
  const { currentGame, sidebarCollapsed } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "player" | "npc">("all");

  const { data: magics, isLoading, refetch } = trpc.magic.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 根据过滤条件筛选武功
  const filteredMagics = magics?.filter((m) =>
    filterType === "all" ? true : m.userType === filterType
  );

  const importMutation = trpc.magic.importFromIni.useMutation({
    onSuccess: (data) => {
      refetch();
      setShowImportModal(false);
      navigate(`${basePath}/${data.id}`);
    },
  });

  const batchImportMutation = trpc.magic.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        // 导航到第一个成功导入的武功
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            武功列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建武功</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "all"
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterType("player")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "player"
                ? "bg-blue-600 text-white"
                : "text-blue-400 hover:bg-[#3c3c3c]"
            }`}
          >
            玩家
          </button>
          <button
            type="button"
            onClick={() => setFilterType("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "npc"
                ? "bg-orange-600 text-white"
                : "text-orange-400 hover:bg-[#3c3c3c]"
            }`}
          >
            NPC
          </button>
        </div>

        {/* 武功列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !filteredMagics || filteredMagics.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">
              {magics && magics.length > 0 ? "没有匹配的武功" : "暂无武功"}
            </div>
          ) : (
            filteredMagics.map((magic) => (
              <NavLink
                key={magic.id}
                to={`${basePath}/${magic.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <MagicIcon iconPath={magic.icon} gameSlug={currentGame?.slug} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{magic.name}</span>
                    <span className={`text-xs ${magic.userType === "player" ? "text-blue-400" : "text-orange-400"}`}>
                      {magic.userType === "player" ? "玩家" : "NPC"}
                    </span>
                  </div>
                  <div className="text-xs text-[#858585] truncate">{magic.key}</div>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportMagicModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onImport={(fileName, iniContent, userType, attackFileContent) => {
            importMutation.mutate({ gameId: gameId!, fileName, iniContent, userType, attackFileContent });
          }}
          onBatchImport={(items) => {
            // 每个 item 已经有 userType 字段，不需要全局指定
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={importMutation.isPending || batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}

      {/* 新建武功模态框 */}
      {showCreateModal && (
        <CreateMagicModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// INI 导入模态框组件 - 支持单个文件和目录批量导入
interface BatchImportItem {
  fileName: string;
  iniContent: string;
  attackFileContent?: string;
  userType?: "player" | "npc"; // 可选，用于自动识别
}

/**
 * 根据文件名自动检测武功类型
 * 规则：路径中包含 "player" 识别为玩家武功，其他都是 NPC 武功
 */
function detectUserTypeFromFileName(fileName: string): "player" | "npc" {
  return fileName.toLowerCase().includes("player") ? "player" : "npc";
}

interface BatchImportResult {
  success: Array<{ fileName: string; id: string; name: string; isFlyingMagic: boolean }>;
  failed: Array<{ fileName: string; error: string }>;
}

function ImportMagicModal({
  gameId,
  onClose,
  onImport,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onImport: (fileName: string, iniContent: string, userType: "player" | "npc", attackFileContent?: string) => void;
  onBatchImport: (items: BatchImportItem[]) => void; // userType 现在包含在每个 item 中
  isLoading: boolean;
  batchResult?: BatchImportResult | null;
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [userType, setUserType] = useState<"player" | "npc">("player");
  // 单个导入
  const [iniContent, setIniContent] = useState("");
  const [iniFileName, setIniFileName] = useState("");
  const [attackFileContent, setAttackFileContent] = useState("");
  const [attackFileName, setAttackFileName] = useState("");
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [isDraggingAttack, setIsDraggingAttack] = useState(false);
  // 批量导入
  const [batchItems, setBatchItems] = useState<BatchImportItem[]>([]);
  const [isDraggingBatch, setIsDraggingBatch] = useState(false);

  const handleFile = (file: File, type: "main" | "attack") => {
    if (file?.name.endsWith(".ini")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (type === "main") {
          setIniContent(content);
          setIniFileName(file.name);
        } else {
          setAttackFileContent(content);
          setAttackFileName(file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "main" | "attack") => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, type);
  };

  const handleDrop = (e: React.DragEvent, type: "main" | "attack") => {
    e.preventDefault();
    if (type === "main") setIsDraggingMain(false);
    else setIsDraggingAttack(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent, type: "main" | "attack") => {
    e.preventDefault();
    if (type === "main") setIsDraggingMain(true);
    else setIsDraggingAttack(true);
  };

  const handleDragLeave = (type: "main" | "attack") => {
    if (type === "main") setIsDraggingMain(false);
    else setIsDraggingAttack(false);
  };

  // 批量导入：处理目录拖拽
  const handleBatchDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBatch(false);

    const items: BatchImportItem[] = [];
    const files = e.dataTransfer.items;

    // 第一步：收集所有 INI 文件（文件名 -> {file, fullPath}）
    const allIniFiles: Map<string, { file: File; fullPath: string }> = new Map();

    const processEntry = async (entry: FileSystemEntry, basePath = "") => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (file.name.toLowerCase().endsWith(".ini")) {
          // 存储文件名（小写）-> {file, fullPath} 的映射
          const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
          allIniFiles.set(file.name.toLowerCase(), { file, fullPath });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        for (const subEntry of entries) {
          await processEntry(subEntry, basePath ? `${basePath}/${entry.name}` : entry.name);
        }
      }
    };

    // 处理拖入的所有项目
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    // 第二步：读取每个 INI 文件，解析 AttackFile 字段
    // 记录哪些文件是 AttackFile（被其他文件引用的）
    const attackFileNames = new Set<string>();
    const mainFileContents: Map<string, { file: File; fullPath: string; content: string; attackFileName?: string }> = new Map();

    for (const [fileName, { file, fullPath }] of allIniFiles) {
      const content = await file.text();

      // 解析 AttackFile 字段
      const attackFileMatch = content.match(/^\s*AttackFile\s*=\s*(.+?)\s*$/im);
      if (attackFileMatch) {
        const attackFileName = attackFileMatch[1].toLowerCase();
        attackFileNames.add(attackFileName);
        mainFileContents.set(fileName, { file, fullPath, content, attackFileName });
      } else {
        mainFileContents.set(fileName, { file, fullPath, content });
      }
    }

    // 第三步：构建导入项目列表
    // 只导入主武功文件（排除被引用的 AttackFile）
    for (const [fileName, info] of mainFileContents) {
      // 如果这个文件是其他文件的 AttackFile，跳过（它会被关联到主文件）
      if (attackFileNames.has(fileName)) {
        continue;
      }

      let attackContent: string | undefined;

      // 如果有 AttackFile 引用，查找并读取
      if (info.attackFileName) {
        const attackFileInfo = allIniFiles.get(info.attackFileName);
        if (attackFileInfo) {
          attackContent = await attackFileInfo.file.text();
        }
      }

      // 自动检测 userType：路径中包含 "player" 则为玩家武功
      const detectedUserType = detectUserTypeFromFileName(info.fullPath);

      items.push({
        fileName: info.file.name,
        iniContent: info.content,
        attackFileContent: attackContent,
        userType: detectedUserType,
      });
    }

    if (items.length > 0) {
      setBatchItems(items);
      setMode("batch");
    }
  };

  const handleBatchDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBatch(true);
  };

  const handleBatchDragLeave = () => {
    setIsDraggingBatch(false);
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 切换某个批量导入项的 userType
  const toggleBatchItemUserType = (index: number) => {
    setBatchItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      // 循环切换: undefined -> player -> npc -> player ...
      const nextType = item.userType === "player" ? "npc" : "player";
      return { ...item, userType: nextType };
    }));
  };

  // 检查是否有未选择类型的项目
  const hasUnselectedItems = batchItems.some((item) => !item.userType);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-[#454545] w-[600px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h3 className="font-medium text-white">从 INI 导入武功</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 模式切换 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                mode === "single"
                  ? "bg-[#0e639c] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4a4a4a]"
              }`}
            >
              单个导入
            </button>
            <button
              type="button"
              onClick={() => setMode("batch")}
              className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                mode === "batch"
                  ? "bg-[#0e639c] text-white"
                  : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4a4a4a]"
              }`}
            >
              批量导入
            </button>
          </div>

          {mode === "single" ? (
            <>
              {/* 单个导入时选择武功类型 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">武功类型</label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value as "player" | "npc")}
                  className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white"
                >
                  <option value="player">玩家武功</option>
                  <option value="npc">NPC 武功</option>
                </select>
              </div>

              {/* 主武功 INI 文件 - 支持拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">武功 INI 文件</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDraggingMain
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : iniContent
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-[#454545] hover:border-[#0098ff]"
                  }`}
                  onDragOver={(e) => handleDragOver(e, "main")}
                  onDragLeave={() => handleDragLeave("main")}
                  onDrop={(e) => handleDrop(e, "main")}
                >
                  {iniContent ? (
                    <div className="text-green-400 flex items-center justify-center gap-2">
                      <span>✓</span>
                      <span>{iniFileName}</span>
                    </div>
                  ) : (
                    <div className="text-[#858585]">
                      <p className="mb-2">拖放 .ini 文件到这里</p>
                      <p className="text-xs">或点击下方选择文件</p>
                    </div>
                  )}
                  <label className="mt-2 inline-block px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm cursor-pointer">
                    选择文件
                    <input
                      type="file"
                      accept=".ini"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, "main")}
                    />
                  </label>
                </div>
              </div>

              {/* AttackFile INI - 支持拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">AttackFile INI（可选，用于飞行武功）</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDraggingAttack
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : attackFileContent
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-[#454545] hover:border-[#0098ff]"
                  }`}
                  onDragOver={(e) => handleDragOver(e, "attack")}
                  onDragLeave={() => handleDragLeave("attack")}
                  onDrop={(e) => handleDrop(e, "attack")}
                >
                  {attackFileContent ? (
                    <div className="text-green-400 flex items-center justify-center gap-2">
                      <span>✓</span>
                      <span>{attackFileName}</span>
                    </div>
                  ) : (
                    <div className="text-[#858585] text-sm">
                      拖放或选择 AttackFile .ini 文件
                    </div>
                  )}
                  <label className="mt-2 inline-block px-3 py-1 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-sm cursor-pointer">
                    选择文件
                    <input
                      type="file"
                      accept=".ini"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, "attack")}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 批量导入 - 支持目录拖放 */}
              <div>
                <label className="block text-sm text-[#cccccc] mb-2">
                  拖放目录或多个 INI 文件
                  <span className="text-[#858585] ml-2">
                    (自动识别 AttackFile 匹配飞行武功)
                  </span>
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    isDraggingBatch
                      ? "border-[#0098ff] bg-[#0098ff]/10"
                      : batchItems.length > 0
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-[#454545] hover:border-[#0098ff]"
                  }`}
                  onDragOver={handleBatchDragOver}
                  onDragLeave={handleBatchDragLeave}
                  onDrop={handleBatchDrop}
                >
                  {batchItems.length === 0 ? (
                    <div className="text-[#858585]">
                      <p className="mb-2 text-lg">📁 拖放武功目录到这里</p>
                      <p className="text-xs">
                        支持拖放整个 ini/magic 目录，自动扫描所有武功文件
                      </p>
                      <p className="text-xs mt-1">
                        自动识别：路径包含 "player" → 玩家武功，其他需手动选择
                      </p>
                    </div>
                  ) : (
                    <div className="text-green-400">
                      ✓ 已扫描 {batchItems.length} 个武功
                      <span className="text-blue-400 ml-2">
                        {batchItems.filter((i) => i.userType === "player").length} 玩家
                      </span>
                      <span className="text-orange-400 ml-2">
                        {batchItems.filter((i) => i.userType === "npc").length} NPC
                      </span>
                      {hasUnselectedItems && (
                        <span className="text-yellow-400 ml-2">
                          ⚠️ {batchItems.filter((i) => !i.userType).length} 待选择
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 批量导入列表 */}
              {batchItems.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-[#454545] rounded">
                  {batchItems.map((item, index) => (
                    <div
                      key={item.fileName}
                      className="flex items-center justify-between px-3 py-2 border-b border-[#454545] last:border-b-0 hover:bg-[#2a2d2e]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{item.fileName}</span>
                        {/* 可点击切换的类型标签 */}
                        <button
                          type="button"
                          onClick={() => toggleBatchItemUserType(index)}
                          className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                            item.userType === "player"
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"
                              : item.userType === "npc"
                              ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/40"
                              : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 animate-pulse"
                          }`}
                          title="点击切换类型"
                        >
                          {item.userType === "player" ? "玩家" : item.userType === "npc" ? "NPC" : "选择类型"}
                        </button>
                        {item.attackFileContent && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                            飞行
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBatchItem(index)}
                        className="text-[#858585] hover:text-red-400 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 批量导入结果 */}
              {batchResult && (
                <div className="space-y-2">
                  {batchResult.success.length > 0 && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                      <p className="text-green-400 text-sm font-medium mb-1">
                        ✓ 成功导入 {batchResult.success.length} 个武功
                      </p>
                      <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                        {batchResult.success.map((s) => (
                          <div key={s.id}>
                            {s.name} {s.isFlyingMagic && "(飞行)"}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {batchResult.failed.length > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                      <p className="text-red-400 text-sm font-medium mb-1">
                        ✗ 失败 {batchResult.failed.length} 个
                      </p>
                      <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
                        {batchResult.failed.map((f) => (
                          <div key={f.fileName}>
                            {f.fileName}: {f.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            {batchResult ? "关闭" : "取消"}
          </button>
          {mode === "single" ? (
            <button
              type="button"
              onClick={() => onImport(iniFileName, iniContent, userType, attackFileContent || undefined)}
              disabled={!iniContent || !iniFileName || isLoading}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            >
              {isLoading ? "导入中..." : "导入"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onBatchImport(batchItems)}
              disabled={batchItems.length === 0 || hasUnselectedItems || isLoading}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
            >
              {isLoading ? "导入中..." : `批量导入 (${batchItems.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 新建武功弹窗 ==========
function CreateMagicModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"player" | "npc">("player");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = trpc.magic.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      userType,
      key: key || `magic_${Date.now()}`,
      name: name || "新武功",
      intro: intro || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-xl w-[480px]">
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h2 className="text-base font-medium text-white">新建武功</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 类型选择 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-2">武功类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUserType("player")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                  userType === "player"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">👤</span>
                <span>玩家武功</span>
              </button>
              <button
                type="button"
                onClick={() => setUserType("npc")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                  userType === "npc"
                    ? "bg-orange-600/20 border-orange-500 text-orange-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">🤖</span>
                <span>NPC 武功</span>
              </button>
            </div>
          </div>

          {/* 武功名称 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">武功名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：降龙十八掌"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
            />
          </div>

          {/* 标识符 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">标识符 (Key)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="例如：player-magic-降龙十八掌.ini（留空自动生成）"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
            />
          </div>

          {/* 武功介绍 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">武功介绍</label>
            <textarea
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="简单描述武功的效果..."
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff] resize-none"
            />
          </div>

          {/* 错误提示 */}
          {createMutation.isError && (
            <p className="text-xs text-red-400">
              创建失败: {createMutation.error.message}
            </p>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 创建等级配置弹窗 ==========
function CreateLevelConfigModal({
  isOpen,
  onClose,
  gameId,
  basePath,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  basePath: string;
  onSuccess: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"player" | "npc">("player");
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = trpc.level.importFromIni.useMutation({
    onSuccess: (data) => {
      onSuccess(data.id);
      onClose();
    },
  });

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".ini")) return;
    const content = await file.text();
    importMutation.mutate({
      gameId,
      fileName: file.name,
      userType,
      iniContent: content,
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleManualCreate = () => {
    navigate(`${basePath}/new?type=${userType}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-xl w-[420px] max-h-[90vh] overflow-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h2 className="text-base font-medium text-white">新建等级配置</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 类型选择 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-2">配置类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUserType("player")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  userType === "player"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">👤</span>
                <span>玩家</span>
              </button>
              <button
                type="button"
                onClick={() => setUserType("npc")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  userType === "npc"
                    ? "bg-orange-600/20 border-orange-500 text-orange-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">🤖</span>
                <span>NPC</span>
              </button>
            </div>
          </div>

          {/* 创建方式选择 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-2">创建方式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mode === "upload"
                    ? "bg-[#094771] border-[#0098ff] text-white"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                📥 导入 INI
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mode === "manual"
                    ? "bg-[#094771] border-[#0098ff] text-white"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                ✏️ 手动创建
              </button>
            </div>
          </div>

          {/* 内容区 */}
          {mode === "upload" ? (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging
                  ? "border-[#0098ff] bg-[#0098ff]/10"
                  : "border-[#555] hover:border-[#666]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ini"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
              <div className="text-3xl mb-2">📄</div>
              <p className="text-sm text-[#cccccc] mb-1">
                拖放 INI 文件到这里
              </p>
              <p className="text-xs text-[#858585] mb-3">或者</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {importMutation.isPending ? "导入中..." : "选择文件"}
              </button>
              {importMutation.isError && (
                <p className="text-xs text-red-400 mt-2">
                  导入失败: {importMutation.error.message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#858585]">
                点击下方按钮进入编辑器，手动配置等级属性。
              </p>
              <button
                type="button"
                onClick={handleManualCreate}
                className="w-full px-4 py-2.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>开始创建</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 物品列表面板 ==========
function GoodsListPanel({ basePath }: { basePath: string }) {
  const { currentGame, sidebarCollapsed } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // 分组折叠状态 (支持二级分组，如 "Equipment" 或 "Equipment:Hand")
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: goodsList, isLoading, refetch } = trpc.goods.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  // 装备部位标签
  const partLabels: Record<string, string> = {
    Hand: "武器",
    Head: "头部",
    Body: "身体",
    Foot: "鞋子",
    Neck: "项链",
    Back: "披风",
    Wrist: "手镯",
  };

  const partIcons: Record<string, string> = {
    Hand: "🗡️",
    Head: "👒",
    Body: "👘",
    Foot: "👟",
    Neck: "📿",
    Back: "🧥",
    Wrist: "⌚",
  };

  // 按种类分组，装备类继续按 Part 分组
  const groupedGoods = useMemo(() => {
    if (!goodsList) return { Consumable: [], Equipment: {}, Quest: [] };

    const consumables: typeof goodsList = [];
    const quests: typeof goodsList = [];
    const equipmentByPart: Record<string, typeof goodsList> = {};

    for (const g of goodsList) {
      if (g.kind === "Consumable") {
        consumables.push(g);
      } else if (g.kind === "Quest") {
        quests.push(g);
      } else if (g.kind === "Equipment") {
        const part = g.part || "Other";
        if (!equipmentByPart[part]) {
          equipmentByPart[part] = [];
        }
        equipmentByPart[part].push(g);
      }
    }

    return {
      Consumable: consumables,
      Equipment: equipmentByPart,
      Quest: quests,
    };
  }, [goodsList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const batchImportMutation = trpc.goods.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  if (sidebarCollapsed) {
    return null;
  }

  const kindLabels = {
    Consumable: "消耗品",
    Equipment: "装备",
    Quest: "任务道具",
  };

  const kindIcons = {
    Consumable: "🍵",
    Equipment: "⚔️",
    Quest: "📜",
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            物品列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建物品</span>
          </button>
        </div>

        {/* 物品列表 - 按种类分组树形展示 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !goodsList || goodsList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无物品</div>
          ) : (
            <>
              {/* 消耗品分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Consumable")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Consumable ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Consumable}</span>
                  <span>{kindLabels.Consumable}</span>
                  <span className="text-[#666]">({groupedGoods.Consumable.length})</span>
                </button>
                {!collapsedGroups.Consumable && groupedGoods.Consumable.map((goods) => (
                  <NavLink
                    key={goods.id}
                    to={`${basePath}/${goods.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                        isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                      }`
                    }
                  >
                    <GoodsIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{goods.name}</span>
                      <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                    </div>
                  </NavLink>
                ))}
              </div>

              {/* 装备分组 - 带二级子分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Equipment")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Equipment ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Equipment}</span>
                  <span>{kindLabels.Equipment}</span>
                  <span className="text-[#666]">({Object.values(groupedGoods.Equipment).flat().length})</span>
                </button>
                {!collapsedGroups.Equipment && Object.entries(groupedGoods.Equipment).map(([part, items]) => (
                  <div key={part}>
                    {/* 二级分组标题 - Part */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(`Equipment:${part}`)}
                      className="w-full px-3 py-1 pl-6 text-xs text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                    >
                      <span className={`transition-transform text-[10px] ${collapsedGroups[`Equipment:${part}`] ? '' : 'rotate-90'}`}>▶</span>
                      <span>{partIcons[part] || "📦"}</span>
                      <span>{partLabels[part] || part}</span>
                      <span className="text-[#555]">({items.length})</span>
                    </button>
                    {/* 二级分组内容 */}
                    {!collapsedGroups[`Equipment:${part}`] && items.map((goods) => (
                      <NavLink
                        key={goods.id}
                        to={`${basePath}/${goods.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 pl-10 text-sm transition-colors ${
                            isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                          }`
                        }
                      >
                        <GoodsIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{goods.name}</span>
                          <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                        </div>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>

              {/* 任务道具分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Quest")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span className={`transition-transform ${collapsedGroups.Quest ? '' : 'rotate-90'}`}>▶</span>
                  <span>{kindIcons.Quest}</span>
                  <span>{kindLabels.Quest}</span>
                  <span className="text-[#666]">({groupedGoods.Quest.length})</span>
                </button>
                {!collapsedGroups.Quest && groupedGoods.Quest.map((goods) => (
                  <NavLink
                    key={goods.id}
                    to={`${basePath}/${goods.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                        isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                      }`
                    }
                  >
                    <GoodsIcon iconPath={goods.icon} gameSlug={currentGame?.slug} size={32} />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{goods.name}</span>
                      <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                    </div>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportGoodsModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}

      {/* 新建物品模态框 */}
      {showCreateModal && (
        <CreateGoodsModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// 物品图标组件
function GoodsIcon({ iconPath, gameSlug, size = 32 }: { iconPath?: string | null; gameSlug?: string; size?: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!iconPath || !gameSlug) return;

    let resourcePath = iconPath;
    if (!resourcePath.includes("/")) {
      resourcePath = `asf/goods/${resourcePath}`;
    }

    const url = `/game/${gameSlug}/resources/${resourcePath}`;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        await initWasm();
        const asfData = decodeAsfWasm(buffer);
        if (asfData && asfData.frameCount > 0 && asfData.frames[0]) {
          const canvas = getFrameCanvas(asfData.frames[0]);
          setImgSrc(canvas.toDataURL());
        }
      } catch {
        // ignore
      }
    })();
  }, [iconPath, gameSlug]);

  if (imgSrc) {
    return <img src={imgSrc} alt="" className="object-contain" style={{ width: size, height: size }} />;
  }

  // 默认图标
  return (
    <span
      className="flex items-center justify-center bg-[#3c3c3c] rounded"
      style={{ width: size, height: size }}
    >
      📦
    </span>
  );
}

// 物品 INI 导入模态框
function ImportGoodsModal({
  gameId,
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; iniContent: string }>) => void;
  isLoading: boolean;
  batchResult?: { success: Array<{ fileName: string; id: string; name: string; kind: string }>; failed: Array<{ fileName: string; error: string }> } | null;
}) {
  const [batchItems, setBatchItems] = useState<Array<{ fileName: string; iniContent: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items: Array<{ fileName: string; iniContent: string }> = [];
    const files = e.dataTransfer.items;

    const processEntry = async (entry: FileSystemEntry) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (file.name.toLowerCase().endsWith(".ini")) {
          const content = await file.text();
          items.push({ fileName: file.name, iniContent: content });
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        // readEntries 一次最多返回 100 个条目，需要多次调用直到返回空数组
        const readAllEntries = async (): Promise<FileSystemEntry[]> => {
          const allEntries: FileSystemEntry[] = [];
          const readBatch = async (): Promise<void> => {
            const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            if (batch.length > 0) {
              allEntries.push(...batch);
              await readBatch(); // 继续读取直到返回空数组
            }
          };
          await readBatch();
          return allEntries;
        };
        const allEntries = await readAllEntries();
        for (const subEntry of allEntries) {
          await processEntry(subEntry);
        }
      }
    };

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    if (items.length > 0) {
      setBatchItems(items);
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-[#454545] w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h3 className="font-medium text-white">从 INI 导入物品</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 拖放区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-[#0098ff] bg-[#0098ff]/10"
                : "border-[#454545] hover:border-[#666]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3">📦</div>
            <p className="text-[#cccccc] text-sm">拖放 INI 文件或文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入</p>
          </div>

          {/* 待导入文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-[#454545] rounded">
              {batchItems.map((item, index) => (
                <div
                  key={item.fileName}
                  className="flex items-center justify-between px-3 py-2 border-b border-[#454545] last:border-b-0 hover:bg-[#2a2d2e]"
                >
                  <span className="text-sm text-white">{item.fileName}</span>
                  <button
                    type="button"
                    onClick={() => removeBatchItem(index)}
                    className="text-[#858585] hover:text-red-400 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 导入结果 */}
          {batchResult && (
            <div className="space-y-2">
              {batchResult.success.length > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm font-medium mb-1">
                    ✓ 成功导入 {batchResult.success.length} 个物品
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>{s.name}</div>
                    ))}
                  </div>
                </div>
              )}
              {batchResult.failed.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm font-medium mb-1">
                    ✗ 失败 {batchResult.failed.length} 个
                  </p>
                  <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
                    {batchResult.failed.map((f) => (
                      <div key={f.fileName}>
                        {f.fileName}: {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            {batchResult ? "关闭" : "取消"}
          </button>
          <button
            type="button"
            onClick={() => onBatchImport(batchItems)}
            disabled={batchItems.length === 0 || isLoading}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
          >
            {isLoading ? "导入中..." : `导入 (${batchItems.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 新建物品弹窗 ==========
function CreateGoodsModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"Consumable" | "Equipment" | "Quest">("Consumable");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = trpc.goods.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      kind,
      key: key || `goods_${Date.now()}`,
      name: name || "新物品",
      intro: intro || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-xl w-[480px]">
        {/* 标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h2 className="text-base font-medium text-white">新建物品</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 类型选择 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-2">物品类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("Consumable")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Consumable"
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">🍵</span>
                <span className="text-xs">消耗品</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("Equipment")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Equipment"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">⚔️</span>
                <span className="text-xs">装备</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("Quest")}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                  kind === "Quest"
                    ? "bg-yellow-600/20 border-yellow-500 text-yellow-400"
                    : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
                }`}
              >
                <span className="text-lg">📜</span>
                <span className="text-xs">任务道具</span>
              </button>
            </div>
          </div>

          {/* 物品名称 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">物品名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：金创药"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
            />
          </div>

          {/* 标识符 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">标识符 (Key)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="例如：goods-m00-金创药.ini（留空自动生成）"
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
            />
          </div>

          {/* 物品介绍 */}
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">物品介绍</label>
            <textarea
              rows={2}
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="简单描述物品的用途..."
              className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff] resize-none"
            />
          </div>

          {/* 错误提示 */}
          {createMutation.isError && (
            <p className="text-xs text-red-400">
              创建失败: {createMutation.error.message}
            </p>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== NPC 列表面板 ==========
function NpcListPanel({ basePath }: { basePath: string }) {
  const { currentGame, sidebarCollapsed } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterKind, setFilterKind] = useState<"all" | "Fighter" | "Normal" | "Other">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const { data: npcList, isLoading, refetch } = trpc.npc.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  const batchImportMutation = trpc.npc.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  // 按关系类型分组
  const groupedNpcs = useMemo(() => {
    if (!npcList) return { Friendly: [], Hostile: [], Neutral: [], Partner: [] };

    const groups: Record<string, typeof npcList> = {
      Friendly: [],
      Hostile: [],
      Neutral: [],
      Partner: [],
    };

    for (const npc of npcList) {
      const relation = npc.relation || "Neutral";
      if (!groups[relation]) groups[relation] = [];
      groups[relation].push(npc);
    }

    return groups;
  }, [npcList]);

  // 根据种类过滤
  const filteredGroupedNpcs = useMemo(() => {
    if (filterKind === "all") return groupedNpcs;

    const result: Record<string, typeof npcList> = {};
    for (const [relation, npcs] of Object.entries(groupedNpcs)) {
      result[relation] = (npcs || []).filter((npc) => {
        if (filterKind === "Fighter") return npc.kind === "Fighter";
        if (filterKind === "Normal") return npc.kind === "Normal";
        return !["Fighter", "Normal"].includes(npc.kind);
      });
    }
    return result;
  }, [groupedNpcs, filterKind]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (sidebarCollapsed) {
    return null;
  }

  const relationLabels: Record<string, string> = {
    Friendly: "友好",
    Hostile: "敌对",
    Neutral: "中立",
    Partner: "伙伴",
  };

  const relationIcons: Record<string, string> = {
    Friendly: "🟢",
    Hostile: "🔴",
    Neutral: "🟡",
    Partner: "🔵",
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-[#1e1e1e]">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            NPC 列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 NPC</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => setFilterKind("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "all"
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("Fighter")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "Fighter"
                ? "bg-red-600 text-white"
                : "text-red-400 hover:bg-[#3c3c3c]"
            }`}
          >
            战斗
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("Normal")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "Normal"
                ? "bg-green-600 text-white"
                : "text-green-400 hover:bg-[#3c3c3c]"
            }`}
          >
            普通
          </button>
        </div>

        {/* NPC 列表 - 按关系分组 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !npcList || npcList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无 NPC</div>
          ) : (
            Object.entries(filteredGroupedNpcs).map(([relation, npcs]) => {
              if (!npcs || npcs.length === 0) return null;
              return (
                <div key={relation}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(relation)}
                    className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                  >
                    <span className={`transition-transform ${collapsedGroups[relation] ? '' : 'rotate-90'}`}>▶</span>
                    <span>{relationIcons[relation]}</span>
                    <span>{relationLabels[relation]}</span>
                    <span className="text-[#666]">({npcs.length})</span>
                  </button>
                  {!collapsedGroups[relation] && npcs.map((npc) => (
                    <NavLink
                      key={npc.id}
                      to={`${basePath}/${npc.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                          isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                        }`
                      }
                    >
                      <NpcIcon iconPath={npc.icon} gameSlug={currentGame?.slug} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{npc.name}</span>
                          <span className={`text-xs ${
                            npc.kind === "Fighter" ? "text-red-400" : "text-green-400"
                          }`}>
                            Lv.{npc.level ?? 1}
                          </span>
                        </div>
                        <span className="text-xs text-[#858585] truncate block">{npc.key}</span>
                      </div>
                    </NavLink>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportNpcModal
          gameId={gameId!}
          onClose={() => setShowImportModal(false)}
          onBatchImport={(items) => {
            batchImportMutation.mutate({ gameId: gameId!, items });
          }}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
        />
      )}

      {/* 新建 NPC 模态框 */}
      {showCreateModal && (
        <CreateNpcModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// NPC 图标组件
function NpcIcon({ iconPath, gameSlug, size = 32 }: { iconPath?: string | null; gameSlug?: string; size?: number }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!iconPath || !gameSlug) return;

    let resourcePath = iconPath;
    if (!resourcePath.includes("/")) {
      resourcePath = `asf/character/${resourcePath}`;
    }

    const url = `/game/${gameSlug}/resources/${resourcePath}`;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        await initWasm();
        const asfData = decodeAsfWasm(buffer);
        if (asfData && asfData.frameCount > 0 && asfData.frames[0]) {
          const canvas = getFrameCanvas(asfData.frames[0]);
          setImgSrc(canvas.toDataURL());
        }
      } catch {
        // ignore
      }
    })();
  }, [iconPath, gameSlug]);

  if (imgSrc) {
    return <img src={imgSrc} alt="" className="object-contain" style={{ width: size, height: size }} />;
  }

  // 默认图标
  return (
    <span
      className="flex items-center justify-center bg-[#3c3c3c] rounded"
      style={{ width: size, height: size }}
    >
      🧙
    </span>
  );
}

// NPC INI 导入模态框（支持 npc 和 npcres 目录合并）
function ImportNpcModal({
  gameId,
  onClose,
  onBatchImport,
  isLoading,
  batchResult,
}: {
  gameId: string;
  onClose: () => void;
  onBatchImport: (items: Array<{ fileName: string; iniContent: string; npcResContent?: string }>) => void;
  isLoading: boolean;
  batchResult?: { success: Array<{ fileName: string; id: string; name: string; hasResources: boolean }>; failed: Array<{ fileName: string; error: string }> } | null;
}) {
  const [batchItems, setBatchItems] = useState<Array<{ fileName: string; iniContent: string; npcResContent?: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // 收集所有 INI 文件，按目录分类
    const npcFiles: Map<string, { file: File; content: string }> = new Map();
    const npcResFiles: Map<string, { file: File; content: string }> = new Map();
    const files = e.dataTransfer.items;

    /**
     * 判断文件属于哪个目录
     * 检查路径中是否有 /npc/ 或 /npcres/ 目录
     * 注意：npcres 要先检查，因为它也包含 "npc" 字符串
     */
    const getFileCategory = (fullPath: string): "npc" | "npcres" | null => {
      const pathLower = fullPath.toLowerCase();
      // 检查是否在 npcres 目录下（精确匹配目录名）
      if (pathLower.match(/[/\\]npcres[/\\]/i) || pathLower.startsWith("npcres/") || pathLower.startsWith("npcres\\")) {
        return "npcres";
      }
      // 检查是否在 npc 目录下（精确匹配目录名，排除 npcres）
      if (pathLower.match(/[/\\]npc[/\\]/i) || pathLower.startsWith("npc/") || pathLower.startsWith("npc\\")) {
        return "npc";
      }
      return null;
    };

    const processEntry = async (entry: FileSystemEntry, basePath = "") => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject);
        });

        if (file.name.toLowerCase().endsWith(".ini")) {
          const content = await file.text();
          const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
          const fileNameLower = file.name.toLowerCase();

          // 根据路径中的目录名判断是 npc 还是 npcres
          const category = getFileCategory(fullPath);
          if (category === "npcres") {
            npcResFiles.set(fileNameLower, { file, content });
          } else if (category === "npc") {
            npcFiles.set(fileNameLower, { file, content });
          }
          // 如果不在 npc 或 npcres 目录下，忽略该文件
        }
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const readAllEntries = async (): Promise<FileSystemEntry[]> => {
          const allEntries: FileSystemEntry[] = [];
          const readBatch = async (): Promise<void> => {
            const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
              reader.readEntries(resolve, reject);
            });
            if (batch.length > 0) {
              allEntries.push(...batch);
              await readBatch();
            }
          };
          await readBatch();
          return allEntries;
        };
        const allEntries = await readAllEntries();
        for (const subEntry of allEntries) {
          await processEntry(subEntry, basePath ? `${basePath}/${entry.name}` : entry.name);
        }
      }
    };

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await processEntry(entry);
      }
    }

    // 从 npc ini 内容中解析 NpcIni 字段值
    const parseNpcIniField = (content: string): string | null => {
      const match = content.match(/^\s*NpcIni\s*=\s*(.+?)\s*$/mi);
      return match ? match[1].toLowerCase() : null;
    };

    // 合并 npc 和 npcres 文件
    const items: Array<{ fileName: string; iniContent: string; npcResContent?: string }> = [];

    for (const [_fileName, npcInfo] of npcFiles) {
      // 从 npc ini 内容中解析 NpcIni 字段，用这个值去匹配 npcres 文件
      const npcIniField = parseNpcIniField(npcInfo.content);
      const npcResInfo = npcIniField ? npcResFiles.get(npcIniField) : null;

      items.push({
        fileName: npcInfo.file.name,
        iniContent: npcInfo.content,
        npcResContent: npcResInfo?.content,
      });
    }

    if (items.length > 0) {
      setBatchItems(items);
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-[#454545] w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h3 className="font-medium text-white">从 INI 导入 NPC</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* 说明 */}
          <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
            <p className="mb-1">支持拖入以下结构：</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="text-[#ce9178]">npc/</code> - NPC 配置目录</li>
              <li><code className="text-[#ce9178]">npcres/</code> - NPC 资源配置目录</li>
            </ul>
            <p className="mt-2">同名的 .ini 文件会自动合并资源配置</p>
          </div>

          {/* 拖放区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-[#0098ff] bg-[#0098ff]/10"
                : "border-[#454545] hover:border-[#666]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="text-4xl mb-3">🧙</div>
            <p className="text-[#cccccc] text-sm">拖放 npc 和 npcres 文件夹到此处</p>
            <p className="text-[#858585] text-xs mt-1">支持批量导入，自动合并资源</p>
          </div>

          {/* 待导入文件列表 */}
          {batchItems.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-[#454545] rounded">
              {batchItems.map((item, index) => (
                <div
                  key={item.fileName}
                  className="flex items-center justify-between px-3 py-2 border-b border-[#454545] last:border-b-0 hover:bg-[#2a2d2e]"
                >
                  <div className="flex-1">
                    <span className="text-sm text-white">{item.fileName}</span>
                    {item.npcResContent && (
                      <span className="ml-2 text-xs text-green-400">+ 资源</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBatchItem(index)}
                    className="text-[#858585] hover:text-red-400 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 导入结果 */}
          {batchResult && (
            <div className="space-y-2">
              {batchResult.success.length > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                  <p className="text-green-400 text-sm font-medium mb-1">
                    ✓ 成功导入 {batchResult.success.length} 个 NPC
                  </p>
                  <div className="text-xs text-green-400/80 max-h-24 overflow-y-auto">
                    {batchResult.success.map((s) => (
                      <div key={s.id}>
                        {s.name} {s.hasResources && <span className="text-green-300">+ 资源</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {batchResult.failed.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                  <p className="text-red-400 text-sm font-medium mb-1">
                    ✗ 失败 {batchResult.failed.length} 个
                  </p>
                  <div className="text-xs text-red-400/80 max-h-24 overflow-y-auto">
                    {batchResult.failed.map((f) => (
                      <div key={f.fileName}>
                        {f.fileName}: {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            {batchResult ? "关闭" : "取消"}
          </button>
          <button
            type="button"
            onClick={() => onBatchImport(batchItems)}
            disabled={batchItems.length === 0 || isLoading}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
          >
            {isLoading ? "导入中..." : `导入 (${batchItems.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// 新建 NPC 弹窗
function CreateNpcModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"Normal" | "Fighter">("Normal");
  const [relation, setRelation] = useState<"Friendly" | "Hostile" | "Neutral">("Friendly");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      gameId,
      key: key || `npc_${Date.now()}`,
      name,
      kind,
      relation,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] rounded-lg border border-[#454545] w-96">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#454545]">
          <h3 className="font-medium text-white">新建 NPC</h3>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-[#858585] mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#007acc]"
              placeholder="输入 NPC 名称"
            />
          </div>
          <div>
            <label className="block text-xs text-[#858585] mb-1">标识符 (可选)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#007acc]"
              placeholder="留空将自动生成"
            />
          </div>
          <div>
            <label className="block text-xs text-[#858585] mb-1">类型</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("Normal")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  kind === "Normal"
                    ? "bg-green-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🧑 普通
              </button>
              <button
                type="button"
                onClick={() => setKind("Fighter")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  kind === "Fighter"
                    ? "bg-red-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                ⚔️ 战斗
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#858585] mb-1">关系</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRelation("Friendly")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  relation === "Friendly"
                    ? "bg-green-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🟢 友好
              </button>
              <button
                type="button"
                onClick={() => setRelation("Neutral")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  relation === "Neutral"
                    ? "bg-yellow-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🟡 中立
              </button>
              <button
                type="button"
                onClick={() => setRelation("Hostile")}
                className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                  relation === "Hostile"
                    ? "bg-red-600 text-white"
                    : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                }`}
              >
                🔴 敌对
              </button>
            </div>
          </div>
          {createMutation.error && (
            <div className="text-red-400 text-sm">{createMutation.error.message}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 等级配置列表面板 ==========
function LevelListPanel({ basePath }: { basePath: string }) {
  const { currentGame, sidebarCollapsed } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: levels, isLoading, refetch } = trpc.level.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <div
      className="flex h-full w-60 flex-col bg-[#252526] border-r border-[#1e1e1e]"
    >
      {/* 创建弹窗 */}
      {gameId && (
        <CreateLevelConfigModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          gameId={gameId}
          basePath={basePath}
          onSuccess={(id) => {
            refetch();
            navigate(`${basePath}/${id}`);
          }}
        />
      )}

      {/* 标题栏 */}
      <div className="flex h-9 items-center justify-between px-4 border-b border-[#1e1e1e]">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
          等级配置
        </span>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
          title="新建配置"
        >
          {DashboardIcons.add}
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto py-1 relative">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : !levels || levels.length === 0 ? (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-[#858585]">暂无配置</p>
            <p className="text-xs text-[#666] mt-2">
              点击 + 按钮创建配置
            </p>
          </div>
        ) : (
          levels.map((level) => (
            <NavLink
              key={level.id}
              to={`${basePath}/${level.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                }`
              }
            >
              <span className="text-lg">{level.userType === "player" ? "👤" : "🤖"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{level.name}</span>
                  <span
                    className={`text-xs ${
                      level.userType === "player" ? "text-blue-400" : "text-orange-400"
                    }`}
                  >
                    {level.userType === "player" ? "玩家" : "NPC"}
                  </span>
                </div>
                <div className="text-xs text-[#858585] truncate">
                  {level.key} · {level.maxLevel}级
                </div>
              </div>
            </NavLink>
          ))
        )}
      </div>
    </div>
  );
}

export function SidebarContent() {
  const { gameId } = useParams();
  const location = useLocation();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  // 根据当前路径确定显示哪个面板
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2] || "game"; // dashboard/gameId/module

  switch (currentModule) {
    case "game":
      return (
        <SidebarPanel title="游戏编辑">
          <TreeView nodes={gameSettingsTree} basePath={`${basePath}/game`} />
        </SidebarPanel>
      );

    case "characters":
      return (
        <ListPanel
          title="角色列表"
          basePath={`${basePath}/characters`}
          items={[
            { id: "player", name: "主角" },
            { id: "partner1", name: "仙儿" },
            { id: "partner2", name: "月儿" },
          ]}
          onAdd={() => console.log("添加角色")}
        />
      );

    case "npcs":
      return <NpcListPanel basePath={`${basePath}/npcs`} />;

    case "goods":
      return <GoodsListPanel basePath={`${basePath}/goods`} />;

    case "shops":
      return (
        <ListPanel
          title="商店列表"
          basePath={`${basePath}/shops`}
          items={[
            { id: "shop001", name: "杂货铺" },
            { id: "shop002", name: "武器店" },
            { id: "shop003", name: "药店" },
          ]}
          onAdd={() => console.log("添加商店")}
        />
      );

    case "levels":
      return <LevelListPanel basePath={`${basePath}/levels`} />;

    case "magic":
      return <MagicListPanel basePath={`${basePath}/magic`} />;

    case "scripts":
      return (
        <SidebarPanel title="通用脚本">
          <TreeView
            nodes={[
              {
                id: "common-scripts",
                label: "common",
                icon: "folder",
                children: [
                  { id: "init", label: "init.txt", path: "common/init" },
                  { id: "utils", label: "utils.txt", path: "common/utils" },
                ],
              },
              { id: "newgame", label: "newgame.txt", path: "newgame", icon: "file" },
            ]}
            basePath={`${basePath}/scripts`}
          />
        </SidebarPanel>
      );

    case "scenes":
      return (
        <SidebarPanel title="场景编辑">
          <TreeView nodes={scenesTree} basePath={`${basePath}/scenes`} />
        </SidebarPanel>
      );

    case "resources":
      // 资源管理器不需要子菜单，直接显示文件管理器
      return null;

    case "statistics":
      return (
        <SidebarPanel title="数据统计">
          <TreeView nodes={statisticsTree} basePath={`${basePath}/statistics`} />
        </SidebarPanel>
      );

    default:
      return (
        <SidebarPanel title="Dashboard">
          <div className="px-4 py-2 text-sm text-[#858585]">
            请选择一个模块
          </div>
        </SidebarPanel>
      );
  }
}
