/**
 * Object 编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DashboardIcons } from "../../icons";
import { useDashboard } from "../../DashboardContext";
import { NumberInput, ResourceFilePicker } from "../../../../components/common";
import type {
  Obj,
  ObjKind,
  ObjResource,
} from "@miu2d/types";
import {
  ObjKindLabels,
  ObjStateLabels,
  createDefaultObj,
  createDefaultObjResource,
  getVisibleFieldsByObjKind,
} from "@miu2d/types";
import { ObjPreview } from "./ObjPreview";

// ========== 列表页（欢迎页面） ==========

export function ObjListPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📦</div>
        <h2 className="text-xl font-medium text-white mb-3">物体编辑</h2>
        <p className="text-[#858585] text-sm leading-relaxed">
          从左侧列表选择一个物体进行编辑，
          <br />
          或使用上方按钮创建新物体、导入 INI 文件。
        </p>
      </div>
    </div>
  );
}

// ========== 详情页 ==========

export function ObjDetailPage() {
  const { gameId: gameSlug, objId, tab } = useParams<{ gameId: string; objId: string; tab: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/objs`;
  const isNew = objId === "new";

  // 缓存 key
  const cacheKey = objId ? `obj:${objId}` : null;

  // Tab 类型
  type TabType = "basic" | "resource" | "behavior";
  const validTabs: TabType[] = ["basic", "resource", "behavior"];

  // 当前 Tab - 从 URL 读取
  const activeTab: TabType = validTabs.includes(tab as TabType)
    ? (tab as TabType)
    : "basic";

  // 切换 Tab - 通过导航更新 URL
  const setActiveTab = useCallback((newTab: TabType) => {
    navigate(`${basePath}/${objId}/${newTab}`, { replace: true });
  }, [navigate, basePath, objId]);

  // 查询 Object 详情
  const { data: obj, isLoading } = trpc.obj.get.useQuery(
    { gameId: gameId!, id: objId! },
    { enabled: !!gameId && !!objId && !isNew }
  );

  // 表单状态 - 优先从缓存读取
  const [formData, setFormData] = useState<Partial<Obj>>(() => {
    if (cacheKey && editCache.has(cacheKey)) {
      return editCache.get<Partial<Obj>>(cacheKey) || {};
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
      setFormData(createDefaultObj(gameId));
    }
  }, [isNew, gameId, formData]);

  // 加载数据后更新表单（只在没有缓存时）
  useEffect(() => {
    if (obj && cacheKey && !editCache.has(cacheKey)) {
      setFormData(obj);
    }
  }, [obj, cacheKey, editCache]);

  const toast = useToast();

  // 保存 Object
  const createMutation = trpc.obj.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`物体「${formData.name || '新物体'}」创建成功`);
      utils.obj.list.invalidate({ gameId: gameId! });
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  const updateMutation = trpc.obj.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.obj.list.invalidate({ gameId: gameId! });
      toast.success(`物体「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.obj.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      utils.obj.list.invalidate({ gameId: gameId! });
      toast.success(`物体已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByObjKind(formData.kind || "Static"));
  }, [formData.kind]);

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        key: formData.key || `obj_${Date.now()}`,
        name: formData.name || "新物体",
        kind: formData.kind,
        ...formData,
      });
    } else if (objId) {
      updateMutation.mutate({
        ...formData,
        id: objId,
        gameId,
      } as Obj);
    }
  }, [gameId, objId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && objId && !isNew) {
      deleteMutation.mutate({ id: objId, gameId });
    }
  }, [gameId, objId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Obj>(key: K, value: Obj[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateResourceField = useCallback((state: keyof ObjResource, field: "image" | "sound", value: string | null) => {
    setFormData((prev) => {
      const resources = prev.resources || createDefaultObjResource();
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
                {isNew ? "新建物体" : formData.name || "物体详情"}
              </h1>
              <p className="text-xs text-[#858585]">
                {ObjKindLabels[formData.kind || "Static"]}
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
                visibleFields={visibleFields}
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
                  <h3 className="text-sm font-medium text-[#cccccc]">📦 物体预览</h3>
                </div>
                <div className="p-4">
                  <ObjPreview
                    gameSlug={gameSlug!}
                    obj={formData}
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
  visibleFields,
}: {
  formData: Partial<Obj>;
  updateField: <K extends keyof Obj>(key: K, value: Obj[K]) => void;
  visibleFields: Set<string>;
}) {
  return (
    <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#3c3c3c]">
        <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[#858585] mb-1">物体名称</label>
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
            placeholder="例如: 宝箱1.ini"
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          />
        </div>

        <div>
          <label className="block text-sm text-[#858585] mb-1">物体类型</label>
          <select
            value={formData.kind || "Static"}
            onChange={(e) => updateField("kind", e.target.value as ObjKind)}
            className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
          >
            {Object.entries(ObjKindLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {visibleFields.has("dir") && (
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
        )}

        {visibleFields.has("lum") && (
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
        )}

        {visibleFields.has("damage") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">伤害值</label>
            <NumberInput
              min={0}
              value={formData.damage ?? 0}
              onChange={(val) => updateField("damage", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("frame") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">当前帧</label>
            <NumberInput
              min={0}
              value={formData.frame ?? 0}
              onChange={(val) => updateField("frame", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("height") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">高度</label>
            <NumberInput
              min={0}
              value={formData.height ?? 0}
              onChange={(val) => updateField("height", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("offX") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">X 偏移</label>
            <NumberInput
              value={formData.offX ?? 0}
              onChange={(val) => updateField("offX", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("offY") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">Y 偏移</label>
            <NumberInput
              value={formData.offY ?? 0}
              onChange={(val) => updateField("offY", val ?? 0)}
              className="w-full"
            />
          </div>
        )}

        {visibleFields.has("millisecondsToRemove") && (
          <div>
            <label className="block text-sm text-[#858585] mb-1">移除延迟(毫秒)</label>
            <NumberInput
              min={0}
              value={formData.millisecondsToRemove ?? 0}
              onChange={(val) => updateField("millisecondsToRemove", val ?? 0)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ========== 资源配置区 ==========

// Object 只支持 Common 一种状态（与 NPC 多状态不同）
const RESOURCE_STATES: Array<{ key: keyof ObjResource; label: string }> = [
  { key: "common", label: "通用" },
];

function ResourceSection({
  formData,
  updateResourceField,
  gameId,
  gameSlug,
}: {
  formData: Partial<Obj>;
  updateResourceField: (state: keyof ObjResource, field: "image" | "sound", value: string | null) => void;
  gameId: string;
  gameSlug: string;
}) {
  const resources = formData.resources || createDefaultObjResource();

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
                fieldName={`obj_${key}_image`}
                gameId={gameId}
                gameSlug={gameSlug}
                extensions={[".asf"]}
                placeholder="点击选择"
              />
              <ResourceFilePicker
                label={`${label}音效`}
                value={resources[key]?.sound || null}
                onChange={(v) => updateResourceField(key, "sound", v)}
                fieldName={`obj_${key}_sound`}
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
  formData: Partial<Obj>;
  updateField: <K extends keyof Obj>(key: K, value: Obj[K]) => void;
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
          {visibleFields.has("scriptFile") && (
            <ResourceFilePicker
              label="交互脚本"
              value={formData.scriptFile}
              onChange={(v) => updateField("scriptFile", v)}
              fieldName="obj_scriptFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("scriptFileRight") && (
            <ResourceFilePicker
              label="右键脚本"
              value={formData.scriptFileRight}
              onChange={(v) => updateField("scriptFileRight", v)}
              fieldName="obj_scriptFileRight"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("timerScriptFile") && (
            <ResourceFilePicker
              label="定时脚本"
              value={formData.timerScriptFile}
              onChange={(v) => updateField("timerScriptFile", v)}
              fieldName="obj_timerScriptFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".txt"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("timerScriptInterval") && (
            <div>
              <label className="block text-sm text-[#858585] mb-1">定时脚本间隔(毫秒)</label>
              <NumberInput
                min={0}
                value={formData.timerScriptInterval ?? 3000}
                onChange={(val) => updateField("timerScriptInterval", val ?? 3000)}
                className="w-full"
              />
            </div>
          )}

          {visibleFields.has("reviveNpcIni") && (
            <ResourceFilePicker
              label="复活NPC配置"
              value={formData.reviveNpcIni}
              onChange={(v) => updateField("reviveNpcIni", v)}
              fieldName="obj_reviveNpcIni"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".ini"]}
              placeholder="点击选择"
            />
          )}

          {visibleFields.has("wavFile") && (
            <ResourceFilePicker
              label="音效文件"
              value={formData.wavFile}
              onChange={(v) => updateField("wavFile", v)}
              fieldName="obj_wavFile"
              gameId={gameId}
              gameSlug={gameSlug}
              extensions={[".wav", ".ogg", ".xnb"]}
              placeholder="点击选择"
            />
          )}
        </div>
      </section>

      {/* 交互配置 */}
      <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#3c3c3c]">
          <h2 className="text-sm font-medium text-[#cccccc]">🎮 交互配置</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          {visibleFields.has("canInteractDirectly") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="canInteractDirectly"
                checked={formData.canInteractDirectly === 1}
                onChange={(e) => updateField("canInteractDirectly", e.target.checked ? 1 : 0)}
                className="rounded"
              />
              <label htmlFor="canInteractDirectly" className="text-sm text-[#cccccc]">
                可远程交互（无需靠近）
              </label>
            </div>
          )}

          {visibleFields.has("scriptFileJustTouch") && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="scriptFileJustTouch"
                checked={formData.scriptFileJustTouch === 1}
                onChange={(e) => updateField("scriptFileJustTouch", e.target.checked ? 1 : 0)}
                className="rounded"
              />
              <label htmlFor="scriptFileJustTouch" className="text-sm text-[#cccccc]">
                仅触碰触发脚本
              </label>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
