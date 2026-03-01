import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * PWAUpdatePrompt - 监听 Service Worker 更新，全屏阻挡提示用户必须刷新
 *
 * 由于引擎迭代频繁，当检测到新版本时以全屏遮罩强制提示用户刷新，
 * 避免用户使用旧版缓存导致异常。
 */

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    // 先直接 reload，不等待 SW 异步回调，避免用户感知延迟
    updateServiceWorker(true);
    window.location.reload();
  };

  return (
    // 全屏遮罩，阻挡所有交互
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          border: "1px solid #4a4a8a",
          borderRadius: "12px",
          padding: "32px 40px",
          color: "#e0e0ff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
          maxWidth: "360px",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "40px" }}>🎮</span>
        <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6 }}>
          {t("pwa.updateMessage")}
        </p>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          style={{
            background: isUpdating ? "#3a3a8a" : "#4a4aff",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            cursor: isUpdating ? "default" : "pointer",
            padding: "10px 28px",
            fontSize: "14px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            opacity: isUpdating ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {isUpdating ? "..." : t("pwa.updateButton")}
        </button>
      </div>
    </div>
  );
}
