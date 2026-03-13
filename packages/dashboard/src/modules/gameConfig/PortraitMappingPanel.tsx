/**
 * 对话头像面板
 * PortraitEntryRow, PortraitMappingPanel
 */

import { trpc, useToast } from "@miu2d/shared";
import type { PortraitEntry } from "@miu2d/types";
import { exportPortraitIni } from "@miu2d/types";
import { NumberInput } from "@miu2d/ui";
import { memo, useCallback, useEffect, useState } from "react";
import { ResourceFilePicker } from "../../components/common";
import { MiniAsfPreview } from "../../components/common/ResourceFilePicker/AsfPreviewTooltip";
import { buildResourcePath } from "../../components/common/ResourceFilePicker/types";
import { useDashboard } from "../../DashboardContext";
import { SectionTitle } from "./FormComponents";

/**
 * 单条头像映射行（memo 减少重渲染）
 */
export const PortraitEntryRow = memo(function PortraitEntryRow({
  entry,
  index,
  gameSlug,
  gameId,
  onUpdate,
  onRemove,
}: {
  entry: PortraitEntry;
  index: number;
  gameSlug: string;
  gameId: string;
  onUpdate: (index: number, field: "idx" | "file", value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#2a2d2e] rounded-lg group hover:bg-[#2f3233] transition-colors">
      {/* 预览 */}
      <div className="w-12 h-12 flex-shrink-0 rounded bg-[#1e1e1e] border border-panel-border flex items-center justify-center overflow-hidden">
        {entry.file ? (
          <MiniAsfPreview
            gameSlug={gameSlug}
            path={buildResourcePath("portrait_image", entry.file)}
            size={48}
          />
        ) : (
          <span className="text-[#555] text-lg">🖼</span>
        )}
      </div>

      {/* 索引 */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <span className="text-[10px] text-[#858585]">索引</span>
        <NumberInput
          min={0}
          value={entry.idx}
          onChange={(val) => onUpdate(index, "idx", val ?? 0)}
          className="w-16"
        />
      </div>

      {/* 文件选择器 */}
      <div className="flex-1 min-w-0">
        <ResourceFilePicker
          label="文件"
          value={entry.file || null}
          onChange={(val) => onUpdate(index, "file", val ?? "")}
          fieldName="portrait_image"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".asf"]}
          placeholder="选择头像文件..."
        />
      </div>

      {/* 删除 */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400 transition-all flex-shrink-0"
        title="删除"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
});

export function PortraitMappingPanel({ gameId }: { gameId: string }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const { currentGame, setShowImportAll } = useDashboard();
  const gameSlug = currentGame?.slug ?? "";

  // 查询
  const { data: portraitData, isLoading } = trpc.talkPortrait.get.useQuery(
    { gameId },
    { enabled: !!gameId }
  );

  const [entries, setEntries] = useState<PortraitEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (portraitData?.entries) {
      setEntries(portraitData.entries);
      setIsDirty(false);
    }
  }, [portraitData]);

  // 保存
  const updateMutation = trpc.talkPortrait.update.useMutation({
    onSuccess: () => {
      toast.success("对话头像配置已保存");
      setIsDirty(false);
      utils.talkPortrait.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const handleSave = () => {
    updateMutation.mutate({ gameId, entries });
  };

  const handleAdd = () => {
    const maxIdx = entries.reduce((max, e) => Math.max(max, e.idx), -1);
    setEntries([...entries, { idx: maxIdx + 1, file: "" }]);
    setIsDirty(true);
  };

  const handleRemove = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const handleUpdate = useCallback(
    (index: number, field: "idx" | "file", value: string | number) => {
      setEntries((prev) => {
        const updated = [...prev];
        if (field === "idx") {
          updated[index] = { ...updated[index], idx: value as number };
        } else {
          updated[index] = { ...updated[index], file: value as string };
        }
        return updated;
      });
      setIsDirty(true);
    },
    []
  );

  const handleExportIni = () => {
    const content = exportPortraitIni(entries);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HeadFile.ini";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="text-[#858585]">加载中...</div>;
  }

  return (
    <div className="space-y-4 relative">
      <SectionTitle desc="Talk 脚本命令使用的角色头像索引映射（对应 HeadFile.ini）" />

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowImportAll(true)}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors"
        >
          批量导入
        </button>
        <button
          type="button"
          onClick={handleExportIni}
          disabled={entries.length === 0}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors disabled:opacity-50"
        >
          导出 INI
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
        >
          + 添加
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded text-white transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "保存中..." : "保存更改"}
          </button>
        )}
      </div>

      {/* 映射表 */}
      {entries.length === 0 ? (
        <div className="text-sm text-[#858585] bg-[#1e1e1e] p-6 rounded-lg text-center">
          暂无头像映射。拖入 HeadFile.ini 文件、点击「从 INI 导入」、或手动添加映射。
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <PortraitEntryRow
              key={`${entry.idx}-${index}`}
              entry={entry}
              index={index}
              gameSlug={gameSlug}
              gameId={gameId}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>
          头像文件位于 <code className="text-[#ce9178]">asf/portrait/</code> 目录下。
        </p>
        <p className="mt-1">
          脚本中使用 <code className="text-[#ce9178]">Talk</code> 命令指定头像索引来显示角色头像。
        </p>
      </div>
    </div>
  );
}
