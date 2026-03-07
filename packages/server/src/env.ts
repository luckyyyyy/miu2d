/**
 * 服务端环境变量集中配置
 *
 * 所有 process.env.* 的读取统一收口到这里，其余模块只 import env 对象。
 * 好处：
 * - 环境变量名称有一个 single source of truth
 * - 默认值一目了然
 * - 更换变量名 / 加校验只改这一个文件
 */

function str(key: string, defaultValue = ""): string {
  return process.env[key] || defaultValue;
}

function num(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = Number(v);
  return Number.isNaN(n) ? defaultValue : n;
}

function bool(key: string, defaultValue = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  return v === "true" || v === "1";
}

// ======================== 导出 ========================

export const env = {
  /** 当前运行环境 */
  nodeEnv: str("NODE_ENV", "development"),
  get isDev() {
    return this.nodeEnv !== "production";
  },
  get isProd() {
    return this.nodeEnv === "production";
  },

  // ---------- Server ----------
  port: num("PORT", 4000),

  // ---------- Database ----------
  databaseUrl: str("DATABASE_URL"),

  // ---------- S3 / MinIO ----------
  s3Endpoint: str("S3_ENDPOINT", "http://localhost:9100"),
  s3Region: str("S3_REGION", "us-east-1"),
  s3AccessKey: str("MINIO_ROOT_USER", "minio"),
  s3SecretKey: str("MINIO_ROOT_PASSWORD", "minio123"),
  s3Bucket: str("MINIO_BUCKET", "miu2d"),
  /** 客户端可访问的 S3 endpoint（开发走代理，生产走 CDN） */
  s3PublicEndpoint: str("S3_PUBLIC_ENDPOINT", "/s3"),

  // ---------- Email / SMTP ----------
  smtpHost: str("SMTP_HOST"),
  smtpPort: num("SMTP_PORT", 587),
  smtpSecure: bool("SMTP_SECURE"),
  smtpUser: str("SMTP_USER"),
  smtpPass: str("SMTP_PASS"),
  smtpFrom: str("SMTP_FROM", "Miu2D Engine <noreply@miu2d.com>"),
  appUrl: str("APP_URL", "http://localhost:5274"),
  get isEmailEnabled() {
    return !!(this.smtpHost && this.smtpUser && this.smtpPass);
  },

  // ---------- Session / Cookie ----------
  /** 显式指定 cookie secure 标志；未设置时跟随 NODE_ENV */
  sessionCookieSecure: process.env.SESSION_COOKIE_SECURE !== undefined
    ? bool("SESSION_COOKIE_SECURE")
    : undefined,
  /** cookie 是否 secure（优先用显式配置，否则 production = true） */
  get cookieSecure(): boolean {
    return this.sessionCookieSecure ?? this.isProd;
  },
} as const;
