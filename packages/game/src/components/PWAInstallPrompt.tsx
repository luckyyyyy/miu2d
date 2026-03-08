import { isPWA } from "@miu2d/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * PWAInstallPrompt - 游戏页面专属 PWA 安装提示
 *
 * beforeinstallprompt 由 main.tsx（同步入口）捕获到 window.__pwaPrompt，
 * 并 dispatch "pwa-prompt-ready" CustomEvent 通知本组件更新。
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaPrompt: Event | null;
    __pwaInstalled?: boolean;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface PWAInstallPromptProps {
  gameName: string;
  logoUrl?: string;
  /** 只在游戏配置加载完成后才显示提示 */
  ready: boolean;
}

const DISMISSED_KEY = "pwa_install_dismissed";

function isDismissedRecently(gameSlug: string): boolean {
  try {
    const raw = localStorage.getItem(`${DISMISSED_KEY}:${gameSlug}`);
    if (!raw) return false;
    return Date.now() - Number(raw) < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed(gameSlug: string) {
  try {
    localStorage.setItem(`${DISMISSED_KEY}:${gameSlug}`, String(Date.now()));
  } catch {
    // ignore
  }
}

export function PWAInstallPrompt({ gameName, logoUrl, ready }: PWAInstallPromptProps) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const gameSlugRef = useRef("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/game\/([^/]+)/);
    gameSlugRef.current = match?.[1] ?? "";
    if (gameSlugRef.current && isDismissedRecently(gameSlugRef.current)) {
      setDismissed(true);
    }
  }, []);

  // 订阅 main.tsx dispatch 的 CustomEvent，prompt 到达或 installed 时重渲染
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener("pwa-prompt-ready", handler);
    // 若事件在组件 mount 前已触发，直接读 window.__pwaPrompt
    if (window.__pwaPrompt) setTick((n) => n + 1);
    return () => window.removeEventListener("pwa-prompt-ready", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = window.__pwaPrompt as BeforeInstallPromptEvent | null;
    if (!prompt) return;
    window.__pwaPrompt = null;
    setTick((n) => n + 1);
    await prompt.prompt();
  }, []);

  const handleDismiss = useCallback(() => {
    if (gameSlugRef.current) markDismissed(gameSlugRef.current);
    setDismissed(true);
  }, []);

  if (!ready || !window.__pwaPrompt || dismissed || window.__pwaInstalled) {
    return null;
  }

  if (isPWA) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        left: "1rem",
        zIndex: 9998,
        background: "#0d0d1f",
        border: "1px solid #3a3a7a",
        borderRadius: "10px",
        padding: "10px 14px",
        color: "#e0e0ff",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
        fontSize: "13px",
        maxWidth: "340px",
      }}
    >
      {logoUrl && (
        <img
          src={logoUrl}
          alt={gameName}
          style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{gameName}</div>
        <div style={{ color: "#a0a0c0", fontSize: 12 }}>{t("pwa.installMessage", { gameName })}</div>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        style={{
          background: "#4a4aff",
          border: "none",
          borderRadius: "5px",
          color: "#fff",
          cursor: "pointer",
          padding: "5px 10px",
          fontSize: "12px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {t("pwa.installButton")}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "#a0a0c0",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
        }}
        aria-label={t("pwa.dismissButton")}
      >
        ×
      </button>
    </div>
  );
}
