/**
 * Object tRPC 路由
 */

import {
  BatchImportObjInputSchema,
  BatchImportObjResultSchema,
  ClearAllObjsInputSchema,
  ClearAllObjsResultSchema,
  CreateObjInputSchema,
  DeleteObjInputSchema,
  GetObjInputSchema,
  ImportObjInputSchema,
  ListObjInputSchema,
  ObjListItemSchema,
  ObjSchema,
  UpdateObjInputSchema,
} from "@miu2d/types";
import { z } from "zod";
import type { AuthenticatedContext } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { Logger } from "../../utils/logger.js";
import { objService } from "./obj.service";

@Router({ alias: "obj" })
export class ObjRouter {
  private readonly logger = new Logger(ObjRouter.name);

  constructor() {
    this.logger.log("ObjRouter registered");
  }

  /**
   * 获取 Object 列表
   */
  @UseMiddlewares(requireUser)
  @Query({ input: ListObjInputSchema, output: z.array(ObjListItemSchema) })
  async list(input: z.infer<typeof ListObjInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.list(input, ctx.userId, ctx.language);
  }

  /**
   * 获取单个 Object 详情
   */
  @UseMiddlewares(requireUser)
  @Query({ input: GetObjInputSchema, output: ObjSchema.nullable() })
  async get(input: z.infer<typeof GetObjInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.get(input.gameId, input.id, ctx.userId, ctx.language);
  }

  /**
   * 创建 Object
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: CreateObjInputSchema, output: ObjSchema })
  async create(input: z.infer<typeof CreateObjInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.create(input, ctx.userId, ctx.language);
  }

  /**
   * 更新 Object
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: UpdateObjInputSchema, output: ObjSchema })
  async update(input: z.infer<typeof UpdateObjInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.update(input, ctx.userId, ctx.language);
  }

  /**
   * 删除 Object
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: DeleteObjInputSchema, output: z.object({ id: z.string() }) })
  async delete(input: z.infer<typeof DeleteObjInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.delete(input.gameId, input.id, ctx.userId, ctx.language);
  }

  /**
   * 从 INI 导入 Object
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ImportObjInputSchema, output: ObjSchema })
  async importFromIni(
    input: z.infer<typeof ImportObjInputSchema>,
    @Ctx() ctx: AuthenticatedContext
  ) {
    return objService.importFromIni(input, ctx.userId, ctx.language);
  }

  /**
   * 批量导入 Object（支持自动关联 objres）
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: BatchImportObjInputSchema, output: BatchImportObjResultSchema })
  async batchImportFromIni(
    input: z.infer<typeof BatchImportObjInputSchema>,
    @Ctx() ctx: AuthenticatedContext
  ) {
    return objService.batchImportFromIni(input, ctx.userId, ctx.language);
  }

  /**
   * 清空所有 Object 和 Object 资源
   */
  @UseMiddlewares(requireUser)
  @Mutation({ input: ClearAllObjsInputSchema, output: ClearAllObjsResultSchema })
  async clearAll(input: z.infer<typeof ClearAllObjsInputSchema>, @Ctx() ctx: AuthenticatedContext) {
    return objService.clearAll(input, ctx.userId, ctx.language);
  }
}
