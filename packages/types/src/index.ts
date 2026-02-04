/**
 * @miu2d/types - 共享类型定义
 *
 * 此包包含前后端共享的 Zod Schema 和 TypeScript 类型。
 */

export { UserSchema, UserSettingsSchema, UserSettingsPatchSchema } from "./user.js";
export type { User, UserSettings } from "./user.js";

export {
  GameSchema,
  CreateGameInputSchema,
  UpdateGameInputSchema,
  DeleteGameInputSchema
} from "./game.js";
export type {
  Game,
  CreateGameInput,
  UpdateGameInput,
  DeleteGameInput
} from "./game.js";

// 文件系统类型
export {
  FileTypeSchema,
  FileNodeSchema,
  ListFilesInputSchema,
  CreateFolderInputSchema,
  PrepareUploadInputSchema,
  PrepareUploadOutputSchema,
  ConfirmUploadInputSchema,
  GetDownloadUrlInputSchema,
  GetDownloadUrlOutputSchema,
  GetUploadUrlInputSchema,
  GetUploadUrlOutputSchema,
  RenameFileInputSchema,
  MoveFileInputSchema,
  DeleteFileInputSchema,
  GetFilePathInputSchema,
  PathNodeSchema,
  GetFilePathOutputSchema
} from "./file.js";
export type {
  FileType,
  FileNode,
  ListFilesInput,
  CreateFolderInput,
  PrepareUploadInput,
  PrepareUploadOutput,
  ConfirmUploadInput,
  GetDownloadUrlInput,
  GetDownloadUrlOutput,
  GetUploadUrlInput,
  GetUploadUrlOutput,
  RenameFileInput,
  MoveFileInput,
  DeleteFileInput,
  GetFilePathInput,
  PathNode,
  GetFilePathOutput
} from "./file.js";

// 武功类型
export {
  MagicMoveKindEnum,
  MagicMoveKindValues,
  MagicMoveKindFromValue,
  MagicMoveKindLabels,
  MagicSpecialKindEnum,
  MagicSpecialKindValues,
  MagicSpecialKindFromValue,
  MagicSpecialKindLabels,
  MagicUserTypeEnum,
  MagicBelongEnum,
  MagicBelongValues,
  MagicBelongFromValue,
  MagicBelongLabels,
  MagicRegionTypeEnum,
  MagicRegionTypeValues,
  MagicRegionTypeFromValue,
  MagicRegionTypeLabels,
  MagicLevelSchema,
  MagicBaseSchema,
  MagicSchema,
  MagicListItemSchema,
  CreateMagicInputSchema,
  UpdateMagicInputSchema,
  DeleteMagicInputSchema,
  ListMagicInputSchema,
  ImportMagicInputSchema,
  BatchImportMagicItemSchema,
  BatchImportMagicInputSchema,
  BatchImportMagicResultSchema,
  GetMagicInputSchema,
  AttackFileSchema,
  getVisibleFieldsByMoveKind,
  createDefaultLevels,
  createDefaultMagic,
  createDefaultAttackFile,
} from "./magic.js";
export type {
  MagicMoveKind,
  MagicSpecialKind,
  MagicUserType,
  MagicBelong,
  MagicRegionType,
  MagicLevel,
  MagicBase,
  Magic,
  MagicListItem,
  CreateMagicInput,
  UpdateMagicInput,
  DeleteMagicInput,
  ListMagicInput,
  ImportMagicInput,
  BatchImportMagicItem,
  BatchImportMagicInput,
  BatchImportMagicResult,
  GetMagicInput,
  AttackFile,
} from "./magic.js";
// 等级配置类型
export {
  LevelUserTypeEnum,
  LevelDetailSchema,
  LevelConfigSchema,
  LevelConfigListItemSchema,
  ListLevelConfigInputSchema,
  GetLevelConfigInputSchema,
  CreateLevelConfigInputSchema,
  UpdateLevelConfigInputSchema,
  DeleteLevelConfigInputSchema,
  ImportLevelConfigInputSchema,
  createDefaultLevelDetail,
  createDefaultLevels as createDefaultLevelConfigLevels,
  createDefaultLevelConfig,
} from "./level.js";
export type {
  LevelUserType,
  LevelDetail,
  LevelConfig,
  LevelConfigListItem,
  ListLevelConfigInput,
  GetLevelConfigInput,
  CreateLevelConfigInput,
  UpdateLevelConfigInput,
  DeleteLevelConfigInput,
  ImportLevelConfigInput,
} from "./level.js";

// 物品类型
export {
  GoodsKindEnum,
  GoodsKindValues,
  GoodsKindFromValue,
  GoodsKindLabels,
  GoodsPartEnum,
  GoodsPartLabels,
  GoodsEffectTypeEnum,
  GoodsEffectTypeLabels,
  getActualEffectType,
  getEffectTypeOptions,
  ConsumableDataSchema,
  EquipmentDataSchema,
  QuestDataSchema,
  GoodsSchema,
  GoodsListItemSchema,
  ListGoodsInputSchema,
  GetGoodsInputSchema,
  CreateGoodsInputSchema,
  UpdateGoodsInputSchema,
  DeleteGoodsInputSchema,
  ImportGoodsInputSchema,
  BatchImportGoodsItemSchema,
  BatchImportGoodsInputSchema,
  BatchImportGoodsResultSchema,
  getVisibleFieldsByKind,
  createDefaultGoods,
} from "./goods.js";
export type {
  GoodsKind,
  GoodsPart,
  GoodsEffectType,
  ConsumableData,
  EquipmentData,
  QuestData,
  Goods,
  GoodsListItem,
  ListGoodsInput,
  GetGoodsInput,
  CreateGoodsInput,
  UpdateGoodsInput,
  DeleteGoodsInput,
  ImportGoodsInput,
  BatchImportGoodsItem,
  BatchImportGoodsInput,
  BatchImportGoodsResult,
} from "./goods.js";