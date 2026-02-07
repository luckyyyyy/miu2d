/**
 * 配置模块统一导出
 */

export {
  // 路径构建器
  buildPath,
  // 预定义路径
  DefaultPaths,
  ensureResourcePath,
  extractRelativePath,
  getResourceDomain,
  getResourcePaths,
  getResourceRoot,
  // URL 构建
  getResourceUrl,
  // 工具函数
  isResourcePath,
  // 缓存键规范化
  normalizeCacheKey,
  // 目录结构
  ResourceDirs,
  ResourcePath,
  // 配置接口和函数
  type ResourcePathsConfig,
  resetResourcePaths,
  setResourcePaths,
} from "./resourcePaths";

