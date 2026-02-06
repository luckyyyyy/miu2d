/**
 * RectBatcher - 矩形批量渲染器
 *
 * 将大量 fillRect 调用合并为少量 draw call，避免天气粒子等场景
 * 每个矩形都单独触发一次 drawArrays + bufferData。
 *
 * 工作方式：
 * 1. 同一颜色的矩形打包到同一批次
 * 2. 颜色切换时 flush 当前批次
 * 3. 预分配 Float32Array 避免每帧 GC
 *
 * 顶点格式：每顶点 2 个 float [x, y]
 * 每矩形 = 2 三角形 = 6 顶点 = 12 floats
 */

import type { RectProgram } from "./shaders";
import type { RGBAColor } from "./colorUtils";

/** 每矩形顶点数 */
const VERTICES_PER_RECT = 6;
/** 每顶点 float 数 */
const FLOATS_PER_VERTEX = 2;
/** 每矩形 float 数 */
const FLOATS_PER_RECT = VERTICES_PER_RECT * FLOATS_PER_VERTEX;
/** 单批次最大矩形数 */
const MAX_RECTS_PER_BATCH = 4096;

export class RectBatcher {
  private gl: WebGLRenderingContext;
  private program: RectProgram;

  // GPU buffers（预分配）
  private vbo: WebGLBuffer;
  private vertexData: Float32Array;

  // 批次状态
  private rectCount = 0;
  private currentColor: RGBAColor = { r: 0, g: 0, b: 0, a: 0 };
  private hasColor = false;

  // 外部应用的全局 alpha
  private _globalAlpha = 1;

  // 统计
  private _drawCalls = 0;
  private _rectCount = 0;

  constructor(gl: WebGLRenderingContext, program: RectProgram) {
    this.gl = gl;
    this.program = program;

    this.vbo = gl.createBuffer()!;
    this.vertexData = new Float32Array(MAX_RECTS_PER_BATCH * FLOATS_PER_RECT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);
  }

  /** 设置全局 alpha（由 renderer state 管理） */
  set globalAlpha(value: number) {
    // alpha 变化也需要 flush（因为 uniform）
    if (value !== this._globalAlpha && this.rectCount > 0) {
      this.flush();
    }
    this._globalAlpha = value;
  }

  get globalAlpha(): number {
    return this._globalAlpha;
  }

  resetStats(): void {
    this._drawCalls = 0;
    this._rectCount = 0;
  }

  get drawCalls(): number {
    return this._drawCalls;
  }

  get totalRects(): number {
    return this._rectCount;
  }

  /**
   * 提交一个矩形到批次
   */
  draw(x: number, y: number, width: number, height: number, color: RGBAColor): void {
    // 颜色切换 → flush
    if (
      this.hasColor &&
      (color.r !== this.currentColor.r ||
        color.g !== this.currentColor.g ||
        color.b !== this.currentColor.b ||
        color.a !== this.currentColor.a)
    ) {
      this.flush();
    }

    this.currentColor = color;
    this.hasColor = true;

    // 批次满 → flush
    if (this.rectCount >= MAX_RECTS_PER_BATCH) {
      this.flush();
    }

    // 写入顶点
    const offset = this.rectCount * FLOATS_PER_RECT;
    const data = this.vertexData;
    const x0 = x;
    const y0 = y;
    const x1 = x + width;
    const y1 = y + height;

    // 三角形 1: 左上 → 右上 → 左下
    data[offset] = x0;
    data[offset + 1] = y0;
    data[offset + 2] = x1;
    data[offset + 3] = y0;
    data[offset + 4] = x0;
    data[offset + 5] = y1;
    // 三角形 2: 右上 → 右下 → 左下
    data[offset + 6] = x1;
    data[offset + 7] = y0;
    data[offset + 8] = x1;
    data[offset + 9] = y1;
    data[offset + 10] = x0;
    data[offset + 11] = y1;

    this.rectCount++;
    this._rectCount++;
  }

  /**
   * 刷新当前批次到 GPU
   */
  flush(): void {
    if (this.rectCount === 0) return;

    const gl = this.gl;
    const prog = this.program;

    gl.useProgram(prog.program);

    // 设置颜色 uniform（batch 内所有矩形同色）
    const c = this.currentColor;
    gl.uniform4f(prog.u_color, c.r, c.g, c.b, c.a * this._globalAlpha);

    // 上传顶点数据
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.vertexData.subarray(0, this.rectCount * FLOATS_PER_RECT)
    );

    // 设置 attribute
    gl.enableVertexAttribArray(prog.a_position);
    gl.vertexAttribPointer(prog.a_position, 2, gl.FLOAT, false, 0, 0);

    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, this.rectCount * VERTICES_PER_RECT);

    this._drawCalls++;
    this.rectCount = 0;
  }

  dispose(): void {
    this.gl.deleteBuffer(this.vbo);
  }
}
