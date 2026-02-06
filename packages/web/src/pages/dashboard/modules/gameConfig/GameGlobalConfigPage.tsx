/**
 * 游戏全局配置页面
 * 左侧分类导航 + 右侧配置编辑 + 右上角固定保存按钮
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { NumberInput } from "@/components/common";
import { trpc } from "../../../../lib/trpc";
import { useDashboard } from "../../DashboardContext";
import { useToast } from "../../../../contexts/ToastContext";
import type {
  GameConfigData,
  MoneyDropTier,
  DrugDropTier,
  BossLevelBonus,
  PlayerInitialStats,
  PlayerThewCost,
  PlayerRestore,
  PlayerSpeed,
  PlayerCombat,
} from "@miu2d/types";
import { createDefaultGameConfig } from "@miu2d/types";

// ========== 分类定义 ==========

type ConfigCategory =
  | "basic"
  | "newgame"
  | "player-identity"
  | "player-stats"
  | "player-speed"
  | "player-thew"
  | "player-restore"
  | "player-combat"
  | "drop-probability"
  | "drop-equip"
  | "drop-money"
  | "drop-drug"
  | "drop-boss";

interface NavSection {
  label: string;
  items: { id: ConfigCategory; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "游戏",
    items: [
      { id: "basic", label: "基础信息" },
      { id: "newgame", label: "新游戏脚本" },
    ],
  },
  {
    label: "主角配置",
    items: [
      { id: "player-identity", label: "角色身份" },
      { id: "player-stats", label: "初始属性" },
      { id: "player-speed", label: "移动速度" },
      { id: "player-thew", label: "体力消耗" },
      { id: "player-restore", label: "自然恢复" },
      { id: "player-combat", label: "战斗参数" },
    ],
  },
  {
    label: "掉落系统",
    items: [
      { id: "drop-probability", label: "掉落概率" },
      { id: "drop-equip", label: "装备等级映射" },
      { id: "drop-money", label: "金钱掉落" },
      { id: "drop-drug", label: "药品掉落" },
      { id: "drop-boss", label: "Boss 加成" },
    ],
  },
];

// ========== 通用组件 ==========

function SectionTitle({ children, desc }: { children: React.ReactNode; desc?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-medium text-white">{children}</h2>
      {desc && <p className="text-xs text-[#666] mt-1">{desc}</p>}
    </div>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-[#858585] mb-1">{label}</label>
      {children}
      {desc && <p className="text-xs text-[#555] mt-1">{desc}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white focus:outline-none focus:border-[#0098ff]";
const monoInputCls = `${inputCls} font-mono text-sm`;

// ========== 掉落子组件 ==========

function MoneyTiersEditor({ tiers, onChange }: { tiers: MoneyDropTier[]; onChange: (t: MoneyDropTier[]) => void }) {
  const update = (i: number, field: keyof MoneyDropTier, value: number | null) => {
    const t = [...tiers];
    t[i] = { ...t[i], [field]: value ?? 0 };
    onChange(t);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#858585] border-b border-[#454545]">
            <th className="pb-2 pr-4">等级</th>
            <th className="pb-2 pr-4">最小金额</th>
            <th className="pb-2 pr-4">最大金额</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => (
            <tr key={tier.tier} className="border-b border-[#333]">
              <td className="py-2 pr-4 text-[#cccccc]">{tier.tier} 级</td>
              <td className="py-2 pr-4">
                <NumberInput value={tier.minAmount} onChange={(v) => update(i, "minAmount", v)} min={0} className="w-28" />
              </td>
              <td className="py-2 pr-4">
                <NumberInput value={tier.maxAmount} onChange={(v) => update(i, "maxAmount", v)} min={0} className="w-28" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrugTiersEditor({ tiers, onChange }: { tiers: DrugDropTier[]; onChange: (t: DrugDropTier[]) => void }) {
  const update = (i: number, field: keyof DrugDropTier, value: string | number | null) => {
    const t = [...tiers];
    t[i] = { ...t[i], [field]: value ?? 0 };
    onChange(t);
  };
  const smallInput = "w-28 px-2 py-1 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0098ff]";
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#858585] border-b border-[#454545]">
              <th className="pb-2 pr-4">名称</th>
              <th className="pb-2 pr-4">NPC 最高等级</th>
              <th className="pb-2 pr-4">关联商店 Key</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr key={i} className="border-b border-[#333]">
                <td className="py-2 pr-4">
                  <input type="text" value={tier.name} onChange={(e) => update(i, "name", e.target.value)} className={smallInput} />
                </td>
                <td className="py-2 pr-4">
                  <NumberInput value={tier.maxLevel} onChange={(v) => update(i, "maxLevel", v)} min={0} className="w-28" />
                </td>
                <td className="py-2 pr-4">
                  <input type="text" value={tier.shopKey} onChange={(e) => update(i, "shopKey", e.target.value)} className={`${smallInput} w-40`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange([...tiers, { name: "", maxLevel: 999, shopKey: "" }])}
        className="mt-2 px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors"
      >
        + 添加等级
      </button>
    </div>
  );
}

function BossLevelBonusEditor({ bonuses, onChange }: { bonuses: BossLevelBonus[]; onChange: (b: BossLevelBonus[]) => void }) {
  const update = (i: number, field: keyof BossLevelBonus, value: number | null) => {
    const b = [...bonuses];
    b[i] = { ...b[i], [field]: value ?? 0 };
    onChange(b);
  };
  const total = bonuses.reduce((s, b) => s + b.chance, 0);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#858585] border-b border-[#454545]">
              <th className="pb-2 pr-4">概率 (%)</th>
              <th className="pb-2 pr-4">额外等级加成</th>
              <th className="pb-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {bonuses.map((b, i) => (
              <tr key={i} className="border-b border-[#333]">
                <td className="py-2 pr-4">
                  <NumberInput value={b.chance} onChange={(v) => update(i, "chance", v)} min={0} max={100} className="w-24" />
                </td>
                <td className="py-2 pr-4">
                  <NumberInput value={b.bonus} onChange={(v) => update(i, "bonus", v)} min={0} className="w-24" />
                </td>
                <td className="py-2 pr-4">
                  {bonuses.length > 1 && (
                    <button type="button" onClick={() => onChange(bonuses.filter((_, j) => j !== i))} className="text-[#858585] hover:text-red-400 transition-colors">
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={() => onChange([...bonuses, { chance: 0, bonus: 0 }])} className="px-3 py-1 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded transition-colors">
          + 添加档位
        </button>
        {total !== 100 && <span className="text-xs text-yellow-500">概率总和为 {total}%，建议设为 100%</span>}
      </div>
    </div>
  );
}

// ========== 各分类面板 ==========

function BasicInfoPanel({ config, updateConfig }: { config: GameConfigData; updateConfig: <K extends keyof GameConfigData>(k: K, v: GameConfigData[K]) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle>基础信息</SectionTitle>
      <Field label="游戏名称">
        <input type="text" value={config.gameName} onChange={(e) => updateConfig("gameName", e.target.value)} className={inputCls} />
      </Field>
      <Field label="游戏版本">
        <input type="text" value={config.gameVersion} onChange={(e) => updateConfig("gameVersion", e.target.value)} className={inputCls} />
      </Field>
      <Field label="游戏描述">
        <textarea rows={3} value={config.gameDescription} onChange={(e) => updateConfig("gameDescription", e.target.value)} className={`${inputCls} resize-none`} />
      </Field>
    </div>
  );
}

function NewGameScriptPanel({ config, updateConfig }: { config: GameConfigData; updateConfig: <K extends keyof GameConfigData>(k: K, v: GameConfigData[K]) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="新游戏开始时执行的脚本文件路径">新游戏脚本</SectionTitle>
      <Field label="脚本路径">
        <input type="text" value={config.newGameScript} onChange={(e) => updateConfig("newGameScript", e.target.value)} className={monoInputCls} placeholder="script/common/newgame.txt" />
      </Field>
    </div>
  );
}

function PlayerIdentityPanel({ config, updatePlayer }: {
  config: GameConfigData;
  updatePlayer: <K extends keyof GameConfigData["player"]>(k: K, v: GameConfigData["player"][K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="主角的默认名称和外观配置">角色身份</SectionTitle>
      <Field label="角色名称">
        <input type="text" value={config.player.name} onChange={(e) => updatePlayer("name", e.target.value)} className={inputCls} />
      </Field>
      <Field label="外观配置文件" desc="NPC INI 文件名">
        <input type="text" value={config.player.npcIni} onChange={(e) => updatePlayer("npcIni", e.target.value)} className={monoInputCls} />
      </Field>
    </div>
  );
}

function PlayerStatsPanel({ stats, onChange }: { stats: PlayerInitialStats; onChange: (s: PlayerInitialStats) => void }) {
  const up = (field: keyof PlayerInitialStats, v: number | null) => onChange({ ...stats, [field]: v ?? 0 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="开始新游戏时主角的初始数值">初始属性</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="初始生命值"><NumberInput value={stats.life} onChange={(v) => up("life", v)} min={1} className="w-full" /></Field>
        <Field label="最大生命值"><NumberInput value={stats.lifeMax} onChange={(v) => up("lifeMax", v)} min={1} className="w-full" /></Field>
        <Field label="初始内力值"><NumberInput value={stats.mana} onChange={(v) => up("mana", v)} min={0} className="w-full" /></Field>
        <Field label="最大内力值"><NumberInput value={stats.manaMax} onChange={(v) => up("manaMax", v)} min={0} className="w-full" /></Field>
        <Field label="初始体力值"><NumberInput value={stats.thew} onChange={(v) => up("thew", v)} min={0} className="w-full" /></Field>
        <Field label="最大体力值"><NumberInput value={stats.thewMax} onChange={(v) => up("thewMax", v)} min={0} className="w-full" /></Field>
        <Field label="攻击力"><NumberInput value={stats.attack} onChange={(v) => up("attack", v)} min={0} className="w-full" /></Field>
        <Field label="防御力"><NumberInput value={stats.defend} onChange={(v) => up("defend", v)} min={0} className="w-full" /></Field>
        <Field label="闪避"><NumberInput value={stats.evade} onChange={(v) => up("evade", v)} min={0} className="w-full" /></Field>
        <Field label="初始等级"><NumberInput value={stats.level} onChange={(v) => up("level", v)} min={1} className="w-full" /></Field>
        <Field label="升级所需经验"><NumberInput value={stats.levelUpExp} onChange={(v) => up("levelUpExp", v)} min={0} className="w-full" /></Field>
      </div>
    </div>
  );
}

function PlayerSpeedPanel({ speed, onChange }: { speed: PlayerSpeed; onChange: (s: PlayerSpeed) => void }) {
  const up = (field: keyof PlayerSpeed, v: number | null) => onChange({ ...speed, [field]: v ?? 1 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="主角移动速度相关参数">移动速度</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="基础速度" desc="角色每帧基础移动像素"><NumberInput value={speed.baseSpeed} onChange={(v) => up("baseSpeed", v)} min={1} className="w-full" /></Field>
        <Field label="跑步倍数" desc="跑步速度 = 基础速度 × 此值"><NumberInput value={speed.runSpeedFold} onChange={(v) => up("runSpeedFold", v)} min={1} className="w-full" /></Field>
        <Field label="最低减速 %" desc="负数表示减速，如 -90 表示最多减速 90%"><NumberInput value={speed.minChangeMoveSpeedPercent} onChange={(v) => up("minChangeMoveSpeedPercent", v)} min={-100} max={0} className="w-full" /></Field>
      </div>
    </div>
  );
}

function PlayerThewPanel({ thew, onChange }: { thew: PlayerThewCost; onChange: (t: PlayerThewCost) => void }) {
  const up = (field: keyof PlayerThewCost, v: number | boolean | null) => onChange({ ...thew, [field]: v ?? 0 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="各种动作消耗的体力值">体力消耗</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="跑步消耗 / 帧"><NumberInput value={thew.runCost} onChange={(v) => up("runCost", v)} min={0} className="w-full" /></Field>
        <Field label="攻击消耗"><NumberInput value={thew.attackCost} onChange={(v) => up("attackCost", v)} min={0} className="w-full" /></Field>
        <Field label="跳跃消耗"><NumberInput value={thew.jumpCost} onChange={(v) => up("jumpCost", v)} min={0} className="w-full" /></Field>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="useThewNormalRun"
          checked={thew.useThewWhenNormalRun}
          onChange={(e) => up("useThewWhenNormalRun", e.target.checked)}
          className="accent-[#0098ff]"
        />
        <label htmlFor="useThewNormalRun" className="text-sm text-[#cccccc] cursor-pointer">非战斗跑步时也消耗体力</label>
      </div>
    </div>
  );
}

function PlayerRestorePanel({ restore, onChange }: { restore: PlayerRestore; onChange: (r: PlayerRestore) => void }) {
  const up = (field: keyof PlayerRestore, v: number | null) => onChange({ ...restore, [field]: v ?? 0 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="站立不动时每个恢复周期回复的比例">自然恢复</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="生命恢复比例" desc="每周期恢复 lifeMax 的百分比">
          <div className="flex items-center gap-2">
            <NumberInput value={Math.round(restore.lifeRestorePercent * 100)} onChange={(v) => up("lifeRestorePercent", (v ?? 0) / 100)} min={0} max={100} className="w-full" />
            <span className="text-sm text-[#858585]">%</span>
          </div>
        </Field>
        <Field label="体力恢复比例" desc="每周期恢复 thewMax 的百分比">
          <div className="flex items-center gap-2">
            <NumberInput value={Math.round(restore.thewRestorePercent * 100)} onChange={(v) => up("thewRestorePercent", (v ?? 0) / 100)} min={0} max={100} className="w-full" />
            <span className="text-sm text-[#858585]">%</span>
          </div>
        </Field>
        <Field label="内力恢复比例" desc="每周期恢复 manaMax 的百分比">
          <div className="flex items-center gap-2">
            <NumberInput value={Math.round(restore.manaRestorePercent * 100)} onChange={(v) => up("manaRestorePercent", (v ?? 0) / 100)} min={0} max={100} className="w-full" />
            <span className="text-sm text-[#858585]">%</span>
          </div>
        </Field>
        <Field label="恢复间隔" desc="毫秒">
          <NumberInput value={restore.restoreIntervalMs} onChange={(v) => up("restoreIntervalMs", v)} min={100} className="w-full" />
        </Field>
        <Field label="打坐内力转换间隔" desc="毫秒">
          <NumberInput value={restore.sittingManaRestoreInterval} onChange={(v) => up("sittingManaRestoreInterval", v)} min={50} className="w-full" />
        </Field>
      </div>
    </div>
  );
}

function PlayerCombatPanel({ combat, onChange }: { combat: PlayerCombat; onChange: (c: PlayerCombat) => void }) {
  const up = (field: keyof PlayerCombat, v: number | null) => onChange({ ...combat, [field]: v ?? 1 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="战斗和交互相关参数">战斗参数</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="脱战时间 (秒)" desc="无攻击后退出战斗姿态的时间">
          <NumberInput value={combat.maxNonFightSeconds} onChange={(v) => up("maxNonFightSeconds", v)} min={1} className="w-full" />
        </Field>
        <Field label="对话交互半径 (格)" desc="可与 NPC 对话的最大距离">
          <NumberInput value={combat.dialogRadius} onChange={(v) => up("dialogRadius", v)} min={1} className="w-full" />
        </Field>
      </div>
    </div>
  );
}

function DropProbabilityPanel({ config, updateProbability }: {
  config: GameConfigData;
  updateProbability: <K extends keyof GameConfigData["drop"]["probability"]>(k: K, v: number | null) => void;
}) {
  const prob = config.drop.probability;
  return (
    <div className="space-y-4">
      <SectionTitle desc="普通敌人击杀后的掉落概率，概率为 1/N，N 越大概率越低">掉落概率</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`武器 (1/${prob.weaponChance})`}><NumberInput value={prob.weaponChance} onChange={(v) => updateProbability("weaponChance", v)} min={1} className="w-full" /></Field>
        <Field label={`防具 (1/${prob.armorChance})`}><NumberInput value={prob.armorChance} onChange={(v) => updateProbability("armorChance", v)} min={1} className="w-full" /></Field>
        <Field label={`金钱 (1/${prob.moneyChance})`}><NumberInput value={prob.moneyChance} onChange={(v) => updateProbability("moneyChance", v)} min={1} className="w-full" /></Field>
        <Field label={`药品 (1/${prob.drugChance})`}><NumberInput value={prob.drugChance} onChange={(v) => updateProbability("drugChance", v)} min={1} className="w-full" /></Field>
      </div>
    </div>
  );
}

function DropEquipPanel({ config, updateEquipTier }: {
  config: GameConfigData;
  updateEquipTier: <K extends keyof GameConfigData["drop"]["equipTier"]>(k: K, v: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="掉落等级 = floor(NPC等级 / 除数) + 1，武器、防具、金钱共用此公式">装备等级映射</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <Field label="等级除数"><NumberInput value={config.drop.equipTier.divisor} onChange={(v) => updateEquipTier("divisor", v)} min={1} className="w-full" /></Field>
        <Field label="最大等级"><NumberInput value={config.drop.equipTier.maxTier} onChange={(v) => updateEquipTier("maxTier", v)} min={1} className="w-full" /></Field>
      </div>
    </div>
  );
}

function DropMoneyPanel({ config, updateDrop }: {
  config: GameConfigData;
  updateDrop: <K extends keyof GameConfigData["drop"]>(k: K, v: GameConfigData["drop"][K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="拾取金钱时随机获得的金额范围，按等级划分">金钱掉落配置</SectionTitle>
      <MoneyTiersEditor tiers={config.drop.moneyTiers} onChange={(t) => updateDrop("moneyTiers", t)} />
    </div>
  );
}

function DropDrugPanel({ config, updateDrop }: {
  config: GameConfigData;
  updateDrop: <K extends keyof GameConfigData["drop"]>(k: K, v: GameConfigData["drop"][K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="根据 NPC 等级决定掉落哪个等级的药品池，最后一条为兜底">药品掉落等级</SectionTitle>
      <DrugTiersEditor tiers={config.drop.drugTiers} onChange={(t) => updateDrop("drugTiers", t)} />
    </div>
  );
}

function DropBossPanel({ config, updateDrop }: {
  config: GameConfigData;
  updateDrop: <K extends keyof GameConfigData["drop"]>(k: K, v: GameConfigData["drop"][K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="Boss（ExpBonus > 0）必定掉落武器或防具，额外等级按概率抽取">Boss 等级加成</SectionTitle>
      <BossLevelBonusEditor bonuses={config.drop.bossLevelBonuses} onChange={(b) => updateDrop("bossLevelBonuses", b)} />
    </div>
  );
}

// ========== 主页面 ==========

export function GameGlobalConfigPage() {
  const { currentGame } = useDashboard();
  const toast = useToast();
  const gameId = currentGame?.id ?? "";

  const [config, setConfig] = useState<GameConfigData>(createDefaultGameConfig());
  const [isDirty, setIsDirty] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>("basic");
  const contentRef = useRef<HTMLDivElement>(null);

  // 获取配置
  const { data, isLoading } = trpc.gameConfig.get.useQuery({ gameId }, { enabled: !!gameId });

  useEffect(() => {
    if (data) {
      // 合并默认值，以防数据库中缺少新增字段
      const defaults = createDefaultGameConfig();
      const merged: GameConfigData = {
        ...defaults,
        ...data.data,
        player: { ...defaults.player, ...(data.data.player ?? {}) },
        drop: { ...defaults.drop, ...(data.data.drop ?? {}) },
      };
      setConfig(merged);
      setIsDirty(false);
    }
  }, [data]);

  const updateConfig = useCallback(<K extends keyof GameConfigData>(field: K, value: GameConfigData[K]) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const updatePlayer = useCallback(<K extends keyof GameConfigData["player"]>(field: K, value: GameConfigData["player"][K]) => {
    setConfig((prev) => ({ ...prev, player: { ...prev.player, [field]: value } }));
    setIsDirty(true);
  }, []);

  const updateDrop = useCallback(<K extends keyof GameConfigData["drop"]>(field: K, value: GameConfigData["drop"][K]) => {
    setConfig((prev) => ({ ...prev, drop: { ...prev.drop, [field]: value } }));
    setIsDirty(true);
  }, []);

  const updateProbability = useCallback(<K extends keyof GameConfigData["drop"]["probability"]>(field: K, value: number | null) => {
    setConfig((prev) => ({
      ...prev,
      drop: { ...prev.drop, probability: { ...prev.drop.probability, [field]: value ?? 1 } },
    }));
    setIsDirty(true);
  }, []);

  const updateEquipTier = useCallback(<K extends keyof GameConfigData["drop"]["equipTier"]>(field: K, value: number | null) => {
    setConfig((prev) => ({
      ...prev,
      drop: { ...prev.drop, equipTier: { ...prev.drop.equipTier, [field]: value ?? 1 } },
    }));
    setIsDirty(true);
  }, []);

  // 保存
  const updateMutation = trpc.gameConfig.update.useMutation({
    onSuccess: () => {
      toast.success("配置保存成功");
      setIsDirty(false);
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const handleSave = () => {
    if (!gameId) return;
    updateMutation.mutate({ gameId, data: config });
  };

  const handleResetToDefault = () => {
    setConfig(createDefaultGameConfig());
    setIsDirty(true);
  };

  // 切换分类时滚动到顶部
  const handleCategoryChange = (cat: ConfigCategory) => {
    setActiveCategory(cat);
    contentRef.current?.scrollTo({ top: 0 });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-80">
          <div className="h-8 bg-[#333] rounded w-48" />
          <div className="h-40 bg-[#252526] rounded" />
        </div>
      </div>
    );
  }

  // 渲染当前分类面板
  function renderPanel() {
    switch (activeCategory) {
      case "basic":
        return <BasicInfoPanel config={config} updateConfig={updateConfig} />;
      case "newgame":
        return <NewGameScriptPanel config={config} updateConfig={updateConfig} />;
      case "player-identity":
        return <PlayerIdentityPanel config={config} updatePlayer={updatePlayer} />;
      case "player-stats":
        return (
          <PlayerStatsPanel
            stats={config.player.initialStats}
            onChange={(s) => updatePlayer("initialStats", s)}
          />
        );
      case "player-speed":
        return (
          <PlayerSpeedPanel
            speed={config.player.speed}
            onChange={(s) => updatePlayer("speed", s)}
          />
        );
      case "player-thew":
        return (
          <PlayerThewPanel
            thew={config.player.thewCost}
            onChange={(t) => updatePlayer("thewCost", t)}
          />
        );
      case "player-restore":
        return (
          <PlayerRestorePanel
            restore={config.player.restore}
            onChange={(r) => updatePlayer("restore", r)}
          />
        );
      case "player-combat":
        return (
          <PlayerCombatPanel
            combat={config.player.combat}
            onChange={(c) => updatePlayer("combat", c)}
          />
        );
      case "drop-probability":
        return <DropProbabilityPanel config={config} updateProbability={updateProbability} />;
      case "drop-equip":
        return <DropEquipPanel config={config} updateEquipTier={updateEquipTier} />;
      case "drop-money":
        return <DropMoneyPanel config={config} updateDrop={updateDrop} />;
      case "drop-drug":
        return <DropDrugPanel config={config} updateDrop={updateDrop} />;
      case "drop-boss":
        return <DropBossPanel config={config} updateDrop={updateDrop} />;
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* 固定保存按钮 - 右上角 */}
      <div className="fixed top-3 right-6 z-50 flex items-center gap-3">
        {isDirty && <span className="text-xs text-yellow-500">有未保存的更改</span>}
        <button
          type="button"
          onClick={handleResetToDefault}
          className="px-3 py-1.5 text-xs text-[#858585] hover:text-white transition-colors"
        >
          恢复默认
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="px-4 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? "保存中..." : "保存"}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧分类导航 */}
        <nav className="w-48 shrink-0 border-r border-[#333] overflow-y-auto py-4 px-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666] px-2 mb-1.5">
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCategoryChange(item.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    activeCategory === item.id
                      ? "bg-[#37373d] text-white"
                      : "text-[#cccccc] hover:bg-[#2a2d2e]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* 右侧内容区 */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}
