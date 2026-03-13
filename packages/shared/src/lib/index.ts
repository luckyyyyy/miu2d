export type {
  GameConfigResponse,
  GameDataResponse,
  LevelConfigData,
  LevelResponse,
  MagicResponse,
  NpcData,
  NpcResData,
  NpcResponse,
  ObjData,
  ObjResData,
  ObjResponse,
} from "./game-api";
export {
  fetchGameApi,
  fetchGameApiBinary,
  getResourceDomain,
  getResourceUrl,
} from "./game-api";
export { isPWA } from "./pwa";
export { trpc, trpcClient } from "./trpc";
