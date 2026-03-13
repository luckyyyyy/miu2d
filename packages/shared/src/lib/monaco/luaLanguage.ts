/**
 * Lua Language Definition for Monaco Editor
 * 支持 Lua 5.4 语法高亮、游戏 API 自动补全和悬停提示
 */
import type { IRange, languages, Position } from "monaco-editor";
import { LUA_API_FUNCTIONS as GAME_API_FUNCTIONS } from "./gameApiDefinitions";

// biome-ignore lint/suspicious/noExplicitAny: Monaco editor type is dynamically loaded
type MonacoType = any;

/**
 * 语言ID
 */
export const LUA_LANGUAGE_ID = "miu2d-lua";

const GAME_API_NAMES = GAME_API_FUNCTIONS.map((f) => f.name);

/** Lua 关键字 */
const LUA_KEYWORDS = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
];

/** Lua 标准库函数 */
const LUA_BUILTINS = [
  "assert",
  "collectgarbage",
  "dofile",
  "error",
  "getmetatable",
  "ipairs",
  "load",
  "loadfile",
  "next",
  "pairs",
  "pcall",
  "print",
  "rawequal",
  "rawget",
  "rawlen",
  "rawset",
  "require",
  "select",
  "setmetatable",
  "tonumber",
  "tostring",
  "type",
  "warn",
  "xpcall",
  // string
  "string.byte",
  "string.char",
  "string.dump",
  "string.find",
  "string.format",
  "string.gmatch",
  "string.gsub",
  "string.len",
  "string.lower",
  "string.match",
  "string.pack",
  "string.packsize",
  "string.rep",
  "string.reverse",
  "string.sub",
  "string.unpack",
  "string.upper",
  // table
  "table.concat",
  "table.insert",
  "table.move",
  "table.pack",
  "table.remove",
  "table.sort",
  "table.unpack",
  // math
  "math.abs",
  "math.acos",
  "math.asin",
  "math.atan",
  "math.ceil",
  "math.cos",
  "math.deg",
  "math.exp",
  "math.floor",
  "math.fmod",
  "math.huge",
  "math.log",
  "math.max",
  "math.maxinteger",
  "math.min",
  "math.mininteger",
  "math.modf",
  "math.pi",
  "math.rad",
  "math.random",
  "math.randomseed",
  "math.sin",
  "math.sqrt",
  "math.tan",
  "math.tointeger",
  "math.type",
];

/**
 * 将 signature 字符串转换为 Monaco snippet insertText。
 * 例如 "(clientId, message)" → "Talk(${1:clientId}, ${2:message})"
 * 无参数 "()" → "Talk($1)"
 */
function buildSnippetInsertText(name: string, signature: string): string {
  // 取出第一对括号内的内容（忽略 "-> ..." 返回类型）
  const match = signature.match(/^\(([^)]*)\)/);
  if (!match) return `${name}($1)`;
  const paramStr = match[1].trim();
  if (!paramStr) return `${name}($1)`;

  const params = paramStr
    .split(",")
    .map((p) => p.trim().replace(/[?]$/, "").trim()) // 去掉可选标记 ?
    .filter(Boolean);

  if (params.length === 0) return `${name}($1)`;

  const snippetParams = params.map((p, i) => `\${${i + 1}:${p}}`).join(", ");
  return `${name}(${snippetParams})`;
}

/** Category 对应的颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  Player: "#4FC1FF",
  NPC: "#C586C0",
  Dialog: "#CE9178",
  Goods: "#4EC9B0",
  Magic: "#DCDCAA",
  Memo: "#9CDCFE",
  Map: "#569CD6",
  Obj: "#D7BA7D",
  Camera: "#B5CEA8",
  Audio: "#6A9955",
  Effect: "#C586C0",
  Timer: "#D4D4D4",
  Variable: "#9CDCFE",
  Input: "#4FC1FF",
  Save: "#CE9178",
  Script: "#DCDCAA",
};

/**
 * 注册 Lua 语言到 Monaco Editor
 */
