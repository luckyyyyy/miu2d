/**
 * 文件系统类型定义
 */
import { z } from "zod";

/**
 * 文件/目录类型
 */
export const FileTypeSchema = z.enum(["file", "folder"]);
export type FileType = z.infer<typeof FileTypeSchema>;

/**
 * 文件/目录基础信息
 */
export const FileNodeSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  type: FileTypeSchema,
  /** 文件/目录的完整路径（从根目录开始） */
  path: z.string(),
  /** S3 存储键，仅文件有值 */
  storageKey: z.string().nullable(),
  /** 文件大小（字节），仅文件有值 */
  size: z.string().nullable(),
  /** MIME 类型，仅文件有值 */
  mimeType: z.string().nullable(),
  /** 文件内容校验和（SHA-256），仅文件有值 */
  checksum: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable()
});
export type FileNode = z.infer<typeof FileNodeSchema>;

/**
 * 列出目录内容请求
 */
export const ListFilesInputSchema = z.object({
  gameId: z.string().uuid(),
  /** 父目录 ID，null 表示根目录 */
  parentId: z.string().uuid().nullable().optional()
});
export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

/**
 * 创建目录请求
 */
export const CreateFolderInputSchema = z.object({
  gameId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255)
});
export type CreateFolderInput = z.infer<typeof CreateFolderInputSchema>;

/**
 * 准备上传请求（获取预签名 URL）
 */
export const PrepareUploadInputSchema = z.object({
  gameId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  mimeType: z.string().optional()
});
export type PrepareUploadInput = z.infer<typeof PrepareUploadInputSchema>;

/**
 * 准备上传响应
 */
export const PrepareUploadOutputSchema = z.object({
  fileId: z.string().uuid(),
  uploadUrl: z.string().url(),
  storageKey: z.string()
});
export type PrepareUploadOutput = z.infer<typeof PrepareUploadOutputSchema>;

/**
 * 确认上传完成请求
 */
export const ConfirmUploadInputSchema = z.object({
  fileId: z.string().uuid()
});
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;

/**
 * 获取下载 URL 请求
 */
export const GetDownloadUrlInputSchema = z.object({
  fileId: z.string().uuid()
});
export type GetDownloadUrlInput = z.infer<typeof GetDownloadUrlInputSchema>;

/**
 * 获取下载 URL 响应
 */
export const GetDownloadUrlOutputSchema = z.object({
  downloadUrl: z.string().url()
});
export type GetDownloadUrlOutput = z.infer<typeof GetDownloadUrlOutputSchema>;

/**
 * 获取上传 URL 请求（用于更新现有文件内容）
 */
export const GetUploadUrlInputSchema = z.object({
  fileId: z.string().uuid(),
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional()
});
export type GetUploadUrlInput = z.infer<typeof GetUploadUrlInputSchema>;

/**
 * 获取上传 URL 响应
 */
export const GetUploadUrlOutputSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string()
});
export type GetUploadUrlOutput = z.infer<typeof GetUploadUrlOutputSchema>;

/**
 * 重命名请求
 */
export const RenameFileInputSchema = z.object({
  fileId: z.string().uuid(),
  newName: z.string().min(1).max(255)
});
export type RenameFileInput = z.infer<typeof RenameFileInputSchema>;

/**
 * 移动文件/目录请求
 */
export const MoveFileInputSchema = z.object({
  fileId: z.string().uuid(),
  /** 新的父目录 ID，null 表示移动到根目录 */
  newParentId: z.string().uuid().nullable()
});
export type MoveFileInput = z.infer<typeof MoveFileInputSchema>;

/**
 * 删除文件/目录请求
 */
export const DeleteFileInputSchema = z.object({
  fileId: z.string().uuid()
});
export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;

/**
 * 获取文件路径请求
 */
export const GetFilePathInputSchema = z.object({
  fileId: z.string().uuid()
});
export type GetFilePathInput = z.infer<typeof GetFilePathInputSchema>;

/**
 * 路径节点
 */
export const PathNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
});
export type PathNode = z.infer<typeof PathNodeSchema>;

/**
 * 获取文件路径响应（从根到当前的路径）
 */
export const GetFilePathOutputSchema = z.object({
  path: z.array(PathNodeSchema)
});
export type GetFilePathOutput = z.infer<typeof GetFilePathOutputSchema>;
