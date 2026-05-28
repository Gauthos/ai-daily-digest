---
title: "调用图分析：为乐趣和收益编写自定义Rust lint"
date: "2026-05-02T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "Rust编译器内置的lint无法覆盖所有代码模式检查，自定义lint可以填补这一空白，尤其适合调用图分析。文章展示如何基于rustc的driver API和dylib lint机制，构建一个分析函数调用关系的linter插件。该lint能检测循环调用、深层递归风险、未使用的公共函数等特定问题。作者给出完整代码示例，并对比了手动审查与自动化lint的效率差异：自定义lint可在毫秒级完成大型项目的调用图扫描。结论是：开发领域专用的自定义lint虽然前期投入约1-2小时，但能持续节省数倍的人工审查时间。"
source: "jyn.dev"
shareId: "60063bfe"
targetUrl: "/posts/2026-05-02/#item-60063bfe"
originalUrl: "https://jyn.dev/callgraph-analysis/"
titleEn: "callgraph analysis"
---
