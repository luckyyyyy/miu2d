import type { SceneItemKind } from "@miu2d/types";
import type { DashboardIcons } from "../../icons";

export interface ContextMenuState {
  x: number;
  y: number;
}

export const kindLabels: Record<SceneItemKind, string> = {
  script: "脚本",
  trap: "陷阱",
  npc: "NPC",
  obj: "物件",
};

export const kindIcons: Record<SceneItemKind, keyof typeof DashboardIcons> = {
  script: "script",
  trap: "trap",
  npc: "npc",
  obj: "obj",
};

export const kindOrder: SceneItemKind[] = ["script", "trap", "npc", "obj"];

export const NPC_RELATION_COLORS: Record<string, string> = {
  Friendly: "#4caf50",
  Hostile: "#f44336",
  Neutral: "#ffb300",
  Partner: "#42a5f5",
};

export const NPC_RELATION_LABELS: Record<string, string> = {
  Friendly: "友好",
  Hostile: "敌对",
  Neutral: "中立",
  Partner: "伙伴",
};

export const OBJ_KIND_LABELS: Record<string, string> = {
  Static: "静态",
  Dynamic: "动态",
  Body: "尸体",
  LoopingSound: "循环音效",
  RandSound: "随机音效",
  Door: "门",
  Trap: "陷阱",
  Drop: "掉落",
};

/** 构建保留所有独立 key 的搜索参数 — npcKey / objKey / scriptKey / trapKey */
export function buildSearchParams(
  currentParams: URLSearchParams,
  kind: SceneItemKind,
  key: string,
): string {
  const params = new URLSearchParams();

  // 保留所有现有的独立 key
  const existingNpcKey = currentParams.get("npcKey");
  const existingObjKey = currentParams.get("objKey");
  const existingScriptKey = currentParams.get("scriptKey");
  const existingTrapKey = currentParams.get("trapKey");
  if (existingNpcKey) params.set("npcKey", existingNpcKey);
  if (existingObjKey) params.set("objKey", existingObjKey);
  if (existingScriptKey) params.set("scriptKey", existingScriptKey);
  if (existingTrapKey) params.set("trapKey", existingTrapKey);

  // 覆盖当前 kind 对应的 key
  if (kind === "npc") {
    params.set("npcKey", key);
  } else if (kind === "obj") {
    params.set("objKey", key);
  } else if (kind === "script") {
    params.set("scriptKey", key);
  } else if (kind === "trap") {
    params.set("trapKey", key);
  }

  return params.toString();
}
