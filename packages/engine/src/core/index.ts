/**
 * Core exports - 纯基础设施
 *
 * 包含: 类型、日志、引擎上下文、DI
 *
 * 事件系统已移至 events/ 模块
 * 战斗计算已移至 combat/ 模块
 */

export * from "./engine-context";
export { logger } from "./logger";
export * from "./types";
