/**
 * 文件系统服务
 *
 * 使用 PostgreSQL 存储文件元数据，S3 存储文件内容
 * 重命名、移动等操作只需修改 PG 记录，无需操作 S3
 */

import type { FileNode } from "@miu2d/types";
import { Prisma } from "@prisma/client";
import type { File as PrismaFile } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import { getMessage, type Language } from "../../i18n";
import * as s3 from "../../storage/s3";
import { verifyGameAccess } from "../../utils/gameAccess";

/**
 * 将数据库记录转换为输出格式
 * @param dbFile 数据库文件记录
 * @param path 文件完整路径（可选，默认为文件名）
 */
export function toFileNodeOutput(dbFile: PrismaFile, path?: string): FileNode {
  return {
    id: dbFile.id,
    gameId: dbFile.gameId,
    parentId: dbFile.parentId,
    name: dbFile.name,
    type: dbFile.type as "file" | "folder",
    path: path ?? `/${dbFile.name}`,
    storageKey: dbFile.storageKey,
    size: dbFile.size,
    mimeType: dbFile.mimeType,
    checksum: dbFile.checksum,
    createdAt: dbFile.createdAt?.toISOString() ?? null,
    updatedAt: dbFile.updatedAt?.toISOString() ?? null,
  };
}

export class FileService {
  /**
   * 获取文件/目录的完整路径字符串
   * 递归获取父目录名称，组成完整路径
   */
  async buildFilePath(fileId: string): Promise<string> {
    const pathParts: string[] = [];
    let currentId: string | null = fileId;

    while (currentId) {
      const file: { id: string; name: string; parentId: string | null } | null = await db.file.findFirst({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });

      if (!file) break;

      pathParts.unshift(file.name);
      currentId = file.parentId;
    }

    return `/${pathParts.join("/")}`;
  }

  /**
   * 获取目录的完整路径（用于列表时计算子项路径）
   */
  async getDirectoryPath(parentId: string | null): Promise<string> {
    if (!parentId) return "";
    return this.buildFilePath(parentId);
  }

  /**
   * 列出目录内容
   */
  async listFiles(
    gameId: string,
    parentId: string | null | undefined,
    userId: string,
    language: Language
  ): Promise<FileNode[]> {
    await verifyGameAccess(gameId, userId, language);

    // 获取父目录路径
    const parentPath = await this.getDirectoryPath(parentId ?? null);

    const condition = parentId !== undefined && parentId !== null
      ? { gameId, parentId, deletedAt: null as null }
      : { gameId, parentId: null as null, deletedAt: null as null };

    const rows = await db.file.findMany({ where: condition });
    return rows.map((row) => toFileNodeOutput(row, `${parentPath}/${row.name}`));
  }

  /**
   * 创建目录
   */
  async createFolder(
    gameId: string,
    parentId: string | null | undefined,
    name: string,
    userId: string,
    language: Language
  ): Promise<FileNode> {
    await verifyGameAccess(gameId, userId, language);

    // 检查同名文件/目录
    await this.checkNameConflict(gameId, parentId ?? null, name, language);

    const folder = await db.file.create({
      data: { gameId, parentId: parentId ?? null, name, type: "folder" },
    });

    const parentPath = await this.getDirectoryPath(parentId ?? null);
    return toFileNodeOutput(folder, `${parentPath}/${folder.name}`);
  }

