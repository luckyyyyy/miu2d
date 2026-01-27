/**
 * Game Manager - Index file
 * Re-exports all game management components
 */
export { GameManager } from "./gameManager";
export type { GameManagerConfig } from "./gameManager";

export { Loader } from "./loader";
export type { LoaderDependencies } from "./loader";

export { createScriptContext } from "./scriptContextFactory";
export type { ScriptContextDependencies } from "./scriptContextFactory";

export { MapTrapManager, getMapTrapManager } from "./mapTrapManager";

export { CollisionChecker } from "./collisionChecker";

export { CameraController } from "./cameraController";

export { MagicHandler } from "./magicHandler";
export type { MagicHandlerDependencies } from "./magicHandler";

export { InputHandler } from "./inputHandler";
export type { InputHandlerDependencies } from "./inputHandler";

export { SpecialActionHandler } from "./specialActionHandler";
export type { SpecialActionHandlerDependencies } from "./specialActionHandler";

export { InteractionManager, EdgeColors } from "./interactionManager";
export type { InteractionTarget, ObjInteractionState, InteractionTargetType } from "./interactionManager";

// Game Engine (Singleton)
export { GameEngine, getGameEngine } from "./gameEngine";
export type { GameEngineConfig, GameEngineState, CanvasRenderInfo } from "./gameEngine";
