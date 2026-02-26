/**
 * TitleGui Component - Modern web title screen
 * Clean, no-resource title screen with game name and two menu options
 */

import type React from "react";
import { useEffect, useInsertionEffect, useRef, useState } from "react";

// 注入动画 CSS（一次性）
const CSS = `
@keyframes titleGlow {
  0%, 100% { text-shadow: 0 0 30px rgba(200,150,60,0.4), 0 0 80px rgba(180,120,40,0.15), 0 2px 8px rgba(0,0,0,0.8); }
  50% { text-shadow: 0 0 60px rgba(220,170,70,0.7), 0 0 120px rgba(200,140,50,0.3), 0 2px 8px rgba(0,0,0,0.8); }
}
@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.22; }
  33% { transform: translate(4%, -6%) scale(1.08); opacity: 0.32; }
  66% { transform: translate(-3%, 5%) scale(0.94); opacity: 0.18; }
}
@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.18; }
  40% { transform: translate(-5%, 4%) scale(1.12); opacity: 0.28; }
  75% { transform: translate(3%, -7%) scale(0.9); opacity: 0.14; }
}
@keyframes orbFloat3 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
  50% { transform: translate(6%, 3%) scale(1.15); opacity: 0.25; }
}
@keyframes auroraShift {
  0% { transform: skewX(-12deg) translateX(-10%); opacity: 0.08; }
  50% { transform: skewX(-8deg) translateX(5%); opacity: 0.14; }
  100% { transform: skewX(-12deg) translateX(-10%); opacity: 0.08; }
}
@keyframes auroraShift2 {
  0% { transform: skewX(10deg) translateX(5%); opacity: 0.06; }
  50% { transform: skewX(14deg) translateX(-8%); opacity: 0.12; }
  100% { transform: skewX(10deg) translateX(5%); opacity: 0.06; }
}
@keyframes scanSweep {
  0% { transform: translateY(-100%); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(100vh); opacity: 0; }
}
@keyframes linePulse {
  0%, 100% { opacity: 0.5; width: 40px; }
  50% { opacity: 1; width: 60px; }
}
@keyframes dotPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.6); }
}
`;

interface TitleGuiProps {
  gameSlug?: string;
  gameName?: string;
  screenWidth?: number;
  screenHeight?: number;
  onNewGame: () => void;
  onLoadGame: () => void;
  onTeam?: () => void;
  onExit?: () => void;
  onMapViewer?: () => void;
}

// 粒子类型
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  fadeDir: number;
}

function useParticles(count: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  // 注入动画 CSS
  useInsertionEffect(() => {
    if (document.getElementById("title-gui-css")) return;
    const style = document.createElement("style");
    style.id = "title-gui-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 初始化粒子
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      fadeDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += p.fadeDir * 0.003;
        if (p.opacity > 0.6 || p.opacity < 0.05) p.fadeDir *= -1;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 160, 220, ${p.opacity})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [count]);

  return canvasRef;
}

interface MenuButtonProps {
  label: string;
  sub?: string;
  onClick: () => void;
  primary?: boolean;
  delay?: number;
}

