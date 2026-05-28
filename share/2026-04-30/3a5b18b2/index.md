---
title: "Codex CLI 0.128.0 新增 /goal 目标循环功能"
date: "2026-04-30T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "OpenAI的Codex CLI在0.128.0版本中引入了/goal命令，让代理能够持续循环执行任务直到目标完成或令牌预算耗尽。该机制模仿了Ralph循环的设计，通过自动注入goals/continuation.md和goals/budget_limit.md提示词在每轮结束时引导模型。这一更新使Codex从单次指令执行转向长时间自主目标导向的迭代模式。相较于之前版本，/goal功能大幅增强了编码代理处理复杂任务的持久性和自主性。"
source: "simonwillison.net"
shareId: "3a5b18b2"
targetUrl: "/posts/2026-04-30/#item-3a5b18b2"
originalUrl: "https://simonwillison.net/2026/Apr/30/codex-goals/#atom-everything"
titleEn: "Codex CLI 0.128.0 adds /goal"
---
