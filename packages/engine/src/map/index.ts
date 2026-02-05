/**
 * Map module exports
 */
// 从 resource/map.ts 导出地图解析功能
export { loadMap, parseMap } from "../resource/map";

// 从 mapBase.ts 导出 MapBase 类和常量
export { LAYER_INDEX, MAX_LAYER, MapBase } from "./mapBase";

// 从 renderer.ts 导出渲染相关功能
export * from "./renderer";
