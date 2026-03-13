/**
 * DisclaimerModal - 首次访问游戏时的版权声明弹窗
 *
 * 必须确认才可继续，不可通过 ESC / 点击背景关闭。
 * 确认后写入 localStorage，后续访问不再显示。
 */

import { useAnimatedVisibility } from "@miu2d/shared";
import type React from "react";

export const DISCLAIMER_STORAGE_KEY = "jxqy_disclaimer_accepted";

export function isDisclaimerAccepted(): boolean {
  try {
    return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface DisclaimerModalProps {
  visible: boolean;
  onConfirm: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ visible, onConfirm }) => {
  const { shouldRender, transitionStyle } = useAnimatedVisibility(visible);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      // 不绑定 onClick — 背景点击无效，强制用户确认
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ opacity: transitionStyle.opacity, transition: transitionStyle.transition }}
      />

      {/* 弹窗主体 */}
      <div
        className="relative w-[480px] max-w-[92vw] flex flex-col rounded-2xl overflow-hidden
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
        style={transitionStyle}
      >
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-base font-semibold text-white/90 tracking-wide">版权声明</h2>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6 space-y-4 text-sm leading-relaxed text-white/70">
          <p>本网站为个人非商业项目，仅用于技术研究与交流学习。</p>
          <p className="text-white/90 font-medium">
            游戏资源版权归原作者所有，如您介意请联系我删除，本项目仅用于交流学习。
          </p>
          <p>继续使用即表示您已知悉上述声明。</p>
        </div>

        {/* 操作按钮 */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/10
              text-white/90 text-sm font-medium transition-colors border border-white/20
              hover:border-white/30 focus:outline-none focus-visible:ring-2
              focus-visible:ring-white/40"
          >
            我已了解，继续游览
          </button>
        </div>
      </div>
    </div>
  );
};
