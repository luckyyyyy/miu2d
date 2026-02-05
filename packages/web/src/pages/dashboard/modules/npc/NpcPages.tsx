/**
 * NPC 编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DashboardIcons } from "../../icons";
import { useDashboard } from "../../DashboardContext";
import { NumberInput, ResourceFilePicker } from "../../../../components/common";
import { MagicPicker } from "../../../../components/common/pickers";
import type {
  Npc,
  NpcKind,
  NpcRelation,
  NpcResource,
  NpcState,
} from "@miu2d/types";
import {
  NpcKindLabels,
  NpcRelationLabels,
  NpcStateLabels,
  createDefaultNpc,
  createDefaultNpcResource,
  getVisibleFieldsByNpcKind,
} from "@miu2d/types";
import { NpcPreview } from "./NpcPreview";

// ========== 列表页（欢迎页面） ==========

export function NpcListPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">👤</div>
        <h2 className="text-xl font-medium text-white mb-3">NPC 编辑</h2>
        <p className="text-[#858585] text-sm leading-relaxed">
          从左侧列表选择一个 NPC 进行编辑，
          <br />
          或使用上方按钮创建新 NPC、导入 INI 文件。
        </p>
      </div>
    </div>
  );
}

// ========== 详情页 ==========

export function NpcDetailPage() {
  const { gameId: gameSlug, npcId, tab } = useParams<{ gameId: string; npcId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/npcs`;
  const isNew = npcId === "new";

  // 缓存 key
  const cacheKey = npcId ? `npc:${npcId}` : null;

  // Tab 类型
  type TabType = "basic" | "combat" | "resource" | "behavior";
  const validTabs: TabType[] = ["basic", "combat", "resource", "behavior"];

  // 当前 Tab - 从 URL 读取
  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : "basic";

  // 切换 Tab - 通过导航更新 URL
  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${npcId}/${newTab}`, { replace: true });
  }, [navigate, basePath, npcId]);

  // 查询 NPC 详情
  const { data: npc, isLoading } = trpc.npc.get.useQuery(
    { gameId: gameId!, id: npcId! },
    { enabled: !!gameId && !!npcId && !isNew }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<Npc>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Npc>>(cacheKey) || {};
    }
    return {};
  });

  // 同步表单数据到缓存
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  // 新建时初始化表单
  useEffect(() => {
    if (isNew && gameId && Object.keys(formData).length === 0) {
      setFormData(createDefaultNpc(gameId));
    }
  }, [isNew, gameId, formData]);

  // 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (npc && cacheKey && !editCache.has(cacheKey)) {
      setFormData(npc);
    }
  }, [npc, cacheKey, editCache]);

  const toast = useToast();

  // 保存 NPC
  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`NPC「${formData.name || '新NPC'}」创建成功`);
      utils.npc.list.invalidate({ gameId: gameId! });
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.npc.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.npc.list.invalidate({ gameId: gameId! });
      toast.success(`NPC「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.npc.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.npc.list.invalidate({ gameId: gameId! });
      toast.success(`NPC 已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByNpcKind(formData.kind || "Normal"));
  }, [formData.kind]);

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key || `npc_${Date.now()}`,
        name: formData.name || "新NPC",
        kind: formData.kind,
        relation: formData.relation,
        ...formData,
      });
    } else if (npcId) {
      updateMutation.mutate({
        ...formData,
        id: npcId,
        gameId,
      } as Npc);
    }
  }, [gameId, npcId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && npcId && !isNew) {
      deleteMutation.mutate({ id: npcId, gameId });
    }
  }, [gameId, npcId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Npc>(key: K, value: Npc[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateResourceField = useCallback((state: keyof NpcResource, field: "image" | "sound", value: string | null) => {
    setFormData((prev) => {
      const resources = prev.resources || createDefaultNpcResource();
      return {
        ...prev,
        resources: {
          ...resources,
          [state]: {
            ...resources[state],
            [field]: value,
          },
        },
      };
    });
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

  // Tab 配置
  const tabs = [
    { key: "basic" as const, label: "基础信息", icon: "📝" },
    { key: "combat" as const, label: "战斗属性", icon: "⚔️" },
    { key: "resource" as const, label: "资源配置", icon: "🎨" },
    { key: "behavior" as const, label: "行为脚本", icon: "📜" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex-shrink-0 bg-[#1e1e1e] border-b border-[#3c3c3c]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={basePath}
              className="p-2 rounded-lg hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
            >
              {DashboardIcons.back}
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {isNew ? "新建 NPC" : formData.name || "NPC 详情"}
              </h1>
              <p className="text-xs text-[#858585]">
                {NpcKindLabels[formData.kind || "Normal"]} · {NpcRelationLabels[formData.relation || "Friendly"]}
                {formData.key && <span className="ml-2 text-[#666]">({formData.key})</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
              >
                删除
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {/* Tab 栏 */}
        <div className="flex px-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-[#858585] hover:text-white"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0098ff] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-6 p-6 min-h-full">
          {/* 左侧表单 */}
          <div className="flex-1 min-w-0 space-y-5">
            {activeTab === "basic" && (
              <BasicInfoSection
                formData={formData}
                updateField={updateField}
              />
            )}

            {activeTab === "combat" && (
              <CombatSection
                formData={formData}
                updateField={updateField}
                visibleFields={visibleFields}
                gameId={gameId!}
                gameSlug={gameSlug!}
              />
            )}

            {activeTab === "resource" && (
              <ResourceSection
                formData={formData}
                updateResourceField={updateResourceField}
                gameId={gameId!}
                gameSlug={gameSlug!}
              />
            )}

            {activeTab === "behavior" && (
              <BehaviorSection
                formData={formData}
                updateField={updateField}
                visibleFields={visibleFields}
                gameId={gameId!}
                gameSlug={gameSlug!}
              />
            )}
          </div>

          {/* 右侧预览 - 固定宽度 */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-6">
              <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#3c3c3c]">
                  <h3 className="text-sm font-medium text-[#cccccc]">👤 NPC 预览</h3>
                </div>
                <div className="p-4">
                  <NpcPreview
                    gameSlug={gameSlug!}
                    npc={formData}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== 基础信息区 ==========

function BasicInfoSection({
  formData,
  updateField,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
}) {
  return (
    <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">NPC 名称</label>
          <input
            type="text"
            value={formData.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">标识符 (Key)</label>
          <input
            type="text"
            value={formData.key || ""}
            onChange={(e) => updateField("key", e.target.value)}
            placeholder="例如: 惠安镇路人1.ini"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">NPC 类型</label>
          <select
            value={formData.kind || "Normal"}
            onChange={(e) => updateField("kind", e.target.value as NpcKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          >
            {Object.entries(NpcKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">关系</label>
          <select
            value={formData.relation || "Friendly"}
            onChange={(e) => updateField("relation", e.target.value as NpcRelation)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          >
            {Object.entries(NpcRelationLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">等级</label>
          <NumberInput
            value={formData.level ?? 1}
            onChange={(val) => updateField("level", val ?? 1)}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">移动速度</label>
          <NumberInput
            min={0}
            max={10}
            value={formData.walkSpeed ?? 1}
            onChange={(val) => updateField("walkSpeed", val ?? 1)}
            className="w-full"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm text-[#858585] mb-1">描述</label>
          <textarea
            rows={2}
            value={formData.intro || ""}
            onChange={(e) => updateField("intro", e.target.value)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff] resize-none"
          />
        </div>
      </div>
    </section>
  );
}

// ========== 战斗属性区 ==========

function CombatSection({
  formData,
  updateField,
  visibleFields,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
  visibleFields: Set<string>;
  gameId: string;
  gameSlug: string;
}) {
  return (
    <div className="space-y-5">
      {/* 生命和资源 */}
      <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h2 className="text-sm font-medium text-[#cccccc]">❤️ 生命与资源</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前生命</label>
            <NumberInput
              min={0}
              value={formData.life ?? 100}
              onChange={(val) => updateField("life", val ?? 0)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-[#858585] mb-1">最大生命</label>
            <NumberInput
              min={0}
              value={formData.lifeMax ?? 100}
              onChange={(val) => updateField("lifeMax", val ?? 0)}
              className="w-full"
            />
          </div>

          {visibleFields.has("thew") && (
            <>
              <div>
                <label className="block text-sm text-[#858585] mb-1">当前体力</label>
                <NumberInput
                  min={0}
                  value={formData.thew ?? 100}
                  onChange={(val) => updateField("thew", val ?? 0)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">最大体力</label>
                <NumberInput
                  min={0}
                  value={formData.thewMax ?? 100}
                  onChange={(val) => updateField("thewMax", val ?? 0)}
                  className="w-full"
                />
              </div>
            </>
          )}

          {visibleFields.has("mana") && (
            <>
              <div>
                <label className="block text-sm text-[#858585] mb-1">当前内力</label>
                <NumberInput
                  min={0}
                  value={formData.mana ?? 100}
                  onChange={(val) => updateField("mana", val ?? 0)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">最大内力</label>
                <NumberInput
                  min={0}
                  value={formData.manaMax ?? 100}
                  onChange={(val) => updateField("manaMax", val ?? 0)}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* 战斗属性 */}
      {visibleFields.has("attack") && (
        <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3c3c3c]">
            <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 战斗属性</h2>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">攻击力</label>
              <NumberInput
                min={0}
                value={formData.attack ?? 10}
                onChange={(val) => updateField("attack", val ?? 0)}
                className="w-full"
              />
            </div>

            {visibleFields.has("defend") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">防御力</label>
                <NumberInput
                  min={0}
                  value={formData.defend ?? 5}
                  onChange={(val) => updateField("defend", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("evade") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">闪避值</label>
                <NumberInput
                  min={0}
                  value={formData.evade ?? 10}
                  onChange={(val) => updateField("evade", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("attackRadius") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">攻击范围</label>
                <NumberInput
                  min={1}
                  max={10}
                  value={formData.attackRadius ?? 1}
                  onChange={(val) => updateField("attackRadius", val ?? 1)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("exp") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">击杀经验</label>
                <NumberInput
                  min={0}
                  value={formData.exp ?? 0}
                  onChange={(val) => updateField("exp", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            {visibleFields.has("flyIni") && (
              <div className="col-span-3">
                <MagicPicker
                  label="飞行攻击"
                  value={formData.flyIni}
                  onChange={(v) => updateField("flyIni", v)}
                  gameId={gameId}
                  gameSlug={gameSlug}
                  placeholder="选择关联武功"
                />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ========== 资源配置区 ==========

const RESOURCE_STATES: Array<{ key: keyof NpcResource; label: string }> = [
  { key: "stand", label: "站立" },
  { key: "stand1", label: "待机" },
  { key: "walk", label: "行走" },
  { key: "run", label: "奔跑" },
  { key: "attack", label: "攻击" },
  { key: "attack1", label: "攻击2" },
  { key: "attack2", label: "攻击3" },
  { key: "hurt", label: "受伤" },
  { key: "death", label: "死亡" },
  { key: "sit", label: "坐下" },
];

function ResourceSection({
  formData,
  updateResourceField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateResourceField: (state: keyof NpcResource, field: "image" | "sound", value: string | null) => void;
  gameId: string;
  gameSlug: string;
}) {
  const resources = formData.resources || createDefaultNpcResource();

  return (
    <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-sm font-medium text-[#cccccc]">🎨 动画与音效资源</h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {RESOURCE_STATES.map(({ key, label }) => (
            <div key={key} className="contents">
              <ResourceFilePicker
                label={`${label}动画`}
                value={resources[key]?.image || null}
                onChange={(v) => updateResourceField(key, "image", v)}
                fieldName={`npc_${key}_image`}
                gameId={gameId}
                gameSlug={gameSlug}
                extensions={[".asf"]}
                placeholder="点击选择"
              />
              <ResourceFilePicker
                label={`${label}音效`}
                value={resources[key]?.sound || null}
                onChange={(v) => updateResourceField(key, "sound", v)}
                fieldName={`npc_${key}_sound`}
                gameId={gameId}
                gameSlug={gameSlug}
                extensions={[".wav", ".ogg", ".xnb"]}
                placeholder="点击选择"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ========== 行为脚本区 ==========

function BehaviorSection({
  formData,
  updateField,
  visibleFields,
  gameId,
  gameSlug,
}: {
  formData: Partial<Npc>;
  updateField: <K extends keyof Npc>(key: K, value: Npc[K]) => void;
  visibleFields: Set<string>;
  gameId: string;
  gameSlug: string;
}) {
  return (
    <div className="space-y-5">
      {/* 脚本配置 */}
      <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h2 className="text-sm font-medium text-[#cccccc]">📜 脚本配置</h2>
        </div>
        <div className="p-4 space-y-3">
          <ResourceFilePicker
            label="对话脚本"
            value={formData.scriptFile}
            onChange={(v) => updateField("scriptFile", v)}
            fieldName="npc_scriptFile"
            gameId={gameId}
            gameSlug={gameSlug}
            extensions={[".txt"]}
            placeholder="点击选择"
          />

          {visibleFields.has("deathScript") && (
            <ResourceFilePicker
              label="死亡脚本"
              value={formData.deathScript}
              onChange={(v) => updateField("deathScript", v)}
              fieldName="npc_deathScript"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("bodyIni") && (
            <ResourceFilePicker
              label="死亡物体"
              value={formData.bodyIni}
              onChange={(v) => updateField("bodyIni", v)}
              fieldName="npc_bodyIni"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".ini"]}
              placeholder="点击选择"
            />
          )}
        </div>
      </section>

      {/* 寻路配置 */}
      {visibleFields.has("pathFinder") && (
        <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3c3c3c]">
            <h2 className="text-sm font-medium text-[#cccccc]">🗺️ 寻路配置</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#858585] mb-1">寻路类型</label>
              <select
                value={formData.pathFinder ?? 1}
                onChange={(e) => updateField("pathFinder", parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
              >
                <option value={0}>简单寻路</option>
                <option value={1}>完整 A* 寻路</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-[#858585] mb-1">初始方向 (0-7)</label>
              <NumberInput
                min={0}
                max={7}
                value={formData.dir ?? 0}
                onChange={(val) => updateField("dir", val ?? 0)}
                className="w-full"
              />
            </div>

            {visibleFields.has("idle") && (
              <div>
                <label className="block text-sm text-[#858585] mb-1">攻击间隔（帧）</label>
                <NumberInput
                  min={0}
                  value={formData.idle ?? 0}
                  onChange={(val) => updateField("idle", val ?? 0)}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-[#858585] mb-1">亮度/透明度</label>
              <NumberInput
                min={0}
                max={255}
                value={formData.lum ?? 0}
                onChange={(val) => updateField("lum", val ?? 0)}
                className="w-full"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
