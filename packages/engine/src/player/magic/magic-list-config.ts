/**
 * magic-list-config.ts - 武功列表共享常量与类型
 *
 * 从 magic-list-manager.ts 提取，供 magic-list-replace.ts 和 magic-list-hide.ts 导入，
 * 消除文件级循环依赖。
 */

import type { MagicData, MagicItemInfo } from "../../magic/types";

/** 武功列表索引常量 — 实现在 magic/magic-list-config.ts，此处 re-export 保持兼容 */
export { MAGIC_LIST_CONFIG } from "../../magic/magic-list-config";

/** 回调类型 */
export interface MagicListCallbacks {
  onUpdateView?: () => void;
  onMagicUse?: (info: MagicItemInfo) => void;
  /**
   * 武功升级回调 - 用于 Player 更新属性
   * 武功升级时增加玩家属性
   * @param oldMagic 旧等级武功（用于移除 FlyIni 等）
   * @param newMagic 新等级武功
   */
  onMagicLevelUp?: (oldMagic: MagicData, newMagic: MagicData) => void;
  /**
   * 修炼武功改变回调 - 用于 Player 更新 SpecialAttackTexture
   * setter
   */
  onXiuLianMagicChange?: (xiuLianMagic: MagicItemInfo | null) => void;
}
