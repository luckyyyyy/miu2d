/**
 * Audio Manager - 精简版
 * 支持：背景音乐、音效、循环音效、3D空间音效
 */

import { DefaultPaths, getResourceUrl } from "../config/resourcePaths";
import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { resourceLoader } from "../resource/resourceLoader";

export interface AudioManagerConfig {
  musicBasePath?: string;
  soundBasePath?: string;
  masterVolume?: number;
  musicVolume?: number;
  soundVolume?: number;
  ambientVolume?: number;
}

/** 3D 音效实例 */
export interface Sound3DInstance {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gainNode: GainNode;
  isLooping: boolean;
}

// 常量
const SOUND_MAX_DISTANCE = 1000; // 最大听觉距离（像素）
const SOUND_3D_MAX_DISTANCE = 8; // Web Audio 坐标缩放因子

export class AudioManager {
  private musicBasePath: string;
  private soundBasePath: string;

  // 音量控制
  private masterVolume = 1.0;
  private musicVolume = 0.7;
  private soundVolume = 1.0;
  private ambientVolume = 1.0;

  // 背景音乐
  private currentMusicFile = "";
  private musicElement: HTMLAudioElement | null = null;
  private isMusicPaused = false;
  private isMusicDisabled = false;
  private isAmbientDisabled = false;

  // 循环音效（脚步声）
  private loopingSoundFile = "";
  private loopingSourceNode: AudioBufferSourceNode | null = null;
  private loopingGainNode: GainNode | null = null;

  // Web Audio
  private audioContext: AudioContext | null = null;

  // 音效实例缓存（同一音效同时只播一个，复用实例）
  private soundInstances = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  // 3D 音效
  private listenerPosition: Vector2 = { x: 0, y: 0 };
  private sound3DInstances = new Map<string, Sound3DInstance>();
  private sound3DLoading = new Set<string>();
  private sound3DStopping = new Set<string>();

  constructor(config: AudioManagerConfig = {}) {
    this.musicBasePath = config.musicBasePath || DefaultPaths.musicBasePath;
    this.soundBasePath = config.soundBasePath || DefaultPaths.soundBasePath;
    this.masterVolume = config.masterVolume ?? 1.0;
    this.musicVolume = config.musicVolume ?? 0.7;
    this.soundVolume = config.soundVolume ?? 1.0;
    this.ambientVolume = config.ambientVolume ?? 1.0;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  // ==================== 背景音乐 ====================

  playMusic(fileName: string): void {
    if (!fileName) {
      this.stopMusic();
      return;
    }

    const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "").toLowerCase();

    if (this.isMusicDisabled) {
      this.currentMusicFile = baseName;
      return;
    }

    // 已在播放相同音乐
    if (this.currentMusicFile === baseName && this.musicElement && !this.isMusicPaused) {
      return;
    }

    this.stopMusic();
    this.currentMusicFile = baseName;

    // 尝试 OGG，失败则尝试 MP3
    this.loadMusic(baseName, ".ogg");
  }

  private loadMusic(baseName: string, ext: string): void {
    const musicPath = `${this.musicBasePath}/${baseName}${ext}`;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = this.masterVolume * this.musicVolume;

    audio.onerror = () => {
      if (ext === ".ogg") {
        this.loadMusic(baseName, ".mp3");
      }
    };

    audio.oncanplaythrough = () => {
      if (this.currentMusicFile !== baseName) return;
      this.musicElement = audio;
      audio.play().catch(() => {});
    };

    audio.src = getResourceUrl(musicPath);
    audio.load();
  }

