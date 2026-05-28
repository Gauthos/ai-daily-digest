---
title: "TRE Python绑定——正则表达式拒绝服务攻击鲁棒性演示"
date: "2026-05-04T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "该文探讨了TRE正则表达式引擎及其Python绑定对抗ReDoS（正则表达式拒绝服务攻击）的能力。作者使用Claude Code构建了一个基于ctypes的实验性Python绑定，并针对TRE库执行了恶意正则表达式攻击测试。由于TRE引擎不支持回溯（backtracking），它相比Python标准库的re模块能更有效地抵御此类攻击。TRE几乎不会因为复杂的嵌套量词导致指数级计算爆炸，从而显著降低了服务被恶意输入拖垮的风险。"
source: "simonwillison.net"
shareId: "398b9f08"
targetUrl: "/posts/2026-05-04/#item-398b9f08"
originalUrl: "https://simonwillison.net/2026/May/4/tre-python-binding/#atom-everything"
titleEn: "TRE Python binding — ReDoS robustness demo"
---
