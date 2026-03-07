/**
 * magic-list-config.ts - 武功列表共享常量
 *
 * 放在 magic/ 模块中以消除 magic ↔ player 循环依赖：
 * passive-manager.ts 从此处导入（magic → magic，无循环）。
 */

/** 武功列表索引常量 */
export const MAGIC_LIST_CONFIG = {
  maxMagic: 500, // 武功面板最大槽位（1-500）
  storeIndexBegin: 1, // 存储区起始索引
  storeIndexEnd: 500, // 存储区结束索引
  bottomSlotCount: 5, // 快捷栏槽位数（独立，不占用面板索引）
  xiuLianIndex: 501, // 修炼武功虚拟索引（仅 ui-bridge / engine-ui-bridge-factory 内部使用）
};
