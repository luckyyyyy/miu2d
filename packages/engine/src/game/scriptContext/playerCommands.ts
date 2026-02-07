/**
 * Player Commands - Player movement, stats, combat, abilities
 * Extracted from scriptContextFactory.ts
 */

import type { ScriptContext } from "../../script/executor";
import type { ScriptCommandContext } from "./types";
import { CharacterState } from "../../core/types";
import { getNeighbors, tileToPixel } from "../../utils";
import { logger } from "../../core/logger";
import type { Npc } from "../../npc";
import type { Player } from "../../player/player";

export function createPlayerCommands(ctx: ScriptCommandContext): Partial<ScriptContext> {
  const {
    player,
    npcManager,
    goodsListManager,
    checkTrap,
    centerCameraOnPlayer,
    isMapObstacleForCharacter,
  } = ctx;

  return {
    setPlayerPosition: (x, y, characterName?) => {
      // SetPlayerPos supports both 2-param and 3-param versions
      // 3-param: SetPlayerPos(name, x, y) - set position for named character
      // 2-param: SetPlayerPos(x, y) - set position for PlayerKindCharacter
      let targetCharacter: Player | Npc | null = null;

      if (characterName) {
        // 3-param version: find character by name
        if (player && player.name === characterName) {
          targetCharacter = player;
        } else {
          targetCharacter = npcManager.getNpc(characterName);
        }
      } else {
        // 2-param version: use PlayerKindCharacter
        // Globals.PlayerKindCharacter = NpcManager.GetPlayerKindCharacter()
        //       ?? (ThePlayer.ControledCharacter ?? ThePlayer)
        const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
        if (npcWithPlayerKind) {
          targetCharacter = npcWithPlayerKind;
        } else if (player.controledCharacter) {
          targetCharacter = player.controledCharacter as Player | Npc;
        } else {
          targetCharacter = player;
        }
      }

      if (!targetCharacter) {
        logger.warn(`[ScriptContext] SetPlayerPos: character not found: ${characterName}`);
        return;
      }

      targetCharacter.setPosition(x, y);

      // SetPlayerPos 后调用 Globals.TheCarmera.CenterPlayerInCamera()
      centerCameraOnPlayer();

      // Reset partner position relate to player position
      if (player) {
        player.resetPartnerPosition?.();
      }

      // After setting position, check and trigger trap at current position
      // we use checkTrap which handles this
      checkTrap({ x, y });
    },
    setPlayerDirection: (direction) => {
      player.setDirection(direction);
    },
    setPlayerState: (state) => {
      // Globals.ThePlayer.SetFightState(int.Parse(parameters[0]) != 0)
      // state != 0 means enter fighting mode, state == 0 means exit fighting mode
      player.setFightState(state !== 0);
    },
    playerGoto: (x, y) => {
      player.walkToTile(x, y);
    },
    isPlayerGotoEnd: (destination) => {
      // Reference: C# IsCharacterMoveEndAndStanding(character, destinationTilePosition, isRun=false)
      if (!player) return true;

      const pos = player.tilePosition;
      const atDestination = pos.x === destination.x && pos.y === destination.y;

      let isEnd = true;

      if (!atDestination) {
        // If standing, try to walk to destination
        if (player.isStanding()) {
          player.walkToTile(destination.x, destination.y);
        }

        // Check moveable (C# pattern)
        const path = player.path;
        if (!path || path.length === 0) {
          // No path found, give up
          player.standingImmediately();
        } else if (
          path.length === 1 &&
          (pos.x !== path[0].x || pos.y !== path[0].y) &&
          player.hasObstacle(path[0])
        ) {
          // Only 1 step and it's blocked by dynamic obstacle (NPC/Obj) → give up
          player.standingImmediately();
        } else if (isMapObstacleForCharacter(pos.x, pos.y)) {
          // Player is stuck on a map obstacle tile (abnormal state) → give up
          // This prevents infinite retries when findPathInDirection creates
          // short direction paths that can never reach the real destination
          logger.warn(
            `[isPlayerGotoEnd] Player stuck on map obstacle at (${pos.x}, ${pos.y}), giving up PlayerGoto to (${destination.x}, ${destination.y})`
          );
          player.standingImmediately();
        } else {
          isEnd = false;
        }
      } else {
        // At destination tile but still moving - keep waiting
        if (!player.isStanding()) {
          isEnd = false;
        }
      }

      return isEnd;
    },
    playerRunTo: (x, y) => {
      player.runToTile(x, y);
    },
    isPlayerRunToEnd: (destination) => {
      // Reference: C# IsCharacterMoveEndAndStanding(character, destinationTilePosition, isRun=true)
      if (!player) return true;

      const pos = player.tilePosition;
      const atDestination = pos.x === destination.x && pos.y === destination.y;

      let isEnd = true;

      if (!atDestination) {
        // If standing, try to run to destination
        if (player.isStanding()) {
          player.runToTile(destination.x, destination.y);
        }

        // Check moveable (C# pattern)
        const path = player.path;
        if (!path || path.length === 0) {
          player.standingImmediately();
        } else if (
          path.length === 1 &&
          (pos.x !== path[0].x || pos.y !== path[0].y) &&
          player.hasObstacle(path[0])
        ) {
          player.standingImmediately();
        } else if (isMapObstacleForCharacter(pos.x, pos.y)) {
          logger.warn(
            `[isPlayerRunToEnd] Player stuck on map obstacle at (${pos.x}, ${pos.y}), giving up PlayerRunTo to (${destination.x}, ${destination.y})`
          );
          player.standingImmediately();
        } else {
          isEnd = false;
        }
      } else {
        if (!player.isStanding()) {
          isEnd = false;
        }
      }

      return isEnd;
    },
    playerGotoDir: (direction, steps) => {
      player.walkToDirection(direction, steps);
    },
    isPlayerGotoDirEnd: () => {
      if (!player) return true;
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },
    addMoney: (amount) => {
      player.addMoney(amount);
    },
    addExp: (amount) => {
      player.addExp(amount);
    },

    // Player stats
    fullLife: () => {
      if (player) {
        player.fullLife();
        logger.log("[ScriptContext] FullLife");
      }
    },
    fullMana: () => {
      if (player) {
        player.fullMana();
        logger.log("[ScriptContext] FullMana");
      }
    },
    fullThew: () => {
      if (player) {
        player.fullThew();
        logger.log("[ScriptContext] FullThew");
      }
    },
    addLife: (amount) => {
      if (player) {
        player.addLife(amount);
        logger.log(`[ScriptContext] AddLife: ${amount}`);
      }
    },
    addMana: (amount) => {
      if (player) {
        player.addMana(amount);
        logger.log(`[ScriptContext] AddMana: ${amount}`);
      }
    },
    addThew: (amount) => {
      if (player) {
        player.addThew(amount);
        logger.log(`[ScriptContext] AddThew: ${amount}`);
      }
    },
    disableFight: () => {
      // Globals.ThePlayer.DisableFight()
      if (player) {
        player.isFightDisabled = true;
        logger.log("[ScriptContext] DisableFight");
      }
    },
    enableFight: () => {
      // Globals.ThePlayer.EnableFight()
      if (player) {
        player.isFightDisabled = false;
        logger.log("[ScriptContext] EnableFight");
      }
    },
    disableJump: () => {
      // Globals.ThePlayer.DisableJump()
      if (player) {
        player.isJumpDisabled = true;
        logger.log("[ScriptContext] DisableJump");
      }
    },
    enableJump: () => {
      // Globals.ThePlayer.EnableJump()
      if (player) {
        player.isJumpDisabled = false;
        logger.log("[ScriptContext] EnableJump");
      }
    },
    disableRun: () => {
      // Globals.ThePlayer.DisableRun()
      if (player) {
        player.isRunDisabled = true;
        logger.log("[ScriptContext] DisableRun");
      }
    },
    enableRun: () => {
      // Globals.ThePlayer.EnableRun()
      if (player) {
        player.isRunDisabled = false;
        logger.log("[ScriptContext] EnableRun");
      }
    },

    // Character state
    toNonFightingState: () => {
      // Globals.PlayerKindCharacter.ToNonFightingState()
      // Used during dialogs (Say/Talk) to exit fighting mode
      const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
      const targetCharacter = npcWithPlayerKind ?? player.controledCharacter ?? player;
      if (targetCharacter) {
        targetCharacter.toNonFightingState();
        logger.log("[ScriptContext] ToNonFightingState");
      }
    },

    // Player change - 多主角切换
    // Loader.ChangePlayer(index)
    playerChange: async (index) => {
      await ctx.changePlayer(index);
      logger.log(`[ScriptContext] PlayerChange: switched to index ${index}`);
    },

    // ============= Extended Player Commands =============
    playerJumpTo: (x, y) => {
      if (player) {
        // Globals.ThePlayer.JumpTo(x, y)
        const success = player.jumpTo({ x, y });
        logger.log(`[ScriptContext] PlayerJumpTo: (${x}, ${y}) success=${success}`);
      }
    },
    isPlayerJumpToEnd: () => {
      if (!player) return true;
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },
    playerGotoEx: (x, y) => {
      if (player) {
        player.walkToTile(x, y);
        logger.log(`[ScriptContext] PlayerGotoEx: (${x}, ${y}) (non-blocking)`);
      }
    },
    playerRunToEx: (x, y) => {
      if (player) {
        player.runToTile(x, y);
        logger.log(`[ScriptContext] PlayerRunToEx: (${x}, ${y}) (non-blocking)`);
      }
    },
    setPlayerScn: () => {
      // 将摄像机居中到玩家位置
      ctx.centerCameraOnPlayer();
      logger.log(`[ScriptContext] SetPlayerScn: centering camera on player`);
    },
    getMoneyNum: () => {
      return player?.money || 0;
    },
    setMoneyNum: (amount) => {
      if (player) {
        player.setMoney(amount);
        logger.log(`[ScriptContext] SetMoneyNum: ${amount}`);
      }
    },
    getPlayerExp: () => {
      return player?.exp || 0;
    },
    getPlayerState: (stateName) => {
      if (!player) return 0;
      switch (stateName) {
        case "Level":
          return player.level;
        case "Attack":
          return player.attack;
        case "Defend":
          return player.defend;
        case "Evade":
          return player.evade;
        case "Life":
          return player.life;
        case "Thew":
          return player.thew;
        case "Mana":
          return player.mana;
        default:
          return 0;
      }
    },
    getPlayerMagicLevel: (magicFile) => {
      if (!player) return 0;
      const magicListManager = player.getMagicListManager();
      const info = magicListManager.getMagicByFileName(magicFile);
      return info?.level || 0;
    },
    limitMana: (limit) => {
      if (player) {
        // Globals.ThePlayer.ManaLimit = (int.Parse(parameters[0]) != 0)
        player.manaLimit = limit;
        logger.log(`[ScriptContext] LimitMana: ${limit}`);
      }
    },
    addMoveSpeedPercent: (percent) => {
      if (player) {
        player.addMoveSpeedPercent = (player.addMoveSpeedPercent || 0) + percent;
        logger.log(`[ScriptContext] AddMoveSpeedPercent: ${percent}`);
      }
    },
    useMagic: (magicFile, x, y) => {
      if (!player) return;

      // 获取魔法并让玩家使用
      const magicListManager = player.getMagicListManager();
      const magicInfo = magicListManager.getMagicByFileName(magicFile);

      if (!magicInfo || !magicInfo.magic) {
        logger.warn(`[ScriptContext] UseMagic: magic not found: ${magicFile}`);
        return;
      }

      // 计算目标位置
      let mapX = x ?? 0;
      let mapY = y ?? 0;

      // 如果没有提供坐标，使用玩家当前方向上的邻居瓦片
      if (x === undefined || y === undefined) {
        const neighbors = getNeighbors(player.tilePosition);
        const dest = neighbors[player.currentDirection];
        mapX = dest.x;
        mapY = dest.y;
      }

      // 直接设置 pending magic 并触发魔法释放
      // Globals.ThePlayer.UseMagic(magicInfo.TheMagic, new Vector2(mapX, mapY))
      const origin = player.positionInWorld;
      const destination = tileToPixel(mapX, mapY);

      player.setPendingMagic(magicInfo.magic, origin, destination);
      // 直接触发 onMagicCast 释放魔法（跳过动画）
      (player as unknown as { onMagicCast(): void }).onMagicCast();

      logger.log(
        `[ScriptContext] UseMagic: ${magicFile} (${magicInfo.magic.name}) at (${mapX}, ${mapY})`
      );
    },
    isEquipWeapon: () => {
      const weapon = goodsListManager.get(205); // 武器槽位
      return weapon !== null;
    },
    addAttack: (value, type) => {
      if (player) {
        // type 1=_attack, 2=_attack2, 3=_attack3 (default 1)
        const t = type ?? 1;
        if (t === 1) {
          player.attack += value;
        } else if (t === 2) {
          player.attack2 += value;
        } else if (t === 3) {
          player.attack3 += value;
        }
        logger.log(`[ScriptContext] AddAttack: ${value}, type=${t}`);
      }
    },
    addDefend: (value, type) => {
      if (player) {
        // type 1=_defend, 2=_defend2, 3=_defend3 (default 1)
        // Also clamps to 0 minimum
        const t = type ?? 1;
        if (t === 1) {
          player.defend = Math.max(0, player.defend + value);
        } else if (t === 2) {
          player.defend2 = Math.max(0, player.defend2 + value);
        } else if (t === 3) {
          player.defend3 = Math.max(0, player.defend3 + value);
        }
        logger.log(`[ScriptContext] AddDefend: ${value}, type=${t}`);
      }
    },
    addEvade: (value) => {
      if (player) {
        player.evade += value;
        logger.log(`[ScriptContext] AddEvade: ${value}`);
      }
    },
    addLifeMax: (value) => {
      if (player) {
        player.lifeMax += value;
        logger.log(`[ScriptContext] AddLifeMax: ${value}`);
      }
    },
    addManaMax: (value) => {
      if (player) {
        player.manaMax += value;
        logger.log(`[ScriptContext] AddManaMax: ${value}`);
      }
    },
    addThewMax: (value) => {
      if (player) {
        player.thewMax += value;
        logger.log(`[ScriptContext] AddThewMax: ${value}`);
      }
    },
    setPlayerMagicToUseWhenBeAttacked: (magicFile, direction) => {
      if (player) {
        player.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          player.magicDirectionWhenBeAttacked = direction;
        }
        logger.log(
          `[ScriptContext] SetPlayerMagicToUseWhenBeAttacked: ${magicFile}, dir=${direction}`
        );
      }
    },
    setWalkIsRun: (value) => {
      if (player) {
        player.walkIsRun = value;
        logger.log(`[ScriptContext] SetWalkIsRun: ${value}`);
      }
    },
  };
}
