/**
 * Item APIs - Goods, Magic, Memo implementations
 */

import type { GoodsAPI, MagicAPI, MemoAPI } from "../../core/gameAPI";
import type { ScriptCommandContext } from "../scriptContext/types";
import { ResourcePath } from "../../config/resourcePaths";
import { logger } from "../../core/logger";
import { parseIni } from "../../utils/iniParser";
import { resourceLoader } from "../../resource/resourceLoader";
import { getNeighbors, tileToPixel } from "../../utils";

export function createGoodsAPI(ctx: ScriptCommandContext): GoodsAPI {
  const { player, guiManager, buyManager, goodsListManager, getCharacterByName } = ctx;

  return {
    add: (goodsName, count) => {
      let addedGood: { name: string } | null = null;
      for (let i = 0; i < count; i++) {
        const result = goodsListManager.addGoodToList(goodsName);
        if (result.success && result.good) { addedGood = result.good; }
      }
      if (addedGood) { guiManager.showMessage(`你获得了${addedGood.name}`); }
    },
    remove: (goodsName, count) => { goodsListManager.deleteGoodByName(goodsName, count); },
    equip: (goodsIndex, equipSlot) => {
      const equipIndex = equipSlot + 200;
      goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
    },
    getCountByFile: (goodsFile) => goodsListManager.getGoodsNum(goodsFile),
    getCountByName: (goodsName) => goodsListManager.getGoodsNumByName(goodsName),
    clear: () => { goodsListManager.renewList(); },
    deleteByName: (name, count) => { goodsListManager.deleteGoodByName(name, count ?? 1); },
    hasFreeSpace: () => goodsListManager.hasFreeItemSpace(),
    addRandom: async (buyFileName) => {
      try {
        const filePath = ResourcePath.buy(buyFileName);
        const content = await resourceLoader.loadText(filePath);
        if (!content) return;
        const sections = parseIni(content);
        const items: string[] = [];
        for (const [sectionName, section] of Object.entries(sections)) {
          if (sectionName === "Header") continue;
          if (section.IniFile) { items.push(section.IniFile); }
        }
        if (items.length === 0) return;
        const randomItem = items[Math.floor(Math.random() * items.length)];
        const result = goodsListManager.addGoodToList(randomItem);
        if (result.success && result.good) { guiManager.showMessage(`你获得了${result.good.name}`); }
      } catch (error) {
        logger.error(`[GameAPI.goods] addRandom error:`, error);
      }
    },
    buy: async (buyFile, canSellSelfGoods) => {
      const success = await buyManager.beginBuy(buyFile, null, canSellSelfGoods);
      if (success) { guiManager.openBuyGui(); }
    },
    isBuyEnd: () => !buyManager.isOpen(),
    setDropIni: (name, dropFile) => {
      const character = getCharacterByName(name);
      if (character) { character.dropIni = dropFile; }
    },
    setDropEnabled: (enabled) => {
      if (enabled) ctx.enableDrop(); else ctx.disableDrop();
    },
  };
}

export function createMagicAPI(ctx: ScriptCommandContext): MagicAPI {
  const { player } = ctx;

  return {
    add: async (magicFile) => {
      if (player) { await player.addMagic(magicFile); }
    },
    delete: (magicFile) => {
      if (player) { player.getMagicListManager().deleteMagic(magicFile); }
    },
    setLevel: (magicFile, level) => {
      player.getMagicListManager().setNonReplaceMagicLevel(magicFile, level);
    },
    getLevel: (magicFile) => {
      if (!player) return 0;
      const info = player.getMagicListManager().getMagicByFileName(magicFile);
      return info?.level || 0;
    },
    clear: () => {
      if (player) { player.getMagicListManager().renewList(); }
    },
    hasFreeSpace: () => {
      if (!player) return false;
      return player.getMagicListManager().getFreeIndex() !== -1;
    },
    use: (magicFile, x, y) => {
      if (!player) return;
      const magicInfo = player.getMagicListManager().getMagicByFileName(magicFile);
      if (!magicInfo || !magicInfo.magic) return;
      let mapX = x ?? 0;
      let mapY = y ?? 0;
      if (x === undefined || y === undefined) {
        const neighbors = getNeighbors(player.tilePosition);
        const dest = neighbors[player.currentDirection];
        mapX = dest.x;
        mapY = dest.y;
      }
      const origin = player.positionInWorld;
      const destination = tileToPixel(mapX, mapY);
      player.setPendingMagic(magicInfo.magic, origin, destination);
      (player as unknown as { onMagicCast(): void }).onMagicCast();
    },
  };
}

export function createMemoAPI(ctx: ScriptCommandContext): MemoAPI {
  const { guiManager, memoListManager } = ctx;

  return {
    add: (text) => { guiManager.addMemo(text); },
    delete: (text) => { guiManager.delMemo(text); },
    addById: async (id) => { await guiManager.addToMemo(id); },
    deleteById: async (id) => {
      await memoListManager.delMemoById(id);
      guiManager.updateMemoView();
    },
  };
}
