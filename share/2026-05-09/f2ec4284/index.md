---
title: "使用 Python 3 LSP 服务器处理 Python 2 代码基本可行"
date: "2026-05-09T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "作者在维护 Python 2 遗留项目（如 DWiki）时，希望在 Emacs 中继续使用现代 LSP 带来的智能编辑体验。虽然主流的 Python LSP 服务器（如 Pyright）已专为 Python 3 开发，但经测试对 Python 2 代码仍具备基本分析能力。代码补全、导航和部分诊断功能均可正常工作，仅少数因语法差异导致的误报。对于尚无迁移计划的旧项目，这种“降级使用”提供了一条实用的开发辅助路径。"
source: "utcc.utoronto.ca/~cks"
shareId: "f2ec4284"
targetUrl: "/posts/2026-05-09/#item-f2ec4284"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/python/Python2WithPython3LSP"
titleEn: "Using a Python 3 LSP server with Python 2 code works (more or less)"
---
