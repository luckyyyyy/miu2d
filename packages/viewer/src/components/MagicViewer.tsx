/**
 * 武功查看/编辑组件
 * 显示武功配置的详细信息，支持编辑
 */

import type { MagicData } from "@miu2d/engine/magic";
import { MagicMoveKind, MagicSpecialKind } from "@miu2d/engine/magic";
import { useState } from "react";

interface MagicViewerProps {
  /** 武功数据 */
  magic: MagicData | null;
  /** 文件名 */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 数据变更回调 */
  onChange?: (magic: MagicData) => void;
  /** 是否为只读模式 */
  readOnly?: boolean;
}

/** 移动类型描述 */
const MOVE_KIND_LABELS: Record<number, string> = {
  [MagicMoveKind.NoMove]: "不移动",
  [MagicMoveKind.FixedPosition]: "固定位置",
  [MagicMoveKind.SingleMove]: "单个移动（直线飞行）",
  [MagicMoveKind.LineMove]: "直线移动（多个）",
  [MagicMoveKind.CircleMove]: "圆形移动",
  [MagicMoveKind.HeartMove]: "心形移动",
  [MagicMoveKind.SpiralMove]: "螺旋移动",
  [MagicMoveKind.SectorMove]: "扇形移动",
  [MagicMoveKind.RandomSector]: "随机扇形",
  [MagicMoveKind.FixedWall]: "固定墙",
  [MagicMoveKind.WallMove]: "墙移动",
  [MagicMoveKind.RegionBased]: "区域类型",
  [MagicMoveKind.FollowCharacter]: "跟随角色",
  [MagicMoveKind.SuperMode]: "超级模式",
  [MagicMoveKind.FollowEnemy]: "跟随敌人",
  [MagicMoveKind.Throw]: "投掷",
  [MagicMoveKind.Kind19]: "持续留痕",
  [MagicMoveKind.Transport]: "传送",
  [MagicMoveKind.PlayerControl]: "玩家控制",
  [MagicMoveKind.Summon]: "召唤NPC",
  [MagicMoveKind.TimeStop]: "时间停止",
  [MagicMoveKind.VMove]: "V字移动",
};

/** 特殊效果类型描述 */
const SPECIAL_KIND_LABELS: Record<number, string> = {
  [MagicSpecialKind.None]: "无特殊效果",
  [MagicSpecialKind.AddLifeOrFrozen]: "加生命/冰冻",
  [MagicSpecialKind.AddThewOrPoison]: "加体力/中毒",
  [MagicSpecialKind.BuffOrPetrify]: "持续效果/石化",
  [MagicSpecialKind.InvisibleHide]: "隐身(攻击消失)",
  [MagicSpecialKind.InvisibleShow]: "隐身(攻击可见)",
  [MagicSpecialKind.Buff]: "持续效果",
  [MagicSpecialKind.ChangeCharacter]: "变身",
  [MagicSpecialKind.RemoveAbnormal]: "解除异常",
  [MagicSpecialKind.ChangeFlyIni]: "改变飞行ini",
};

/**
 * 可折叠的配置段落组件
 */
function ConfigSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#3c3c3c] rounded mb-2">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3c3c3c] text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xs text-[#808080]">{isOpen ? "▼" : "▶"}</span>
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium text-[#cccccc]">{title}</span>
      </button>
      {isOpen && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * 表单输入行组件
 */
function FormRow({
  label,
  value,
  type = "text",
  readOnly = false,
  onChange,
  options,
  tooltip,
}: {
  label: string;
  value: string | number | undefined;
  type?: "text" | "number" | "select" | "textarea";
  readOnly?: boolean;
  onChange?: (value: string) => void;
  options?: { value: string | number; label: string }[];
  tooltip?: string;
}) {
  const displayValue = value === undefined ? "" : String(value);

  const inputClasses =
    "w-full bg-[#3c3c3c] border border-[#555] rounded px-2 py-1 text-sm text-[#cccccc] focus:outline-none focus:border-[#007acc]";
  const readOnlyClasses = readOnly ? "opacity-60 cursor-not-allowed" : "";

  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-xs text-[#808080] truncate" title={tooltip || label}>
        {label}
      </label>
      {type === "select" && options ? (
        <select
          className={`${inputClasses} ${readOnlyClasses}`}
          value={displayValue}
          disabled={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          className={`${inputClasses} ${readOnlyClasses} min-h-[60px] resize-y`}
          value={displayValue}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={`${inputClasses} ${readOnlyClasses}`}
          value={displayValue}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  );
}

/**
 * 等级表格组件
 */
function LevelTable({ levels }: { levels: Map<number, Partial<MagicData>> | undefined }) {
  if (!levels || levels.size === 0) {
    return <div className="text-center text-[#808080] py-4 text-sm">无等级数据</div>;
  }

  // 将 Map 转为数组并排序
  const levelArray = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#2d2d2d] text-[#808080]">
            <th className="border border-[#3c3c3c] px-2 py-1 text-left">等级</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-right">效果值</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-right">法力消耗</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-right">升级经验</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-right">速度</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-left">移动类型</th>
            <th className="border border-[#3c3c3c] px-2 py-1 text-right">生命帧</th>
          </tr>
        </thead>
        <tbody>
          {levelArray.map(([level, data]) => (
            <tr key={level} className="text-[#cccccc] hover:bg-[#2a2a2a]">
              <td className="border border-[#3c3c3c] px-2 py-1">Lv.{level}</td>
              <td className="border border-[#3c3c3c] px-2 py-1 text-right text-amber-400">
                {data.effect ?? "-"}
              </td>
              <td className="border border-[#3c3c3c] px-2 py-1 text-right text-blue-400">
                {data.manaCost ?? "-"}
              </td>
              <td className="border border-[#3c3c3c] px-2 py-1 text-right text-green-400">
                {data.levelupExp ?? "-"}
              </td>
              <td className="border border-[#3c3c3c] px-2 py-1 text-right">{data.speed ?? "-"}</td>
              <td className="border border-[#3c3c3c] px-2 py-1">
                {data.moveKind !== undefined
                  ? (MOVE_KIND_LABELS[data.moveKind] ?? `类型${data.moveKind}`)
                  : "-"}
              </td>
              <td className="border border-[#3c3c3c] px-2 py-1 text-right">
                {data.lifeFrame ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MagicViewer({
  magic,
  fileName,
  isLoading,
  error,
  onChange,
  readOnly = true,
}: MagicViewerProps) {
  // 当前激活的标签页
  const [activeTab, setActiveTab] = useState<"config" | "levels" | "json">("config");

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
          <span className="text-[#808080]">加载中...</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // 空状态
  if (!magic) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-[#808080]">
          <span className="text-4xl">🧙</span>
          <p className="mt-4">选择一个武功文件查看</p>
        </div>
      </div>
    );
  }

  const moveKindOptions = Object.entries(MOVE_KIND_LABELS).map(([value, label]) => ({
    value: Number(value),
    label: `${value} - ${label}`,
  }));

  const specialKindOptions = Object.entries(SPECIAL_KIND_LABELS).map(([value, label]) => ({
    value: Number(value),
    label: `${value} - ${label}`,
  }));

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c] bg-[#252526]">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧙</span>
          <div>
            <h2 className="text-sm font-semibold text-[#cccccc]">
              {magic.name || fileName || "未命名武功"}
            </h2>
            {fileName && <p className="text-xs text-[#808080]">{fileName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 标签页切换 */}
          <div className="flex bg-[#3c3c3c] rounded">
            <button
              type="button"
              className={`px-3 py-1 text-xs rounded-l ${
                activeTab === "config"
                  ? "bg-[#007acc] text-white"
                  : "text-[#cccccc] hover:bg-[#555]"
              }`}
              onClick={() => setActiveTab("config")}
            >
              配置
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs ${
                activeTab === "levels"
                  ? "bg-[#007acc] text-white"
                  : "text-[#cccccc] hover:bg-[#555]"
              }`}
              onClick={() => setActiveTab("levels")}
            >
              等级表
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs rounded-r ${
                activeTab === "json" ? "bg-[#007acc] text-white" : "text-[#cccccc] hover:bg-[#555]"
              }`}
              onClick={() => setActiveTab("json")}
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "config" && (
          <div className="max-w-2xl">
            {/* 基础信息 */}
            <ConfigSection title="基础信息" icon="📋" defaultOpen={true}>
              <FormRow label="名称" value={magic.name} readOnly={readOnly} />
              <FormRow label="描述" value={magic.intro} type="textarea" readOnly={readOnly} />
              <FormRow label="类型" value={magic.type} readOnly={readOnly} />
            </ConfigSection>

            {/* 资源文件 */}
            <ConfigSection title="资源文件" icon="🎨" defaultOpen={true}>
              <FormRow label="图标动画" value={magic.image} readOnly={readOnly} />
              <FormRow label="小图标" value={magic.icon} readOnly={readOnly} />
              <FormRow label="飞行动画" value={magic.flyingImage} readOnly={readOnly} />
              <FormRow label="飞行音效" value={magic.flyingSound} readOnly={readOnly} />
              <FormRow label="消失动画" value={magic.vanishImage} readOnly={readOnly} />
              <FormRow label="消失音效" value={magic.vanishSound} readOnly={readOnly} />
              <FormRow label="超级模式动画" value={magic.superModeImage} readOnly={readOnly} />
            </ConfigSection>

            {/* 移动参数 */}
            <ConfigSection title="移动参数" icon="🚀" defaultOpen={true}>
              <FormRow
                label="移动类型"
                value={magic.moveKind}
                type="select"
                options={moveKindOptions}
                readOnly={readOnly}
              />
              <FormRow label="速度" value={magic.speed} type="number" readOnly={readOnly} />
              <FormRow label="区域范围" value={magic.region} type="number" readOnly={readOnly} />
              <FormRow label="等待帧数" value={magic.waitFrame} type="number" readOnly={readOnly} />
              <FormRow label="生命帧数" value={magic.lifeFrame} type="number" readOnly={readOnly} />
            </ConfigSection>

            {/* 渲染参数 */}
            <ConfigSection title="渲染参数" icon="✨" defaultOpen={false}>
              <FormRow
                label="Alpha混合"
                value={magic.alphaBlend}
                type="number"
                readOnly={readOnly}
              />
              <FormRow label="飞行亮度" value={magic.flyingLum} type="number" readOnly={readOnly} />
              <FormRow label="消失亮度" value={magic.vanishLum} type="number" readOnly={readOnly} />
            </ConfigSection>

            {/* 特殊效果 */}
            <ConfigSection title="特殊效果" icon="⚡" defaultOpen={false}>
              <FormRow
                label="特殊类型"
                value={magic.specialKind}
                type="select"
                options={specialKindOptions}
                readOnly={readOnly}
              />
              <FormRow
                label="效果值"
                value={magic.specialKindValue}
                type="number"
                readOnly={readOnly}
              />
              <FormRow
                label="持续毫秒"
                value={magic.specialKindMilliSeconds}
                type="number"
                readOnly={readOnly}
              />
            </ConfigSection>

            {/* 效果值 */}
            <ConfigSection title="效果值" icon="💪" defaultOpen={false}>
              <FormRow label="主效果" value={magic.effect} type="number" readOnly={readOnly} />
              <FormRow label="效果2" value={magic.effect2} type="number" readOnly={readOnly} />
              <FormRow label="效果3" value={magic.effect3} type="number" readOnly={readOnly} />
              <FormRow label="法力消耗" value={magic.manaCost} type="number" readOnly={readOnly} />
              <FormRow label="体力消耗" value={magic.thewCost} type="number" readOnly={readOnly} />
            </ConfigSection>

            {/* 关联武功 */}
            <ConfigSection title="关联武功" icon="🔗" defaultOpen={false}>
              <FormRow label="所属类型" value={magic.belong} type="number" readOnly={readOnly} />
              <FormRow label="动作文件" value={magic.actionFile} readOnly={readOnly} />
              <FormRow label="攻击文件" value={magic.attackFile} readOnly={readOnly} />
              <FormRow label="第二武功" value={magic.secondMagicFile} readOnly={readOnly} />
              <FormRow label="爆炸武功" value={magic.explodeMagicFile} readOnly={readOnly} />
            </ConfigSection>

            {/* 碰撞参数 */}
            <ConfigSection title="碰撞参数" icon="💥" defaultOpen={false}>
              <FormRow
                label="穿透敌人"
                value={magic.passThrough}
                type="number"
                readOnly={readOnly}
              />
              <FormRow
                label="穿透墙壁"
                value={magic.passThroughWall}
                type="number"
                readOnly={readOnly}
              />
              <FormRow
                label="碰撞半径"
                value={magic.bodyRadius}
                type="number"
                readOnly={readOnly}
              />
            </ConfigSection>

            {/* 弹跳参数 */}
            <ConfigSection title="弹跳参数" icon="🏀" defaultOpen={false}>
              <FormRow label="弹跳" value={magic.bounce} type="number" readOnly={readOnly} />
              <FormRow
                label="弹跳伤害"
                value={magic.bounceHurt}
                type="number"
                readOnly={readOnly}
              />
              <FormRow label="弹飞" value={magic.bounceFly} type="number" readOnly={readOnly} />
              <FormRow
                label="弹飞速度"
                value={magic.bounceFlySpeed}
                type="number"
                readOnly={readOnly}
              />
            </ConfigSection>

            {/* 范围效果 */}
            <ConfigSection title="范围效果" icon="🎯" defaultOpen={false}>
              <FormRow
                label="范围效果"
                value={magic.rangeEffect}
                type="number"
                readOnly={readOnly}
              />
              <FormRow
                label="范围半径"
                value={magic.rangeRadius}
                type="number"
                readOnly={readOnly}
              />
              <FormRow
                label="范围伤害"
                value={magic.rangeDamage}
                type="number"
                readOnly={readOnly}
              />
            </ConfigSection>

            {/* 控制效果 */}
            <ConfigSection title="控制效果" icon="🔒" defaultOpen={false}>
              <FormRow
                label="禁止移动"
                value={magic.disableMoveMilliseconds}
                type="number"
                readOnly={readOnly}
                tooltip="毫秒"
              />
              <FormRow
                label="禁止技能"
                value={magic.disableSkillMilliseconds}
                type="number"
                readOnly={readOnly}
                tooltip="毫秒"
              />
              <FormRow
                label="致盲时间"
                value={magic.blindMilliseconds}
                type="number"
                readOnly={readOnly}
                tooltip="毫秒"
              />
            </ConfigSection>

            {/* 其他参数 */}
            <ConfigSection title="其他参数" icon="⚙️" defaultOpen={false}>
              <FormRow label="最大等级" value={magic.maxLevel} type="number" readOnly={readOnly} />
              <FormRow
                label="震屏"
                value={magic.vibratingScreen}
                type="number"
                readOnly={readOnly}
              />
              <FormRow label="攻击全体" value={magic.attackAll} type="number" readOnly={readOnly} />
              <FormRow label="NPC文件" value={magic.npcFile} readOnly={readOnly} />
            </ConfigSection>
          </div>
        )}

        {activeTab === "levels" && (
          <div>
            <h3 className="text-sm font-medium text-[#cccccc] mb-3">📊 等级成长表</h3>
            <LevelTable levels={magic.levels} />
          </div>
        )}

        {activeTab === "json" && (
          <div className="h-full">
            <h3 className="text-sm font-medium text-[#cccccc] mb-3">📝 JSON 格式</h3>
            <pre className="bg-[#2d2d2d] p-4 rounded overflow-auto text-xs text-[#cccccc] max-h-[calc(100vh-200px)]">
              {JSON.stringify(magic, mapReplacer, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * JSON.stringify replacer for Map objects
 */
function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}
