/**
 * ClassicGameUI - 经典风格游戏UI渲染组件
 *
 * 使用 ASF 精灵的复古像素风格 UI
 * 渲染逻辑从 GameUI 提取，与 useGameUILogic 配合使用
 */

import { logger } from "@miu2d/engine/core/logger";
import type React from "react";
import { useEffect } from "react";
import { GameUIContext } from "../contexts";
import { useBuildGameUIContextValue, useTouchDropHandlers } from "./hooks";
import type { GameUILogic } from "./hooks";
import { useEquipGuiConfig, useStateGuiConfig } from "./ui/classic/useUISettings";
import {
  BottomGui,
  BottomStateGui,
  BuyGui,
  GambleGui,
  DialogUI,
  EquipGui,
  GoodsGui,
  ItemTooltip,
  LittleHeadGui,
  LittleMapGui,
  MagicGui,
  MagicTooltip,
  MemoGui,
  MessageGui,
  NpcLifeBar,
  SelectionMultipleUI,
  SelectionUI,
  StateGui,
  TimerGui,
  TopGui,
  XiuLianGui,
} from "./ui/classic";

interface ClassicGameUIProps {
  logic: GameUILogic;
  width: number;
  height: number;
}

/**
 * ClassicGameUI Component
 */
export const ClassicGameUI: React.FC<ClassicGameUIProps> = ({ logic, width, height }) => {
  // 检测 State 和 Equip 是否共用同一背景图（整合模式，如 demo2）
  const stateGuiConfig = useStateGuiConfig();
  const equipGuiConfig = useEquipGuiConfig();
  // 同一背景图 AND 同一叠加图才算整合模式（避免 sword2 中两者共用 panel.msf 但 overlayImage 不同被误判）
  const isStateIntegratedWithEquip =
    !!stateGuiConfig &&
    !!equipGuiConfig &&
    stateGuiConfig.panel.image === equipGuiConfig.panel.image &&
    (stateGuiConfig.panel.overlayImage ?? "") === (equipGuiConfig.panel.overlayImage ?? "");

  const {
    engine,
    dispatch,
    panels,
    dialog,
    selection,
    multiSelection,
    message,
    uiPlayer,
    player,
    goodsData,
    magicData,
    buyData,
    partnersData,
    hoveredNpc,
    npcUpdateKey,
    dragData,
    setDragData,
    magicDragData,
    bottomMagicDragData,
    tooltip,
    magicTooltip,
    timerState,
    minimapState,
    togglePanel,
    handleEquipRightClick,
    handleEquipDrop,
    handleEquipDragStart,
    handleGoodsRightClick,
    handleGoodsDrop,
    handleGoodsDragStart,
    handleGoodsDropOnBottom,
    handleBottomGoodsDragStart,
    handleUseBottomGood,
    handleMagicDragStart,
    handleBottomMagicDragStart,
    handleMagicDragEnd,
    handleMagicDropOnStore,
    handleMagicDropOnBottom,
    handleMagicDropOnXiuLian,
    handleXiuLianDragStart,
    handleMouseEnter,
    handleMouseLeave,
    handleMagicHover,
    handleMagicLeave,
    handleShopItemMouseEnter,
    handleShopItemRightClick,
    handleShopClose,
  } = logic;

  // 告知引擎整合模式：F1 等同 F2，不单独响应 state 面板
  useEffect(() => {
    engine?.setStateEquipIntegrated(isStateIntegratedWithEquip);
  }, [engine, isStateIntegratedWithEquip]);

  // ============= Touch Drop Handlers =============
  const {
    handleBottomTouchDrop,
    handleEquipTouchDrop,
    handleGoodsTouchDrop,
    handleMagicTouchDrop,
    handleXiuLianTouchDrop,
  } = useTouchDropHandlers(logic);

  // ======= GameUIContext value ======= (must be before early-return to satisfy Rules of Hooks)
  const gameUIContextValue = useBuildGameUIContextValue(logic, width, height);

  if (!engine) return null;

  return (
    <GameUIContext.Provider value={gameUIContextValue}>
      {/* Top GUI */}
      <TopGui />

      {/* Partner Heads (队友头像) */}
      {partnersData.length > 0 && (
        <LittleHeadGui
          partners={partnersData}
          onPartnerClick={(_index, partner) => {
            if (partner.canEquip) {
              // TODO: 打开 NPC 装备界面
              logger.debug(`[ClassicGameUI] Partner clicked: ${partner.name}`);
            }
          }}
        />
      )}

      {/* Timer GUI */}
      {timerState.isRunning && !timerState.isHidden && (
        <TimerGui timerState={timerState} screenWidth={width} />
      )}

      {/* NPC Life Bar */}
      <NpcLifeBar key={npcUpdateKey} npc={hoveredNpc} screenWidth={width} />

      {/* Bottom State GUI */}
      <BottomStateGui />

      {/* Bottom GUI */}
      <BottomGui
        goodsItems={goodsData.bottomGoods}
        magicItems={magicData.bottomMagics}
        onItemClick={(index) => {
          if (index < 3) {
            handleUseBottomGood(index);
          } else {
            dispatch({ type: "USE_MAGIC_BY_BOTTOM", bottomSlot: index - 3 });
          }
        }}
        onItemRightClick={(index) => {
          if (index < 3) {
            if (panels?.buy) {
              dispatch({ type: "SELL_ITEM", bagIndex: 221 + index });
            } else {
              handleUseBottomGood(index);
            }
          } else {
            dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: index - 3 });
          }
        }}
        onMagicRightClick={(magicIndex) => {
          dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: magicIndex });
        }}
        onDragStart={(data) => {
          if (data.type === "magic") {
            handleBottomMagicDragStart(data.listIndex);
          } else if (data.type === "goods") {
            handleBottomGoodsDragStart(data.slotIndex);
          }
        }}
        onDrop={(targetIndex) => {
          if (targetIndex < 3) {
            if (dragData) {
              handleGoodsDropOnBottom(targetIndex);
            }
          } else if (targetIndex >= 3 && (magicDragData || bottomMagicDragData)) {
            handleMagicDropOnBottom(targetIndex - 3);
          }
        }}
        onTouchDrop={handleBottomTouchDrop}
        onDragEnd={() => {
          handleMagicDragEnd();
          setDragData(null);
        }}
      />

      {/* State Panel - 整合模式下由 EquipGui 通过 overlayStats 渲染文字，此处仅在非整合模式显示 */}
      {panels?.state && player && (
        <StateGui
          isVisible={true}
          stats={{
            level: player.level,
            exp: player.exp,
            levelUpExp: player.levelUpExp,
            life: player.life,
            lifeMax: player.lifeMax,
            thew: player.thew,
            thewMax: player.thewMax,
            mana: player.mana,
            manaMax: player.manaMax,
            manaLimit: player.manaLimit,
            attack: player.attack,
            attack2: player.attack2,
            attack3: player.attack3,
            defend: player.defend,
            defend2: player.defend2,
            defend3: player.defend3,
            evade: player.evade,
          }}
          playerIndex={uiPlayer?.playerIndex ?? 0}
          screenWidth={width}
          onClose={() => togglePanel("state")}
        />
      )}

      {/* Equip Panel */}
      {panels?.equip && (
        <EquipGui
          isVisible={true}
          equips={goodsData.equips}
          screenWidth={width}
          onSlotRightClick={handleEquipRightClick}
          onSlotDrop={handleEquipDrop}
          onSlotDragStart={handleEquipDragStart}
          onSlotMouseEnter={handleMouseEnter}
          onSlotMouseLeave={handleMouseLeave}
          onClose={() => togglePanel("equip")}
          dragData={dragData}
          onTouchDrop={handleEquipTouchDrop}
          overlayStats={isStateIntegratedWithEquip && player ? {
            level: player.level,
            exp: player.exp,
            levelUpExp: player.levelUpExp,
            life: player.life,
            lifeMax: player.lifeMax,
            thew: player.thew,
            thewMax: player.thewMax,
            mana: player.mana,
            manaMax: player.manaMax,
            manaLimit: player.manaLimit,
            attack: player.attack,
            attack2: player.attack2,
            attack3: player.attack3,
            defend: player.defend,
            defend2: player.defend2,
            defend3: player.defend3,
            evade: player.evade,
          } : undefined}
        />
      )}

      {/* XiuLian Panel */}
      {panels?.xiulian && (
        <XiuLianGui
          isVisible={true}
          magicInfo={magicData.xiuLianMagic}
          screenWidth={width}
          onClose={() => togglePanel("xiulian")}
          onDrop={handleMagicDropOnXiuLian}
          onDragStart={handleXiuLianDragStart}
          onDragEnd={handleMagicDragEnd}
          dragData={magicDragData}
          bottomDragData={bottomMagicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
          onTouchDrop={handleXiuLianTouchDrop}
        />
      )}

      {/* Good Panel */}
      {panels?.goods && (
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
          onClose={() => togglePanel("goods")}
          dragData={dragData}
          onTouchDrop={handleGoodsTouchDrop}
        />
      )}

      {/* Magic Panel */}
      {panels?.magic && (
        <MagicGui
          isVisible={true}
          magicInfos={magicData.storeMagics}
          screenWidth={width}
          onMagicClick={(storeIndex) => logger.log("Magic clicked:", storeIndex)}
          onMagicRightClick={(storeIndex) =>
            dispatch({ type: "SET_CURRENT_MAGIC", magicIndex: storeIndex })
          }
          onClose={() => togglePanel("magic")}
          onDragStart={handleMagicDragStart}
          onDragEnd={handleMagicDragEnd}
          onDrop={handleMagicDropOnStore}
          dragData={magicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
          onTouchDrop={handleMagicTouchDrop}
        />
      )}

      {/* Memo Panel */}
      {panels?.memo && (
        <MemoGui
          isVisible={true}
          memos={engine?.memoListManager?.getAllMemos() ?? []}
          screenWidth={width}
          onClose={() => togglePanel("memo")}
        />
      )}

      {/* Buy/Shop Panel */}
      {panels?.buy && buyData.items.length > 0 && (
        <BuyGui
          isVisible={true}
          items={buyData.items.map((item) => {
            if (!item) return null;
            const basePrice = item.price > 0 ? item.price : item.good.cost;
            const effectivePrice = Math.floor((basePrice * buyData.buyPercent) / 100);
            return { good: item.good, count: item.count, price: effectivePrice };
          })}
          screenWidth={width}
          buyPercent={buyData.buyPercent}
          numberValid={buyData.numberValid}
          onItemRightClick={handleShopItemRightClick}
          onItemMouseEnter={handleShopItemMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={handleShopClose}
        />
      )}

      {/* System Menu - 已由 GameScreen 的 GameMenuPanel 替代 */}

      {/* Gamble Mini-Game */}
      {panels?.gamble && (() => {
        const guiState = engine?.guiManager?.getState();
        const gambleState = guiState?.gamble as { npcType: number; cost: number } | null;
        const money = engine?.player?.money ?? 0;
        return (
          <GambleGui
            isVisible={true}
            cost={gambleState?.cost ?? 0}
            npcType={((gambleState?.npcType ?? 0) as 0 | 1)}
            playerMoney={money}
            onResult={(win) => dispatch({ type: "GAMBLE_DONE", win })}
          />
        );
      })()}

      {/* LittleMap */}
      {panels?.littleMap && (
        <LittleMapGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          mapData={minimapState.mapData}
          mapName={minimapState.mapName}
          mapDisplayName={minimapState.mapDisplayName}
          playerPosition={minimapState.playerPosition}
          characters={minimapState.characters}
          cameraPosition={minimapState.cameraPosition}
          onClose={() => togglePanel("littleMap")}
          onMapClick={(worldPos) => {
            dispatch({ type: "MINIMAP_CLICK", worldX: worldPos.x, worldY: worldPos.y });
            togglePanel("littleMap");
          }}
        />
      )}

      {/* Dialog - 渲染在弹窗面板之上 */}
      {dialog?.isVisible && (
        <DialogUI
          state={dialog}
          screenWidth={width}
          screenHeight={height}
          onClose={() => dispatch({ type: "DIALOG_CLICK" })}
          onSelectionMade={(sel) => {
            dispatch({ type: "DIALOG_SELECT", selection: sel });
          }}
        />
      )}

      {/* Selection - 渲染在弹窗面板之上 */}
      {selection?.isVisible && (
        <SelectionUI
          state={{
            ...selection,
            options: selection.options.map((o) => ({ ...o })),
          }}
          screenWidth={width}
          screenHeight={height}
          onSelect={(index) => dispatch({ type: "SELECTION_CHOOSE", index })}
        />
      )}

      {/* Multi-Selection - 渲染在弹窗面板之上 */}
      {multiSelection?.isVisible && (
        <SelectionMultipleUI
          state={{
            ...multiSelection,
            options: multiSelection.options.map((o) => ({ ...o })),
            selectedIndices: [...multiSelection.selectedIndices],
          }}
          screenWidth={width}
          screenHeight={height}
          onToggleSelection={(index) => dispatch({ type: "MULTI_SELECTION_TOGGLE", index })}
        />
      )}

      {/* Message Notification */}
      <MessageGui
        isVisible={message?.isVisible ?? false}
        message={message?.text ?? ""}
        screenWidth={width}
        screenHeight={height}
      />

      {/* Item Tooltip */}
      <ItemTooltip
        isVisible={tooltip.isVisible}
        good={tooltip.good}
        shopPrice={tooltip.shopPrice}
        position={tooltip.position}
      />

      {/* Magic Tooltip */}
      <MagicTooltip
        isVisible={magicTooltip.isVisible}
        magicInfo={magicTooltip.magicInfo}
        position={magicTooltip.position}
      />

      {/* Video Player */}

      {/* Engine Watermark */}
      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 4,
          fontSize: 10,
          color: "rgba(255, 255, 255, 0.25)",
          pointerEvents: "none",
          userSelect: "none",
          fontFamily: "sans-serif",
          letterSpacing: 0.5,
        }}
      >
        Powered by Miu2D Engine
      </div>
    </GameUIContext.Provider>
  );
};
