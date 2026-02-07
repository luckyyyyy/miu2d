/**
 * 游戏全局配置页面
 * 根据路由参数 :configTab 渲染对应的配置面板
 * 侧边栏导航由 SidebarContent 提供
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { NumberInput, ResourceFilePicker, ScriptEditor } from "@/components/common";
import { MiniAsfPreview } from "@/components/common/ResourceFilePicker/AsfPreviewTooltip";
import { buildResourcePath } from "@/components/common/ResourceFilePicker/types";
import { trpc } from "../../../../lib/trpc";
import { useDashboard } from "../../DashboardContext";
import { useToast } from "../../../../contexts/ToastContext";
import type {
  GameConfigData,
  MoneyDropTier,
  DrugDropTier,
  BossLevelBonus,
  PlayerThewCost,
  PlayerRestore,
  PlayerSpeed,
  PlayerCombat,
  PortraitEntry,
} from "@miu2d/types";
import { createDefaultGameConfig, exportPortraitIni } from "@miu2d/types";

// ========== 配置分类 ==========

type ConfigCategory =
  | "basic"
  | "newgame"
  | "portrait"
  | "player-speed"
  | "player-thew"
  | "player-restore"
  | "player-combat"
  | "drop-probability"
  | "drop-equip"
  | "drop-money"
  | "drop-drug"
  | "drop-boss";

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

function BasicInfoPanel({ config, updateConfig, gameId }: {
  config: GameConfigData;
  updateConfig: <K extends keyof GameConfigData>(k: K, v: GameConfigData[K]) => void;
  gameId: string;
}) {
  // 从 players 表获取主角候选列表
  const { data: players } = trpc.player.list.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

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
      <Field label="游戏主角" desc="新游戏时使用的主角角色">
        <select
          value={config.playerKey}
          onChange={(e) => updateConfig("playerKey", e.target.value)}
          className={inputCls}
        >
          <option value="">-- 请选择主角 --</option>
          {players?.map((p) => (
            <option key={p.id} value={p.key}>
              {p.name}（{p.key}）
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function NewGameScriptPanel({ config, updateConfig }: { config: GameConfigData; updateConfig: <K extends keyof GameConfigData>(k: K, v: GameConfigData[K]) => void }) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="新游戏开始时执行的脚本内容（JXQY 脚本语法）">新游戏脚本</SectionTitle>
      <div className="border border-[#454545] rounded overflow-hidden">
        <ScriptEditor
          value={config.newGameScript}
          onChange={(v) => updateConfig("newGameScript", v)}
          height="400px"
        />
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

// ========== 对话头像面板 ==========

function PortraitMappingPanel({ gameId }: { gameId: string }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [isDragging, setIsDragging] = useState(false);
  const { currentGame } = useDashboard();
  const gameSlug = currentGame?.slug ?? "";

  // 查询
  const { data: portraitData, isLoading } = trpc.portrait.get.useQuery(
    { gameId },
    { enabled: !!gameId }
  );

  const [entries, setEntries] = useState<PortraitEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (portraitData?.entries) {
      setEntries(portraitData.entries);
      setIsDirty(false);
    }
  }, [portraitData]);

  // 保存
  const updateMutation = trpc.portrait.update.useMutation({
    onSuccess: () => {
      toast.success("对话头像配置已保存");
      setIsDirty(false);
      utils.portrait.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  // 从 INI 导入
  const importMutation = trpc.portrait.importFromIni.useMutation({
    onSuccess: (result) => {
      setEntries(result.entries);
      setIsDirty(false);
      toast.success(`成功导入 ${result.entries.length} 个头像映射`);
      utils.portrait.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`导入失败: ${err.message}`),
  });

  const handleSave = () => {
    updateMutation.mutate({ gameId, entries });
  };

  const handleAdd = () => {
    const maxIdx = entries.reduce((max, e) => Math.max(max, e.idx), -1);
    setEntries([...entries, { idx: maxIdx + 1, file: "" }]);
    setIsDirty(true);
  };

  const handleRemove = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleUpdate = (index: number, field: "idx" | "file", value: string | number) => {
    const updated = [...entries];
    if (field === "idx") {
      updated[index] = { ...updated[index], idx: value as number };
    } else {
      updated[index] = { ...updated[index], file: value as string };
    }
    setEntries(updated);
    setIsDirty(true);
  };

  const handleImportIni = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ini";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      importMutation.mutate({ gameId, iniContent: content });
    };
    input.click();
  };

  const handleExportIni = () => {
    const content = exportPortraitIni(entries);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HeadFile.ini";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const iniFile = files.find((f) => f.name.toLowerCase().endsWith(".ini"));
    if (!iniFile) {
      toast.error("请拖入 .ini 文件");
      return;
    }
    const content = await iniFile.text();
    importMutation.mutate({ gameId, iniContent: content });
  };

  if (isLoading) {
    return <div className="text-[#858585]">加载中...</div>;
  }

  return (
    <div
      className="space-y-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-[#0098ff]/10 border-2 border-dashed border-[#0098ff] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-[#0098ff] text-sm font-medium bg-[#252526] px-4 py-2 rounded-lg shadow-lg">
            释放 .ini 文件以导入头像映射
          </div>
        </div>
      )}
      <SectionTitle desc="Talk 脚本命令使用的角色头像索引映射（对应 HeadFile.ini）">对话头像</SectionTitle>

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleImportIni}
          disabled={importMutation.isPending}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors disabled:opacity-50"
        >
          {importMutation.isPending ? "导入中..." : "从 INI 导入"}
        </button>
        <button
          type="button"
          onClick={handleExportIni}
          disabled={entries.length === 0}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors disabled:opacity-50"
        >
          导出 INI
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
        >
          + 添加
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded text-white transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "保存中..." : "保存更改"}
          </button>
        )}
      </div>

      {/* 映射表 */}
      {entries.length === 0 ? (
        <div className="text-sm text-[#858585] bg-[#1e1e1e] p-6 rounded-lg text-center">
          暂无头像映射。拖入 HeadFile.ini 文件、点击「从 INI 导入」、或手动添加映射。
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={`${entry.idx}-${index}`} className="flex items-center gap-3 px-4 py-3 bg-[#2a2d2e] rounded-lg group hover:bg-[#2f3233] transition-colors">
              {/* 预览 */}
              <div className="w-12 h-12 flex-shrink-0 rounded bg-[#1e1e1e] border border-[#333] flex items-center justify-center overflow-hidden">
                {entry.file ? (
                  <MiniAsfPreview
                    gameSlug={gameSlug}
                    path={buildResourcePath("portrait_image", entry.file)}
                    size={48}
                  />
                ) : (
                  <span className="text-[#555] text-lg">🖼</span>
                )}
              </div>

              {/* 索引 */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <span className="text-[10px] text-[#858585]">索引</span>
                <NumberInput
                  min={0}
                  value={entry.idx}
                  onChange={(val) => handleUpdate(index, "idx", val ?? 0)}
                  className="w-16"
                />
              </div>

              {/* 文件选择器 */}
              <div className="flex-1 min-w-0">
                <ResourceFilePicker
                  label="文件"
                  value={entry.file || null}
                  onChange={(val) => handleUpdate(index, "file", val ?? "")}
                  fieldName="portrait_image"
                  gameId={gameId}
                  gameSlug={gameSlug}
                  extensions={[".asf"]}
                  placeholder="选择头像文件..."
                />
              </div>

              {/* 删除 */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400 transition-all flex-shrink-0"
                title="删除"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>头像文件位于 <code className="text-[#ce9178]">asf/portrait/</code> 目录下。</p>
        <p className="mt-1">脚本中使用 <code className="text-[#ce9178]">Talk</code> 命令指定头像索引来显示角色头像。</p>
      </div>
    </div>
  );
}

// ========== 主页面 ==========

export function GameGlobalConfigPage() {
  const { currentGame } = useDashboard();
  const { configTab } = useParams();
  const toast = useToast();
  const gameId = currentGame?.id ?? "";

  const [config, setConfig] = useState<GameConfigData>(createDefaultGameConfig());
  const [isDirty, setIsDirty] = useState(false);
  const activeCategory = (configTab || "basic") as ConfigCategory;
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

  // 切换 tab 时滚动到顶部
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeCategory]);

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
        return <BasicInfoPanel config={config} updateConfig={updateConfig} gameId={gameId} />;
      case "newgame":
        return <NewGameScriptPanel config={config} updateConfig={updateConfig} />;
      case "portrait":
        return <PortraitMappingPanel gameId={gameId} />;
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
      <div className="absolute top-3 right-6 z-20 flex items-center gap-3">
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
      <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}
