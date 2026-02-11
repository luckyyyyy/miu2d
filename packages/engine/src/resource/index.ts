/**
 * Resource Module - 资源管理
 *
 * 所有资源文件格式解析器统一放在此目录：
 * - asf.ts  - ASF 精灵动画格式 (WASM)
 * - mmf.ts  - MMF 地图格式（新）
 * - map.ts  - MAP 地图格式（旧，仅供 viewer 使用）
 * - mpc.ts  - MPC 资源包格式 (WASM)
 * - shd.ts  - SHD 阴影格式
 * - xnb.ts  - XNB 音频格式
 *
 * 使用方式：
 * 1. 应用启动时：await initWasm()
 * 2. 其他地方直接 import { loadMMF, loadMpc } 使用
 */
export * from "./asf";
export * from "./cache-registry";
export * from "./map";
export * from "./mmf";
export * from "./mpc";
export * from "./resource-loader";
export * from "./shd";
export * from "./xnb";

export * from "./resource-paths";
