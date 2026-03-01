/**
 * GambleGui - 赌博小游戏界面
 *
 * 所有布局和资源路径均通过 resourceLoader API 从 ini/ui/littlegame/*.ini 加载，
 * 不硬编码任何资源路径。
 *
 * 流程：
 * 1. choose  — 玩家选大/小
 * 2. shaking — 摇骰子动画（Gambling.ini → 赌博动画摇骰子.asf）
 * 3. opening — 开盘动画（Opening.ini → 赌博动画开盘.asf）
 * 4. result  — 显示三颗骰子结果，等待玩家离开
 */

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { resourceLoader } from "@miu2d/engine/resource/resource-loader";
import { normalizeImagePath } from "@miu2d/engine/gui/ui-settings";
import { parseIni } from "@miu2d/engine/utils/ini-parser";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";
import { playUiSound } from "./hooks";

// ---- Config types ----

interface ElementConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  image: string;
  sound?: string;
}

interface GambleLittleGameConfig {
  window: ElementConfig;
  gambling: ElementConfig;
  openBg: ElementConfig;
  opening: ElementConfig;
  dice1: ElementConfig;
  dice2: ElementConfig;
  dice3: ElementConfig;
  gambleBig: ElementConfig;
  gambleSmall: ElementConfig;
  chipin: ElementConfig;
  quit: ElementConfig;
  message: ElementConfig;
  playerFace: ElementConfig;
  luFace: ElementConfig;
  bossFace: ElementConfig;
  labPlayer: ElementConfig;
  labComputer: ElementConfig;
  labChipIn: ElementConfig;
}

// ---- Parse helper ----

function parseElementConfig(content: string): ElementConfig {
  const sections = parseIni(content);
  const init = sections.Init ?? {};
  return {
    left: Number(init.Left ?? 0),
    top: Number(init.Top ?? 0),
    width: Number(init.Width ?? 0),
    height: Number(init.Height ?? 0),
    image: normalizeImagePath(init.Image ?? ""),
    sound: normalizeImagePath(init.Sound ?? "") || undefined,
  };
}

// ---- Loader (parallel fetch, with cache) ----

let cachedGambleConfig: GambleLittleGameConfig | null = null;
let gambleConfigPromise: Promise<GambleLittleGameConfig> | null = null;

const GAMBLE_INI_PATHS: Record<keyof GambleLittleGameConfig, string> = {
  window:       "ini/ui/littlegame/Window.ini",
  gambling:     "ini/ui/littlegame/Gambling.ini",
  openBg:       "ini/ui/littlegame/OpenBg.ini",
  opening:      "ini/ui/littlegame/Opening.ini",
  dice1:        "ini/ui/littlegame/Dice1.ini",
  dice2:        "ini/ui/littlegame/Dice2.ini",
  dice3:        "ini/ui/littlegame/Dice3.ini",
  gambleBig:    "ini/ui/littlegame/GambleBig.ini",
  gambleSmall:  "ini/ui/littlegame/GambleSmall.ini",
  chipin:       "ini/ui/littlegame/Chipin.ini",
  quit:         "ini/ui/littlegame/Quit.ini",
  message:      "ini/ui/littlegame/Message.ini",
  playerFace:   "ini/ui/littlegame/PlayerFace.ini",
  luFace:       "ini/ui/littlegame/LuFace.ini",
  bossFace:     "ini/ui/littlegame/BossFace.ini",
  labPlayer:    "ini/ui/littlegame/LabPlayer.ini",
  labComputer:  "ini/ui/littlegame/LabComputer.ini",
  labChipIn:    "ini/ui/littlegame/LabChipIn.ini",
};

async function loadGambleLittleGameConfig(): Promise<GambleLittleGameConfig> {
  if (cachedGambleConfig) return cachedGambleConfig;
  if (gambleConfigPromise) return gambleConfigPromise;

  gambleConfigPromise = (async () => {
    const keys = Object.keys(GAMBLE_INI_PATHS) as (keyof GambleLittleGameConfig)[];
    const contents = await Promise.all(
      keys.map((k) => resourceLoader.loadText(GAMBLE_INI_PATHS[k]))
    );
    const result = {} as GambleLittleGameConfig;
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = parseElementConfig(contents[i] ?? "");
    }
    cachedGambleConfig = result;
    return result;
  })();

  return gambleConfigPromise;
}

/** Reset cache when switching game slug */
export function resetGambleLittleGameConfigCache(): void {
  cachedGambleConfig = null;
  gambleConfigPromise = null;
}

// ---- Hook ----