export function registerLuaLanguage(monaco: MonacoType): void {
  // 检查是否已注册
  const languagesList = monaco.languages.getLanguages();
  if (languagesList.some((lang: { id: string }) => lang.id === LUA_LANGUAGE_ID)) {
    return;
  }

  // 注册语言
  monaco.languages.register({
    id: LUA_LANGUAGE_ID,
    extensions: [".lua"],
    aliases: ["Lua", "lua"],
  });

  // 语言配置
  monaco.languages.setLanguageConfiguration(LUA_LANGUAGE_ID, {
    comments: {
      lineComment: "--",
      blockComment: ["--[[", "]]"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "[[", close: "]]" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /^\s*--\s*#?region\b/,
        end: /^\s*--\s*#?endregion\b/,
      },
    },
    indentationRules: {
      increaseIndentPattern: /^\s*(else|elseif|for|function|if|repeat|while|do)\b.*$/,
      decreaseIndentPattern: /^\s*(end|else|elseif|until)\b.*$/,
    },
  } as languages.LanguageConfiguration);

  // Monarch 词法分析器
  monaco.languages.setMonarchTokensProvider(LUA_LANGUAGE_ID, {
    keywords: LUA_KEYWORDS,
    builtins: LUA_BUILTINS.filter((b) => !b.includes(".")),
    gameApiFunctions: GAME_API_NAMES,

    tokenizer: {
      root: [
        // 多行注释
        [/--\[\[/, "comment", "@blockComment"],
        // 单行注释
        [/--.*$/, "comment"],

        // 多行字符串
        [/\[\[/, "string", "@multiLineString"],

        // 字符串
        [/"/, "string", "@doubleQuoteString"],
        [/'/, "string", "@singleQuoteString"],

        // 数字
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],

        // 游戏 API 函数（PascalCase 全局函数）
        [
          /[A-Z][a-zA-Z0-9]*/,
          {
            cases: {
              "@gameApiFunctions": "function.gameapi",
              "@default": "identifier",
            },
          },
        ],

        // 标识符/关键字
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@builtins": "function.builtin",
              "@default": "identifier",
            },
          },
        ],

        // 运算符
        [/[+\-*/%^#~]/, "operator"],
        [/[<>=]=?/, "operator"],
        [/\.\.\.?/, "operator"],
        [/[;,.]/, "delimiter"],
        [/[{}()[\]]/, "@brackets"],
      ],

      blockComment: [
        [/\]\]/, "comment", "@pop"],
        [/./, "comment"],
      ],

      multiLineString: [
        [/\]\]/, "string", "@pop"],
        [/./, "string"],
      ],

      doubleQuoteString: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],

      singleQuoteString: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
    },
  } as languages.IMonarchLanguage);

  // ===== 自动补全 =====
  monaco.languages.registerCompletionItemProvider(LUA_LANGUAGE_ID, {
    triggerCharacters: [".", ":"],
    provideCompletionItems: (
      model: {
        getWordUntilPosition: (pos: Position) => {
          word: string;
          startColumn: number;
          endColumn: number;
        };
      },
      position: Position
    ) => {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = [];

      // 游戏 API 函数补全
      for (const func of GAME_API_FUNCTIONS) {
        const blockingBadge = func.blocking ? " ⏱" : "";
        const categoryColor = CATEGORY_COLORS[func.category] ?? "#D4D4D4";
        suggestions.push({
          label: {
            label: func.name,
            description: `[${func.category}]${blockingBadge}`,
          },
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: buildSnippetInsertText(func.name, func.signature),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `${func.name}${func.signature}`,
          documentation: {
            value: `**${func.category}** | ${func.description}${func.blocking ? "\n\n⏱ *阻塞操作*" : ""}`,
          },
          range,
          sortText: `0_${func.category}_${func.name}`,
          tags: [],
          command: { id: "editor.action.triggerParameterHints", title: "Trigger Parameter Hints" },
        } as languages.CompletionItem);
      }

      // Lua 关键字补全
      for (const kw of LUA_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: `1_${kw}`,
        } as languages.CompletionItem);
      }

      // Lua 内置函数补全
      for (const builtin of LUA_BUILTINS) {
        const parts = builtin.split(".");
        const label = parts.length > 1 ? parts[1] : builtin;
        suggestions.push({
          label: builtin,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${builtin}(`,
          detail: `Lua 标准库: ${builtin}`,
          range,
          sortText: `2_${label}`,
        } as languages.CompletionItem);
      }

      // Monaco snippet syntax uses ${n:placeholder} — build from parts to avoid lint warnings
      const $ = (n: number, text: string) => `\${${n}:${text}}`;
      const snippets: Array<{ label: string; insertText: string; documentation: string }> = [
        {
          label: "if-then-end",
          insertText: `if ${$(1, "condition")} then\n\t${$(2, "-- body")}\nend`,
          documentation: "If 语句",
        },
        {
          label: "if-then-else-end",
          insertText: `if ${$(1, "condition")} then\n\t${$(2, "-- then")}\nelse\n\t${$(3, "-- else")}\nend`,
          documentation: "If-Else 语句",
        },
        {
          label: "for-do-end",
          insertText: `for ${$(1, "i")} = ${$(2, "1")}, ${$(3, "10")} do\n\t${$(4, "-- body")}\nend`,
          documentation: "For 循环",
        },
        {
          label: "for-in-pairs",
          insertText: `for ${$(1, "k")}, ${$(2, "v")} in pairs(${$(3, "table")}) do\n\t${$(4, "-- body")}\nend`,
          documentation: "For-In-Pairs 循环",
        },
        {
          label: "while-do-end",
          insertText: `while ${$(1, "condition")} do\n\t${$(2, "-- body")}\nend`,
          documentation: "While 循环",
        },
        {
          label: "function",
          insertText: `function ${$(1, "name")}(${$(2, "args")})\n\t${$(3, "-- body")}\nend`,
          documentation: "函数定义",
        },
        {
          label: "local function",
          insertText: `local function ${$(1, "name")}(${$(2, "args")})\n\t${$(3, "-- body")}\nend`,
          documentation: "局部函数定义",
        },
      ];

      for (const snippet of snippets) {
        suggestions.push({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
          range,
          sortText: `3_${snippet.label}`,
        } as languages.CompletionItem);
      }

      return { suggestions };
    },
  });

  // ===== 悬停提示 =====
  monaco.languages.registerHoverProvider(LUA_LANGUAGE_ID, {
    provideHover: (
      model: {
        getWordAtPosition: (
          pos: Position
        ) => { word: string; startColumn: number; endColumn: number } | null;
      },
      position: Position
    ) => {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const func = GAME_API_FUNCTIONS.find((f) => f.name === wordInfo.word);
      if (!func) return null;

      const blockingInfo = func.blocking ? "\n\n⏱ **阻塞操作** — 此函数会等待操作完成才返回" : "";
      const contents = [
        {
          value: `\`\`\`lua\nfunction ${func.name}${func.signature}\n\`\`\``,
        },
        {
          value: `**[${func.category}]** ${func.description}${blockingInfo}`,
        },
      ];

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn,
        },
        contents,
      };
    },
  });

  // ===== 签名帮助 =====
  monaco.languages.registerSignatureHelpProvider(LUA_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ["(", ","],
    provideSignatureHelp: (
      model: { getValueInRange: (range: IRange) => string },
      position: Position
    ) => {
      // 查找当前函数调用
      const textBefore = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // 从后往前找未匹配的 ( 来找函数名
      let parenDepth = 0;
      let funcEnd = -1;
      let activeParam = 0;

      for (let i = textBefore.length - 1; i >= 0; i--) {
        const ch = textBefore[i];
        if (ch === ")") parenDepth++;
        else if (ch === "(") {
          if (parenDepth === 0) {
            funcEnd = i;
            break;
          }
          parenDepth--;
        } else if (ch === "," && parenDepth === 0) {
          activeParam++;
        }
      }

      if (funcEnd < 0) return null;

      // 提取函数名
      const beforeParen = textBefore.substring(0, funcEnd).trimEnd();
      const funcNameMatch = beforeParen.match(/([A-Za-z_]\w*)$/);
      if (!funcNameMatch) return null;

      const func = GAME_API_FUNCTIONS.find((f) => f.name === funcNameMatch[1]);
      if (!func) return null;

      // 解析参数列表
      const paramStr = func.signature.replace(/^\(/, "").replace(/\).*$/, "");
      const params = paramStr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const parameters: Array<{ label: string; documentation?: string }> = params.map((p) => ({
        label: p,
      }));

      return {
        value: {
          signatures: [
            {
              label: `${func.name}${func.signature}`,
              documentation: `**[${func.category}]** ${func.description}`,
              parameters,
            },
          ],
          activeSignature: 0,
          activeParameter: activeParam,
        },
        dispose: () => {},
      };
    },
  });
}

/**
 * 定义 Lua 主题（复用 vs-dark 基础，定制 token 颜色）
 */
export function defineLuaTheme(monaco: MonacoType): void {
  monaco.editor.defineTheme("miu2d-lua-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "C586C0" },
      { token: "function.gameapi", foreground: "DCDCAA" },
      { token: "function.builtin", foreground: "4EC9B0" },
      { token: "identifier", foreground: "9CDCFE" },
      { token: "string", foreground: "CE9178" },
      { token: "string.escape", foreground: "D7BA7D" },
      { token: "number", foreground: "B5CEA8" },
      { token: "number.hex", foreground: "B5CEA8" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
    },
  } as Record<string, unknown>);
}
