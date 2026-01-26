/**
 * GameUI - Renders all game UI components
 * Extracted from Game.tsx for better code organization
 */
import React, { useState, useCallback, useMemo } from "react";
import type { PlayerData } from "../../engine/core/types";
import type { GuiManagerState } from "../../engine/gui/types";
import type { GameManager } from "../../engine/game/gameManager";
import { getMemoListManager } from "../../engine/listManager";
import { GoodKind } from "../../engine/goods";
import type { Good } from "../../engine/goods";
import {
  DialogUI,
  SelectionUI,
  TopGui,
  BottomGui,
  BottomStateGui,
  StateGui,
  EquipGui,
  GoodsGui,
  MagicGui,
  MemoGui,
  SystemGui,
  XiuLianGui,
  CurrentMissionHint,
  MessageGui,
  ItemTooltip,
} from "../ui";
import type { DragData, EquipSlotType, EquipSlots } from "../ui/EquipGui";
import { equipPositionToSlotType, slotTypeToEquipPosition } from "../ui/EquipGui";
import type { GoodItemData } from "../ui/GoodsGui";
import type { TooltipState } from "../ui/ItemTooltip";

interface GameUIProps {
  isLoading: boolean;
  width: number;
  height: number;
  guiState: GuiManagerState | undefined;
  player: PlayerData | undefined;
  gameManager: GameManager | null;
}

/**
 * GameUI Component - Renders all game UI overlays
 */
