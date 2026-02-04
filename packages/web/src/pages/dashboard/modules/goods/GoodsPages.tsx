/**
 * 物品编辑页面 - 完整实现
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "../../../../contexts/ToastContext";
import { DashboardIcons } from "../../icons";
import { useDashboard } from "../../DashboardContext";
import type {
  Goods,
  GoodsKind,
  GoodsPart,
} from "@miu2d/types";
import {
  GoodsKindLabels,
  GoodsPartLabels,
  GoodsEffectTypeLabels,
  getEffectTypeOptions,
  getActualEffectType,
  getVisibleFieldsByKind,
  createDefaultGoods,
} from "@miu2d/types";

// ========== 列表页（欢迎页面） ==========

export function GoodsListPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📦</div>
        <h2 className="text-xl font-medium text-white mb-3">物品编辑</h2>
        <p className="text-[#858585] text-sm leading-relaxed">
          从左侧列表选择一个物品进行编辑，
          <br />
          或使用上方按钮创建新物品、导入 INI 文件。
        </p>
      </div>
    </div>
  );
}

// ========== 详情页 ==========

export function GoodsDetailPage() {
  const { gameId: gameSlug, goodsId } = useParams<{ gameId: string; goodsId: string }>();
  const { currentGame, editCache } = useDashboard();
  const gameId = currentGame?.id;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const basePath = `/dashboard/${gameSlug}/goods`;
  const isNew = goodsId === "new";

  // 缓存 key
  const cacheKey = goodsId ? `goods:${goodsId}` : null;

  // URL 参数获取类型
  const searchParams = new URLSearchParams(window.location.search);
  const kindParam = searchParams.get("kind") as GoodsKind | null;

  // 查询物品详情
  const { data: goods, isLoading } = trpc.goods.get.useQuery(
    { gameId: gameId!, id: goodsId! },
    { enabled: !!gameId && !!goodsId && !isNew }
  );

  // 表单状态
  const [formData, setFormData] = useState<Partial<Goods>>({});

  // 当 goodsId 变化时，重置表单状态
  useEffect(() => {
    if (!cacheKey) return;

    // 优先从缓存读取
    if (editCache.has(cacheKey)) {
      setFormData(editCache.get<Partial<Goods>>(cacheKey) || {});
    } else if (isNew && gameId) {
      // 新建时初始化
      setFormData(createDefaultGoods(gameId, kindParam || "Consumable") as Partial<Goods>);
    } else {
      // 等待查询数据
      setFormData({});
    }
  }, [cacheKey, isNew, gameId, kindParam, editCache]);

  // 加载数据后更新表单（当表单为空且有查询数据时）
  useEffect(() => {
    if (goods && Object.keys(formData).length === 0) {
      setFormData(goods);
    }
  }, [goods, formData]);

  // 同步表单数据到缓存
  useEffect(() => {
    if (cacheKey && Object.keys(formData).length > 0) {
      editCache.set(cacheKey, formData);
    }
  }, [cacheKey, formData, editCache]);

  const toast = useToast();

  // 保存物品
  const createMutation = trpc.goods.create.useMutation({
    onSuccess: (data) => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      // 刷新左侧物品列表
      if (gameId) {
        utils.goods.list.invalidate({ gameId });
      }
      toast.success(`物品「${formData.name || '新物品'}」创建成功`);
      navigate(`${basePath}/${data.id}`);
    },
  });

  const updateMutation = trpc.goods.update.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      toast.success(`物品「${formData.name}」保存成功`);
    },
  });

  const deleteMutation = trpc.goods.delete.useMutation({
    onSuccess: () => {
      if (cacheKey) {
        editCache.remove(cacheKey);
      }
      // 刷新左侧物品列表
      if (gameId) {
        utils.goods.list.invalidate({ gameId });
      }
      toast.success(`物品已删除`);
      navigate(basePath);
    },
  });

  // 根据 Kind 获取可见字段
  const visibleFields = useMemo(() => {
    return new Set(getVisibleFieldsByKind(formData.kind || "Consumable"));
  }, [formData.kind]);

  const handleSave = useCallback(() => {
    if (!gameId) return;

    if (isNew) {
      createMutation.mutate({
        gameId,
        kind: formData.kind || "Consumable",
        key: formData.key || `goods_${Date.now()}`,
        name: formData.name || "新物品",
        intro: formData.intro,
      });
    } else if (goodsId) {
      updateMutation.mutate({
        ...formData,
        id: goodsId,
        gameId,
      } as Goods);
    }
  }, [gameId, goodsId, isNew, formData, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (gameId && goodsId && !isNew) {
      deleteMutation.mutate({ id: goodsId, gameId });
    }
  }, [gameId, goodsId, isNew, deleteMutation]);

  const updateField = useCallback(<K extends keyof Goods>(key: K, value: Goods[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (isLoading && !isNew) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#858585]">加载中...</div>
      </div>
    );
  }

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
                {isNew ? "新建物品" : formData.name || "物品详情"}
              </h1>
              <p className="text-xs text-[#858585]">
                {GoodsKindLabels[formData.kind || "Consumable"]}
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
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl space-y-5">
          {/* 基本信息 */}
          <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3c3c3c]">
              <h2 className="text-sm font-medium text-[#cccccc]">📝 基本信息</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品类型</label>
                <select
                  value={formData.kind || "Consumable"}
                  onChange={(e) => updateField("kind", e.target.value as GoodsKind)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                >
                  {Object.entries(GoodsKindLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">物品名称</label>
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
                  placeholder="例如: goods-m00-金花.ini"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-[#858585] mb-1">价格</label>
                <input
                  type="number"
                  value={formData.cost ?? ""}
                  onChange={(e) => updateField("cost", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-[#858585] mb-1">物品介绍</label>
                <textarea
                  rows={3}
                  value={formData.intro || ""}
                  onChange={(e) => updateField("intro", e.target.value)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff] resize-none"
                />
              </div>
            </div>
          </section>

          {/* 资源文件 */}
          <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3c3c3c]">
              <h2 className="text-sm font-medium text-[#cccccc]">🎨 资源文件</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品图像</label>
                <input
                  type="text"
                  value={formData.image || ""}
                  onChange={(e) => updateField("image", e.target.value || null)}
                  placeholder="例如: tm050-金葵花.asf"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">物品图标</label>
                <input
                  type="text"
                  value={formData.icon || ""}
                  onChange={(e) => updateField("icon", e.target.value || null)}
                  placeholder="例如: tm050-金葵花s.asf"
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#858585] mb-1">特效资源</label>
                <input
                  type="text"
                  value={formData.effect || ""}
                  onChange={(e) => updateField("effect", e.target.value || null)}
                  className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                />
              </div>
            </div>
          </section>

          {/* 消耗品属性 */}
          {formData.kind === "Consumable" && (
            <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3c3c3c]">
                <h2 className="text-sm font-medium text-[#cccccc]">🍵 消耗效果</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复生命</label>
                    <input
                      type="number"
                      value={formData.life ?? ""}
                      onChange={(e) => updateField("life", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复体力</label>
                    <input
                      type="number"
                      value={formData.thew ?? ""}
                      onChange={(e) => updateField("thew", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">恢复内力</label>
                    <input
                      type="number"
                      value={formData.mana ?? ""}
                      onChange={(e) => updateField("mana", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#858585] mb-1">特殊效果</label>
                  <select
                    value={formData.effectType ?? 0}
                    onChange={(e) => updateField("effectType", parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                  >
                    {getEffectTypeOptions("Consumable", null).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* 装备属性 */}
          {formData.kind === "Equipment" && (
            <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3c3c3c]">
                <h2 className="text-sm font-medium text-[#cccccc]">⚔️ 装备属性</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">装备部位</label>
                    <select
                      value={formData.part || "Hand"}
                      onChange={(e) => {
                        updateField("part", e.target.value as GoodsPart);
                        // 部位变化时，重置 effectType（因为可选项不同）
                        updateField("effectType", 0);
                      }}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    >
                      {Object.entries(GoodsPartLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">特效类型</label>
                    <select
                      value={formData.effectType ?? 0}
                      onChange={(e) => updateField("effectType", parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    >
                      {getEffectTypeOptions("Equipment", formData.part as GoodsPart).map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {/* 显示实际效果 */}
                    {formData.effectType != null && formData.effectType > 0 && (
                      <p className="mt-1 text-xs text-[#6a9955]">
                        实际效果: {GoodsEffectTypeLabels[getActualEffectType("Equipment", formData.part as GoodsPart, formData.effectType)]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">生命上限</label>
                    <input
                      type="number"
                      value={formData.lifeMax ?? ""}
                      onChange={(e) => updateField("lifeMax", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">体力上限</label>
                    <input
                      type="number"
                      value={formData.thewMax ?? ""}
                      onChange={(e) => updateField("thewMax", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">内力上限</label>
                    <input
                      type="number"
                      value={formData.manaMax ?? ""}
                      onChange={(e) => updateField("manaMax", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">攻击力</label>
                    <input
                      type="number"
                      value={formData.attack ?? ""}
                      onChange={(e) => updateField("attack", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">防御力</label>
                    <input
                      type="number"
                      value={formData.defend ?? ""}
                      onChange={(e) => updateField("defend", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#858585] mb-1">闪避</label>
                    <input
                      type="number"
                      value={formData.evade ?? ""}
                      onChange={(e) => updateField("evade", e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 任务道具属性 */}
          {formData.kind === "Quest" && (
            <section className="bg-[#252526] border border-[#3c3c3c] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#3c3c3c]">
                <h2 className="text-sm font-medium text-[#cccccc]">📜 使用脚本</h2>
              </div>
              <div className="p-4">
                <div>
                  <label className="block text-sm text-[#858585] mb-1">脚本路径</label>
                  <input
                    type="text"
                    value={formData.script || ""}
                    onChange={(e) => updateField("script", e.target.value || null)}
                    placeholder="例如: Book00-太极剑谱.txt"
                    className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-[#0098ff]"
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
