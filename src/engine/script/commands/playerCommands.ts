/**
 * Player Commands - Movement, Stats, Items
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandRegistry } from "./types";

/**
 * SetPlayerPos - Set player tile position
 */
const setPlayerPosCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.context.setPlayerPosition(x, y);
  return true;
};

/**
 * SetPlayerDir - Set player facing direction
 */
const setPlayerDirCommand: CommandHandler = (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  helpers.context.setPlayerDirection(direction);
  return true;
};

/**
 * SetPlayerState - Set player state
 */
const setPlayerStateCommand: CommandHandler = (params, _result, helpers) => {
  const state = helpers.resolveNumber(params[0] || "0");
  helpers.context.setPlayerState(state);
  return true;
};

/**
 * PlayerGoto - Walk player to position (BLOCKING)
 */
const playerGotoCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  const destination = { x, y };
  helpers.context.playerGoto(x, y);

  if (helpers.context.isPlayerGotoEnd(destination)) {
    return true;
  }

  helpers.state.waitingForPlayerGoto = true;
  helpers.state.playerGotoDestination = destination;
  return false;
};

/**
 * PlayerRunTo - Run player to position (BLOCKING)
 */
const playerRunToCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  const destination = { x, y };
  helpers.context.playerRunTo(x, y);

  if (helpers.context.isPlayerRunToEnd(destination)) {
    return true;
  }

  helpers.state.waitingForPlayerRunTo = true;
  helpers.state.playerRunToDestination = destination;
  return false;
};

/**
 * PlayerGotoDir - Walk player in direction (BLOCKING)
 */
const playerGotoDirCommand: CommandHandler = (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const steps = helpers.resolveNumber(params[1] || "1");
  helpers.context.playerGotoDir(direction, steps);

  if (helpers.context.isPlayerGotoDirEnd()) {
    return true;
  }

  helpers.state.waitingForPlayerGotoDir = true;
  return false;
};

/**
 * AddGoods - Add items to inventory
 */
const addGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.resolveNumber(params[1] || "1");
  helpers.context.addGoods(goodsName, count);
  return true;
};

/**
 * AddRandGoods - Add random item from buy file
 * C# Reference: ScriptExecuter.AddRandGoods
 */
const addRandGoodsCommand: CommandHandler = async (params, _result, helpers) => {
  const buyFileName = helpers.resolveString(params[0] || "");
  console.log(`[ScriptExecutor] AddRandGoods: ${buyFileName}`);
  await helpers.context.addRandGoods(buyFileName);
  return true;
};

/**
 * DelGoods - Remove items from inventory
 */
const delGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const goodsName = helpers.resolveString(params[0] || "");
  const count = helpers.resolveNumber(params[1] || "1");
  helpers.context.removeGoods(goodsName, count);
  return true;
};

/**
 * EquipGoods - Equip an item
 */
const equipGoodsCommand: CommandHandler = (params, _result, helpers) => {
  const equipType = helpers.resolveNumber(params[0] || "0");
  const goodsId = helpers.resolveNumber(params[1] || "0");
  helpers.context.equipGoods(equipType, goodsId);
  return true;
};

/**
 * AddMoney - Add money to player
 */
const addMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addMoney(amount);
  return true;
};

/**
 * AddRandMoney - Add random amount of money
 */
const addRandMoneyCommand: CommandHandler = (params, _result, helpers) => {
  const min = helpers.resolveNumber(params[0] || "0");
  const max = helpers.resolveNumber(params[1] || "100");
  const amount = min + Math.floor(Math.random() * (max - min + 1));
  helpers.context.addMoney(amount);
  return true;
};

/**
 * AddExp - Add experience to player
 */
const addExpCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  helpers.context.addExp(amount);
  return true;
};

/**
 * FullLife - Fully restore player health
 */
const fullLifeCommand: CommandHandler = () => {
  console.log("FullLife");
  return true;
};

/**
 * FullMana - Fully restore player mana
 */
const fullManaCommand: CommandHandler = () => {
  console.log("FullMana");
  return true;
};

/**
 * FullThew - Fully restore player stamina
 */
const fullThewCommand: CommandHandler = () => {
  console.log("FullThew");
  return true;
};

/**
 * AddLife - Add health to player
 */
const addLifeCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  console.log(`AddLife: ${amount}`);
  return true;
};

/**
 * AddMana - Add mana to player
 */
const addManaCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  console.log(`AddMana: ${amount}`);
  return true;
};

/**
 * AddThew - Add stamina to player
 */
const addThewCommand: CommandHandler = (params, _result, helpers) => {
  const amount = helpers.resolveNumber(params[0] || "0");
  console.log(`AddThew: ${amount}`);
  return true;
};

/**
 * AddMagic - Add magic to player
 */
const addMagicCommand: CommandHandler = (params, _result, helpers) => {
  const magicId = helpers.resolveString(params[0] || "");
  console.log(`AddMagic: ${magicId}`);
  return true;
};

/**
 * SetMagicLevel - Set magic level
 */
const setMagicLevelCommand: CommandHandler = (params, _result, helpers) => {
  const magicId = helpers.resolveString(params[0] || "");
  const level = helpers.resolveNumber(params[1] || "1");
  console.log(`SetMagicLevel: ${magicId}, level=${level}`);
  return true;
};

/**
 * Register all player commands
 */
export function registerPlayerCommands(registry: CommandRegistry): void {
  // Position and movement
  registry.set("setplayerpos", setPlayerPosCommand);
  registry.set("setplayerdir", setPlayerDirCommand);
  registry.set("setplayerstate", setPlayerStateCommand);
  registry.set("playergoto", playerGotoCommand);
  registry.set("playerrunto", playerRunToCommand);
  registry.set("playergotodir", playerGotoDirCommand);

  // Inventory
  registry.set("addgoods", addGoodsCommand);
  registry.set("addrandgoods", addRandGoodsCommand);
  registry.set("delgoods", delGoodsCommand);
  registry.set("equipgoods", equipGoodsCommand);

  // Stats
  registry.set("addmoney", addMoneyCommand);
  registry.set("addrandmoney", addRandMoneyCommand);
  registry.set("addexp", addExpCommand);
  registry.set("fulllife", fullLifeCommand);
  registry.set("fullmana", fullManaCommand);
  registry.set("fullthew", fullThewCommand);
  registry.set("addlife", addLifeCommand);
  registry.set("addmana", addManaCommand);
  registry.set("addthew", addThewCommand);

  // Magic
  registry.set("addmagic", addMagicCommand);
  registry.set("setmagiclevel", setMagicLevelCommand);
}
