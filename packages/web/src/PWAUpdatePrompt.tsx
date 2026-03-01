import { isPWA } from "@miu2d/shared";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * PWAUpdatePrompt - 监听 Service Worker 更新，提示用户刷新以获取新版本
 *
 * 由于引擎迭代频繁，当检测到新版本时主动提示用户，
 * 避免用户长时间使用旧版缓存。
 */

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // 普通浏览器始终能通过刷新获取最新资源，提示无必要；
  // 只在已安装的 PWA（standalone 模式）中才显示更新提示。
  if (!needRefresh || !isPWA) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        zIndex: 9999,
        background: "#1a1a2e",
        border: "1px solid #4a4a8a",
        borderRadius: "8px",
        padding: "12px 16px",
        color: "#e0e0ff",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        fontSize: "14px",
        maxWidth: "320px",
      }}
    >
      <span>🎮 {t("pwa.updateMessage")}</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        style={{
          background: "#4a4aff",
          border: "none",
          borderRadius: "4px",
          color: "#fff",
          cursor: "pointer",
          padding: "4px 12px",
          fontSize: "13px",
          whiteSpace: "nowrap",
        }}
      >
        {t("pwa.updateButton")}
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        style={{
          background: "transparent",
          border: "none",
          color: "#a0a0c0",
          cursor: "pointer",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 4px",
        }}
        aria-label={t("pwa.dismissButton")}
      >
        ×
      </button>
    </div>
  );
}
