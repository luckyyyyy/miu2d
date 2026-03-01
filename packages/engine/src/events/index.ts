/**
 * Events - 事件基础设施与事件契约
 *
 * 包含:
 * - TypedEventEmitter: 通用类型安全事件发射器
 * - GameEvents / GameEventMap: 引擎 ↔ UI 层的事件名称和类型映射
 * - GUI 状态类型: 事件 payload 中使用的 GUI 状态接口
 */

export * from "./event-emitter";
export * from "./game-events";
export * from "./gui-state-types";
