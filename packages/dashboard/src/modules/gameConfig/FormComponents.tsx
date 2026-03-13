/**
 * 共享 UI 基础组件
 * InfoIcon, HelpIcon, HelpTip, InfoAlert, WarnAlert, SectionTitle, Field, FormCard, inputCls
 */

import type React from "react";

/** 信息图标（圆形 i） */
export function InfoIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.2A5.8 5.8 0 1013.8 8 5.81 5.81 0 008 2.2zM8 11a.75.75 0 01-.75-.75v-3.5a.75.75 0 011.5 0v3.5A.75.75 0 018 11zm0-6.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
    </svg>
  );
}

/** 问号图标 */
export function HelpIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.2A5.8 5.8 0 1013.8 8 5.81 5.81 0 008 2.2zM8 11.5a.75.75 0 110 1.5.75.75 0 010-1.5zm.5-2.25a.5.5 0 01-1 0v-.38a1.5 1.5 0 01.88-1.36A1.25 1.25 0 107.25 6.5a.5.5 0 01-1 0 2.25 2.25 0 112.13 2.24.5.5 0 00-.38.48v.03z" />
    </svg>
  );
}

/** 带悬浮提示的问号 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex ml-1.5 cursor-help">
      <HelpIcon size={14} className="text-[#555] group-hover:text-[#0098ff] transition-colors" />
      <span className="absolute bottom-full left-0 mb-2 px-3 py-2 text-xs text-[#cccccc] bg-[#1e1e1e] border border-widget-border rounded-lg shadow-xl whitespace-normal w-64 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 leading-relaxed">
        {text}
      </span>
    </span>
  );
}

/** 信息提示框 - 用于 section 级别的说明 */
export function InfoAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 mb-5 rounded-lg bg-[#0098ff]/5 border border-[#0098ff]/15">
      <InfoIcon size={16} className="text-[#0098ff] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[#999] leading-relaxed">{children}</p>
    </div>
  );
}

/** 警告提示框 */
export function WarnAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="currentColor"
        className="text-yellow-500 flex-shrink-0 mt-0.5"
      >
        <path d="M8.56 1.69a.63.63 0 00-1.12 0L1.05 13.5a.63.63 0 00.56.88h12.78a.63.63 0 00.56-.88L8.56 1.69zM8 5.5a.5.5 0 01.5.5v3a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
      </svg>
      <p className="text-xs text-[#999] leading-relaxed">{children}</p>
    </div>
  );
}

export function SectionTitle({ desc }: { desc?: string }) {
  if (!desc) return null;
  return (
    <div className="mb-6">
      <InfoAlert>{desc}</InfoAlert>
    </div>
  );
}

export function Field({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center text-sm text-[#cccccc] font-medium">
        {label}
        {desc && <HelpTip text={desc} />}
      </label>
      {children}
    </div>
  );
}

/** 表单卡片容器 */
export function FormCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#252526] border border-panel-border rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border transition-colors";