  stopMusic(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.src = "";
      this.musicElement = null;
    }
    this.currentMusicFile = "";
    this.isMusicPaused = false;
  }

  pauseMusic(): void {
    if (this.musicElement && !this.isMusicPaused) {
      this.musicElement.pause();
      this.isMusicPaused = true;
    }
  }

  resumeMusic(): void {
    if (this.isMusicDisabled) {
      this.isMusicDisabled = false;
      if (this.currentMusicFile) this.playMusic(this.currentMusicFile);
      return;
    }
    if (this.musicElement && this.isMusicPaused) {
      this.musicElement.play().catch(() => {});
      this.isMusicPaused = false;
    }
  }

  setMusicEnabled(enabled: boolean): void {
    this.isMusicDisabled = !enabled;
    if (!enabled) {
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicElement.src = "";
        this.musicElement = null;
      }
    } else if (this.currentMusicFile) {
      this.playMusic(this.currentMusicFile);
    }
  }

  isMusicEnabled(): boolean {
    return !this.isMusicDisabled;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getCurrentMusicFile(): string {
    return this.currentMusicFile;
  }

  // ==================== 音效 ====================

  playSound(fileName: string): void {
    if (!fileName) return;
    // 保留原始扩展名，无扩展名时默认 .xnb
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    const soundFile = hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;
    const soundPath = `${this.soundBasePath}/${soundFile}`;
    this.playAudioFile(soundPath, this.masterVolume * this.soundVolume);
  }

  private async playAudioFile(path: string, volume: number): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      // 如果同名音效正在播放，跳过（不顶掉）
      if (this.soundInstances.has(path)) return;

      // 尝试加载原始路径，失败则尝试 .xnb
      let buffer = await resourceLoader.loadAudio(path);
      let actualPath = path;
      if (!buffer && !path.toLowerCase().endsWith(".xnb")) {
        actualPath = path.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
        buffer = await resourceLoader.loadAudio(actualPath);
      }
      if (!buffer) return;

      // 再次检查（异步加载期间可能已经有了）
      if (this.soundInstances.has(actualPath)) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      // 缓存实例
      this.soundInstances.set(actualPath, { source, gain });
      source.onended = () => {
        if (this.soundInstances.get(actualPath)?.source === source) {
          this.soundInstances.delete(actualPath);
        }
      };

      source.start(0);
    } catch (e) {
      logger.warn(`[AudioManager] playAudioFile error: ${e}`);
    }
  }

  stopAllSounds(): void {
    // 停止所有音效实例
    for (const [, instance] of this.soundInstances) {
      try {
        instance.source.stop();
      } catch {
        /* ignore */
      }
      instance.source.disconnect();
      instance.gain.disconnect();
    }
    this.soundInstances.clear();
    this.stopLoopingSound();
  }

  // ==================== 循环音效（脚步声） ====================

  playLoopingSound(fileName: string): void {
    if (!fileName) {
      this.stopLoopingSound();
      return;
    }

    // 保留原始扩展名，无扩展名时默认 .xnb
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    const soundFile = hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;

    if (this.loopingSoundFile === soundFile && this.loopingSourceNode) return;

    this.stopLoopingSound();
    this.loopingSoundFile = soundFile;

    const soundPath = `${this.soundBasePath}/${soundFile}`;
    this.startLoopingSound(soundPath, soundFile);
  }

  private async startLoopingSound(path: string, baseName: string): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      // 尝试加载原始路径，失败则尝试 .xnb
      let buffer = await resourceLoader.loadAudio(path);
      if (!buffer && !path.toLowerCase().endsWith(".xnb")) {
        const xnbPath = path.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
        buffer = await resourceLoader.loadAudio(xnbPath);
      }
      if (!buffer || this.loopingSoundFile !== baseName) return;

      this.stopLoopingSoundInternal();

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.soundVolume * 2.5;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      this.loopingSourceNode = source;
      this.loopingGainNode = gain;
    } catch (e) {
      logger.warn(`[AudioManager] startLoopingSound error: ${e}`);
      this.loopingSoundFile = "";
    }
  }

  private stopLoopingSoundInternal(): void {
    if (this.loopingSourceNode) {
      try {
        this.loopingSourceNode.stop();
      } catch {
        /* ignore */
      }
      this.loopingSourceNode.disconnect();
      this.loopingSourceNode = null;
    }
    if (this.loopingGainNode) {
      this.loopingGainNode.disconnect();
      this.loopingGainNode = null;
    }
  }

  stopLoopingSound(): void {
    this.stopLoopingSoundInternal();
    this.loopingSoundFile = "";
  }

  isLoopingSoundPlaying(): boolean {
    return this.loopingSourceNode !== null;
  }

  // ==================== 音量控制 ====================

  setSoundVolume(volume: number): void {
    this.soundVolume = Math.max(0, Math.min(1, volume));
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }
  }

  getSoundVolume(): number {
    return this.soundVolume;
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    for (const instance of this.sound3DInstances.values()) {
      instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
    }
  }

  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  setAmbientEnabled(enabled: boolean): void {
    this.isAmbientDisabled = !enabled;
    if (!enabled) this.stopAll3DSounds();
  }

  isAmbientEnabled(): boolean {
    return !this.isAmbientDisabled;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
    }
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }
    for (const instance of this.sound3DInstances.values()) {
      instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  // ==================== 3D 音效 ====================

  setListenerPosition(position: Vector2): void {
    this.listenerPosition = { x: position.x, y: position.y };
  }

  getListenerPosition(): Vector2 {
    return this.listenerPosition;
  }

  // 3D 一次性音效实例缓存（同一音效同时只播一个）
  private sound3DOnceInstances = new Map<
    string,
    { source: AudioBufferSourceNode; panner: PannerNode; gain: GainNode }
  >();

  /** 播放一次性 3D 音效 */
  async play3DSoundOnce(fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;

    // 保留原始扩展名，无扩展名时默认 .xnb
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    const soundFile = hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;
    const direction = this.getDirection(emitterPosition);
    const distance = Math.hypot(direction.x, direction.y);

    if (distance > SOUND_MAX_DISTANCE) return;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;

      // 如果同名音效正在播放，跳过（不顶掉）
      if (this.sound3DOnceInstances.has(soundPath)) return;

      // 尝试加载原始路径，失败则尝试 .xnb
      let buffer = await resourceLoader.loadAudio(soundPath);
      let actualPath = soundPath;
      if (!buffer && !soundPath.toLowerCase().endsWith(".xnb")) {
        actualPath = soundPath.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
        buffer = await resourceLoader.loadAudio(actualPath);
      }
      if (!buffer) return;

      // 再次检查（异步加载期间可能已经有了）
      if (this.sound3DOnceInstances.has(actualPath)) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(ctx, direction);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      // 缓存实例
      this.sound3DOnceInstances.set(actualPath, { source, panner, gain });
      source.onended = () => {
        if (this.sound3DOnceInstances.get(actualPath)?.source === source) {
          this.sound3DOnceInstances.delete(actualPath);
        }
      };

      source.start(0);
    } catch (e) {
      logger.warn(`[AudioManager] play3DSoundOnce error: ${e}`);
    }
  }

  /** 播放循环 3D 音效 */
  async play3DSoundLoop(id: string, fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;

    // 已存在则更新位置
    if (this.sound3DInstances.has(id)) {
      this.update3DSoundPosition(id, emitterPosition);
      return;
    }

    if (this.sound3DLoading.has(id) || this.sound3DStopping.has(id)) return;

    const direction = this.getDirection(emitterPosition);
    if (Math.hypot(direction.x, direction.y) > SOUND_MAX_DISTANCE) return;

    this.sound3DLoading.add(id);
    // 保留原始扩展名，无扩展名时默认 .xnb
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    const soundFile = hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;
      // 尝试加载原始路径，失败则尝试 .xnb
      let buffer = await resourceLoader.loadAudio(soundPath);
      if (!buffer && !soundPath.toLowerCase().endsWith(".xnb")) {
        const xnbPath = soundPath.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
        buffer = await resourceLoader.loadAudio(xnbPath);
      }
      if (!buffer || this.sound3DInstances.has(id)) {
        this.sound3DLoading.delete(id);
        return;
      }

      const currentDirection = this.getDirection(emitterPosition);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const panner = this.createPannerNode(ctx, currentDirection);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      this.sound3DInstances.set(id, { source, panner, gainNode: gain, isLooping: true });
      this.sound3DLoading.delete(id);
    } catch (e) {
      this.sound3DLoading.delete(id);
      logger.warn(`[AudioManager] play3DSoundLoop error: ${e}`);
    }
  }

  /** 更新 3D 音效位置 */
  update3DSoundPosition(id: string, emitterPosition: Vector2): void {
    const instance = this.sound3DInstances.get(id);
    if (!instance) return;

    const direction = this.getDirection(emitterPosition);
    this.apply3DPosition(instance.panner, direction);
  }

  /** 停止指定 3D 音效 */
  stop3DSound(id: string): void {
    const instance = this.sound3DInstances.get(id);
    if (!instance || this.sound3DStopping.has(id)) return;

    this.sound3DStopping.add(id);
    this.sound3DInstances.delete(id);

    try {
      instance.source.stop();
    } catch {
      /* ignore */
    }
    instance.source.disconnect();
    instance.gainNode.disconnect();

    setTimeout(() => this.sound3DStopping.delete(id), 100);
  }

  /** 停止所有 3D 音效 */
  stopAll3DSounds(): void {
    for (const [id, instance] of this.sound3DInstances) {
      try {
        instance.source.stop();
      } catch {
        /* ignore */
      }
      instance.source.disconnect();
      instance.gainNode.disconnect();
      this.sound3DStopping.add(id);
      setTimeout(() => this.sound3DStopping.delete(id), 100);
    }
    this.sound3DInstances.clear();
    this.sound3DRandomPlaying.clear();
  }

  // 随机音效播放状态
  private sound3DRandomPlaying = new Set<string>();

  /** 随机播放 3D 音效（每帧有概率触发） */
  async play3DSoundRandom(
    id: string,
    fileName: string,
    emitterPosition: Vector2,
    chance: number
  ): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;
    if (this.sound3DRandomPlaying.has(id)) return;
    if (Math.random() > chance) return;

    const direction = this.getDirection(emitterPosition);
    if (Math.hypot(direction.x, direction.y) > SOUND_MAX_DISTANCE) return;

    this.sound3DRandomPlaying.add(id);
    // 保留原始扩展名，无扩展名时默认 .xnb
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    const soundFile = hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;
      // 尝试加载原始路径，失败则尝试 .xnb
      let buffer = await resourceLoader.loadAudio(soundPath);
      if (!buffer && !soundPath.toLowerCase().endsWith(".xnb")) {
        const xnbPath = soundPath.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
        buffer = await resourceLoader.loadAudio(xnbPath);
      }
      if (!buffer) {
        this.sound3DRandomPlaying.delete(id);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(ctx, direction);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => this.sound3DRandomPlaying.delete(id);
      source.start(0);
    } catch (e) {
      this.sound3DRandomPlaying.delete(id);
      logger.warn(`[AudioManager] play3DSoundRandom error: ${e}`);
    }
  }

  private getDirection(emitterPosition: Vector2): Vector2 {
    return {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };
  }

  private createPannerNode(ctx: AudioContext, direction: Vector2): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "linear";
    panner.refDistance = 1;
    panner.maxDistance = SOUND_3D_MAX_DISTANCE;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;
    this.apply3DPosition(panner, direction);
    return panner;
  }

  private apply3DPosition(panner: PannerNode, direction: Vector2): void {
    const distance = Math.hypot(direction.x, direction.y);

    if (distance === 0) {
      panner.positionX.value = 0;
      panner.positionY.value = 0;
      panner.positionZ.value = 0;
    } else if (distance > SOUND_MAX_DISTANCE) {
      panner.positionX.value = 999999;
      panner.positionY.value = 0;
      panner.positionZ.value = 999999;
    } else {
      const scale = (distance / SOUND_MAX_DISTANCE) * SOUND_3D_MAX_DISTANCE;
      panner.positionX.value = (direction.x / distance) * scale;
      panner.positionY.value = 0;
      panner.positionZ.value = (direction.y / distance) * scale;
    }
  }

  // ==================== 清理 ====================

  dispose(): void {
    this.stopMusic();
    this.stopLoopingSound();
    this.stopAll3DSounds();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  // ==================== 兼容性接口 ====================

  /** 检查是否允许自动播放（总是返回 true，简化处理） */
  isAutoplayAllowed(): boolean {
    return true;
  }

  /** 请求自动播放权限（空实现，用户交互时自动解锁） */
  async requestAutoplayPermission(): Promise<boolean> {
    return true;
  }

  updateAll3DSounds(): void {
    // 由 ObjManager 逐个更新位置，这里不需要实现
  }
}