const MenuButton: React.FC<MenuButtonProps> = ({ label, sub, onClick, primary = false, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: 260,
        padding: "14px 28px",
        background: hovered
          ? primary
            ? "rgba(180, 140, 80, 0.25)"
            : "rgba(255,255,255,0.08)"
          : primary
            ? "rgba(180, 140, 80, 0.12)"
            : "rgba(255,255,255,0.04)",
        border: `1px solid ${
          hovered
            ? primary
              ? "rgba(220, 180, 100, 0.7)"
              : "rgba(255,255,255,0.35)"
            : primary
              ? "rgba(200, 160, 80, 0.4)"
              : "rgba(255,255,255,0.12)"
        }`,
        borderRadius: 4,
        cursor: "pointer",
        transition: "all 0.2s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? "translateX(6px)" : "translateX(0)") : "translateX(-20px)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: hovered && primary ? "0 0 24px rgba(200,160,60,0.2)" : "none",
      }}
    >
      {/* 左侧竖线装饰 */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: "20%",
          height: "60%",
          width: 2,
          background: primary
            ? hovered
              ? "rgba(230,180,80,0.9)"
              : "rgba(200,160,60,0.5)"
            : hovered
              ? "rgba(255,255,255,0.6)"
              : "rgba(255,255,255,0.2)",
          borderRadius: 2,
          transition: "all 0.2s",
        }}
      />
      <span
        style={{
          flex: 1,
          textAlign: "left",
          paddingLeft: 8,
        }}
      >
        <span
          style={{
            display: "block",
            fontFamily: '"STKaiti", "楷体", serif',
            fontSize: 20,
            letterSpacing: "0.12em",
            color: primary
              ? hovered
                ? "rgba(255, 220, 120, 1)"
                : "rgba(230, 195, 100, 0.9)"
              : hovered
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.75)",
            transition: "color 0.2s",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {sub && (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              marginTop: 2,
              letterSpacing: "0.05em",
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {/* 右侧箭头 */}
      <span
        style={{
          fontSize: 14,
          color: primary ? "rgba(230,190,80,0.6)" : "rgba(255,255,255,0.25)",
          transition: "transform 0.2s, color 0.2s",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
        }}
      >
        ›
      </span>
    </button>
  );
};

export const TitleGui: React.FC<TitleGuiProps> = ({
  gameName,
  onNewGame,
  onLoadGame,
}) => {
  const canvasRef = useParticles(60);
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTitleVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const displayName = gameName || "游戏";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "radial-gradient(ellipse at 30% 40%, #1a0e2e 0%, #0d0813 50%, #060309 100%)",
      }}
    >
      {/* 粒子背景 */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />

      {/* ── 光影层 ── */}

      {/* 主光晕：左上角紫色大球 */}
      <div
        style={{
          position: "absolute",
          left: "-5%",
          top: "-15%",
          width: "65%",
          height: "90%",
          background: "radial-gradient(ellipse, rgba(90,45,140,0.35) 0%, rgba(60,20,100,0.15) 40%, transparent 70%)",
          animation: "orbFloat1 14s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* 副光晕：右下角橙红色 */}
      <div
        style={{
          position: "absolute",
          right: "-8%",
          bottom: "-10%",
          width: "55%",
          height: "70%",
          background: "radial-gradient(ellipse, rgba(160,70,20,0.28) 0%, rgba(120,40,10,0.12) 40%, transparent 70%)",
          animation: "orbFloat2 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* 中心蓝紫光晕 */}
      <div
        style={{
          position: "absolute",
          left: "30%",
          top: "25%",
          width: "45%",
          height: "55%",
          background: "radial-gradient(ellipse, rgba(60,80,180,0.18) 0%, transparent 65%)",
          animation: "orbFloat3 22s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* 小焦点光：标题区域金色补光 */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: "30%",
          width: "35%",
          height: "35%",
          background: "radial-gradient(ellipse, rgba(200,150,50,0.14) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* 极光带 1 */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "-20%",
          width: "140%",
          height: "22%",
          background: "linear-gradient(180deg, transparent 0%, rgba(100,60,180,0.12) 40%, rgba(80,140,200,0.1) 60%, transparent 100%)",
          animation: "auroraShift 12s ease-in-out infinite",
          pointerEvents: "none",
          filter: "blur(12px)",
        }}
      />
      {/* 极光带 2 */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "-20%",
          width: "140%",
          height: "18%",
          background: "linear-gradient(180deg, transparent 0%, rgba(180,80,40,0.1) 30%, rgba(200,120,60,0.08) 60%, transparent 100%)",
          animation: "auroraShift2 16s ease-in-out infinite",
          pointerEvents: "none",
          filter: "blur(16px)",
        }}
      />
      {/* 极光带 3（蓝绿冷色调） */}
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          left: "-20%",
          width: "140%",
          height: "14%",
          background: "linear-gradient(180deg, transparent 0%, rgba(40,160,160,0.09) 50%, transparent 100%)",
          animation: "auroraShift 20s ease-in-out infinite reverse",
          pointerEvents: "none",
          filter: "blur(20px)",
        }}
      />

      {/* 扫光线（慢速扫过） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent 0%, rgba(200,160,80,0.0) 20%, rgba(200,160,80,0.18) 50%, rgba(200,160,80,0.0) 80%, transparent 100%)",
          animation: "scanSweep 10s linear infinite",
          pointerEvents: "none",
          filter: "blur(1px)",
        }}
      />

      {/* 底部边缘光 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "120px",
          background: "linear-gradient(0deg, rgba(80,30,120,0.2) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      {/* 顶部边缘光 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(180deg, rgba(30,10,60,0.4) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── 主内容区（水平垂直居中） ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* 游戏标题 */}
        <div
          style={{
            marginBottom: 52,
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? "translateY(0)" : "translateY(-20px)",
            transition: "opacity 0.9s ease, transform 0.9s ease",
          }}
        >
          {/* 上装饰线（有脉冲动画） */}
          <div
            style={{
              height: 1,
              background: "rgba(200,160,60,0.6)",
              marginBottom: 16,
              animation: "linePulse 3s ease-in-out infinite",
            }}
          />
          <h1
            style={{
              margin: 0,
              fontFamily: '"STKaiti", "楷体", "KaiTi", "SimKai", serif',
              fontSize: "clamp(2.6rem, 5vw, 4rem)",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "rgba(255, 242, 210, 0.97)",
              animation: "titleGlow 4s ease-in-out infinite",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </h1>
          {/* 底部装饰 */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 24, height: 1, background: "rgba(200,160,60,0.4)" }} />
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "rgba(220,175,70,0.7)",
                animation: "dotPulse 2.5s ease-in-out infinite",
              }}
            />
            <div style={{ width: 40, height: 1, background: "rgba(200,160,60,0.4)" }} />
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "rgba(200,155,60,0.4)",
                animation: "dotPulse 2.5s ease-in-out infinite 0.8s",
              }}
            />
            <div style={{ width: 16, height: 1, background: "rgba(200,160,60,0.2)" }} />
          </div>
        </div>

        {/* 菜单按钮组 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MenuButton label="新的开始" sub="NEW GAME" onClick={onNewGame} primary delay={400} />
          <MenuButton label="读档" sub="LOAD SAVE" onClick={onLoadGame} delay={550} />
        </div>
      </div>

      {/* 右侧暗角遮罩 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 100% 50%, rgba(0,0,0,0.4) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
