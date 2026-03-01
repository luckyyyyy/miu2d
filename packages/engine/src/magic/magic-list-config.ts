/**
 * magic-list-config.ts - 武功列表共享常量
 *
 * 放在 magic/ 模块中以消除 magic ↔ player 循环依赖：
 * passive-manager.ts 从此处导入（magic → magic，无循环）。
 */

/** 武功列表索引常量 */
export const MAGIC_LIST_CONFIG = {
  maxMagic: 61, // 最大武功数量（存储区 1-60 + 修炼 61）
  magicListIndexBegin: 1, // 列表起始索引
  storeIndexBegin: 1, // 存储区起始 (武功面板)
  storeIndexEnd: 60, // 存储区结束（扩展至60，支持更多武功）
  bottomSlotCount: 5, // 快捷栏槽位数（独立 reference 数组，不占用存储区索引）
  xiuLianIndex: 61, // 修炼武功索引（紧接存储区之后）
  hideStartIndex: 1000, // 隐藏列表起始索引

  // 旧存档兼容：旧版快捷栏占用 magicList[40..44]，加载时自动迁移
  LEGACY_BOTTOM_INDEX_BEGIN: 40,
  LEGACY_BOTTOM_INDEX_END: 44,
  LEGACY_XIUL_LIAN_INDEX: 49,
};
