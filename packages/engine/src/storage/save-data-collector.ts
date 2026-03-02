import { extractFlatDataFromCharacter } from "../character/character-config";
import {
  BOTTOM_INDEX_BEGIN,
  BOTTOM_INDEX_END,
  BOTTOM_ITEMS_COUNT,
  EQUIP_INDEX_BEGIN,
  EQUIP_INDEX_END,
  type GoodsListManager,
  STORE_INDEX_BEGIN,
  STORE_INDEX_END,
} from "../player/goods";
import { MAGIC_LIST_CONFIG } from "../player/magic/magic-list-config";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import type {
  GoodsContainerSave,
  GoodsItemData,
  GoodsSaveItem,
  MagicContainerSave,
  MagicItemData,
  MagicSaveItem,
  PlayerSaveData,
} from "./save-types";

export class SaveDataCollector {
  static collectPlayerData(player: Player): PlayerSaveData {
    const base = extractFlatDataFromCharacter(player, true);
    base.dir = player.currentDirection;
    return base as unknown as PlayerSaveData;
  }

  static collectGoodsData(goodsListManager: GoodsListManager): GoodsItemData[] {
    const items: GoodsItemData[] = [];

    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
        });
      }
    }

    for (let i = BOTTOM_INDEX_BEGIN; i <= BOTTOM_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
          index: i,
        });
      }
    }

    return items;
  }

  static collectEquipsData(goodsListManager: GoodsListManager): (GoodsItemData | null)[] {
    const equips: (GoodsItemData | null)[] = [];

    for (let i = EQUIP_INDEX_BEGIN; i <= EQUIP_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        equips.push({
          fileName: info.good.fileName,
          count: 1,
        });
      } else {
        equips.push(null);
      }
    }

    return equips;
  }

  static collectMagicsData(magicInventory: PlayerMagicInventory): MagicItemData[] {
    const items: MagicItemData[] = [];
    const maxMagic = MAGIC_LIST_CONFIG.maxMagic;

    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getItemInfo(i);
      if (info?.magic) {
        const item: MagicItemData = {
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
        };
        if (info.hideCount !== 1) {
          item.hideCount = info.hideCount;
        }
        items.push(item);
      }
    }

    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getHiddenItemInfo(i);
      if (info?.magic) {
        items.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
          hideCount: info.hideCount,
          lastIndexWhenHide: info.lastIndexWhenHide,
          isHidden: true,
        });
      }
    }

    return items;
  }

  static collectBottomSlotsData(magicInventory: PlayerMagicInventory): (number | null)[] {
    return magicInventory.getBottomSlots();
  }

  /** 收集武功容器（新格式） */
  static collectMagicContainer(magicInventory: PlayerMagicInventory): MagicContainerSave {
    const maxMagic = MAGIC_LIST_CONFIG.maxMagic;

    // 面板武功（60 个槽位，0-indexed）
    const panelMagics: (MagicSaveItem | null)[] = [];
    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getItemInfo(i);
      if (info?.magic) {
        panelMagics.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          hideCount: info.hideCount !== 1 ? info.hideCount : undefined,
        });
      } else {
        panelMagics.push(null);
      }
    }

    // 修炼武功
    const xiuLian = magicInventory.getXiuLianMagic();
    const xiuLianMagic: MagicSaveItem | null = xiuLian?.magic
      ? { fileName: xiuLian.magic.fileName, level: xiuLian.level, exp: xiuLian.exp }
      : null;

    // 快捷栏武功
    const bottomSlotItems = magicInventory.getBottomSlotsItems();
    const bottomMagics: (MagicSaveItem | null)[] = bottomSlotItems.map((info) =>
      info?.magic
        ? { fileName: info.magic.fileName, level: info.level, exp: info.exp }
        : null
    );

    // 隐藏武功
    const hiddenMagics: MagicSaveItem[] = [];
    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getHiddenItemInfo(i);
      if (info?.magic) {
        hiddenMagics.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          hideCount: info.hideCount,
          lastPanelSlot: info.lastIndexWhenHide,
        });
      }
    }

    return { panelMagics, xiuLianMagic, bottomMagics, hiddenMagics };
  }

  /** 收集物品容器（新格式） */
  static collectGoodsContainer(goodsListManager: GoodsListManager): GoodsContainerSave {
    // 背包物品
    const bagItems: GoodsSaveItem[] = [];
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        bagItems.push({ fileName: info.good.fileName, count: info.count });
      }
    }

    // 装备槽
    const equipItems: (GoodsSaveItem | null)[] = [];
    for (let i = EQUIP_INDEX_BEGIN; i <= EQUIP_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      equipItems.push(info?.good ? { fileName: info.good.fileName, count: 1 } : null);
    }

    // 快捷栏物品（独立 bottomItems）
    const bottomItemsArr: (GoodsSaveItem | null)[] = [];
    for (let s = 0; s < BOTTOM_ITEMS_COUNT; s++) {
      const slotItemInfo = goodsListManager.getBottomItemAtSlot(s);
      bottomItemsArr.push(slotItemInfo?.good ? { fileName: slotItemInfo.good.fileName, count: slotItemInfo.count } : null);
    }

    return { bagItems, equipItems, bottomItems: bottomItemsArr };
  }
}
