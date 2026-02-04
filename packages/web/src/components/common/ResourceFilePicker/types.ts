/**
 * 资源文件选择器类型定义
 */

export type ResourceFileType = "asf" | "audio" | "other";

/**
 * 资源文件的默认基础路径配置
 */
export const ResourceBasePaths: Record<string, string> = {
  // ASF 文件
  image: "asf/magic",           // 武功主图像
  icon: "asf/magic",            // 武功图标
  flyingImage: "asf/effect",    // 飞行特效
  vanishImage: "asf/effect",    // 消失特效
  superModeImage: "asf/effect", // 超级模式特效
  leapImage: "asf/effect",      // 跳跃特效
  actionFile: "asf/character",  // 动作文件

  // 音频文件
  flyingSound: "Content/sound", // 飞行音效
  vanishSound: "Content/sound", // 消失音效

  // 通用
  default: "",
} as const;

/**
 * 根据字段名获取文件类型
 */
export function getResourceFileType(fieldName: string, fileName?: string): ResourceFileType {
  if (!fileName) return "other";

  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "asf" || ext === "mpc") {
    return "asf";
  }

  if (ext === "wav" || ext === "ogg" || ext === "mp3") {
    return "audio";
  }

  return "other";
}

/**
 * 获取字段的默认基础路径
 */
export function getBasePath(fieldName: string): string {
  return ResourceBasePaths[fieldName] ?? ResourceBasePaths.default;
}

/**
 * 构建完整的资源路径
 * @param fieldName 字段名（用于获取默认基础路径）
 * @param value 当前值（可能是相对路径或绝对路径）
 * 注意：返回的路径已经是小写
 */
export function buildResourcePath(fieldName: string, value: string): string {
  if (!value) return "";

  let result: string;

  // 如果已经是绝对路径，直接使用
  if (value.startsWith("/") || value.startsWith("asf/") || value.startsWith("Content/")) {
    result = value;
  } else {
    // 否则添加默认基础路径
    const basePath = getBasePath(fieldName);
    result = basePath ? `${basePath}/${value}` : value;
  }

  // 统一转小写
  return result.toLowerCase();
}

/**
 * 获取资源的下载 URL
 * 注意：路径会自动转换为小写
 */
export function getResourceUrl(gameSlug: string, path: string): string {
  if (!path) return "";
  return `/game/${gameSlug}/resources/${path.toLowerCase()}`;
}
