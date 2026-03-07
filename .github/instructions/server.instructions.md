---
applyTo: "packages/server/**"
---

# Server / tRPC 路由说明

## 新增 tRPC 路由

1. 在 `@miu2d/types` 中定义 `Schema` 和类型
2. 在 `packages/server/src/modules/<name>/<name>.router.ts` 创建 `@Router` 类
3. 在 `modules/index.ts` 中 `import "./<name>"`

```typescript
@Router({ alias: "example" })
export class ExampleRouter {
  @UseMiddlewares(requireUser)
  @Query({ input: z.object({ id: z.string() }), output: ExampleSchema })
  async getById(input: { id: string }, @Ctx() ctx: AuthenticatedContext) { ... }
}
```

## 目录结构

### `packages/server/src/`

```
modules/     # auth/ user/ game/ file/ magic/ goods/ level/ npc/ obj/ player/ shop/ talk/ save/ scene/
db/schema.ts # Drizzle 表结构
trpc/        # decorators, middlewares, context
```
