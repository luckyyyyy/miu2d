/**
 * 资源文件选择器
 *
 * 通用的游戏资源文件选择组件，支持：
 * - ASF 动画预览（内嵌）
 * - 音频播放（WAV/OGG）
 * - 点击修改弹出文件选择器
 * - 每个字段占一行
 */
import { useCallback, useState } from "react";
import { FileSelectDialog } from "./FileSelectDialog";
import { MiniAsfPreview } from "./AsfPreviewTooltip";
import { AudioPreview } from "./AudioPreview";
import { buildResourcePath, getResourceFileType } from "./types";

export interface ResourceFilePickerProps {
  /** 字段标签 */
  label: string;
  /** 当前值 */
  value: string | null | undefined;
  /** 值变化回调 */
  onChange: (value: string | null) => void;
  /** 字段名（用于确定默认路径和类型） */
  fieldName: string;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug（用于预览） */
  gameSlug: string;
  /** 允许的扩展名 */
  extensions?: string[];
  /** 占位文本 */
  placeholder?: string;
}

export function ResourceFilePicker({
  label,
  value,
  onChange,
  fieldName,
  gameId,
  gameSlug,
  extensions,
  placeholder = "未选择",
}: ResourceFilePickerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 完整资源路径
  const fullPath = value ? buildResourcePath(fieldName, value) : "";

  // 文件类型
  const fileType = getResourceFileType(fieldName, value || "");

  // 打开选择器
  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  // 选择文件
  const handleSelect = useCallback((path: string) => {
    // 后端返回的 path 以 / 开头，去掉开头的斜杠
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    onChange(normalizedPath);
    setIsDialogOpen(false);
  }, [onChange]);

  // 清除
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  return (
    <div className="flex items-center gap-4">
      {/* 标签 */}
      <label className="text-sm text-[#858585] w-24 flex-shrink-0">{label}</label>

      {/* 内容区 */}
      <div className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded-lg p-2 min-h-[48px] flex items-center">
        {value ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 预览区 */}
            {fileType === "asf" && (
              <MiniAsfPreview gameSlug={gameSlug} path={fullPath} size={36} />
            )}

            {/* 音频预览 */}
            {fileType === "audio" && (
              <AudioPreview gameSlug={gameSlug} path={fullPath} />
            )}

            {/* 文件路径信息 */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#cccccc] truncate" title={fullPath}>
                {fullPath.startsWith("/") ? fullPath : `/${fullPath}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[#808080] flex-1">
            {placeholder}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 text-xs rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-white"
              title="清除"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenDialog}
            className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc] rounded border border-[#454545]"
          >
            {value ? "修改" : "选择"}
          </button>
        </div>
      </div>

      {/* 文件选择弹窗 */}
      <FileSelectDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        fieldName={fieldName}
        currentValue={value}
        extensions={extensions}
        title={`选择${label}`}
      />
    </div>
  );
}

// ========== 资源字段组 ==========

interface ResourceFieldConfig {
  key: string;
  label: string;
  extensions?: string[];
}

interface ResourceFieldGroupProps {
  /** 字段配置列表 */
  fields: ResourceFieldConfig[];
  /** 当前数据 */
  data: Record<string, string | null | undefined>;
  /** 更新字段 */
  updateField: (key: string, value: string | null) => void;
  /** 游戏 ID */
  gameId: string;
  /** 游戏 slug */
  gameSlug: string;
}

export function ResourceFieldGroup({
  fields,
  data,
  updateField,
  gameId,
  gameSlug,
}: ResourceFieldGroupProps) {
  return (
    <div className="space-y-4">
      {fields.map(({ key, label, extensions }) => (
        <ResourceFilePicker
          key={key}
          label={label}
          value={data[key]}
          onChange={(value) => updateField(key, value)}
          fieldName={key}
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={extensions}
        />
      ))}
    </div>
  );
}
