/**
 * Resource Module - 资源管理
 *
 * 所有资源文件格式解析器统一放在此目录：
 * - asf.ts  - ASF 精灵动画格式 (WASM)
 * - map.ts  - MAP 地图格式
 * - mpc.ts  - MPC 资源包格式 (WASM)
 * - shd.ts  - SHD 阴影格式
 * - xnb.ts  - XNB 音频格式
 *
 * 使用方式：
 * 1. 应用启动时：await initWasm()
 * 2. 其他地方直接 import { loadAsf, loadMpc } 使用
 */
export * from "./asf";
export * from "./cacheRegistry";
export * from "./map";
export * from "./mpc";
export * from "./resourceLoader";
export * from "./shd";
export * from "./xnb";

