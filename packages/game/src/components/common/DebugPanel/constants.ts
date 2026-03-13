/**
 * Debug Panel 常量
 */

// 角色状态名称映射（与 CharacterState 枚举对齐）
export const STATE_NAMES: Record<number, string> = {
  0: "站立", // Stand
  1: "站立1", // Stand1
  2: "行走", // Walk
  3: "奔跑", // Run
  4: "跳跃", // Jump
  5: "攻击", // Attack
  6: "攻击1", // Attack1
  7: "攻击2", // Attack2
  8: "施法", // Magic
  9: "受伤", // Hurt
  10: "打坐", // Sit
  11: "死亡", // Death
  12: "特殊", // Special
  13: "坐下过渡", // Sitting
  20: "持剑站立", // FightStand
  21: "持剑行走", // FightWalk
  22: "持剑奔跑", // FightRun
  23: "持剑跳跃", // FightJump
  24: "特殊攻击", // SpecialAttack
  255: "隐藏", // Hide
};

// localStorage keys
export const LS_SCRIPT_CONTENT = "debug_script_content";
export const LS_SCRIPT_CONTENT_LUA = "debug_script_content_lua";
export const LS_SCRIPT_HISTORY = "debug_script_history";
export const LS_SCRIPT_HISTORY_LUA = "debug_script_history_lua";
export const LS_SCRIPT_TAB = "debug_script_tab";
export const MAX_HISTORY = 20;

// 样式类 — VS Code Dark Theme
export const inputClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-[#d4d4d4] focus:outline-none focus:border-[#007acc]";
export const selectClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] border border-[#3c3c3c] text-[#d4d4d4] focus:outline-none focus:border-[#007acc] cursor-pointer [&>option]:text-[#d4d4d4] [&>option]:bg-[#252526]";
export const btnClass =
  "px-2 py-1 text-[11px] bg-[#3c3c3c] hover:bg-[#505050] text-[#d4d4d4] border border-[#505050] disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary =
  "px-2 py-1 text-[11px] bg-[#0e639c] hover:bg-[#1177bb] text-white border border-[#0e639c] disabled:opacity-50 disabled:cursor-not-allowed";
