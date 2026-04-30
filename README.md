# AI Daily Digest

从 [Andrej Karpathy](https://x.com/karpathy) 推荐的 97 个 Hacker News 顶级技术博客中抓取最新文章，通过 AI 多维评分筛选，生成结构化的每日精选日报。

![AI Daily Digest 概览](assets/overview.png)

> 信息源来自 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/)，涵盖 simonwillison.net、paulgraham.com、overreacted.io、gwern.net、krebsonsecurity.com 等。

## 快速开始

### 直接订阅 RSS

无需部署，直接用 RSS 阅读器订阅本项目的每日产出：

```
https://daily.choleraic.xyz/index.xml
```

也可以在浏览器中查看：https://daily.choleraic.xyz

### 自行部署（GitHub Actions + Pages）

Fork 本仓库后，完成以下 3 步：

1. `Settings → Secrets and variables → Actions` 中配置至少一个密钥：
   - `GEMINI_API_KEY`（推荐，[免费获取](https://aistudio.google.com/apikey)）
   - 或 `OPENAI_API_KEY`（可选再加 `OPENAI_API_BASE`、`OPENAI_MODEL`）
2. `Settings → Pages` 中选择 `Deploy from a branch` → 分支 `docs` → 目录 `/ (root)`
3. `Actions → daily-digest` 手动执行一次 `Run workflow`

工作流每天 `15:00 UTC`（北京时间 23:00）自动运行，生成日报并发布到 `docs` 分支。

### 本地运行

```bash
export GEMINI_API_KEY="your-key"
bun scripts/digest.ts --hours 48 --top-n 15 --lang zh --output .build/digest.md
```

生成后可继续用 Hugo 构建静态站点：

```bash
bun scripts/prepare-hugo.ts --input .build/digest.md --keep 30
hugo --minify
```

## 架构

### 管线流程

```
RSS 抓取（97源） → 时间过滤 + 去重 → AI 评分 + 分类 → AI 摘要 + 翻译 → 趋势总结 → Markdown
                                                                                          ↓
                                                                         prepare-hugo.ts → Hugo 构建 → 静态站点 + RSS
```

### 文件结构

```
├── scripts/
│   ├── digest.ts              # CLI 入口 + 管线编排
│   ├── feeds.ts               # RSS 源列表 + 抓取（fast-xml-parser）
│   ├── ai-client.ts           # Gemini/OpenAI 双通道 AI 客户端
│   ├── scoring.ts             # AI 评分 + 摘要 + 趋势总结
│   ├── report.ts              # Markdown 日报生成
│   ├── types.ts               # 共享类型与常量
│   └── prepare-hugo.ts        # Hugo 内容准备 + 搜索索引
├── .github/workflows/
│   └── daily-digest.yml       # CI/CD：定时触发 → digest → Hugo 构建 → 部署
├── hugo.toml                  # Hugo 站点配置
└── content/posts/             # Hugo 文章（自动生成）
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `types.ts` | 共享类型、分类定义、时间工具函数 |
| `feeds.ts` | 97 个 RSS 源定义、fast-xml-parser 解析、并发抓取（10 路，40s 超时） |
| `ai-client.ts` | Gemini 优先 + OpenAI 兼容降级、JSON 解析与重试 |
| `scoring.ts` | 三维评分（相关性 / 质量 / 时效性）+ 摘要 + 趋势总结 |
| `report.ts` | Markdown 日报生成（今日看点 / 必读 Top 3 / 分类列表） |
| `prepare-hugo.ts` | 将 digest 产出转为 Hugo 文章 + 维护搜索索引 |

## 日报结构

| 板块 | 内容 |
|------|------|
| 📝 今日看点 | 3-5 句话的宏观趋势总结 |
| 🏆 今日必读 | Top 3 深度展示：中英双语标题、摘要、推荐理由、关键词 |
| 分类文章列表 | 按 6 大分类分组，每篇含中文标题、来源、评分、摘要 |

### 分类体系

| 分类 | 覆盖范围 |
|------|----------|
| 🤖 AI / ML | AI、机器学习、LLM、深度学习 |
| 🔒 安全 | 安全、隐私、漏洞、加密 |
| ⚙️ 工程 | 软件工程、架构、编程语言、系统设计 |
| 🛠 工具 / 开源 | 开发工具、开源项目、新发布的库/框架 |
| 💡 观点 / 杂谈 | 行业观点、个人思考、职业发展 |
| 📝 其他 | 不属于以上分类的内容 |

## 配置

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `GEMINI_API_KEY` | 二选一 | Gemini API Key（[免费获取](https://aistudio.google.com/apikey)） |
| `OPENAI_API_KEY` | 二选一 | OpenAI 兼容 API Key（Gemini 失败时自动降级） |
| `OPENAI_API_BASE` | 可选 | 自定义 API 地址（默认 `https://api.openai.com/v1`） |
| `OPENAI_MODEL` | 可选 | 自定义模型名（默认根据 API 地址自动推断） |

### CLI 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--hours <n>` | 48 | 抓取时间窗口（小时） |
| `--top-n <n>` | 15 | 精选文章数量 |
| `--lang <zh\|en>` | zh | 摘要语言 |
| `--output <path>` | `./digest-YYYYMMDD.md` | 输出文件路径 |

### 切换 AI 提供商

项目内置 Gemini + OpenAI 兼容双通道。如需使用 DeepSeek、通义千问等 OpenAI 兼容服务，只需设置环境变量：

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_API_BASE="https://api.deepseek.com/v1"
export OPENAI_MODEL="deepseek-chat"
```

无需修改代码。

## 信息源

97 个 RSS 源精选自 Hacker News 社区最受欢迎的独立技术博客，包括：

> Simon Willison · Paul Graham · Dan Abramov · Gwern · Krebs on Security · Antirez · John Gruber · Troy Hunt · Mitchell Hashimoto · Steve Blank · Eli Bendersky · Fabien Sanglard ...

完整列表内嵌于 `scripts/digest.ts`。

## 环境要求

- [Bun](https://bun.sh) 运行时
- 至少一个 AI API Key（Gemini 或 OpenAI 兼容）
- 网络连接
