---
title: "基于调用图的Rust自定义lint分析"
date: "2026-05-03T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "介绍如何编写能访问完整程序调用图的Rust自定义lint。传统lint局限于单文件或单函数，而调用图分析允许检测跨调用链的模式（如递归隐患、无效生命周期传递）。文章以作者工作博客中的实战示例，演示从构建调用图到实现具体检查规则的完整流程。结论指出：结合调用图的静态分析能大幅提升Rust代码质量检查的深度，兼具开发乐趣和实际工程价值。"
source: "jyn.dev"
shareId: "60063bfe"
targetUrl: "/posts/2026-05-03/#item-60063bfe"
originalUrl: "https://jyn.dev/callgraph-analysis/"
titleEn: "callgraph analysis"
---