  /**
   * 检查名称冲突
   */
  private async checkNameConflict(
    gameId: string,
    parentId: string | null,
    name: string,
    language: Language,
    excludeId?: string
  ): Promise<void> {
    const condition = parentId !== null
      ? { gameId, parentId, name, deletedAt: null as null }
      : { gameId, parentId: null as null, name, deletedAt: null as null };

    const existing = await db.file.findFirst({ where: condition, select: { id: true } });

    if (existing && existing.id !== excludeId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: getMessage(language, "errors.file.nameConflict"),
      });
    }
  }

  /**
   * 准备上传（获取预签名 URL）
   */
  async prepareUpload(
    gameId: string,
    parentId: string | null | undefined,
    name: string,
    size: number,
    mimeType: string | undefined,
    userId: string,
    language: Language
  ): Promise<{ fileId: string; uploadUrl: string; storageKey: string }> {
    await verifyGameAccess(gameId, userId, language);

    // 检查同名文件/目录
    await this.checkNameConflict(gameId, parentId ?? null, name, language);

    // 创建文件记录（待确认状态）
    const file = await db.file.create({
      data: {
        gameId,
        parentId: parentId ?? null,
        name,
        type: "file",
        size: size.toString(),
        mimeType: mimeType ?? "application/octet-stream",
      },
    });

    // 生成 S3 存储键
    const storageKey = s3.generateStorageKey(gameId, file.id);

    // 更新存储键
    await db.file.update({ where: { id: file.id }, data: { storageKey } });

    // 获取预签名上传 URL
    const uploadUrl = await s3.getUploadUrl(storageKey, mimeType);

    return { fileId: file.id, uploadUrl, storageKey };
  }

  /**
   * 确认上传完成
   */
  async confirmUpload(fileId: string, userId: string, language: Language): Promise<FileNode> {
    // 获取文件记录
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    // 验证 S3 中文件存在
    if (file.storageKey && !(await s3.fileExists(file.storageKey))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(language, "errors.file.uploadNotComplete"),
      });
    }

    // 更新 updatedAt
    const updated = await db.file.update({ where: { id: fileId }, data: { updatedAt: new Date() } });

    const path = await this.buildFilePath(updated.id);
    return toFileNodeOutput(updated, path);
  }

  /**
   * 获取下载 URL
   */
  async getDownloadUrl(fileId: string, userId: string, language: Language): Promise<string> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    if (file.type !== "file" || !file.storageKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(language, "errors.file.notAFile"),
      });
    }

    return s3.getDownloadUrl(file.storageKey);
  }

  /**
   * 获取上传 URL（用于更新现有文件内容）
   */
  async getUploadUrl(
    fileId: string,
    size: number | undefined,
    mimeType: string | undefined,
    userId: string,
    language: Language
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    if (file.type !== "file") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(language, "errors.file.notAFile"),
      });
    }

    // 生成新的 storageKey，不覆盖原始文件
    const newStorageKey = s3.generateStorageKey(file.gameId, `${fileId}-${Date.now()}`);

    // 更新文件元数据和新的 storageKey
    await db.file.update({
      where: { id: fileId },
      data: {
        storageKey: newStorageKey,
        ...(size !== undefined && { size: size.toString() }),
        ...(mimeType !== undefined && { mimeType }),
        updatedAt: new Date(),
      },
    });

    const uploadUrl = await s3.getUploadUrl(newStorageKey, mimeType);
    return { uploadUrl, storageKey: newStorageKey };
  }

  /**
   * 重命名文件/目录
   */
  async rename(
    fileId: string,
    newName: string,
    userId: string,
    language: Language
  ): Promise<FileNode> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    // 检查同名冲突
    await this.checkNameConflict(file.gameId, file.parentId, newName, language, fileId);

    const updated = await db.file.update({ where: { id: fileId }, data: { name: newName, updatedAt: new Date() } });

    const path = await this.buildFilePath(updated.id);
    return toFileNodeOutput(updated, path);
  }

  /**
   * 移动文件/目录
   */
  async move(
    fileId: string,
    newParentId: string | null,
    userId: string,
    language: Language
  ): Promise<FileNode> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    // 验证目标目录存在且是目录
    if (newParentId) {
      const parent = await db.file.findFirst({
        where: { id: newParentId, gameId: file.gameId, deletedAt: null },
      });

      if (!parent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: getMessage(language, "errors.file.parentNotFound"),
        });
      }

      if (parent.type !== "folder") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getMessage(language, "errors.file.parentNotFolder"),
        });
      }

      // 防止将目录移动到自己的子目录中
      if (file.type === "folder") {
        const isDescendant = await this.isDescendant(newParentId, fileId);
        if (isDescendant) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getMessage(language, "errors.file.cannotMoveToDescendant"),
          });
        }
      }
    }

    // 检查同名冲突
    await this.checkNameConflict(file.gameId, newParentId, file.name, language, fileId);

    const updated = await db.file.update({ where: { id: fileId }, data: { parentId: newParentId, updatedAt: new Date() } });

    const path = await this.buildFilePath(updated.id);
    return toFileNodeOutput(updated, path);
  }

  /**
   * 检查 targetId 是否是 ancestorId 的后代
   */
  private async isDescendant(targetId: string, ancestorId: string): Promise<boolean> {
    let currentId: string | null = targetId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === ancestorId) return true;
      if (visited.has(currentId)) break; // 防止循环
      visited.add(currentId);

      const file: { parentId: string | null } | null = await db.file.findFirst({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = file?.parentId ?? null;
    }

    return false;
  }

  /**
   * 删除文件/目录
   */
  async delete(fileId: string, userId: string, language: Language): Promise<{ id: string }> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    // 软删除：只打标记，不删除数据库记录和 S3 文件
    await this.softDeleteRecursive(fileId);

    return { id: fileId };
  }

  /**
   * 递归收集文件/目录及其所有子项的 ID（仅未删除的节点）
   */
  private async collectAllIds(fileId: string): Promise<string[]> {
    const ids: string[] = [fileId];

    const children = await db.file.findMany({
      where: { parentId: fileId, deletedAt: null },
      select: { id: true },
    });

    for (const child of children) {
      const childIds = await this.collectAllIds(child.id);
      ids.push(...childIds);
    }

    return ids;
  }

  /**
   * 软删除文件/目录及其所有子项。
   * 先收集所有需要标记的 ID，再通过单次事务批量更新，避免部分更新后失败导致数据不一致。
   */
  private async softDeleteRecursive(fileId: string): Promise<void> {
    const allIds = await this.collectAllIds(fileId);
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.file.updateMany({ where: { id: { in: allIds } }, data: { deletedAt: now } });
    });
  }

  /**
   * 递归收集需要删除的 S3 存储键
   */
  private async collectStorageKeys(fileId: string, keys: string[]): Promise<void> {
    const file = await db.file.findFirst({ where: { id: fileId } });
    if (!file) return;

    if (file.type === "file" && file.storageKey) {
      keys.push(file.storageKey);
    } else if (file.type === "folder") {
      // 获取所有子文件
      const children = await db.file.findMany({ where: { parentId: fileId, deletedAt: null } });

      for (const child of children) {
        await this.collectStorageKeys(child.id, keys);
      }
    }
  }

  /**
   * 获取文件路径（从根到当前）
   */
  async getFilePath(
    fileId: string,
    userId: string,
    language: Language
  ): Promise<{ path: Array<{ id: string; name: string }> }> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    // 构建路径
    const path: Array<{ id: string; name: string }> = [];
    let currentId: string | null = fileId;

    while (currentId) {
      const current: { id: string; name: string; parentId: string | null } | null = await db.file.findFirst({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });

      if (!current) break;

      path.unshift({ id: current.id, name: current.name });
      currentId = current.parentId;
    }

    return { path };
  }

  /**
   * 获取文件信息
   */
  async getFile(fileId: string, userId: string, language: Language): Promise<FileNode> {
    const file = await db.file.findFirst({ where: { id: fileId, deletedAt: null } });

    if (!file) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.file.notFound"),
      });
    }

    await verifyGameAccess(file.gameId, userId, language);

    const path = await this.buildFilePath(file.id);
    return toFileNodeOutput(file, path);
  }

  /**
   * 批量准备上传（获取预签名 URL）
   * 一次性处理多个文件，显著减少网络往返
   */
  async batchPrepareUpload(
    gameId: string,
    fileItems: Array<{
      clientId: string;
      parentId: string | null | undefined;
      name: string;
      size: number;
      mimeType: string | undefined;
    }>,
    skipExisting: boolean,
    userId: string,
    language: Language
  ): Promise<
    Array<{
      clientId: string;
      fileId: string;
      uploadUrl: string;
      storageKey: string;
      skipped: boolean;
    }>
  > {
    await verifyGameAccess(gameId, userId, language);

    const results: Array<{
      clientId: string;
      fileId: string;
      uploadUrl: string;
      storageKey: string;
      skipped: boolean;
    }> = [];

    // 按 parentId 分组，批量检查同名冲突
    const byParent = new Map<string, typeof fileItems>();
    for (const item of fileItems) {
      const key = item.parentId ?? "__root__";
      const group = byParent.get(key) ?? [];
      group.push(item);
      byParent.set(key, group);
    }

    for (const [parentKey, items] of byParent) {
      const parentId = parentKey === "__root__" ? null : parentKey;
      const names = items.map((i) => i.name);

      // 批量查询该目录下已存在的文件名
      const existingFiles = await db.file.findMany({
        where: parentId
          ? { gameId, parentId, deletedAt: null, name: { in: names } }
          : { gameId, parentId: null, deletedAt: null, name: { in: names } },
        select: { id: true, name: true, storageKey: true },
      });

      const existingByName = new Map(existingFiles.map((f) => [f.name, f]));

      // 处理已存在的文件
      const newItems: typeof items = [];
      for (const item of items) {
        const existing = existingByName.get(item.name);

        if (existing) {
          if (skipExisting) {
            results.push({
              clientId: item.clientId,
              fileId: existing.id,
              uploadUrl: "",
              storageKey: existing.storageKey ?? "",
              skipped: true,
            });
            continue;
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: getMessage(language, "errors.file.nameConflict"),
          });
        }
        newItems.push(item);
      }

      if (newItems.length === 0) continue;

      // 预先生成 UUID 和 storageKey，避免 INSERT 后再 UPDATE
      const newFileRows = newItems.map((item) => {
        const id = crypto.randomUUID();
        const storageKey = s3.generateStorageKey(gameId, id);
        return {
          id,
          storageKey,
          clientId: item.clientId,
          mimeType: item.mimeType,
          row: {
            id,
            gameId,
            parentId: parentId,
            name: item.name,
            type: "file" as const,
            size: item.size.toString(),
            mimeType: item.mimeType ?? "application/octet-stream",
            storageKey,
          },
        };
      });

      // 一次批量 INSERT
      await db.file.createMany({ data: newFileRows.map((f) => f.row) });

      // 并行获取所有 presigned URL
      const uploadUrls = await Promise.all(
        newFileRows.map((f) => s3.getUploadUrl(f.storageKey, f.mimeType))
      );

      for (let i = 0; i < newFileRows.length; i++) {
        const f = newFileRows[i];
        results.push({
          clientId: f.clientId,
          fileId: f.id,
          uploadUrl: uploadUrls[i],
          storageKey: f.storageKey,
          skipped: false,
        });
      }
    }

    return results;
  }

  /**
   * 批量确认上传完成
   * 一次性确认多个文件，减少网络往返
   */
  async batchConfirmUpload(fileIds: string[], userId: string, language: Language): Promise<number> {
    if (fileIds.length === 0) return 0;

    // 验证所有文件存在且用户有权限
    const fileRecords = await db.file.findMany({
      where: { id: { in: fileIds }, deletedAt: null },
    });

    if (fileRecords.length === 0) return 0;

    // 验证对所有涉及的游戏有权限（通常只有一个）
    const gameIds = [...new Set(fileRecords.map((f) => f.gameId))];
    for (const gid of gameIds) {
      await verifyGameAccess(gid, userId, language);
    }

    // 批量验证 S3 中文件存在（并行检查）
    const validFileIds: string[] = [];
    const checks = fileRecords.map(async (file) => {
      if (file.storageKey && (await s3.fileExists(file.storageKey))) {
        validFileIds.push(file.id);
      }
    });
    await Promise.all(checks);

    if (validFileIds.length === 0) return 0;

    // 批量更新 updatedAt
    await db.file.updateMany({ where: { id: { in: validFileIds } }, data: { updatedAt: new Date() } });

    return validFileIds.length;
  }

  /**
   * 服务端创建文件夹路径（递归创建所有中间文件夹）
   * 如果文件夹已存在则复用，避免客户端逐级查询
   */
  async ensureFolderPath(
    gameId: string,
    parentId: string | null | undefined,
    pathParts: string[],
    userId: string,
    language: Language
  ): Promise<string> {
    await verifyGameAccess(gameId, userId, language);

    let currentParentId: string | null = parentId ?? null;

    for (const folderName of pathParts) {
      // 检查此层是否已存在
      const existing = await db.file.findFirst({
        where: currentParentId
          ? { gameId, parentId: currentParentId, name: folderName, type: "folder", deletedAt: null }
          : { gameId, parentId: null, name: folderName, type: "folder", deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        currentParentId = existing.id;
      } else {
        const folder = await db.file.create({
          data: { gameId, parentId: currentParentId, name: folderName, type: "folder" },
        });
        currentParentId = folder.id;
      }
    }

    return currentParentId!;
  }
}

export const fileService = new FileService();
