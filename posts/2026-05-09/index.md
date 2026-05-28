---
title: "AI 博客每日精选 — 2026-05-09"
date: 2026-05-09T22:32:00-10:00
summary: "今日技术圈聚焦人工智能与开源生态两大主线。AI工具从编程辅助到输出格式创新，正试图弥合开发者能力鸿沟，但其背后企业却陷入“烧钱换增长”的商业闭环，投资回报率仍存疑。与此同时，大量开源依赖项已悄然停维，业界惯用的表面指标无法反映项目真实健康度，软件供应链的隐性危机持续发酵。"
---

> 来自 Karpathy 推荐的 91 个顶级技术博客，AI 精选 Top 15

## 📝 今日看点

今日技术圈聚焦人工智能与开源生态两大主线。AI工具从编程辅助到输出格式创新，正试图弥合开发者能力鸿沟，但其背后企业却陷入“烧钱换增长”的商业闭环，投资回报率仍存疑。与此同时，大量开源依赖项已悄然停维，业界惯用的表面指标无法反映项目真实健康度，软件供应链的隐性危机持续发酵。

---

## 🏆 今日必读

🥇 **使用Claude Code：HTML的惊人有效性** <a id="item-0abd127d" class="x-anchor" aria-hidden="true"></a>

[Using Claude Code: The Unreasonable Effectiveness of HTML](https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/#atom-everything) — simonwillison.net · 1 天前 · 🤖 AI / ML

> Thariq Shihipar（Anthropic Claude Code团队成员）主张在与Claude交互时请求HTML而非Markdown输出。HTML能更灵活地展示复杂信息，例如代码审查、数据报告等。文中提供了大量实例和提示技巧，如创建交互式HTML工件来分析PR的流控逻辑。这种格式转换显著提升了AI输出的实用性和可读性。作者认为，HTML是发挥Claude全部潜力的关键。

💡 **为什么值得读**: 提供了一种简单却高效的AI交互技巧，附带可直接使用的提示模板，能立刻提升你的工作流。

🏷️ Claude, HTML, Markdown, AI

🥈 **AI让弱工程师不再那么有害** <a id="item-bfb48c88" class="x-anchor" aria-hidden="true"></a>

[AI makes weak engineers less harmful](https://seangoedecke.com/ai-makes-weak-engineers-less-harmful/) — seangoedecke.com · 1 天前 · 💡 观点 / 杂谈

> 软件工程能力呈重尾分布，顶尖工程师产出远高于平均，而最弱工程师常净贡献为负，制造额外问题。许多科技公司因此倾向于组建小而高薪的精英团队。但AI编程工具能辅助弱工程师编写更规范、更少Bug的代码，降低其负面影响。作者认为，AI有助于缩小工程师间生产力差距，使团队结构更多元。

💡 **为什么值得读**: 重新思考AI对团队效能的影响，为技术管理者和招聘决策提供新视角。

🏷️ AI, software engineering, productivity, team dynamics

🥉 **AI代理与投资回报率** <a id="item-b105c1b4" class="x-anchor" aria-hidden="true"></a>

[Agents and ROI](https://garymarcus.substack.com/p/agents-and-roi) — garymarcus.substack.com · 1 天前 · 💡 观点 / 杂谈

> 此前MIT研究显示，生成式AI对多数企业缺乏真正的投资回报率。Gary Marcus指出，当前AI代理热潮同样面临ROI疑问。许多企业未经验证即大规模部署AI代理，但实际商业收益模糊。作者建议，企业应严格评估AI代理的成本效益，而非盲目跟风。缺乏坚实ROI支持的AI代理可能只是另一场泡沫。

💡 **为什么值得读**: 在AI代理被吹捧为下一代生产力工具时，提供冷静的批判性声音，帮助决策者避免陷阱。

🏷️ AI agents, ROI, generative AI, MIT study

---

## ⚙️ 工程

### 1. 开源健康评分的误区：街灯效应 {#item-6622e702}

[The Mismeasure of Open Source](https://nesbitt.io/2026/05/09/the-mismeasure-of-open-source.html) — **nesbitt.io** · 22 小时前 · ⭐ 22/30

> 业界常用GitHub星数、提交频率、贡献者数量等易于获取的指标评判开源项目健康度，但这些表面数据无法反映真实长期维护能力和社区活力，这正是“街灯效应”的体现。作者批评了流行的开源健康评分系统（如OpenSSF Scorecard），指出它们过度依赖可量化指标而忽略代码质量、安全响应、社区多样性等关键维度。文章提出应结合定性分析，建立更全面的评估框架，避免“只在有光的地方找钥匙”。

🏷️ open source, project health, metrics, streetlight effect

---

### 2. 使用 ReadDirectoryChangesW 跟踪重命名时如何更可靠 {#item-b1e027b8}

[Developing more confidence when tracking renames via Read­Directory­ChangesW](https://devblogs.microsoft.com/oldnewthing/?p=112310) — **devblogs.microsoft.com/oldnewthing** · 1 天前 · ⭐ 18/30

> 在使用 ReadDirectoryChangesW 监控文件系统时，准确跟踪文件重命名操作是个常见难点，因为文件名改变可能导致跟踪丢失。通过记录文件的唯一 ID（File ID），并将其与重命名事件相关联，可以可靠地识别文件，即使其名称已变。文章提供了具体的 API 调用方法来说明如何获取文件 ID 并在回调中使用。该方案无需复杂的状态维护，即可显著提升对重命名操作的感知准确度。最终，开发者可以更自信地处理文件重命名场景。

🏷️ Windows, API, filesystem, rename

---

### 3. 极低频 {#item-b3a3a820}

[extremely low frequencies](https://computer.rip/2026-05-09-extremely-low-frequencies.html) — **computer.rip** · 1 天前 · ⭐ 18/30

> 潜艇自美国内战投入实战以来，与深水潜艇的通信始终是巨大挑战。极低频（ELF）电磁波因其在海水中衰减率低，能够穿透数百米水深，成为向潜艇单向传输指令的核心手段。虽然它的数据速率极低，只能传送少量字符，但足以发送发动核打击等关键命令。文章梳理了从早期潜艇到现代核威慑体系中ELF技术的演进，并解释了这一频段的技术特性与限制。

🏷️ submarine, ELF, communication, radio

---

### 4. 我不会在你的URL中添加查询字符串 {#item-016ff330}

[I Will Not Add Query Strings to Your URLs](https://susam.net/no-query-strings.html) — **susam.net** · 1 天前 · ⭐ 17/30

> URL中的查询字符串是Web设计的一项不良特性，导致链接脆弱、难以阅读和分享。Chris Morgan公开宣布禁止查询字符串，引发作者强烈共鸣。作者回顾多年浏览经验，发现带查询字符串的URL常因参数变动而失效，造成内容重复和缓存问题。他认为干净、永久的URL更有利于Web生态和用户体验。作者最终承诺永远不会在他人的URL上添加查询字符串，并呼吁开发者共同抵制这一陋习。

🏷️ URL design, query strings, web development, REST

---

### 5. 引用 Luke Curley {#item-55bf5e37}

[Quoting Luke Curley](https://simonwillison.net/2026/May/9/luke-curley/#atom-everything) — **simonwillison.net** · 1 天前 · ⭐ 15/30

> WebRTC 协议为优化视频会议等实时场景，设计了激进的网络丢包策略以维持低延迟。当 WebRTC 用于传输 AI 提示词时，这一机制会导致提示内容残缺，影响回复的准确性。用户 Luke Curley 指出，对于昂贵且复杂的 AI 请求，用户宁愿多等 200 毫秒也不希望提示被破坏。这暴露了实时通信协议直接套用在 AI 交互上的不适配问题，未来可能需要引入可靠性优先的模式。

🏷️ WebRTC, latency, audio, packet loss

---

### 6. 使用 Python 3 LSP 服务器处理 Python 2 代码基本可行 {#item-f2ec4284}

[Using a Python 3 LSP server with Python 2 code works (more or less)](https://utcc.utoronto.ca/~cks/space/blog/python/Python2WithPython3LSP) — **utcc.utoronto.ca/~cks** · 10 小时前 · ⭐ 15/30

> 作者在维护 Python 2 遗留项目（如 DWiki）时，希望在 Emacs 中继续使用现代 LSP 带来的智能编辑体验。虽然主流的 Python LSP 服务器（如 Pyright）已专为 Python 3 开发，但经测试对 Python 2 代码仍具备基本分析能力。代码补全、导航和部分诊断功能均可正常工作，仅少数因语法差异导致的误报。对于尚无迁移计划的旧项目，这种“降级使用”提供了一条实用的开发辅助路径。

🏷️ Python, LSP, Emacs, legacy

---

## 💡 观点 / 杂谈

### 7. AI让弱工程师不再那么有害 {#item-bfb48c88}

[AI makes weak engineers less harmful](https://seangoedecke.com/ai-makes-weak-engineers-less-harmful/) — **seangoedecke.com** · 1 天前 · ⭐ 25/30

> 软件工程能力呈重尾分布，顶尖工程师产出远高于平均，而最弱工程师常净贡献为负，制造额外问题。许多科技公司因此倾向于组建小而高薪的精英团队。但AI编程工具能辅助弱工程师编写更规范、更少Bug的代码，降低其负面影响。作者认为，AI有助于缩小工程师间生产力差距，使团队结构更多元。

🏷️ AI, software engineering, productivity, team dynamics

---

### 8. AI代理与投资回报率 {#item-b105c1b4}

[Agents and ROI](https://garymarcus.substack.com/p/agents-and-roi) — **garymarcus.substack.com** · 1 天前 · ⭐ 25/30

> 此前MIT研究显示，生成式AI对多数企业缺乏真正的投资回报率。Gary Marcus指出，当前AI代理热潮同样面临ROI疑问。许多企业未经验证即大规模部署AI代理，但实际商业收益模糊。作者建议，企业应严格评估AI代理的成本效益，而非盲目跟风。缺乏坚实ROI支持的AI代理可能只是另一场泡沫。

🏷️ AI agents, ROI, generative AI, MIT study

---

### 9. 真正的奇点是我们沿途结交的朋友 {#item-c87ff212}

[The Real Singularity is the Friends We Made Along the Way](https://geohot.github.io//blog/jekyll/update/2026/05/09/real-singularity.html) — **geohot.github.io** · 1 天前 · ⭐ 15/30

> 一张发表在《金融时报》上的图表引起作者 George Hotz 的注意，其夸张程度令人怀疑是反讽。由于未订阅全文，作者无法确认该文章的语境或图表背后的严肃性。标题“真正的奇点是我们沿途结交的朋友”化用网络流行语，暗指“奇点”概念已被过度商业化炒作。这篇简短博文以典型的 geohot 式幽默，对技术媒体泡沫进行了侧击。

🏷️ singularity, AI, humor, graph

---

## 📝 其他

### 10. 特朗普徒劳寻找‘替罪牛’ {#item-58035221}

[Pluralistic: Trump's fruitless search for a goreable ox (09 May 2026)](https://pluralistic.net/?p=12791) — **pluralistic.net** · 19 小时前 · ⭐ 18/30

> 特朗普政府试图在讨好亿万富翁和缓解民众生活成本危机之间取得平衡，但两者本质冲突。减税和放松管制让富豪获益，却推高了普通人的住房、医疗和食品成本。为了转移矛盾，特朗普不断寻找可攻击的外部敌人或内部替罪羊，例如移民或政治对手。然而，这种策略未能奏效，公众的不满依然指向经济现实。作者指出，任何政府都无法同时服务寡头和大众，鱼与熊掌不可兼得。

🏷️ politics, Trump, economy, policy

---

### 11. Pluralistic: Lee Lai的《Cannon》 {#item-2968f247}

[Pluralistic: Lee Lai's "Cannon" (08 May 2026)](https://pluralistic.net/?p=12787) — **pluralistic.net** · 1 天前 · ⭐ 16/30

> Cory Doctorow在专栏中推荐了Lee Lai的漫画作品《Cannon》，一部关于责任、性与糟糕餐馆老板的细腻故事，余味悠长。该作品以微妙的情感和持久感染力著称，被视为值得细细品味的独立漫画。文中还附带多个值得关注的链接，如eBay支付报纸分类广告、Chuck Tingle与Sad Puppies之争、FBI与TOR等话题。Doctorow的每日精选为读者提供了多元的文化和技术视角。

🏷️ comic, review, Lee Lai, Cannon

---

### 12. 计算曲率 {#item-d97e043a}

[Calculating curvature](https://www.johndcook.com/blog/?p=247012) — **johndcook.com** · 1 天前 · ⭐ 16/30

> 曲率概念直观但计算往往复杂，特别是对于隐式定义的曲线。对于水平集曲线f(x,y)=c，曲率κ的表达式即使对于简单函数也会变得繁琐。文章通过引入中间变量简化了推导，给出了一个更紧凑的计算公式。该方法适用于计算机图形学和几何建模中的曲率计算，降低了实际应用中的数学门槛。

🏷️ curvature, level set, geometry, mathematics

---

## 🤖 AI / ML

### 13. 使用Claude Code：HTML的惊人有效性 {#item-0abd127d}

[Using Claude Code: The Unreasonable Effectiveness of HTML](https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/#atom-everything) — **simonwillison.net** · 1 天前 · ⭐ 25/30

> Thariq Shihipar（Anthropic Claude Code团队成员）主张在与Claude交互时请求HTML而非Markdown输出。HTML能更灵活地展示复杂信息，例如代码审查、数据报告等。文中提供了大量实例和提示技巧，如创建交互式HTML工件来分析PR的流控逻辑。这种格式转换显著提升了AI输出的实用性和可读性。作者认为，HTML是发挥Claude全部潜力的关键。

🏷️ Claude, HTML, Markdown, AI

---

### 14. AI的循环癫狂 {#item-eae6d801}

[Premium: AI's Circular Psychosis](https://wheresyoured.at/69fdea5bede6c40001e1af38) — **wheresyoured.at** · 1 天前 · ⭐ 25/30

> Anthropic的收入不足以支付高昂的云服务费用，只能依靠外部投资来偿还云账单，形成了“烧投资人钱付云厂商”的恶性循环。这种模式在AI行业中普遍存在，企业依赖持续融资维持运营，并未产生真正的正向现金流。AI公司实质上沦为云厂商的“利润中转站”，将投资者资金源源不断地输送给云计算巨头。作者警告这种循环不可持续，一旦融资断裂，AI行业可能面临连锁崩溃。

🏷️ AI economy, Anthropic, cloud costs, circular funding

---

## 🔒 安全

### 15. 《伯尼的周末》：你的哪些依赖项在装活？ {#item-b2fb7a1d}

[Weekend at Bernie’s](https://nesbitt.io/2026/05/08/weekend-at-bernies.html) — **nesbitt.io** · 1 天前 · ⭐ 23/30

> 许多软件项目所依赖的开源组件已事实上停止维护，却像电影《老板度假去》中的尸体一样被“装扮”成存活状态继续使用。作者演示了如何识别这些“僵尸依赖项”，如检查仓库最近提交时间、Issue响应情况、维护者活跃度等指标。忽视依赖项的真实健康度会引入安全漏洞和技术债务，文章提供了自动化检测工具。结论是必须深入检查依赖项的实际维护状况，而不能只看表面。

🏷️ dependencies, supply chain, security, maintenance

---

*生成于 2026-05-09 22:32 (Pacific/Honolulu) | 扫描 90 源 → 获取 2641 篇 → 精选 15 篇*
*基于 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) RSS 源列表，由 [Andrej Karpathy](https://x.com/karpathy) 推荐*
