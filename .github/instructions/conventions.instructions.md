---
applyTo: "packages/**"
---

# 编码规范

## 必须遵守

1. **禁止 `any`** — 使用 `unknown` + 类型守卫
2. **禁止 `console.log`** — 使用 `logger`
3. **禁止静默忽略错误** — catch 块必须记录或重新抛出
4. **禁止无意义 getter** — 直接用公共属性

## 示例

```typescript
// ❌
function process(data: any) {}
try { } catch { }
get name() { return this._name; }

// ✅
function process(data: unknown) { if (isValid(data)) { ... } }
try { } catch (e) { logger.error(e); throw e; }
name = "";
```

## 日志

```typescript
import { logger } from "@miu2d/engine/core/logger";
logger.info("[Module] 信息");   // 避免在 update loop 中调用
```

## 命名

| 类别 | 规范 |
|------|------|
| 类 | `PascalCase` |
| 函数 / 变量 | `camelCase` |
| 常量 | `UPPER_SNAKE_CASE` |
| TS 文件 | `kebab-case.ts` |
| React 组件 | `PascalCase.tsx` |
