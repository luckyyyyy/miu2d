/**
 * Item & Magic Commands - Goods, magic, memo, shop
 * Extracted from scriptContextFactory.ts
 */

import type { ScriptContext } from "../../script/executor";
import type { ScriptCommandContext } from "./types";
import { ResourcePath } from "../../config/resourcePaths";
import { logger } from "../../core/logger";
import { parseIni } from "../../utils/iniParser";
import { resourceLoader } from "../../resource/resourceLoader";
import type { Good } from "../../player/goods";

export function createItemCommands(ctx: ScriptCommandContext): Partial<ScriptContext> {
  const {
    player,
    guiManager,
    buyManager,
    goodsListManager,
    getCharacterByName,
  } = ctx;

  return {

    // Player
    addGoods: (goodsName, count) => {
      logger.log(`AddGoods: ${goodsName} x${count}`);
      let addedGood: Good | null = null;
      for (let i = 0; i < count; i++) {
        const result = goodsListManager.addGoodToList(goodsName);
        if (result.success && result.good) {
          addedGood = result.good;
        }
      }
      // shows message when item added
      if (addedGood) {
        guiManager.showMessage(`你获得了${addedGood.name}`);
      }
      // Note: GoodsListManager.addGoodToList already calls onUpdateView callback
    },
    removeGoods: (goodsName, count) => {
      logger.log(`RemoveGoods: ${goodsName} x${count}`);
      goodsListManager.deleteGoodByName(goodsName, count);
    },
    equipGoods: async (goodsIndex, equipSlot) => {
      const equipIndex = equipSlot + 200;
      logger.log(`EquipGoods: from index ${goodsIndex} to slot ${equipIndex}`);
      goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
    },

    // Magic functions
    addMagic: async (magicFile) => {
      if (player) {
        const success = await player.addMagic(magicFile);
        if (success) {
          logger.log(`[ScriptContext] AddMagic: ${magicFile}`);
        } else {
          logger.warn(`[ScriptContext] AddMagic failed: ${magicFile}`);
        }
      }
    },
    setMagicLevel: (magicFile, level) => {
      // MagicListManager.SetNonReplaceMagicLevel(fileName, level)
      const magicListManager = player.getMagicListManager();
      magicListManager.setNonReplaceMagicLevel(magicFile, level);
      logger.log(`[ScriptContext] SetMagicLevel: ${magicFile} -> level ${level}`);
    },

    // Memo functions
    addMemo: (text) => {
      guiManager.addMemo(text);
    },
    delMemo: (text) => {
      guiManager.delMemo(text);
    },
    addToMemo: async (memoId) => {
      await guiManager.addToMemo(memoId);
    },
    delMemoById: async (memoId) => {
      await ctx.memoListManager.delMemoById(memoId);
      guiManager.updateMemoView();
    },
    addRandGoods: async (buyFileName) => {
      // Reads ini/buy/{buyFileName}, picks random item, calls AddGoods
      logger.log(`[ScriptContext] AddRandGoods: ${buyFileName}`);
      try {
        const filePath = ResourcePath.buy(buyFileName);
        const content = await resourceLoader.loadText(filePath);
        if (!content) {
          logger.warn(`[ScriptContext] Failed to load buy file: ${filePath}`);
          return;
        }

        // Parse INI file
        const sections = parseIni(content);
        const items: string[] = [];

        for (const [sectionName, section] of Object.entries(sections)) {
          if (sectionName === "Header") continue;
          if (section.IniFile) {
            items.push(section.IniFile);
          }
        }

        if (items.length === 0) {
          logger.warn(`[ScriptContext] No items found in buy file: ${buyFileName}`);
          return;
        }

        // Pick random item
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];
        logger.log(`[ScriptContext] AddRandGoods picked: ${randomItem}`);

        // Add the item using existing addGoods logic
        const result = goodsListManager.addGoodToList(randomItem);
        if (result.success && result.good) {
          guiManager.showMessage(`你获得了${result.good.name}`);
        }
        // Note: GoodsListManager.addGoodToList already calls onUpdateView callback
      } catch (error) {
        logger.error(`[ScriptContext] AddRandGoods error:`, error);
      }
    },
    delMagic: (magicFile) => {
      if (player) {
        const magicListManager = player.getMagicListManager();
        magicListManager.deleteMagic(magicFile);
        logger.log(`[ScriptContext] DelMagic: ${magicFile}`);
      }
    },

    // ============= Extended Goods Commands =============
    buyGoods: async (buyFile, canSellSelfGoods) => {
      logger.log(`[ScriptContext] BuyGoods: ${buyFile}, canSellSelfGoods=${canSellSelfGoods}`);
      const success = await buyManager.beginBuy(buyFile, null, canSellSelfGoods);
      if (success) {
        guiManager.openBuyGui();
      }
    },
    isBuyGoodsEnd: () => {
      return !buyManager.isOpen();
    },
    getGoodsNum: (goodsFile) => {
      return goodsListManager.getGoodsNum(goodsFile);
    },
    getGoodsNumByName: (goodsName) => {
      return goodsListManager.getGoodsNumByName(goodsName);
    },
    clearGoods: () => {
      goodsListManager.renewList();
      logger.log("[ScriptContext] ClearGoods");
    },
    clearMagic: () => {
      if (player) {
        const magicListManager = player.getMagicListManager();
        magicListManager.renewList();
        logger.log("[ScriptContext] ClearMagic");
      }
    },
    delGoodByName: (name, count) => {
      goodsListManager.deleteGoodByName(name, count ?? 1);
      logger.log(`[ScriptContext] DelGoodByName: ${name} x${count ?? 1}`);
    },
    checkFreeGoodsSpace: () => {
      return goodsListManager.hasFreeItemSpace();
    },
    checkFreeMagicSpace: () => {
      if (!player) return false;
      const magicListManager = player.getMagicListManager();
      return magicListManager.getFreeIndex() !== -1;
    },
    setDropIni: (name, dropFile) => {
      // 设置角色的掉落物配置文件
      const character = getCharacterByName(name);
      if (character) {
        character.dropIni = dropFile;
      }
      logger.log(`[ScriptContext] SetDropIni: ${name} -> ${dropFile}`);
    },
  };
}
