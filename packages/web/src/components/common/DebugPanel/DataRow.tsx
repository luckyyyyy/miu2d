/**
 * 数据行组件
 */

import type React from "react";

interface DataRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
}

export const DataRow: React.FC<DataRowProps> = ({ label, value, valueColor = "text-white/70" }) => (
  <div className="flex justify-between text-[11px] py-px">
    <span className="text-white/40">{label}</span>
    <span className={`font-mono ${valueColor}`}>{value}</span>
  </div>
);
