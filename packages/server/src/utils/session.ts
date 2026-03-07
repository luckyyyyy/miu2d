/**
 * 共享的会话解析工具
 *
 * 从 HTTP cookie 中提取 userId，供 tRPC context 和 Hono REST routes 共用。
 * 确保 tRPC 和 REST 端点使用完全相同的 cookie 名称和查询逻辑。
 */
import { db } from "../db/client";
import { DEMO_DEV_USER_ID, isDev } from "./demo";

export const SESSION_COOKIE_NAME = "SESSION_ID";

/**
 * 从 cookie 字符串中提取指定 key 的值
 */
export function getCookieValue(
  cookieHeader: string | undefined | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : undefined;
}

/**
 * 从 cookie 字符串解析出当前登录的 userId
 *
 * 开发模式下，未登录时返回 DEMO_DEV_USER_ID。
 */
export async function resolveUserId(
  cookieHeader: string | undefined | null
): Promise<string | undefined> {
  const sessionId = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  let userId: string | undefined;

  if (sessionId) {
    const session = await db.session.findFirst({
      where: { id: sessionId, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
    userId = session?.userId;
  }

  if (!userId && isDev()) {
    userId = DEMO_DEV_USER_ID;
  }

  return userId;
}
