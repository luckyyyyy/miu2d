/**
 * Core exports - 纯基础设施
 *
 * 包含: 类型、日志、事件、引擎上下文、DI
 */

export * from "../character/attr-types";
export { logger } from "./logger";
export * from "../map/types";
export * from "./types";

// Re-export from new locations for backward compatibility
export * from "../utils/path-finder";
export * from "../data/timer-manager";
// NOTE: debug-manager is NOT re-exported here to avoid circular dependency.
// Import directly: "@miu2d/engine/utils/debug-manager"
