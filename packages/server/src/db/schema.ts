import { jsonb, pgTable, text, timestamp, uuid, integer, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  settings: jsonb("settings"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});

/**
 * 游戏表（原 workspaces，重命名为 games）
 */
export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * 游戏成员表
 */
export const gameMembers = pgTable("game_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * 文件系统表
 * 使用 PostgreSQL 存储文件元数据，S3 只存储文件内容
 * 这样重命名、移动等操作只需修改 PG 记录，无需操作 S3
 */
export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏 */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 父目录 ID，null 表示根目录（自引用外键，应用层处理级联删除） */
  parentId: uuid("parent_id"),
  /** 文件/目录名 */
  name: text("name").notNull(),
  /** 类型：file 或 folder */
  type: text("type", { enum: ["file", "folder"] }).notNull(),
  /** S3 存储键，仅文件有值，格式: {gameId}/{fileId} */
  storageKey: text("storage_key"),
  /** 文件大小（字节），仅文件有值 */
  size: text("size"),
  /** MIME 类型，仅文件有值 */
  mimeType: text("mime_type"),
  /** 文件内容校验和（SHA-256），仅文件有值 */
  checksum: text("checksum"),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  /** 软删除时间，null 表示未删除 */
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

/**
 * 武功表
 * 使用简化设计：只存储索引字段 + 完整的 JSON 数据
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const magics = pgTable("magics", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（索引字段，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 武功类型（索引字段）: player / npc */
  userType: text("user_type", { enum: ["player", "npc"] }).notNull().default("player"),
  /** 武功名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** 完整武功配置（JSONB，存储 Magic 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("magics_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 等级配置表
 * 存储玩家和 NPC 的等级属性配置
 * 类型定义在 @miu2d/types 中
 */
export const levelConfigs = pgTable("level_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（如 level-easy, level-hard, level-npc） */
  key: text("key").notNull(),
  /** 配置名称（如 "简单模式", "困难模式"） */
  name: text("name").notNull(),
  /** 配置类型: player / npc */
  userType: text("user_type", { enum: ["player", "npc"] }).notNull().default("player"),
  /** 最大等级数 */
  maxLevel: integer("max_level").notNull().default(80),
  /** 等级数据（JSONB，存储 LevelDetail[] 数组） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("level_configs_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 物品表
 * 使用简化设计：只存储索引字段 + 完整的 JSON 数据
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const goods = pgTable("goods", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（索引字段，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 物品种类（索引字段）: Consumable / Equipment / Quest */
  kind: text("kind", { enum: ["Consumable", "Equipment", "Quest"] }).notNull().default("Consumable"),
  /** 完整物品配置（JSONB，存储 Goods 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("goods_game_id_key_unique").on(t.gameId, t.key)
]);

