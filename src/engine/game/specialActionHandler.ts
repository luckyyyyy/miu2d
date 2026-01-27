/**
 * Special Action Handler - Manages special action state updates
 * Extracted from GameManager to reduce complexity
 *
 * C# Reference: Character.Update checks IsPlayCurrentDirOnceEnd()
 */
import { CharacterState } from "../core/types";
import type { Player } from "../character/player";
import type { NpcManager } from "../character/npcManager";
import type { MagicManager } from "../magic";
import type { MagicHandler } from "./magicHandler";

/**
 * Dependencies for SpecialActionHandler
 */
export interface SpecialActionHandlerDependencies {
  player: Player;
  npcManager: NpcManager;
  magicManager: MagicManager;
  getMagicHandler: () => MagicHandler;
}

/**
 * SpecialActionHandler - Manages special action completion checks
 */
export class SpecialActionHandler {
  private deps: SpecialActionHandlerDependencies;

  constructor(deps: SpecialActionHandlerDependencies) {
    this.deps = deps;
  }

  /**
   * Update special action states
   * C# Reference: Character.Update checks IsPlayCurrentDirOnceEnd()
   */
  update(): void {
    this.updatePlayerSpecialAction();
    this.updateNpcSpecialActions();
  }

  /**
   * Update player special action
   */
  private updatePlayerSpecialAction(): void {
    const { player, magicManager } = this.deps;
    const magicHandler = this.deps.getMagicHandler();

    if (player.isInSpecialAction) {
      console.log(`[SpecialAction] Checking player special action end...`);
      if (player.isSpecialActionEnd()) {
        // Save state BEFORE endSpecialAction() changes it to Stand
        const previousState = player.state;
        console.log(`[SpecialAction] Player special action ended, previous state: ${previousState}`);
        player.endSpecialAction();

        // C# Reference: Character.Update() Magic state - release magic when animation ends
        // if (IsPlayCurrentDirOnceEnd()) { MagicManager.UseMagic(...) }
        const pendingMagic = magicHandler.getPendingMagic();
        if (previousState === CharacterState.Magic && pendingMagic) {
          console.log(`[Magic] Releasing ${pendingMagic.magic.name} after casting animation`);
          magicManager.useMagic({
            userId: "player",
            magic: pendingMagic.magic,
            origin: pendingMagic.origin,
            destination: pendingMagic.destination,
          });
          magicHandler.clearPendingMagic();
        }

        // State is already set to Stand by endSpecialAction(), no need to set again
      }
    }
  }

  /**
   * Update NPC special actions
   */
  private updateNpcSpecialActions(): void {
    const { npcManager } = this.deps;

    // Use getAllNpcs to get Npc class instances
    for (const [, npc] of npcManager.getAllNpcs()) {
      if (npc.isInSpecialAction) {
        if (npc.isSpecialActionEnd()) {
          console.log(`[SpecialAction] NPC "${npc.config.name}" special action ended`);
          npc.endSpecialAction();

          // Return NPC to Stand state
          if (
            npc.state === CharacterState.Magic ||
            npc.state === CharacterState.Attack ||
            npc.state === CharacterState.Attack1 ||
            npc.state === CharacterState.Attack2
          ) {
            npc.state = CharacterState.Stand;
          }
        }
      }
    }
  }
}
