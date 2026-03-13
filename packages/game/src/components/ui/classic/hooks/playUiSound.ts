/**
 * UI button hover sound utility
 * Uses resourceLoader (supports XNB decoding) + Web Audio API.
 * Module-level source ref stops any previous UI sound before playing a new one.
 */

import { getResourceRoot } from "@miu2d/engine/resource";
import { resourceLoader } from "@miu2d/engine/resource/resource-loader";

// Shared AudioContext (lazy)
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

// Stop previous UI sound before playing next
let lastSource: AudioBufferSourceNode | null = null;

/**
 * Load an AudioBuffer trying .xnb first, then original path.
 * Mirrors AudioManager.loadAudioBuffer logic.
 */
async function loadUiAudioBuffer(soundPath: string): Promise<AudioBuffer | null> {
  const isXnb = /\.xnb$/i.test(soundPath);
  if (!isXnb) {
    const xnbPath = soundPath.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
    const buf = await resourceLoader.loadAudio(xnbPath);
    if (buf) return buf;
  }
  return resourceLoader.loadAudio(soundPath);
}

/**
 * Play a UI button hover sound.
 * @param soundFileName - filename relative to content/sound/ (e.g. "界-大按钮.wav")
 * @param volume - volume level 0~1, defaults to 0.6
 */
export function playUiSound(soundFileName: string, volume = 0.6): void {
  if (!soundFileName) return;
  const soundPath = `${getResourceRoot()}/content/sound/${soundFileName.toLowerCase()}`;

  void (async () => {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();

      const buffer = await loadUiAudioBuffer(soundPath);
      if (!buffer) return;

      // Stop previous UI sound
      if (lastSource) {
        try {
          lastSource.stop();
        } catch {
          /* already ended */
        }
        lastSource.disconnect();
        lastSource = null;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);

      lastSource = source;
      source.onended = () => {
        if (lastSource === source) lastSource = null;
        source.disconnect();
        gain.disconnect();
      };
      source.start(0);
    } catch {
      // Silently ignore audio errors
    }
  })();
}
