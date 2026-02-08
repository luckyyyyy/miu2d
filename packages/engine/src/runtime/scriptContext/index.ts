/**
 * scriptContext/ - Shared types and helpers used by gameAPI/ implementations
 *
 * The old command files (playerCommands, npcCommands, etc.) have been replaced
 * by the structured GameAPI in runtime/gameAPI/.
 */
export type { ScriptCommandContext } from "./types";
export { isCharacterMoveEnd } from "./helpers";
