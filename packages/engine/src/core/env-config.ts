/**
 * 环境变量配置
 *
 * 放在 core/ 中以消除 data ↔ resource 循环依赖：
 * - data/game-data-api.ts 直接从此处导入 getResourceDomain()（data → core，无循环）
 * - resource/resource-paths.ts 也从此处导入（resource → core，无循环）
 */

/**
 * 获取资源域名（从环境变量读取）
 * 环境变量: VITE_DEMO_RESOURCES_DOMAIN
 * 例如: https://yych.example.com
 *
 * @returns 资源域名（不带尾部斜杠），如果未配置返回空字符串
 */
export function getResourceDomain(): string {
  const domain = import.meta.env.VITE_DEMO_RESOURCES_DOMAIN as string | undefined;
  if (domain) {
    // 移除尾部斜杠
    return domain.replace(/\/+$/, "");
  }
  return "";
}
