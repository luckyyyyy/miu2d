/**
 * Modern MessageBox - 消息提示框
 */
import type React from "react";
import { useEffect, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface MessageBoxProps {
  isVisible: boolean;
  message: string;
}

export const MessageBox: React.FC<MessageBoxProps> = ({ isVisible, message }) => {
  const { screenWidth } = useGameUIContext();
  const [phase, setPhase] = useState<"hidden" | "in" | "visible" | "out">("hidden");

  useEffect(() => {
    if (!isVisible || !message) {
      setPhase("hidden");
      return;
    }
    // 入场
    setPhase("in");
    const visTimer = setTimeout(() => setPhase("visible"), 20);
    // 淡出 (1.5s 后)
    const outTimer = setTimeout(() => setPhase("out"), 1500);
    // 隐藏 (动画完成后)
    const hideTimer = setTimeout(() => setPhase("hidden"), 1800);
    return () => {
      clearTimeout(visTimer);
      clearTimeout(outTimer);
      clearTimeout(hideTimer);
    };
  }, [isVisible, message]);

  if (phase === "hidden" || !message) return null;

  const isEntering = phase === "in";
  const isLeaving = phase === "out";

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 180,
        transform: `translateX(-50%) translateY(${isEntering ? 12 : isLeaving ? -4 : 0}px)`,
        maxWidth: Math.min(420, screenWidth - 40),
        minWidth: 180,
        pointerEvents: "none",
        opacity: isEntering || isLeaving ? 0 : 1,
        transition: "opacity 0.25s ease, transform 0.25s ease",
        zIndex: 2000,
        // 外发光
        filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))",
      }}
    >
      {/* 背景卡片 */}
      <div
        style={{
          background: "rgba(12, 16, 28, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: borderRadius.lg,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* 左侧金色强调条 */}
        <div
          style={{
            width: 3,
            background: "linear-gradient(180deg, #ffd700, #b8860b)",
            flexShrink: 0,
          }}
        />
        {/* 文字区域 */}
        <div
          style={{
            padding: `${spacing.sm + 2}px ${spacing.lg}px`,
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {/* 金色菱形装饰点 */}
          <div
            style={{
              width: 6,
              height: 6,
              background: "#D4AF37",
              transform: "rotate(45deg)",
              flexShrink: 0,
              boxShadow: "0 0 6px rgba(212,175,55,0.8)",
            }}
          />
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: modernColors.text.primary,
              letterSpacing: "0.03em",
              lineHeight: 1.5,
            }}
          >
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 消息队列组件 - 支持同时显示多条消息
 */
interface MessageQueueProps {
  messages: Array<{ id: string; text: string }>;
  screenWidth: number;
  onRemove?: (id: string) => void;
}

export const MessageQueue: React.FC<MessageQueueProps> = ({ messages, screenWidth, onRemove }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 100,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        pointerEvents: "none",
        maxWidth: Math.min(400, screenWidth - 40),
      }}
    >
      {messages.map((msg, idx) => (
        <MessageItem
          key={msg.id}
          message={msg.text}
          index={idx}
          onAnimationEnd={() => onRemove?.(msg.id)}
        />
      ))}
    </div>
  );
};

interface MessageItemProps {
  message: string;
  index: number;
  onAnimationEnd?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, index, onAnimationEnd }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 2500);

    const removeTimer = setTimeout(() => {
      onAnimationEnd?.();
    }, 3000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [onAnimationEnd]);

  return (
    <div
      style={{
        padding: `${spacing.sm}px ${spacing.lg}px`,
        ...glassEffect.standard,
        borderRadius: borderRadius.md,
        opacity: isExiting ? 0 : 1,
        transform: `translateY(${isExiting ? -10 : 0}px)`,
        transition: "all 0.3s ease",
        animation: "slideIn 0.3s ease",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          fontSize: typography.fontSize.sm,
          color: modernColors.text.primary,
        }}
      >
        {message}
      </span>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};
