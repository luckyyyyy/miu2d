/**
 * NPC Commands - NPC CRUD, movement, actions, AI
 * Extracted from scriptContextFactory.ts
 */

import type { ScriptContext } from "../../script/executor";
import type { ScriptCommandContext } from "./types";
import { isCharacterMoveEnd } from "./helpers";
import { CharacterState } from "../../core/types";
import { ResourcePath } from "../../config/resourcePaths";
import { logger } from "../../core/logger";
import { tileToPixel } from "../../utils";
import type { Character } from "../../character/character";

export function createNpcCommands(ctx: ScriptCommandContext): Partial<ScriptContext> {
  const {
    player,
    npcManager,
    getCharacterByName,
    getCharactersByName,
    isMapObstacleForCharacter,
  } = ctx;

  return {

    // NPC
    addNpc: async (npcFile, x, y, direction?) => {
      // direction defaults to 4 (south)
      await npcManager.addNpc(ResourcePath.npc(npcFile), x, y, direction ?? 4);
    },
    deleteNpc: (name) => {
      npcManager.deleteNpc(name);
    },
    getNpcPosition: (name) => {
      const character = getCharacterByName(name);
      return character ? character.tilePosition : null;
    },
    setNpcPosition: (name, x, y) => {
      if (player && player.name === name) {
        player.setPosition(x, y);
        return;
      }
      npcManager.setNpcPosition(name, x, y);
    },
    npcGoto: (name, x, y) => {
      if (player && player.name === name) {
        player.walkToTile(x, y);
        return;
      }
      npcManager.npcGoto(name, x, y);
    },
    isNpcGotoEnd: (name, destination) => {
      let character: Character | null = null;
      if (player && player.name === name) {
        character = player;
      } else {
        character = npcManager.getNpc(name);
      }
      return isCharacterMoveEnd(
        character, destination,
        (c, d) => c.walkTo(d),
        isMapObstacleForCharacter, `isNpcGotoEnd(${name})`,
      );
    },
    npcGotoDir: (name, direction, steps) => {
      if (player && player.name === name) {
        player.walkToDirection(direction, steps);
        return;
      }
      npcManager.npcGotoDir(name, direction, steps);
    },
    isNpcGotoDirEnd: (name) => {
      const character = getCharacterByName(name);
      if (!character) return true;
      return character.state === CharacterState.Stand || character.state === CharacterState.Stand1;
    },
    setNpcActionFile: async (name, stateType, asfFile) => {
      logger.log(
        `[ScriptContext] SetNpcActionFile: name="${name}", state=${stateType}, file="${asfFile}"`
      );
      if (player && player.name === name) {
        // 调用 Player 的 setNpcActionFile，等待 ASF 加载完成
        await player.setNpcActionFile(stateType, asfFile);
        return;
      }
      await npcManager.setNpcActionFile(name, stateType, asfFile);
    },
    npcSpecialAction: (name, asfFile) => {
      const character = getCharacterByName(name);
      if (!character) {
        logger.warn(`[ScriptContext] NpcSpecialAction: Character not found: ${name}`);
        return;
      }
      character
        .setSpecialAction(asfFile)
        .then((success: boolean) => {
          if (!success) {
            logger.warn(`[ScriptContext] Failed to start special action for ${name}`);
          }
        })
        .catch((err: unknown) => {
          logger.error(`Failed to start special action for ${name}:`, err);
          character.isInSpecialAction = false;
        });
    },
    isNpcSpecialActionEnd: (name) => {
      const character = getCharacterByName(name);
      if (!character) return true;
      return !character.isInSpecialAction;
    },
    setNpcLevel: (name, level) => {
      if (player.name === name) {
        logger.log(`[ScriptContext] SetNpcLevel: setting player level to ${level}`);
        player.setLevelTo(level);
      } else {
        npcManager.setNpcLevel(name, level);
      }
    },
    setNpcDirection: (name, direction) => {
      npcManager.setNpcDirection(name, direction);
    },
    setNpcState: (name, state) => {
      npcManager.setNpcState(name, state);
    },
    setNpcRelation: (name, relation) => {
      // 包括 Player
      npcManager.setNpcRelation(name, relation);
      if (player && player.name === name) {
        player.setRelation(relation);
      }
    },
    setNpcDeathScript: (name, scriptFile) => {
      // 先检查是否是玩家
      if (player && player.name === name) {
        player.deathScript = scriptFile;
        logger.log(`[setNpcDeathScript] Set death script for Player ${name}: ${scriptFile}`);
        return;
      }
      // 再检查 NPC
      const npc = npcManager.getNpc(name);
      if (npc) {
        npc.deathScript = scriptFile;
        logger.log(`[setNpcDeathScript] Set death script for ${name}: ${scriptFile}`);
      } else {
        logger.warn(`[setNpcDeathScript] NPC not found: ${name}`);
      }
    },
    setNpcScript: (name, scriptFile) => {
      npcManager.setNpcScript(name, scriptFile);
    },
    showNpc: (name, show) => {
      npcManager.showNpc(name, show);
      logger.log(`[ShowNpc] ${name} -> show=${show}`);
    },
    mergeNpc: async (npcFile) => {
      await npcManager.mergeNpc(npcFile);
    },
    saveNpc: async (fileName) => {
      await npcManager.saveNpc(fileName);
    },
    watch: (char1Name, char2Name, watchType) => {
      // make characters face each other
      // watchType: 0 = both face each other, 1 = only char1 faces char2
      const char1 = getCharacterByName(char1Name);
      const char2 = getCharacterByName(char2Name);
      if (!char1 || !char2) {
        logger.warn(`[Watch] Character not found: ${char1Name} or ${char2Name}`);
        return;
      }

      const isC1 = watchType === 0 || watchType === 1;
      const isC2 = watchType === 0;

      if (isC1) {
        // char1 面向 char2
        const dx = char2.pixelPosition.x - char1.pixelPosition.x;
        const dy = char2.pixelPosition.y - char1.pixelPosition.y;
        char1.setDirectionFromDelta(dx, dy);
      }
      if (isC2) {
        // char2 面向 char1
        const dx = char1.pixelPosition.x - char2.pixelPosition.x;
        const dy = char1.pixelPosition.y - char2.pixelPosition.y;
        char2.setDirectionFromDelta(dx, dy);
      }
      logger.log(`[Watch] ${char1Name} <-> ${char2Name}, type=${watchType}`);
    },
    enableNpcAI: () => {
      npcManager.enableAI();
    },
    disableNpcAI: () => {
      npcManager.disableAI();
    },

    // ============= Extended NPC Commands =============
    setNpcKind: (name, kind) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.kind = kind;
      }
      if (player && player.name === name) {
        player.kind = kind;
      }
      logger.log(`[ScriptContext] SetNpcKind: ${name} -> ${kind}`);
    },
    setNpcMagicFile: (name, magicFile) => {
      // > FlyIni = Utils.GetMagic(fileName)
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
      logger.log(`[ScriptContext] SetNpcMagicFile: ${name} -> ${magicFile}`);
    },
    setNpcRes: async (name, resFile) => {
      // > SetNpcIni(fileName) -> refresh draw image
      const character = getCharacterByName(name);
      if (character) {
        // 等待资源加载完成（对于 Player 会同时更新 NpcIniIndex 和 SpecialAttackTexture）
        const success = await character.loadSpritesFromNpcIni(resFile);
        if (success) {
          logger.log(`[ScriptContext] SetNpcRes: ${name} -> ${resFile} (loaded)`);
        } else {
          logger.warn(`[ScriptContext] SetNpcRes: ${name} -> ${resFile} (failed)`);
        }
      } else {
        logger.log(`[ScriptContext] SetNpcRes: ${name} -> ${resFile} (character not found)`);
      }
    },
    setNpcAction: (name, action, x, y) => {
      // 设置 NPC 执行指定动作
      const character = getCharacterByName(name);
      if (!character) return;
      const destination = { x: x ?? 0, y: y ?? 0 };
      const pixelDest = tileToPixel(destination.x, destination.y);
      switch (action) {
        case CharacterState.Stand:
        case CharacterState.Stand1:
          character.standingImmediately();
          break;
        case CharacterState.Walk:
          character.walkTo(destination);
          break;
        case CharacterState.Run:
          character.runTo(destination);
          break;
        case CharacterState.Jump:
          character.jumpTo(destination);
          break;
        case CharacterState.Attack:
        case CharacterState.Attack1:
        case CharacterState.Attack2:
          character.performeAttack(pixelDest);
          break;
        case CharacterState.Magic:
          // target.UseMagic(target.FlyIni, destination)
          // Use performeAttack with magic file to trigger magic state
          if (character.flyIni) {
            character.performeAttack(pixelDest, character.flyIni);
          }
          break;
        case CharacterState.Sit:
          // 只有 Player 有此方法
          if (
            "sitdown" in character &&
            typeof (character as unknown as Record<string, unknown>).sitdown === "function"
          ) {
            (character as unknown as { sitdown: () => void }).sitdown();
          } else {
            character.state = CharacterState.Sit;
          }
          break;
        case CharacterState.Hurt:
          character.hurting();
          break;
        case CharacterState.Death:
          character.death();
          break;
        case CharacterState.FightStand:
          character.standingImmediately();
          character.toFightingState();
          break;
        case CharacterState.FightWalk:
          character.walkTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightRun:
          character.runTo(destination);
          character.toFightingState();
          break;
        case CharacterState.FightJump:
          character.jumpTo(destination);
          character.toFightingState();
          break;
        default:
          logger.log(`[ScriptContext] SetNpcAction: Unhandled action ${action}`);
      }
      logger.log(`[ScriptContext] SetNpcAction: ${name}, action=${action}, pos=(${x}, ${y})`);
    },
    setNpcActionType: (name, actionType) => {
      // > Action = type
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.action = actionType;
      }
      logger.log(`[ScriptContext] SetNpcActionType: ${name} -> ${actionType}`);
    },
    setAllNpcScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.scriptFile = scriptFile;
      }
      logger.log(`[ScriptContext] SetAllNpcScript: ${name} -> ${scriptFile}`);
    },
    setAllNpcDeathScript: (name, scriptFile) => {
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.deathScript = scriptFile;
      }
      logger.log(`[ScriptContext] SetAllNpcDeathScript: ${name} -> ${scriptFile}`);
    },
    npcAttack: (name, x, y) => {
      // target.PerformeAttack(MapBase.ToPixelPosition(value))
      const characters = getCharactersByName(name);
      const pixelPos = tileToPixel(x, y);
      for (const character of characters) {
        character.performeAttack(pixelPos);
      }
      logger.log(`[ScriptContext] NpcAttack: ${name} at (${x}, ${y})`);
    },
    followNpc: (follower, target) => {
      const followerChar = getCharacterByName(follower);
      const targetChar = getCharacterByName(target);
      if (followerChar && targetChar) {
        followerChar.follow(targetChar);
        logger.log(`[ScriptContext] FollowNpc: ${follower} follows ${target}`);
      }
    },
    setNpcMagicToUseWhenBeAttacked: (name, magicFile, direction) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.magicToUseWhenBeAttacked = magicFile;
        if (direction !== undefined) {
          character.magicDirectionWhenBeAttacked = direction;
        }
      }
      logger.log(
        `[ScriptContext] SetNpcMagicToUseWhenBeAttacked: ${name}, ${magicFile}, dir=${direction}`
      );
    },
    addNpcProperty: (name, property, value) => {
      // 使用反射设置属性
      const npcs = npcManager.getAllNpcsByName(name);
      const characters: Character[] = [...npcs];
      if (player && player.name === name) {
        characters.push(player);
      }
      // 将属性名转换为小写开头
      const propName = property.charAt(0).toLowerCase() + property.slice(1);
      for (const character of characters) {
        const charRecord = character as unknown as Record<string, unknown>;
        if (propName in charRecord && typeof charRecord[propName] === "number") {
          (charRecord[propName] as number) += value;
        }
      }
      logger.log(`[ScriptContext] AddNpcProperty: ${name}.${property} += ${value}`);
    },
    changeFlyIni: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni(magicFile);
      }
      logger.log(`[ScriptContext] ChangeFlyIni: ${name} -> ${magicFile}`);
    },
    changeFlyIni2: (name, magicFile) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.setFlyIni2(magicFile);
      }
      logger.log(`[ScriptContext] ChangeFlyIni2: ${name} -> ${magicFile}`);
    },
    addFlyInis: (name, magicFile, distance) => {
      // 追加武功到 flyInis 列表
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.addFlyInis(magicFile, distance);
      }
      logger.log(`[ScriptContext] AddFlyInis: ${name}, ${magicFile}, distance=${distance}`);
    },
    setNpcDestination: (name, x, y) => {
      // 设置 NPC 目的地坐标
      const npcs = npcManager.getAllNpcsByName(name);
      for (const npc of npcs) {
        npc.destinationMapPosX = x;
        npc.destinationMapPosY = y;
      }
      logger.log(`[ScriptContext] SetNpcDestination: ${name} -> (${x}, ${y})`);
    },
    getNpcCount: (kind1, kind2) => {
      // 统计指定类型范围的 NPC 数量
      const allNpcs = npcManager.getAllNpcs();
      let count = 0;
      for (const [, npc] of allNpcs) {
        if (kind2 !== undefined) {
          if (npc.kind >= kind1 && npc.kind <= kind2) count++;
        } else {
          if (npc.kind === kind1) count++;
        }
      }
      return count;
    },
    setKeepAttack: (name, x, y) => {
      const characters = getCharactersByName(name);
      for (const character of characters) {
        character.keepAttackX = x;
        character.keepAttackY = y;
      }
      logger.log(`[ScriptContext] SetKeepAttack: ${name} -> (${x}, ${y})`);
    },
  };
}
