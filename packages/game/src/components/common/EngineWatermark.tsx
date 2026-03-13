import type React from "react";

interface EngineWatermarkProps {
  zIndex?: number;
}

export const EngineWatermark: React.FC<EngineWatermarkProps> = ({ zIndex }) => (
  <div
    style={{
      position: "absolute",
      right: 8,
      bottom: 4,
      fontSize: 10,
      color: "rgba(255, 255, 255, 0.25)",
      pointerEvents: "none",
      userSelect: "none",
      fontFamily: "sans-serif",
      letterSpacing: 0.5,
      textAlign: "right",
      ...(zIndex !== undefined ? { zIndex } : {}),
    }}
  >
    <div>
      Powered by Miu2D Engine · v{__APP_VERSION__} · #{__COMMIT_HASH__}
    </div>
    <div>游戏资源版权归原作者所有，如您介意请联系我删除，本项目仅用于交流学习</div>
  </div>
);
