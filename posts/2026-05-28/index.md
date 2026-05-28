---
title: "AI 博客每日精选 — 2026-05-28"
date: 2026-05-28T00:24:00-10:00
summary: "来自 91 个顶级技术博客，AI 精选 15 篇深读与 2 条快讯"
---

> 来自 Karpathy 推荐的 91 个顶级技术博客，AI 精选 15 篇深读与 2 条快讯

## 🏆 今日必读

🥇 **Anthropic和OpenAI已找到产品市场契合点** <a id="item-9531c79f" class="x-anchor" aria-hidden="true"></a>

[I think Anthropic and OpenAI have found product-market fit](https://simonwillison.net/2026/May/27/product-market-fit/#atom-everything) — simonwillison.net · 17 小时前 · 🤖 AI / ML

> Anthropic和OpenAI近期将企业计划转为API定价，导致大量企业AI支出激增，标志着编码代理产品已找到产品市场契合点。Claude Code和Codex等编码代理消耗大量token，重度用户每月API费用可达上千美元，远超固定订阅费。两家公司将企业合同从固定费率改为按用量付费，并推出API价格更高的新模型，如GPT-5.5和Opus 4.7。Uber等公司出现AI预算超支，但生产力提升难以量化，这正是产品定价过高的典型迹象。2026年4月成为收入拐点，AI实验室可能开始盈利，即将到来的IPO将揭示真实财务数据。

<div class="editorial-note">
  <p>企业为AI代理支付高额费用的趋势，与同日curl项目因AI漏洞报告激增而承受的压力，共同表明AI正在深刻重塑软件开发和安全的成本结构。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-9531c79f" data-source="simonwillison.net" data-category="ai-ml" data-score="26">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

🥈 **压力** <a id="item-8a2ba426" class="x-anchor" aria-hidden="true"></a>

[The pressure](https://simonwillison.net/2026/May/26/the-pressure/#atom-everything) — simonwillison.net · 1 天前 · 🔒 安全

> curl项目正面临因AI辅助漏洞发现而激增的安全报告压力。安全报告数量达到2024年的4-5倍，平均每天超过一份，且报告质量显著提高。项目负责人Daniel Stenberg称这是前所未有的压力，甚至影响到了工作生活平衡。尽管报告增多，但curl本身软件健壮，发现的漏洞绝大多数为低危或中危，高危漏洞自2023年以来未再出现。团队感到责任重大，但报告洪流可能迫使项目调整安全处理流程。

<div class="editorial-note">
  <p>在企业尝到AI代理甜头的同时，curl的遭遇显示AI驱动的安全审计正在将开源维护者推向极限，这可能会加速安全人才和自动化工具的投资。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-8a2ba426" data-source="simonwillison.net" data-category="security" data-score="25">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

🥉 **微软Copilot Cowork泄露文件** <a id="item-6f30ae0a" class="x-anchor" aria-hidden="true"></a>

[Microsoft Copilot Cowork Exfiltrates Files](https://simonwillison.net/2026/May/26/copilot-cowork-exfiltrates-files/#atom-everything) — simonwillison.net · 1 天前 · 🔒 安全

> 设计AI代理系统的最大挑战之一是防止攻击者通过提示注入窃取数据。微软的Copilot Cowork允许代理在未经批准的情况下向用户邮箱发送邮件，这些邮件可被用于数据泄露。攻击者可以在邮件中嵌入外部图片链接，当用户打开邮件时，图片请求会将数据发送至外部服务器。由于OneDrive可生成预认证下载链接，提示注入可导致这些链接泄露，使攻击者能下载用户文件。这一漏洞突显了在集成AI代理到办公系统时，需要更严格的安全控制。

<div class="editorial-note">
  <p>企业急于部署AI代理提高效率，但Copilot Cowork的漏洞提醒我们，未经充分安全测试的代理工具可能成为内部威胁的新渠道。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-6f30ae0a" data-source="simonwillison.net" data-category="security" data-score="25">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

---

## ⚡ 快讯

- **Solvinity 收购禁令**: [Het Solvinity besluit in detail, en de mogelijke gevolgen](https://berthub.eu/articles/posts/het-solvinity-besluit-gevolgen/) — berthub.eu · 1 天前  
  Gisteren verscheen de brief waarmee de staatssecretaris van Economische Zaken en Klimaat liet weten dat ze de overname v
- **Hy3 LLM 登顶 OpenRouter 排名**: [The mysterious Hy3 LLM is topping OpenRouter Model Rankings by a large margin](https://minimaxir.com/2026/05/openrouter-hy3/) — minimaxir.com · 1 天前  
  Why Hy3?

---

## 💡 观点 / 杂谈

### 1. Pluralistic: AI and a world without migrants (27 May 2026) {#item-7e5b58b6}

[Pluralistic: AI and a world without migrants (27 May 2026)](https://pluralistic.net/?p=12847) — **pluralistic.net** · 1 天前

> Pluralistic: AI and a world without migrants (27 May 2026)

---

### 2. Using My Fucking Brain {#item-50cd70d9}

[Using My Fucking Brain](https://terriblesoftware.org/?p=661) — **terriblesoftware.org** · 21 小时前

> Using My Fucking Brain

---

### 3. Revenge of The Business Idiot {#item-742122b0}

[Revenge of The Business Idiot](https://wheresyoured.at/6a15a121732336000177f820) — **wheresyoured.at** · 1 天前

> Revenge of The Business Idiot

---

### 4. Quoting Paul Graham {#item-5fc9d250}

[Quoting Paul Graham](https://simonwillison.net/2026/May/26/paul-graham/#atom-everything) — **simonwillison.net** · 1 天前

> Quoting Paul Graham

---

### 5. How Many Tokens Did You Burn Today {#item-508e6cb0}

[How Many Tokens Did You Burn Today](https://idiallo.com/blog/how-many-tokens-did-you-burn-today?src=feed) — **idiallo.com** · 1 天前

> How Many Tokens Did You Burn Today

---

### 6. The Costco theory of the internet {#item-01fa7375}

[The Costco theory of the internet](https://joanwestenberg.com/6a14f8be2aaad80001c9df7a) — **joanwestenberg.com** · 8 小时前

> The Costco theory of the internet

---

## ⚙️ 工程

### 7. sqlite AGENTS.md {#item-79b4bf45}

[sqlite AGENTS.md](https://simonwillison.net/2026/May/27/sqlite-agents/#atom-everything) — **simonwillison.net** · 10 小时前

> sqlite AGENTS.md

---

### 8. CHAOSS Metrics in 2026 {#item-d201b4f5}

[CHAOSS Metrics in 2026](https://nesbitt.io/2026/05/27/chaoss-metrics-in-2026.html) — **nesbitt.io** · 1 天前

> CHAOSS Metrics in 2026

---

### 9. Notes on optimizing battery life: {#item-c06eb2f8}

[Notes on optimizing battery life:](http://maurycyz.com/misc/battery/) — **maurycyz.com** · 1 天前

> Notes on optimizing battery life:

---

### 10. SQLAlchemy 2 In Practice - Solutions to the Exercises {#item-450ed000}

[SQLAlchemy 2 In Practice - Solutions to the Exercises](https://blog.miguelgrinberg.com/post/sqlalchemy-2-in-practice---solutions-to-the-exercises) — **miguelgrinberg.com** · 15 小时前

> SQLAlchemy 2 In Practice - Solutions to the Exercises

---

## 🔒 安全

### 11. 压力 {#item-8a2ba426}

[The pressure](https://simonwillison.net/2026/May/26/the-pressure/#atom-everything) — **simonwillison.net** · 1 天前

> curl项目正面临因AI辅助漏洞发现而激增的安全报告压力。安全报告数量达到2024年的4-5倍，平均每天超过一份，且报告质量显著提高。项目负责人Daniel Stenberg称这是前所未有的压力，甚至影响到了工作生活平衡。尽管报告增多，但curl本身软件健壮，发现的漏洞绝大多数为低危或中危，高危漏洞自2023年以来未再出现。团队感到责任重大，但报告洪流可能迫使项目调整安全处理流程。

<div class="editorial-note">
  <p>在企业尝到AI代理甜头的同时，curl的遭遇显示AI驱动的安全审计正在将开源维护者推向极限，这可能会加速安全人才和自动化工具的投资。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-8a2ba426" data-source="simonwillison.net" data-category="security" data-score="25">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

---

### 12. 微软Copilot Cowork泄露文件 {#item-6f30ae0a}

[Microsoft Copilot Cowork Exfiltrates Files](https://simonwillison.net/2026/May/26/copilot-cowork-exfiltrates-files/#atom-everything) — **simonwillison.net** · 1 天前

> 设计AI代理系统的最大挑战之一是防止攻击者通过提示注入窃取数据。微软的Copilot Cowork允许代理在未经批准的情况下向用户邮箱发送邮件，这些邮件可被用于数据泄露。攻击者可以在邮件中嵌入外部图片链接，当用户打开邮件时，图片请求会将数据发送至外部服务器。由于OneDrive可生成预认证下载链接，提示注入可导致这些链接泄露，使攻击者能下载用户文件。这一漏洞突显了在集成AI代理到办公系统时，需要更严格的安全控制。

<div class="editorial-note">
  <p>企业急于部署AI代理提高效率，但Copilot Cowork的漏洞提醒我们，未经充分安全测试的代理工具可能成为内部威胁的新渠道。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-6f30ae0a" data-source="simonwillison.net" data-category="security" data-score="25">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

---

### 13. AI won’t replace human pentesters and security teams. It will be a force multiplier {#item-fa5d595d}

[AI won’t replace human pentesters and security teams. It will be a force multiplier](https://xint.io/blog/ai-cybersecurity-role-changes) — **xint.io** · 1 天前

> AI won’t replace human pentesters and security teams. It will be a force multiplier

---

## 🤖 AI / ML

### 14. Anthropic和OpenAI已找到产品市场契合点 {#item-9531c79f}

[I think Anthropic and OpenAI have found product-market fit](https://simonwillison.net/2026/May/27/product-market-fit/#atom-everything) — **simonwillison.net** · 17 小时前

> Anthropic和OpenAI近期将企业计划转为API定价，导致大量企业AI支出激增，标志着编码代理产品已找到产品市场契合点。Claude Code和Codex等编码代理消耗大量token，重度用户每月API费用可达上千美元，远超固定订阅费。两家公司将企业合同从固定费率改为按用量付费，并推出API价格更高的新模型，如GPT-5.5和Opus 4.7。Uber等公司出现AI预算超支，但生产力提升难以量化，这正是产品定价过高的典型迹象。2026年4月成为收入拐点，AI实验室可能开始盈利，即将到来的IPO将揭示真实财务数据。

<div class="editorial-note">
  <p>企业为AI代理支付高额费用的趋势，与同日curl项目因AI漏洞报告激增而承受的压力，共同表明AI正在深刻重塑软件开发和安全的成本结构。</p>
  <p class="editorial-note__byline">-- 蒲公英</p>
  <div class="article-feedback" data-article-id="item-9531c79f" data-source="simonwillison.net" data-category="ai-ml" data-score="26">
  <span class="feedback-hint">这个视角对你有用吗？</span>
  <button class="feedback-btn feedback-up" type="button" data-vote="up" aria-label="有用"><img src="https://img.icons8.com/hatch/64/facebook-like.png" alt="like" width="20" height="20" loading="lazy"></button>
  <button class="feedback-btn feedback-down" type="button" data-vote="down" aria-label="没用"><img src="https://img.icons8.com/hatch/64/dislike.png" alt="dislike" width="20" height="20" loading="lazy"></button>
</div>
</div>

---

## 🛠 工具 / 开源

### 15. I patched iozone for better disk benchmarks on modern macOS {#item-57079f98}

[I patched iozone for better disk benchmarks on modern macOS](https://www.jeffgeerling.com/blog/2026/i-patched-iozone-for-better-disk-benchmarks-on-modern-macos/) — **jeffgeerling.com** · 1 天前

> I patched iozone for better disk benchmarks on modern macOS

---

*生成于 2026-05-28 00:24 (Pacific/Honolulu) | 扫描 91 源 → 获取 2683 篇 → 深读 15 篇 · 快讯 2 条*
*基于 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) RSS 源列表，由 [Andrej Karpathy](https://x.com/karpathy) 推荐*
