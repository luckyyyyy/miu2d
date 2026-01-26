/**
 * Command Registry - Central registry for all script commands
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandRegistry } from "./types";
import { registerDialogCommands } from "./dialogCommands";
import { registerPlayerCommands } from "./playerCommands";
import { registerNpcCommands } from "./npcCommands";
import { registerGameStateCommands } from "./gameStateCommands";
import { registerMiscCommands } from "./miscCommands";

/**
 * Create and populate the command registry with all available commands
 */
export function createCommandRegistry(): CommandRegistry {
  const registry: CommandRegistry = new Map();

  // Register all command groups
  registerDialogCommands(registry);
  registerPlayerCommands(registry);
  registerNpcCommands(registry);
  registerGameStateCommands(registry);
  registerMiscCommands(registry);

  return registry;
}

// Re-export types
export type { CommandHandler, CommandHelpers, CommandRegistry, ScriptContext } from "./types";
