import { logger } from "../core/logger";
import type { CharacterSaveSlot, GoodsContainerSave, MagicContainerSave, PlayerSaveData } from "./save-types";

export interface CharacterMemoryData {
  player: PlayerSaveData | null;
  magics: MagicContainerSave | null;
  goods: GoodsContainerSave | null;
  memo: {
    items: string[];
  } | null;
}

const EMPTY_MEMORY: CharacterMemoryData = {
  player: null,
  magics: null,
  goods: null,
  memo: null,
};

export class CharacterMemoryStore {
  private readonly memory = new Map<number, CharacterMemoryData>();

  clear(): void {
    this.memory.clear();
    logger.debug(`[Loader] Character memory cleared`);
  }

  get(index: number): CharacterMemoryData | undefined {
    return this.memory.get(index);
  }

  getOrCreate(index: number): CharacterMemoryData {
    let data = this.memory.get(index);
    if (!data) {
      data = {
        player: EMPTY_MEMORY.player,
        magics: EMPTY_MEMORY.magics,
        goods: EMPTY_MEMORY.goods,
        memo: EMPTY_MEMORY.memo,
      };
      this.memory.set(index, data);
    }
    return data;
  }

  restoreFromSave(otherCharacters: Record<number, CharacterSaveSlot>): void {
    for (const [indexStr, slot] of Object.entries(otherCharacters)) {
      const index = parseInt(indexStr, 10);
      if (Number.isNaN(index)) continue;

      const memoryData: CharacterMemoryData = {
        player: slot.player,
        // 优先使用新格式容器，否则为 null（旧格式由 loader 直接处理）
        magics: slot.magicContainer ?? null,
        goods: slot.goodsContainer ?? null,
        memo: slot.memo ? { items: slot.memo } : null,
      };

      this.memory.set(index, memoryData);
    }

    logger.debug(
      `[Loader] Restored ${Object.keys(otherCharacters).length} other characters to memory`
    );
  }

  collectForSave(): Record<number, CharacterSaveSlot> | undefined {
    if (this.memory.size === 0) {
      return undefined;
    }

    const result: Record<number, CharacterSaveSlot> = {};

    for (const [index, memoryData] of this.memory) {
      result[index] = {
        player: memoryData.player,
        magicContainer: memoryData.magics,
        goodsContainer: memoryData.goods,
        memo: memoryData.memo?.items ?? null,
      };
    }

    logger.debug(`[Loader] Collected ${Object.keys(result).length} other characters for save`);
    return result;
  }
}
