/**
 * LuaExecutor - Lua script executor using wasmoon (Lua 5.4 WASM)
 *
 * Design:
 * - Uses LuaEngine from wasmoon for Lua 5.4 support in the browser
 * - wasmoon natively bridges JS async functions via Lua coroutines
 *   (JS Promises are automatically yield/resume'd by wasmoon's proxy)
 * - All GameAPI methods are exposed as PascalCase Lua global functions
 * - Shares the same GameAPI and BlockingResolver as the DSL executor
 *
 * Usage:
 *   const luaExec = new LuaExecutor(api);
 *   await luaExec.init();
 *   await luaExec.runString('Talk(0, "你好!")');
 */

import { LuaFactory } from "wasmoon";
import type LuaEngine from "wasmoon/dist/engine";
import { logger } from "../../core/logger";
import type { GameAPI } from "../api/game-api";
import { LUA_API_FUNCTIONS, registerLuaAPIBindings } from "./lua-api-bindings";

export class LuaExecutor {
  private engine: LuaEngine | null = null;
  private api: GameAPI;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(api: GameAPI) {
    this.api = api;
  }

  /**
   * Initialize the Lua WASM engine (must be called before running scripts).
   * Safe to call multiple times — only initializes once.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    await this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      logger.info("[LuaExecutor] Initializing Lua WASM engine...");

      // Use local glue.wasm (copied to public/wasm/) instead of the unpkg CDN default
      const factory = new LuaFactory("/wasm/glue.wasm");
      this.engine = await factory.createEngine({
        openStandardLibs: true,
        injectObjects: true,
        enableProxy: true,
      });

      // Register all GameAPI bindings as PascalCase Lua globals
      registerLuaAPIBindings((name: string, value: unknown) => {
        this.engine!.global.set(name, value);
      }, this.api);

      // Register a Lua print function that goes to our logger
      this.engine.global.set("print", (...args: unknown[]) => {
        logger.info(`[Lua] ${args.map(String).join("\t")}`);
      });

      // Wrap all blocking (async) API functions so that they auto-await their
      // returned Promise via wasmoon's :await() coroutine-yield bridge.
      // Without this, Lua receives the Promise as a userdata and continues
      // immediately — Talk/Say/PlayerWalkTo etc. would not block.
      const blockingFuncs = LUA_API_FUNCTIONS.filter((f) => f.blocking).map((f) => f.name);
      const uniqueNames = [...new Set(blockingFuncs)];
      const wrapperLines = uniqueNames.map(
        (name) =>
          `if type(${name}) ~= "nil" then\n` +
          `  local __raw_${name} = ${name}\n` +
          `  ${name} = function(...) local p = __raw_${name}(...); if type(p) == "userdata" then return p:await() end; return p end\n` +
          `end`
      );
      await this.engine.doString(wrapperLines.join("\n"));
      logger.info(`[LuaExecutor] Wrapped ${uniqueNames.length} blocking functions with :await()`);

      this.isInitialized = true;
      logger.info("[LuaExecutor] Lua engine initialized successfully");
    } catch (error) {
      this.initPromise = null;
      logger.error("[LuaExecutor] Failed to initialize Lua engine:", error);
      throw error;
    }
  }

  /**
   * Execute a Lua script string
   */
  async runString(code: string, fileName?: string): Promise<void> {
    await this.init();

    if (!this.engine) {
      throw new Error("Lua engine not initialized");
    }

    const name = fileName ?? "[lua-inline]";
    logger.log(`[LuaExecutor] Running Lua script: ${name}`);

    try {
      await this.engine.doString(code);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[LuaExecutor] Error in ${name}: ${msg}`);
      throw error;
    }
  }

  /**
   * Execute a Lua script file (load content and run)
   */
  async runFile(content: string, filePath: string): Promise<void> {
    await this.runString(content, filePath);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.engine) {
      try {
        this.engine.global.close();
      } catch {
        // ignore close errors
      }
      this.engine = null;
      this.isInitialized = false;
      this.initPromise = null;
      logger.info("[LuaExecutor] Lua engine disposed");
    }
  }
}
