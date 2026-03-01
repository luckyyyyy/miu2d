/**
 * 基础信息面板
 * BasicInfoPanel
 */

import { trpc, useToast } from "@miu2d/shared";
import type { GameConfigDataFull } from "@miu2d/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "../../DashboardContext";
import { getGameApiUrl } from "../../utils/resourcePath";
import { Field, FormCard, HelpTip, SectionTitle, inputCls } from "./FormComponents";

export function BasicInfoPanel({
  config,
  updateConfig,
  gameId,
  gameSlug,
}: {
  config: GameConfigDataFull;
  updateConfig: <K extends keyof GameConfigDataFull>(k: K, v: GameConfigDataFull[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentGame, setCurrentGame } = useDashboard();
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Logo 从 slug 派生的 URL，加时间戳刷新
  const [logoTimestamp, setLogoTimestamp] = useState(() => Date.now());
  const logoSrc = gameSlug ? `${getGameApiUrl(gameSlug, "logo/128")}?_t=${logoTimestamp}` : "";
  const [logoExists, setLogoExists] = useState(true);

  // 空间名称编辑
  const [nameValue, setNameValue] = useState(currentGame?.name ?? "");
  useEffect(() => {
    if (currentGame?.name) setNameValue(currentGame.name);
  }, [currentGame?.name]);

  // 空间路由编辑
  const [slugValue, setSlugValue] = useState(currentGame?.slug ?? "");
  const [slugError, setSlugError] = useState("");
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const isSlugValid = slugValue.length > 0 && slugRegex.test(slugValue);

  useEffect(() => {
    if (currentGame?.slug) setSlugValue(currentGame.slug);
  }, [currentGame?.slug]);

  const updateGameMutation = trpc.game.update.useMutation({
    onSuccess: (updated) => {
      toast.success("空间信息已保存");
      setCurrentGame(updated);
      utils.game.list.invalidate();
      if (updated.slug !== currentGame?.slug) {
        navigate(`/dashboard/${updated.slug}/game/basic`, { replace: true });
      }
    },
    onError: (err) => {
      setSlugError(err.message);
    },
  });

  const handleNameSave = useCallback(() => {
    if (!currentGame || !nameValue.trim()) return;
    updateGameMutation.mutate({ id: currentGame.id, name: nameValue.trim() });
  }, [currentGame, nameValue, updateGameMutation]);

  const handleSlugSave = useCallback(() => {
    if (!currentGame || !isSlugValid) return;
    setSlugError("");
    updateGameMutation.mutate({ id: currentGame.id, slug: slugValue });
  }, [currentGame, isSlugValid, slugValue, updateGameMutation]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gameSlug) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo 文件不能超过 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch(getGameApiUrl(gameSlug, "logo"), {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }

      await res.json();
      setLogoExists(true);
      setLogoTimestamp(Date.now());
      toast.success("Logo 上传成功");
    } catch (err) {
      toast.error(`Logo 上传失败: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    if (!gameSlug) return;
    setIsUploading(true);
    try {
      const res = await fetch(getGameApiUrl(gameSlug, "logo"), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setLogoExists(false);
      setLogoTimestamp(Date.now());
      toast.success("Logo 已删除");
    } catch (err) {
      toast.error("Logo 删除失败");
    } finally {
      setIsUploading(false);
    }
  };

  // 从 players 表获取主角候选列表
  const { data: players } = trpc.player.list.useQuery({ gameId }, { enabled: !!gameId });

  // 从 scenes 表获取地图候选列表
  const { data: scenes } = trpc.scene.list.useQuery({ gameId }, { enabled: !!gameId });

  return (
    <div className="space-y-4">
      <SectionTitle />

      {/* 空间信息 */}
      <FormCard>
        <div className="space-y-4">
          <div className="text-sm font-medium text-[#cccccc] pb-2 border-b border-panel-border">
            空间信息
          </div>
          <Field label="空间名称" desc="即游戏名称，将显示在标题界面、顶栏和游戏列表中">
            <div className="flex gap-2">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className={`${inputCls} flex-1`}
                placeholder="游戏名称"
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              />
              <button
                type="button"
                onClick={handleNameSave}
                disabled={!nameValue.trim() || nameValue === currentGame?.name || updateGameMutation.isPending}
                className="px-3 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {updateGameMutation.isPending ? "保存中..." : "保存"}
              </button>
            </div>
          </Field>
          <Field label="空间 Logo" desc="上传空间 Logo，将作为网页图标和 PWA 安装图标显示。要求最小 512×512 像素，支持 PNG、JPG、WebP 等格式，最大 5MB">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-widget-border bg-[#1a1a1a] flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoSrc && logoExists ? (
                  <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoExists(false)} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[#444]">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading ? "上传中..." : logoExists ? "更换 Logo" : "上传 Logo"}
                </button>
                {logoExists && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={isUploading}
                    className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#5a1d1d] text-[#858585] hover:text-[#f48771] rounded-lg transition-colors disabled:opacity-50"
                  >
                    删除 Logo
                  </button>
                )}
              </div>
            </div>
          </Field>
          <Field
            label="空间路由（Slug）"
            desc="游戏访问路径 /game/[slug] 及编辑器路径 /dashboard/[slug]。仅支持小写字母、数字和连字符"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={slugValue}
                onChange={(e) => {
                  setSlugValue(e.target.value.toLowerCase());
                  setSlugError("");
                }}
                className={`flex-1 px-3 py-2 bg-[#3c3c3c] border rounded-lg text-white text-sm focus:outline-none transition-colors ${
                  slugValue && !isSlugValid
                    ? "border-red-500 focus:border-red-500"
                    : "border-widget-border focus:border-focus-border"
                }`}
                placeholder="my-game"
                onKeyDown={(e) => e.key === "Enter" && handleSlugSave()}
              />
              <button
                type="button"
                onClick={handleSlugSave}
                disabled={
                  !isSlugValid ||
                  slugValue === gameSlug ||
                  updateGameMutation.isPending
                }
                className="px-3 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {updateGameMutation.isPending ? "保存中..." : "保存"}
              </button>
            </div>
            {slugError && <p className="mt-1 text-xs text-red-400">{slugError}</p>}
            {slugValue && !isSlugValid && (
              <p className="mt-1 text-xs text-red-400">
                仅支持小写字母、数字和连字符，不能以连字符开头或结尾
              </p>
            )}
            {slugValue !== gameSlug && isSlugValid && (
              <p className="mt-1 text-xs text-amber-400">⚠ 修改路由后，所有旧链接将失效</p>
            )}
          </Field>
        </div>
      </FormCard>

      <FormCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-panel-border mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#cccccc]">开放游戏</span>
              <HelpTip text="开启后玩家可以访问游戏并加载数据。关闭后 /api/data 接口将不可用，游戏无法启动" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.gameEnabled}
              onClick={() => updateConfig("gameEnabled", !config.gameEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.gameEnabled ? "bg-[#0e639c]" : "bg-[#3c3c3c]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  config.gameEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <Field label="游戏版本">
            <input
              type="text"
              value={config.gameVersion}
              onChange={(e) => updateConfig("gameVersion", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="游戏描述">
            <textarea
              rows={3}
              value={config.gameDescription}
              onChange={(e) => updateConfig("gameDescription", e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field label="游戏主角" desc="新游戏开始时使用的主角角色配置">
            <select
              value={config.playerKey}
              onChange={(e) => updateConfig("playerKey", e.target.value)}
              className={inputCls}
            >
              <option value="">-- 请选择主角 --</option>
              {players?.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name}（{p.key}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="初始地图" desc="新游戏开始时加载的地图（场景）">
            <select
              value={config.initialMap}
              onChange={(e) => updateConfig("initialMap", e.target.value)}
              className={inputCls}
            >
              <option value="">-- 请选择地图 --</option>
              {scenes?.map((s) => (
                <option key={s.id} value={s.mapFileName}>
                  {s.name}（{s.mapFileName}）
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="初始 NPC 文件"
            desc="新游戏开始时加载的 NPC 文件名（如 map002.npc），留空则不加载"
          >
            <input
              type="text"
              value={config.initialNpc}
              onChange={(e) => updateConfig("initialNpc", e.target.value)}
              className={inputCls}
              placeholder="例如: map002.npc"
            />
          </Field>
          <Field
            label="初始物体文件"
            desc="新游戏开始时加载的 OBJ 文件名（如 map002_obj.obj），留空则不加载"
          >
            <input
              type="text"
              value={config.initialObj}
              onChange={(e) => updateConfig("initialObj", e.target.value)}
              className={inputCls}
              placeholder="例如: map002_obj.obj"
            />
          </Field>
          <Field label="初始背景音乐" desc="新游戏开始时播放的背景音乐文件名，留空则无背景音乐">
            <input
              type="text"
              value={config.initialBgm}
              onChange={(e) => updateConfig("initialBgm", e.target.value)}
              className={inputCls}
              placeholder="例如: music01.ogg"
            />
          </Field>
          <Field
            label="标题界面音乐"
            desc="Title 画面播放的背景音乐文件名（位于 content/music/ 目录下），留空则无音乐。进入游戏后自动停止"
          >
            <input
              type="text"
              value={config.titleMusic}
              onChange={(e) => updateConfig("titleMusic", e.target.value)}
              className={inputCls}
              placeholder="例如: title.ogg"
            />
          </Field>

        </div>
      </FormCard>
    </div>
  );
}