function useGambleLittleGameConfig(): GambleLittleGameConfig | null {
  const [config, setConfig] = useState<GambleLittleGameConfig | null>(
    cachedGambleConfig
  );
  useEffect(() => {
    if (cachedGambleConfig) {
      setConfig(cachedGambleConfig);
      return;
    }
    let cancelled = false;
    loadGambleLittleGameConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}

// npcType: 0 = 吕文才, 1 = 赌场老板
type NpcType = 0 | 1;

type GamePhase =
  | "choose"   // 等待玩家选大/小
  | "shaking"  // 摇骰子动画
  | "opening"  // 开盘动画
  | "result";  // 显示结果

export interface GambleGuiProps {
  isVisible: boolean;
  cost: number;
  npcType: NpcType;
  playerMoney: number;
  onResult: (win: boolean) => void;
}

const rollDie = (): number => Math.floor(Math.random() * 6) + 1;

const DICE_EMOJI = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export const GambleGui: React.FC<GambleGuiProps> = ({
  isVisible,
  cost,
  npcType,
  playerMoney,
  onResult,
}) => {
  const config = useGambleLittleGameConfig();

  const [phase, setPhase] = useState<GamePhase>("choose");
  const [diceValues, setDiceValues] = useState<[number, number, number]>([1, 1, 1]);
  const [message, setMessage] = useState("猜大还是猜小？");
  const [win, setWin] = useState(false);

  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      setPhase("choose");
      setDiceValues([1, 1, 1]);
      setMessage("猜大还是猜小？（11以上为大，10以下为小）");
      setWin(false);
    }
  }, [isVisible]);

  const handleChoose = useCallback(
    (choice: "big" | "small") => {
      if (phase !== "choose") return;
      setMessage("摇骰子中……");
      setPhase("shaking");

      shakeTimerRef.current = setTimeout(() => {
        const d1 = rollDie();
        const d2 = rollDie();
        const d3 = rollDie();
        setDiceValues([d1, d2, d3]);

        const total = d1 + d2 + d3;
        const resultIsBig = total >= 11;
        const playerWin =
          (choice === "big" && resultIsBig) || (choice === "small" && !resultIsBig);

        setWin(playerWin);
        setPhase("opening");
        setMessage("开盘！");

        openTimerRef.current = setTimeout(() => {
          const sizeText = resultIsBig ? `大（${total}点）` : `小（${total}点）`;
          setMessage(playerWin ? `你赢了！${sizeText}` : `你输了！${sizeText}`);
          setPhase("result");
        }, 1000);
      }, 1500);
    },
    [phase]
  );

  const handleQuit = useCallback(() => {
    if (phase === "result" || phase === "choose") {
      onResult(win);
    }
  }, [phase, win, onResult]);

  if (!isVisible || !config) return null;

  const bossFaceImage =
    npcType === 0 ? config.luFace.image : config.bossFace.image;
  const bossLeft = npcType === 0 ? config.luFace.left : config.bossFace.left;
  const bossTop = npcType === 0 ? config.luFace.top : config.bossFace.top;

  const windowW = config.window.width || 640;
  const windowH = config.window.height || 480;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        zIndex: 200,
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          position: "relative",
          width: windowW,
          height: windowH,
          overflow: "hidden",
        }}
      >
        {/* 背景 */}
        {config.window.image && (
          <div
            style={{
              position: "absolute",
              left: config.window.left,
              top: config.window.top,
              width: windowW,
              height: windowH,
            }}
          >
            <AsfAnimatedSprite
              path={config.window.image}
              autoPlay={false}
              loop={false}
            />
          </div>
        )}

        {/* 玩家头像 */}
        <div
          style={{
            position: "absolute",
            left: config.playerFace.left,
            top: config.playerFace.top,
            width: config.playerFace.width || 30,
            height: config.playerFace.height || 30,
          }}
        >
          <AsfAnimatedSprite path={config.playerFace.image} autoPlay loop />
        </div>

        {/* NPC 头像 */}
        <div
          style={{
            position: "absolute",
            left: bossLeft,
            top: bossTop,
            width: config.bossFace.width || 30,
            height: config.bossFace.height || 30,
          }}
        >
          <AsfAnimatedSprite path={bossFaceImage} autoPlay loop />
        </div>

        {/* 摇骰子动画 */}
        {phase === "shaking" && config.gambling.image && (
          <div
            style={{
              position: "absolute",
              left: config.gambling.left,
              top: config.gambling.top,
              width: config.gambling.width || 30,
              height: config.gambling.height || 30,
            }}
          >
            <AsfAnimatedSprite path={config.gambling.image} autoPlay loop />
          </div>
        )}

        {/* 开盘动画 */}
        {phase === "opening" && (
          <>
            {config.openBg.image && (
              <div
                style={{
                  position: "absolute",
                  left: config.openBg.left,
                  top: config.openBg.top,
                  width: config.openBg.width || 60,
                  height: config.openBg.height || 75,
                }}
              >
                <AsfAnimatedSprite
                  path={config.openBg.image}
                  autoPlay={false}
                  loop={false}
                />
              </div>
            )}
            {config.opening.image && (
              <div
                style={{
                  position: "absolute",
                  left: config.opening.left,
                  top: config.opening.top,
                  width: config.opening.width || 562,
                  height: config.opening.height || 329,
                }}
              >
                <AsfAnimatedSprite
                  path={config.opening.image}
                  autoPlay
                  loop={false}
                />
              </div>
            )}
          </>
        )}

        {/* 三颗骰子（result 阶段） */}
        {phase === "result" &&
          ([config.dice1, config.dice2, config.dice3] as ElementConfig[]).map(
            (diceConf, idx) => (
              <div
                key={`dice-${idx}`}
                style={{
                  position: "absolute",
                  left: diceConf.left,
                  top: diceConf.top,
                  width: diceConf.width || 30,
                  height: diceConf.height || 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  color: "#fff",
                  textShadow: "0 0 4px #000",
                }}
              >
                {DICE_EMOJI[diceValues[idx] - 1]}
              </div>
            )
          )}

        {/* 猜大/猜小按钮（choose 阶段） */}
        {phase === "choose" && (
          <>
            <button
              type="button"
              style={{
                position: "absolute",
                left: config.gambleBig.left,
                top: config.gambleBig.top,
                width: config.gambleBig.width || 120,
                height: config.gambleBig.height || 70,
                background: "rgba(180,60,30,0.85)",
                border: "2px solid rgba(255,180,80,0.8)",
                color: "#ffe4b0",
                fontSize: 22,
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: 4,
              }}
              onClick={() => handleChoose("big")}
              onMouseEnter={() => { if (config.gambleBig.sound) playUiSound(config.gambleBig.sound); }}
            >
              大
            </button>
            <button
              type="button"
              style={{
                position: "absolute",
                left: config.gambleSmall.left,
                top: config.gambleSmall.top,
                width: config.gambleSmall.width || 120,
                height: config.gambleSmall.height || 70,
                background: "rgba(30,80,180,0.85)",
                border: "2px solid rgba(80,180,255,0.8)",
                color: "#b0d8ff",
                fontSize: 22,
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: 4,
              }}
              onClick={() => handleChoose("small")}
              onMouseEnter={() => { if (config.gambleSmall.sound) playUiSound(config.gambleSmall.sound); }}
            >
              小
            </button>
            {/* 下注按钮（装饰性） */}
            {config.chipin.image && (
              <div
                style={{
                  position: "absolute",
                  left: config.chipin.left,
                  top: config.chipin.top,
                  width: config.chipin.width || 103,
                  height: config.chipin.height || 33,
                  pointerEvents: "none",
                }}
              >
                <AsfAnimatedSprite
                  path={config.chipin.image}
                  autoPlay={false}
                  loop={false}
                />
              </div>
            )}
          </>
        )}

        {/* 消息框 */}
        <div
          style={{
            position: "absolute",
            left: config.message.left,
            top: config.message.top,
            width: config.message.width || 280,
            height: config.message.height || 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {config.message.image && (
            <AsfAnimatedSprite
              path={config.message.image}
              autoPlay={false}
              loop={false}
              style={{ position: "absolute", inset: 0 }}
            />
          )}
          <span
            style={{
              position: "relative",
              color: "#fff1b0",
              fontSize: 14,
              textShadow: "0 1px 3px #000",
              zIndex: 1,
            }}
          >
            {message}
          </span>
        </div>

        {/* 玩家钱标签 */}
        <span
          style={{
            position: "absolute",
            left: config.labPlayer.left,
            top: config.labPlayer.top,
            width: config.labPlayer.width || 80,
            color: "#fff1b0",
            fontSize: 12,
            textShadow: "0 1px 2px #000",
          }}
        >
          {playerMoney} 两
        </span>

        {/* 下注额标签 */}
        <span
          style={{
            position: "absolute",
            left: config.labChipIn.left,
            top: config.labChipIn.top,
            width: config.labChipIn.width || 80,
            color: "#fff1b0",
            fontSize: 12,
            textShadow: "0 1px 2px #000",
          }}
        >
          下注: {cost}
        </span>

        {/* 离开按钮 */}
        {(phase === "result" || phase === "choose") && config.quit.image && (
          <div
            style={{
              position: "absolute",
              left: config.quit.left,
              top: config.quit.top,
              width: config.quit.width || 103,
              height: config.quit.height || 36,
              cursor: "pointer",
            }}
            onClick={handleQuit}
            onMouseEnter={() => { if (config.quit.sound) playUiSound(config.quit.sound); }}
          >
            <AsfAnimatedSprite
              path={config.quit.image}
              autoPlay={false}
              loop={false}
            />
          </div>
        )}

        {/* 结果色彩叠加 */}
        {phase === "result" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: win
                ? "radial-gradient(ellipse at center, rgba(255,220,0,0.18) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(180,0,0,0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
};