export const GameUI: React.FC<GameUIProps> = ({
  isLoading,
  width,
  height,
  guiState,
  player,
  gameManager,
}) => {
  // Drag-drop state
  const [dragData, setDragData] = useState<DragData | null>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({
    isVisible: false,
    good: null,
    isRecycle: false,
    position: { x: 0, y: 0 },
  });

  // Get goods version to trigger re-render when goods change
  const goodsVersion = gameManager?.getGoodsVersion() ?? 0;

  // Get goods and equipment data from GoodsListManager
  const goodsData = useMemo(() => {
    if (!gameManager) return { items: [], equips: {}, money: 0 };

    const goodsManager = gameManager.getGoodsListManager();
    const items: (GoodItemData | null)[] = [];
    const equips: EquipSlots = {};

    console.log(`[GameUI] Building goodsData, version=${goodsVersion}`);

    // Get inventory items (indices 1-198)
    for (let i = 1; i <= 198; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry && entry.good) {
        items.push({ good: entry.good, count: entry.count });
        if (i <= 10) {
          console.log(`[GameUI] Inventory slot ${i}: ${entry.good.name} x${entry.count}`);
        }
      } else {
        items.push(null);
      }
    }

    // Get equipment (indices 201-207)
    const equipIndices = [201, 202, 203, 204, 205, 206, 207];
    const equipSlots: EquipSlotType[] = ["head", "neck", "body", "back", "hand", "wrist", "foot"];

    equipIndices.forEach((index, i) => {
      const entry = goodsManager.getItemInfo(index);
      if (entry && entry.good) {
        equips[equipSlots[i]] = { good: entry.good, count: entry.count };
      }
    });

    return {
      items,
      equips,
      money: player?.money ?? 0,
    };
  }, [gameManager, player?.money, goodsVersion]);

  // Handle equip slot right-click (unequip)
  const handleEquipRightClick = useCallback((slot: EquipSlotType) => {
    if (!gameManager) return;
    const goodsManager = gameManager.getGoodsListManager();
    const slotIndex = slotTypeToEquipPosition(slot) + 200; // 201-207
    goodsManager.unEquipGood(slotIndex);
  }, [gameManager]);

  // Handle equip slot drop
  const handleEquipDrop = useCallback((slot: EquipSlotType, data: DragData) => {
    if (!gameManager) return;
    const goodsManager = gameManager.getGoodsListManager();
    const slotIndex = slotTypeToEquipPosition(slot) + 200;

    if (data.type === "goods") {
      // Equip from inventory
      goodsManager.exchangeListItemAndEquiping(data.index, slotIndex);
    } else if (data.type === "equip" && data.sourceSlot) {
      // Swap equipment
      const sourceIndex = slotTypeToEquipPosition(data.sourceSlot) + 200;
      goodsManager.exchangeListItem(sourceIndex, slotIndex);
    }

    setDragData(null);
  }, [gameManager]);

  // Handle equip slot drag start
  const handleEquipDragStart = useCallback((slot: EquipSlotType, good: Good) => {
    const slotIndex = slotTypeToEquipPosition(slot) + 200;
    setDragData({
      type: "equip",
      index: slotIndex,
      good,
      sourceSlot: slot,
    });
  }, []);

  // Handle goods item right-click (use/equip)
  const handleGoodsRightClick = useCallback((index: number) => {
    if (!gameManager) return;
    const goodsManager = gameManager.getGoodsListManager();
    const actualIndex = index + 1; // Convert from 0-based to 1-based
    const entry = goodsManager.getListItem(actualIndex);

    if (!entry || !entry.good) return;

    if (entry.good.kind === GoodKind.Equipment) {
      // Equip the item
      const equipIndex = entry.good.part + 200;
      goodsManager.exchangeListItemAndEquiping(actualIndex, equipIndex);
    } else if (entry.good.kind === GoodKind.Drug) {
      // Use the drug
      goodsManager.usingGood(actualIndex);
    }
  }, [gameManager]);

  // Handle goods item drop
  const handleGoodsDrop = useCallback((targetIndex: number, data: DragData) => {
    if (!gameManager) return;
    const goodsManager = gameManager.getGoodsListManager();
    const actualTargetIndex = targetIndex + 1; // Convert from 0-based to 1-based

    if (data.type === "goods") {
      // Swap inventory items
      goodsManager.exchangeListItem(data.index, actualTargetIndex);
    } else if (data.type === "equip") {
      // Unequip to inventory slot
      goodsManager.exchangeListItemAndEquiping(actualTargetIndex, data.index);
    }

    setDragData(null);
  }, [gameManager]);

  // Handle goods item drag start
  const handleGoodsDragStart = useCallback((index: number, good: Good) => {
    const actualIndex = index + 1; // Convert from 0-based to 1-based
    setDragData({
      type: "goods",
      index: actualIndex,
      good,
    });
  }, []);

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback((_: number | EquipSlotType, good: Good | null, rect: DOMRect) => {
    if (good) {
      setTooltip({
        isVisible: true,
        good,
        isRecycle: false,
        position: { x: rect.right + 10, y: rect.top },
      });
    }
  }, []);

  // Handle mouse leave for tooltip
  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, isVisible: false }));
  }, []);

  if (isLoading) return null;

  return (
    <>
      {/* Top GUI - buttons for State, Equip, Goods, Magic etc. */}
      <TopGui
        screenWidth={width}
        onStateClick={() => gameManager?.getGuiManager().toggleStateGui()}
        onEquipClick={() => gameManager?.getGuiManager().toggleEquipGui()}
        onXiuLianClick={() => gameManager?.getGuiManager().toggleXiuLianGui()}
        onGoodsClick={() => gameManager?.getGuiManager().toggleGoodsGui()}
        onMagicClick={() => gameManager?.getGuiManager().toggleMagicGui()}
        onMemoClick={() => gameManager?.getGuiManager().toggleMemoGui()}
        onSystemClick={() => gameManager?.getGuiManager().toggleSystemGui()}
      />

      {/* Bottom State GUI - Life/Thew/Mana orbs */}
      {player && (
        <BottomStateGui
          life={player.config.stats?.life ?? 1000}
          maxLife={player.config.stats?.lifeMax ?? 1000}
          thew={player.config.stats?.thew ?? 1000}
          maxThew={player.config.stats?.thewMax ?? 1000}
          mana={player.config.stats?.mana ?? 1000}
          maxMana={player.config.stats?.manaMax ?? 1000}
          screenWidth={width}
          screenHeight={height}
        />
      )}

      {/* Bottom GUI - Hotbar for items and skills */}
      <BottomGui
        items={[null, null, null, null, null, null, null, null]}
        screenWidth={width}
        screenHeight={height}
        onItemClick={(index) => console.log("Hotbar item click:", index)}
        onItemRightClick={(index) => console.log("Hotbar item right-click:", index)}
      />

      {/* Dialog */}
      {guiState?.dialog?.isVisible && (
        <DialogUI
          state={guiState.dialog}
          screenWidth={width}
          screenHeight={height}
          onClose={() => gameManager?.getGuiManager().handleDialogClick()}
          onSelectionMade={(selection) => {
            gameManager?.getGuiManager().onDialogSelectionMade(selection);
            gameManager?.onSelectionMade(selection);
          }}
        />
      )}

      {/* Selection */}
      {guiState?.selection?.isVisible && (
        <SelectionUI
          state={guiState.selection}
          screenWidth={width}
          screenHeight={height}
          onSelect={(index) => gameManager?.getGuiManager().selectByIndex(index)}
        />
      )}

      {/* State Panel - 左侧面板 */}
      {guiState?.panels?.state && player && (
        <StateGui
          isVisible={true}
          stats={{
            level: player.config.stats?.level ?? 1,
            exp: player.config.stats?.exp ?? 0,
            levelUpExp: player.config.stats?.levelUpExp ?? 100,
            life: player.config.stats?.life ?? 1000,
            lifeMax: player.config.stats?.lifeMax ?? 1000,
            thew: player.config.stats?.thew ?? 1000,
            thewMax: player.config.stats?.thewMax ?? 1000,
            mana: player.config.stats?.mana ?? 1000,
            manaMax: player.config.stats?.manaMax ?? 1000,
            attack: player.config.stats?.attack ?? 100,
            defend: player.config.stats?.defend ?? 50,
            evade: player.config.stats?.evade ?? 30,
          }}
          screenWidth={width}
          onClose={() => gameManager?.getGuiManager().toggleStateGui()}
        />
      )}

      {/* Equip Panel - 左侧面板 */}
      {guiState?.panels?.equip && (
        <EquipGui
          isVisible={true}
          equips={goodsData.equips}
          screenWidth={width}
          onSlotRightClick={handleEquipRightClick}
          onSlotDrop={handleEquipDrop}
          onSlotDragStart={handleEquipDragStart}
          onSlotMouseEnter={handleMouseEnter}
          onSlotMouseLeave={handleMouseLeave}
          onClose={() => gameManager?.getGuiManager().toggleEquipGui()}
          dragData={dragData}
        />
      )}

      {/* XiuLian Panel - 左侧面板 */}
      {guiState?.panels?.xiulian && (
        <XiuLianGui
          isVisible={true}
          magic={null}
          screenWidth={width}
          onClose={() => gameManager?.getGuiManager().toggleXiuLianGui()}
        />
      )}

      {/* Goods Panel - 右侧面板 */}
      {guiState?.panels?.goods && (
        <GoodsGui
          isVisible={true}
          items={goodsData.items}
          money={goodsData.money}
          screenWidth={width}
          onItemRightClick={handleGoodsRightClick}
          onItemDrop={handleGoodsDrop}
          onItemDragStart={handleGoodsDragStart}
          onItemMouseEnter={handleMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={() => gameManager?.getGuiManager().toggleGoodsGui()}
          dragData={dragData}
        />
      )}

      {/* Magic Panel - 右侧面板 */}
      {guiState?.panels?.magic && (
        <MagicGui
          isVisible={true}
          magics={[]}
          screenWidth={width}
          onClose={() => gameManager?.getGuiManager().toggleMagicGui()}
        />
      )}

      {/* Memo Panel - 右侧面板 */}
      {guiState?.panels?.memo && (
        <MemoGui
          isVisible={true}
          memos={getMemoListManager().getAllMemos()}
          screenWidth={width}
          onClose={() => gameManager?.getGuiManager().toggleMemoGui()}
        />
      )}

      {/* Current Mission Hint - 当前任务提示 */}
      {!guiState?.panels?.memo && (
        <CurrentMissionHint
          memos={getMemoListManager().getAllMemos()}
          screenWidth={width}
          screenHeight={height}
          onMemoClick={() => gameManager?.getGuiManager().toggleMemoGui()}
        />
      )}

      {/* System Menu */}
      {guiState?.panels?.system && (
        <SystemGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          onSaveLoad={() => console.log("Save/Load")}
          onOption={() => gameManager?.getGuiManager().showMessage("请用游戏设置程序进行设置")}
          onExit={() => {
            gameManager?.getGuiManager().showSystem(false);
            // TODO: Run return.txt script
          }}
          onReturn={() => gameManager?.getGuiManager().showSystem(false)}
        />
      )}

      {/* Message Notification - 消息通知 (升级提示等) */}
      <MessageGui
        isVisible={guiState?.hud?.messageVisible ?? false}
        message={guiState?.hud?.messageText ?? ""}
        screenWidth={width}
        screenHeight={height}
      />

      {/* Item Tooltip */}
      <ItemTooltip
        isVisible={tooltip.isVisible}
        good={tooltip.good}
        position={tooltip.position}
      />
    </>
  );
};
