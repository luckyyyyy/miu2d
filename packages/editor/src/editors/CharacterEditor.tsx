/**
 * 角色编辑器主页面
 * 左侧文件树 + 右侧属性编辑面板
 */

import { useState, useCallback, useMemo } from "react";
import { VirtualTree, type TreeNode } from "../components/tree";
import { useFileSystem } from "../hooks/useFileSystem";
import {
  type EditorCharacterConfig,
  type CharacterFieldGroup,
  type CharacterFieldDef,
  defaultEditorCharacterConfig,
  characterFieldGroups,
  CharacterKind,
  RelationType,
} from "../types/character";
import {
  parseCharacterIni,
  characterConfigToJson,
  characterConfigToIni,
} from "../utils/characterParser";

/** 属性分组面板 */
function FieldGroupPanel({
  group,
  config,
  onChange,
  isExpanded,
  onToggle,
}: {
  group: CharacterFieldGroup;
  config: EditorCharacterConfig;
  onChange: (key: keyof EditorCharacterConfig, value: unknown) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#3c3c3c]">
      {/* 分组标题 */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#cccccc] hover:bg-[#2a2d2e]"
        onClick={onToggle}
      >
        <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span>{group.icon}</span>
        <span>{group.name}</span>
      </button>

      {/* 字段列表 */}
      {isExpanded && (
        <div className="space-y-2 px-3 pb-3">
          {group.fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) => onChange(field.key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 单个字段编辑器 */
function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: CharacterFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inputClassName =
    "mt-1 w-full rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc] border border-[#4c4c4c] focus:border-[#007acc] focus:outline-none";

  return (
    <div>
      <label className="block text-xs text-[#808080]">
        {field.label}
        {field.description && (
          <span className="ml-1 text-[#606060]" title={field.description}>
            ⓘ
          </span>
        )}
      </label>

      {field.type === "string" && (
        <input
          type="text"
          className={inputClassName}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          className={inputClassName}
          value={(value as number) ?? 0}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      )}

      {field.type === "boolean" && (
        <label className="mt-1 flex items-center gap-2 text-sm text-[#cccccc]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[#4c4c4c] bg-[#3c3c3c]"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? "是" : "否"}</span>
        </label>
      )}

      {field.type === "enum" && field.options && (
        <select
          className={inputClassName}
          value={(value as number) ?? 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === "file" && (
        <div className="mt-1 flex gap-1">
          <input
            type="text"
            className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc] border border-[#4c4c4c] focus:border-[#007acc] focus:outline-none"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.fileDirectory || "文件路径"}
          />
        </div>
      )}

      {field.type === "script" && (
        <div className="mt-1 flex gap-1">
          <input
            type="text"
            className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[#cccccc] border border-[#4c4c4c] focus:border-[#007acc] focus:outline-none"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="脚本文件名.txt"
          />
        </div>
      )}
    </div>
  );
}

/** 角色预览信息 */
function CharacterPreview({ config }: { config: EditorCharacterConfig | null }) {
  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-[#808080]">
        <div className="text-center">
          <span className="text-6xl">👤</span>
          <p className="mt-4">选择一个角色配置文件</p>
        </div>
      </div>
    );
  }

  const kindLabel =
    {
      [CharacterKind.Normal]: "普通 NPC",
      [CharacterKind.Fighter]: "战斗角色",
      [CharacterKind.Player]: "玩家",
      [CharacterKind.Follower]: "伙伴",
      [CharacterKind.GroundAnimal]: "地面动物",
      [CharacterKind.Eventer]: "事件触发",
      [CharacterKind.AfraidPlayerAnimal]: "怕人动物",
      [CharacterKind.Flyer]: "飞行角色",
    }[config.kind] || "未知";

  const relationLabel =
    {
      [RelationType.Friend]: "友好",
      [RelationType.Enemy]: "敌对",
      [RelationType.Neutral]: "中立",
      [RelationType.None]: "无",
    }[config.relation] || "未知";

  return (
    <div className="p-4">
      {/* 角色名称和基本信息 */}
      <div className="mb-4 rounded-lg bg-[#252526] p-4">
        <h2 className="text-xl font-bold text-amber-400">{config.name || "未命名"}</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-[#3c3c3c] px-2 py-1">
            {kindLabel}
          </span>
          <span
            className={`rounded px-2 py-1 ${
              config.relation === RelationType.Enemy
                ? "bg-red-900 text-red-300"
                : config.relation === RelationType.Friend
                  ? "bg-green-900 text-green-300"
                  : "bg-yellow-900 text-yellow-300"
            }`}
          >
            {relationLabel}
          </span>
          <span className="rounded bg-[#3c3c3c] px-2 py-1">
            Lv.{config.level}
          </span>
        </div>
      </div>

      {/* 属性条 */}
      <div className="mb-4 space-y-2">
        <div>
          <div className="flex justify-between text-sm text-[#cccccc]">
            <span>❤️ 生命</span>
            <span>
              {config.life} / {config.lifeMax}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#3c3c3c]">
            <div
              className="h-full rounded-full bg-red-500"
              style={{
                width: `${Math.min(100, (config.life / config.lifeMax) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-[#cccccc]">
            <span>💪 体力</span>
            <span>
              {config.thew} / {config.thewMax}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#3c3c3c]">
            <div
              className="h-full rounded-full bg-yellow-500"
              style={{
                width: `${Math.min(100, (config.thew / config.thewMax) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-[#cccccc]">
            <span>💙 内力</span>
            <span>
              {config.mana} / {config.manaMax}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#3c3c3c]">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{
                width: `${Math.min(100, (config.mana / config.manaMax) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 战斗属性 */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded bg-[#252526] p-2">
          <span className="text-[#808080]">⚔️ 攻击</span>
          <span className="ml-2 text-[#cccccc]">{config.attack}</span>
        </div>
        <div className="rounded bg-[#252526] p-2">
          <span className="text-[#808080]">🛡️ 防御</span>
          <span className="ml-2 text-[#cccccc]">{config.defend}</span>
        </div>
        <div className="rounded bg-[#252526] p-2">
          <span className="text-[#808080]">💨 闪避</span>
          <span className="ml-2 text-[#cccccc]">{config.evade}</span>
        </div>
        <div className="rounded bg-[#252526] p-2">
          <span className="text-[#808080]">🏃 速度</span>
          <span className="ml-2 text-[#cccccc]">{config.walkSpeed}</span>
        </div>
      </div>

      {/* 资源引用 */}
      <div className="rounded bg-[#252526] p-3 text-sm">
        <h3 className="mb-2 font-medium text-[#cccccc]">📦 资源引用</h3>
        <div className="space-y-1 text-[#808080]">
          {config.npcIni && (
            <div>
              <span className="text-[#606060]">NPC资源:</span>{" "}
              <span className="text-[#9cdcfe]">{config.npcIni}</span>
            </div>
          )}
          {config.flyIni && (
            <div>
              <span className="text-[#606060]">攻击魔法:</span>{" "}
              <span className="text-[#9cdcfe]">{config.flyIni}</span>
            </div>
          )}
          {config.bodyIni && (
            <div>
              <span className="text-[#606060]">尸体:</span>{" "}
              <span className="text-[#9cdcfe]">{config.bodyIni}</span>
            </div>
          )}
          {config.scriptFile && (
            <div>
              <span className="text-[#606060]">脚本:</span>{" "}
              <span className="text-[#ce9178]">{config.scriptFile}</span>
            </div>
          )}
          {config.deathScript && (
            <div>
              <span className="text-[#606060]">死亡脚本:</span>{" "}
              <span className="text-[#ce9178]">{config.deathScript}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CharacterEditor() {
  // 文件系统
  const {
    nodes,
    isLoading: isLoadingDir,
    error: dirError,
    selectDirectory,
    refresh,
    readFile,
    rootName,
    loadChildren,
  } = useFileSystem({
    fileFilter: (name) => {
      // 只显示 .ini 文件（目录由 handleToNode 自动处理，不会经过此过滤器）
      return name.toLowerCase().endsWith(".ini");
    },
  });

  // 当前选中的文件
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  // 角色配置
  const [config, setConfig] = useState<EditorCharacterConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<EditorCharacterConfig | null>(null);
  // 加载状态
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // 展开的分组
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["基础信息", "属性值", "资源引用"])
  );
  // 输出格式
  const [outputFormat, setOutputFormat] = useState<"json" | "ini">("json");
  // 显示输出预览
  const [showOutput, setShowOutput] = useState(false);

  // 选中文件
  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  // 打开角色配置文件
  const handleOpen = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory) return;
      if (!node.name.toLowerCase().endsWith(".ini")) return;

      try {
        setIsLoadingFile(true);
        setFileError(null);

        const buffer = await readFile(node.id);
        if (!buffer) {
          setFileError("无法读取文件");
          return;
        }

        // 尝试 UTF-8 解码
        let content: string;
        try {
          content = new TextDecoder("utf-8").decode(buffer);
        } catch {
          // 回退到 GBK
          content = new TextDecoder("gbk").decode(buffer);
        }

        const parsed = parseCharacterIni(content);
        setConfig(parsed);
        setOriginalConfig(parsed);
      } catch (err) {
        setFileError(`解析失败: ${(err as Error).message}`);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [readFile]
  );

  // 展开目录
  const handleExpand = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory && !node.isLoaded) {
        await loadChildren(node);
      }
    },
    [loadChildren]
  );

  // 更新配置字段
  const handleFieldChange = useCallback(
    (key: keyof EditorCharacterConfig, value: unknown) => {
      if (!config) return;
      setConfig({ ...config, [key]: value });
    },
    [config]
  );

  // 切换分组展开
  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  // 重置为原始配置
  const handleReset = useCallback(() => {
    if (originalConfig) {
      setConfig({ ...originalConfig });
    }
  }, [originalConfig]);

  // 创建新配置
  const handleNew = useCallback(() => {
    setConfig({ ...defaultEditorCharacterConfig });
    setOriginalConfig(null);
    setSelectedNode(null);
  }, []);

  // 验证配置（简化版本）
  const validationErrors = useMemo(() => {
    if (!config) return [];
    const errors: string[] = [];
    if (!config.name) errors.push("名称不能为空");
    return errors;
  }, [config]);

  // 是否有修改
  const hasChanges = useMemo(() => {
    if (!config || !originalConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  }, [config, originalConfig]);

  // 输出内容
  const outputContent = useMemo(() => {
    if (!config) return "";
    return outputFormat === "json"
      ? characterConfigToJson(config)
      : characterConfigToIni(config);
  }, [config, outputFormat]);

  return (
    <div className="flex h-full bg-[#1e1e1e] overflow-hidden">
      {/* 左侧文件树面板 */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[#3c3c3c] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#bbbbbb]">
            {rootName ? `角色: ${rootName}` : "资源管理器"}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={handleNew}
              title="新建"
            >
              ➕
            </button>
            <button
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={refresh}
              title="刷新"
              disabled={!rootName}
            >
              🔄
            </button>
            <button
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={selectDirectory}
              title="选择目录"
            >
              📂
            </button>
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-hidden">
          {isLoadingDir ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : dirError ? (
            <div className="p-4 text-center text-red-400 text-sm">{dirError}</div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#808080] text-sm p-4 text-center">
              <span className="text-3xl mb-4">👤</span>
              <p className="mb-2">点击上方按钮选择角色资源目录</p>
              <p className="text-xs">
                建议选择：
                <br />
                <code className="text-[#cccccc]">/resources/ini/npc</code>
                <br />
                或
                <br />
                <code className="text-[#cccccc]">/resources</code>
              </p>
              <button
                className="mt-4 rounded bg-[#0e639c] px-4 py-2 text-sm text-white hover:bg-[#1177bb]"
                onClick={selectDirectory}
              >
                选择目录
              </button>
            </div>
          ) : (
            <VirtualTree
              nodes={nodes}
              selectedId={selectedNode?.id}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onExpand={handleExpand}
            />
          )}
        </div>
      </div>

      {/* 中央预览区域 */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* 工具栏 */}
        <div className="flex h-9 items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#cccccc]">
              {selectedNode?.name || (config ? "新建角色" : "角色编辑器")}
            </span>
            {hasChanges && (
              <span className="text-xs text-amber-400">● 已修改</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 输出格式选择 */}
            <select
              className="rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc] border border-[#4c4c4c]"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as "json" | "ini")}
            >
              <option value="json">JSON</option>
              <option value="ini">INI</option>
            </select>
            <button
              className="rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc] hover:bg-[#4c4c4c]"
              onClick={() => setShowOutput(!showOutput)}
            >
              {showOutput ? "隐藏输出" : "预览输出"}
            </button>
            {hasChanges && (
              <button
                className="rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc] hover:bg-[#4c4c4c]"
                onClick={handleReset}
              >
                重置
              </button>
            )}
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 预览 */}
          <div className="flex-1 overflow-auto">
            {isLoadingFile ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : fileError ? (
              <div className="p-4 text-center text-red-400">{fileError}</div>
            ) : showOutput ? (
              <div className="h-full p-4">
                <pre className="h-full overflow-auto rounded bg-[#252526] p-4 text-sm text-[#d4d4d4] font-mono">
                  {outputContent}
                </pre>
              </div>
            ) : (
              <CharacterPreview config={config} />
            )}
          </div>

          {/* 验证错误提示 */}
          {validationErrors.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 rounded bg-red-900/80 p-3 text-sm text-red-200">
              <div className="font-medium mb-1">⚠️ 验证错误</div>
              <ul className="list-disc list-inside">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-80 shrink-0 border-l border-[#3c3c3c] overflow-hidden flex flex-col">
        {/* 标题 */}
        <div className="flex h-9 items-center border-b border-[#3c3c3c] bg-[#252526] px-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#bbbbbb]">
            属性编辑器
          </span>
        </div>

        {/* 属性分组 */}
        <div className="flex-1 overflow-auto">
          {config ? (
            characterFieldGroups.map((group) => (
              <FieldGroupPanel
                key={group.name}
                group={group}
                config={config}
                onChange={handleFieldChange}
                isExpanded={expandedGroups.has(group.name)}
                onToggle={() => toggleGroup(group.name)}
              />
            ))
          ) : (
            <div className="p-4 text-center text-[#808080] text-sm">
              选择或创建一个角色配置
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
