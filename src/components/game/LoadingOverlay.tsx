/**
 * LoadingOverlay - Loading screen component
 * Extracted from Game.tsx for better code organization
 */
import React from "react";

interface LoadingOverlayProps {
  isLoading: boolean;
  progress: number;
  text?: string;
}

/**
 * Loading Overlay Component
 * Displays loading progress while game resources are being loaded
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  progress,
  text = "加载中...",
}) => {
  if (!isLoading) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        zIndex: 100,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 20 }}>{text}</div>
      <div
        style={{
          width: 200,
          height: 8,
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: "#4a90d9",
            borderRadius: 4,
            transition: "width 0.2s ease",
          }}
        />
      </div>
      <div style={{ marginTop: 10, fontSize: 14, color: "#888" }}>
        {Math.round(progress * 100)}%
      </div>
    </div>
  );
};
