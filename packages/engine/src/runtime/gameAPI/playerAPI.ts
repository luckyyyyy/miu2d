/**
 * PlayerAPI Implementation - Delegates to existing playerCommands logic
 */

import type { PlayerAPI } from "../../core/gameAPI";
import type { ScriptCommandContext } from "../scriptContext/types";
import { isCharacterMoveEnd } from "../scriptContext/helpers";
import { CharacterState } from "../../core/types";
import { getNeighbors, tileToPixel } from "../../utils";
import { logger } from "../../core/logger";
import type { Npc } from "../../npc";
import type { Player } from "../../player/player";

export function createPlayerAPI(ctx: ScriptCommandContext): PlayerAPI {
  const {
    player,
    npcManager,
    goodsListManager,
    checkTrap,
    centerCameraOnPlayer,
    isMapObstacleForCharacter,
  } = ctx;

  const pa = (fn: (p: Player) => void, label: string) => () => {
    if (player) { fn(player); logger.log(`[GameAPI.player] ${label}`); }
  };

  return {
    setPosition: (x, y, characterName?) => {
      let targetCharacter: Player | Npc | null = null;
      if (characterName) {
        if (player && player.name === characterName) {
          targetCharacter = player;
        } else {
          targetCharacter = npcManager.getNpc(characterName);
        }
      } else {
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
        logger.warn(`[GameAPI.player] setPosition: character not found: ${characterName}`);
        return;
      }
      targetCharacter.setPosition(x, y);
      centerCameraOnPlayer();
      if (player) { player.resetPartnerPosition?.(); }
      checkTrap({ x, y });
    },
    setDirection: (direction) => { player.setDirection(direction); },
    setState: (state) => { player.setFightState(state !== 0); },
    walkTo: (x, y) => { player.walkToTile(x, y); },
    isWalkEnd: (destination) => isCharacterMoveEnd(
      player, destination, (_c, d) => player.walkToTile(d.x, d.y),
      isMapObstacleForCharacter, "isPlayerGotoEnd",
    ),
    walkToDir: (direction, steps) => { player.walkToDirection(direction, steps); },
    isWalkDirEnd: () => {
      if (!player) return true;
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },
    runTo: (x, y) => { player.runToTile(x, y); },
    isRunEnd: (destination) => isCharacterMoveEnd(
      player, destination, (_c, d) => player.runToTile(d.x, d.y),
      isMapObstacleForCharacter, "isPlayerRunToEnd",
    ),
    jumpTo: (x, y) => {
      if (player) {
        const success = player.jumpTo({ x, y });
        logger.log(`[GameAPI.player] jumpTo: (${x}, ${y}) success=${success}`);
      }
    },
    isJumpEnd: () => {
      if (!player) return true;
      return player.state === CharacterState.Stand || player.state === CharacterState.Stand1;
    },
    walkToNonBlocking: (x, y) => {
      if (player) { player.walkToTile(x, y); }
    },
    runToNonBlocking: (x, y) => {
      if (player) { player.runToTile(x, y); }
    },
    centerCamera: () => { ctx.centerCameraOnPlayer(); },
    setWalkIsRun: (value) => {
      if (player) { player.walkIsRun = value; }
    },
    toNonFightingState: () => {
      const npcWithPlayerKind = npcManager.getPlayerKindCharacter();
      const targetCharacter = npcWithPlayerKind ?? player.controledCharacter ?? player;
      if (targetCharacter) { targetCharacter.toNonFightingState(); }
    },
    change: async (index) => {
      await ctx.changePlayer(index);
      logger.log(`[GameAPI.player] change: switched to index ${index}`);
    },

    // Stats
    getMoney: () => player?.money || 0,
    setMoney: (amount) => { if (player) { player.setMoney(amount); } },
    addMoney: (amount) => { player.addMoney(amount); },
    getExp: () => player?.exp || 0,
    addExp: (amount) => { player.addExp(amount); },
    getStat: (stateName) => {
      if (!player) return 0;
      switch (stateName) {
        case "Level": return player.level;
        case "Attack": return player.attack;
        case "Defend": return player.defend;
        case "Evade": return player.evade;
        case "Life": return player.life;
        case "Thew": return player.thew;
        case "Mana": return player.mana;
        default: return 0;
      }
    },
    fullLife: pa(p => p.fullLife(), "FullLife"),
    fullMana: pa(p => p.fullMana(), "FullMana"),
    fullThew: pa(p => p.fullThew(), "FullThew"),
    addLife: (amount) => { if (player) { player.addLife(amount); } },
    addMana: (amount) => { if (player) { player.addMana(amount); } },
    addThew: (amount) => { if (player) { player.addThew(amount); } },
    addLifeMax: (value) => { if (player) { player.lifeMax += value; } },
    addManaMax: (value) => { if (player) { player.manaMax += value; } },
    addThewMax: (value) => { if (player) { player.thewMax += value; } },
    addAttack: (value, type) => {
      if (!player) return;
      const t = type ?? 1;
      if (t === 1) player.attack += value;
      else if (t === 2) player.attack2 += value;
      else if (t === 3) player.attack3 += value;
    },
    addDefend: (value, type) => {
      if (!player) return;
      const t = type ?? 1;
      if (t === 1) player.defend = Math.max(0, player.defend + value);
      else if (t === 2) player.defend2 = Math.max(0, player.defend2 + value);
      else if (t === 3) player.defend3 = Math.max(0, player.defend3 + value);
    },
    addEvade: (value) => { if (player) { player.evade += value; } },
    limitMana: (limit) => { if (player) { player.manaLimit = limit; } },
    addMoveSpeedPercent: (percent) => {
      if (player) { player.addMoveSpeedPercent = (player.addMoveSpeedPercent || 0) + percent; }
    },
    isEquipWeapon: () => {
      const weapon = goodsListManager.get(205);
      return weapon !== null;
    },

    // Abilities
    setFightEnabled: (enabled) => { if (player) { player.isFightDisabled = !enabled; } },
    setJumpEnabled: (enabled) => { if (player) { player.isJumpDisabled = !enabled; } },
    setRunEnabled: (enabled) => { if (player) { player.isRunDisabled = !enabled; } },

    setMagicWhenAttacked: (magicFile, direction) => {
      if (player) {
        player.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) { player.magicDirectionWhenBeAttacked = direction; }
      }
    },
  };
}
