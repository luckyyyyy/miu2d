/**
 * S3/MinIO 存储服务
 *
 * 用于存储文件内容，元数据存储在 PostgreSQL
 * S3 key 格式: {gameId}/{fileId}
 */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";
import { Logger } from "../utils/logger.js";

const logger = new Logger("S3Storage");

/**
 * S3 内部配置（server-to-MinIO，用于实际数据传输）
 */
const s3Config = {
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
  forcePathStyle: true, // MinIO 需要
};

const bucket = env.s3Bucket;

/**
 * 公开访问的 S3 endpoint
 * 开发环境下使用 /s3 前缀，由 Vite 代理转发到 MinIO
 * 生产环境可设置为 CDN 或公网 MinIO 地址
 *
 * 注意：presigned URL 必须用此 endpoint 生成签名，否则 host 不匹配导致 403
 */
const s3PublicEndpoint = env.s3PublicEndpoint;

/**
 * S3 客户端单例（内部使用，用于服务端直接上传/下载）
 */
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client(s3Config);
    logger.log(`S3 client initialized, endpoint: ${s3Config.endpoint}`);
  }
  return s3Client;
}

/**
 * S3 客户端单例（用于生成 presigned URL，使用公开 endpoint）
 *
 * presigned URL 中的签名包含 host，必须与前端实际请求的 host 一致。
 * 若用内部 endpoint 生成再做字符串替换，MinIO 校验 host 时会失败 → 403。
 */
let s3PublicClient: S3Client | null = null;

function getS3PublicClient(): S3Client {
  if (!s3PublicClient) {
    // 开发模式下 s3PublicEndpoint 为 "/s3"（相对路径），不是合法 URL，
    // 回退到内部 endpoint（Vite 代理会转发，host 校验不严格）
    const isAbsoluteUrl =
      s3PublicEndpoint.startsWith("http://") || s3PublicEndpoint.startsWith("https://");
    const endpoint = isAbsoluteUrl ? s3PublicEndpoint : s3Config.endpoint;
    s3PublicClient = new S3Client({
      ...s3Config,
      endpoint,
    });
    logger.log(`S3 public client initialized, endpoint: ${endpoint}`);
  }
  return s3PublicClient;
}

/**
 * 将 S3 存储键转为公开访问 URL
 * 格式: {s3PublicEndpoint}/{bucket}/{key}
 */
export function getPublicFileUrl(storageKey: string): string {
  return `${s3PublicEndpoint}/${bucket}/${storageKey}`;
}

/**
 * 生成 S3 存储键
 */
export function generateStorageKey(gameId: string, fileId: string): string {
  return `games/${gameId}/${fileId}`;
}

/**
 * 上传文件到 S3
 */
export async function uploadFile(
  storageKey: string,
  content: Buffer | Uint8Array,
  mimeType?: string
): Promise<void> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: content,
      ContentType: mimeType || "application/octet-stream",
    })
  );

  logger.debug(`Uploaded file: ${storageKey}`);
}

/**
 * 从 S3 下载文件
 */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const client = getS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${storageKey}`);
  }

  // 将 stream 转换为 Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 流式下载文件（不加载到内存）
 * 返回可读流和元数据，用于直接管道传输到 HTTP 响应
 *
 * @param storageKey - S3 对象 key
 * @param ifNoneMatch - 可选 ETag，用于条件请求（304 Not Modified）
 */
export async function getFileStream(
  storageKey: string,
  ifNoneMatch?: string
): Promise<{
  stream: AsyncIterable<Uint8Array>;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
  notModified?: boolean;
}> {
  const client = getS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        IfNoneMatch: ifNoneMatch,
      })
    );

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${storageKey}`);
    }

    return {
      stream: response.Body as AsyncIterable<Uint8Array>,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      etag: response.ETag,
    };
  } catch (err: unknown) {
    // S3 returns 304 Not Modified when ETag matches IfNoneMatch
    if (
      err &&
      typeof err === "object" &&
      "$metadata" in err &&
      (err as { $metadata: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 304
    ) {
      return {
        stream: (async function* () {})(),
        contentType: undefined,
        contentLength: 0,
        etag: ifNoneMatch,
        notModified: true,
      };
    }
    throw err;
  }
}

/**
 * 获取文件的预签名下载 URL
 */
export async function getDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const client = getS3PublicClient();

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
    { expiresIn }
  );

  return url;
}

/**
 * 获取文件的预签名上传 URL
 */
export async function getUploadUrl(
  storageKey: string,
  mimeType?: string,
  expiresIn = 3600
): Promise<string> {
  const client = getS3PublicClient();

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: mimeType || "application/octet-stream",
    }),
    { expiresIn }
  );

  return url;
}

/**
 * 删除单个文件
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );

  logger.debug(`Deleted file: ${storageKey}`);
}

/**
 * 批量删除文件
 */
export async function deleteFiles(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return;

  const client = getS3Client();

  // S3 每次最多删除 1000 个对象
  const batchSize = 1000;
  for (let i = 0; i < storageKeys.length; i += batchSize) {
    const batch = storageKeys.slice(i, i + batchSize);

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
        },
      })
    );
  }

  logger.debug(`Deleted ${storageKeys.length} files`);
}

/**
 * 检查文件是否存在
 */
export async function fileExists(storageKey: string): Promise<boolean> {
  const client = getS3Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
    return true;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * 复制文件（用于某些特殊场景，正常重命名/移动不需要）
 */
export async function copyFile(sourceKey: string, destKey: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destKey,
    })
  );

  logger.debug(`Copied file: ${sourceKey} -> ${destKey}`);
}

/**
 * 获取文件内容为字符串
 * 用于读取 JSON 等文本文件
 */
export async function getObject(storageKey: string): Promise<string | null> {
  try {
    const buffer = await downloadFile(storageKey);
    return buffer.toString("utf-8");
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "NoSuchKey") {
      return null;
    }
    throw error;
  }
}

/**
 * 保存字符串内容到文件
 * 用于保存 JSON 等文本文件
 */
export async function putObject(
  storageKey: string,
  content: string,
  mimeType = "application/json"
): Promise<void> {
  await uploadFile(storageKey, Buffer.from(content, "utf-8"), mimeType);
}

/**
 * 删除单个对象（别名）
 */
export async function deleteObject(storageKey: string): Promise<void> {
  await deleteFile(storageKey);
}
