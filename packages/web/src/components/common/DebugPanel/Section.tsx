/**
 * 折叠区块组件
 */

import type React from "react";
import { useState } from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export const Section: React.FC<SectionProps> = ({ title, children, defaultOpen = true, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/70 hover:bg-white/5"
      >
        <span className={`text-[10px] ${isOpen ? "rotate-90" : ""}`}>▶</span>
        <span className="flex-1 text-left">{title}</span>
        {badge !== undefined && <span className="text-[10px] text-white/30">{badge}</span>}
      </button>
      {isOpen && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
};
