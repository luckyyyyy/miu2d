/**
 * Map Constants - 地图障碍类型常量
 *
 * 放在 core/ 中以消除 wasm ↔ map 循环依赖。
 * wasm-path-finder.ts 和 map-base.ts 都直接从此处导入。
 */

/** 无障碍 */
export const NONE = 0x00;
/** 完全障碍 */
export const OBSTACLE = 0x80;
/** 可跳过的障碍 */
export const CAN_OVER_OBSTACLE = 0xa0;
/** 透明障碍（武功可穿，人不能过） */
export const TRANS = 0x40;
/** 可跳过的透明障碍 */
export const CAN_OVER_TRANS = 0x60;
/** 可跳过 */
export const CAN_OVER = 0x20;
