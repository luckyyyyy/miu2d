/**
 * 配角区块 - 显示配角状态和升级按钮
 */

import type React from "react";
import type { PartnerInfo } from "../types";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import { btnClass } from "../constants";

interface PartnerSectionProps {
  partners: PartnerInfo[];
  onPartnerLevelUp?: (name: string) => void;
  onPartnerLevelDown?: (name: string) => void;
}

export const PartnerSection: React.FC<PartnerSectionProps> = ({
  partners,
  onPartnerLevelUp,
  onPartnerLevelDown,
}) => {
  if (partners.length === 0) return null;

  return (
    <Section title="配角" badge={partners.length} defaultOpen={true}>
      <div className="space-y-2">
        {partners.map((partner) => (
          <div key={partner.name} className="border border-[#333] rounded px-2 py-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#fbbf24] font-semibold">{partner.name}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onPartnerLevelDown?.(partner.name)}
                  disabled={partner.level <= 1}
                  className={`${btnClass} w-5 h-5 p-0 text-[10px]`}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onPartnerLevelUp?.(partner.name)}
                  className={`${btnClass} w-5 h-5 p-0 text-[10px]`}
                >
                  +
                </button>
              </div>
            </div>
            <div className="space-y-px">
              <DataRow label="等级" value={partner.level} valueColor="text-[#fbbf24]" />
              <DataRow
                label="经验"
                value={`${partner.exp}/${partner.levelUpExp || "MAX"}`}
              />
              <DataRow
                label="生命"
                value={`${partner.life}/${partner.lifeMax}`}
                valueColor="text-[#f87171]"
              />
              <DataRow
                label="内力"
                value={`${partner.mana}/${partner.manaMax}`}
                valueColor="text-[#60a5fa]"
              />
              <DataRow
                label="体力"
                value={`${partner.thew}/${partner.thewMax}`}
                valueColor="text-[#4ade80]"
              />
              <DataRow label="攻击" value={partner.attack} />
              <DataRow label="防御" value={partner.defend} />
              <DataRow label="闪避" value={partner.evade} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};
