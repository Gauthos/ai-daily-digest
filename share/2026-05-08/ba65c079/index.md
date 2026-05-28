---
title: "驾驭 Zig Fmt：高效使用的两个技巧"
date: "2026-05-08T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "Zig 语言的 zig fmt 格式化工具默认行为严格，可能破坏开发者手工对齐的代码结构。第一个技巧是在代码块前后插入 `// zig fmt: off` 和 `// zig fmt: on` 注释来局部禁用格式化，保留关键部分的布局。第二个技巧是理解 zig fmt 的设计哲学，接受其统一风格以降低团队认知分歧，而非频繁对抗工具。通过这两招，开发者既能享受自动化格式化的效率，又能避免核心代码被无意修改。最后建议团队内部明确 zig fmt 的使用边界，平衡灵活性与一致性。"
source: "matklad.github.io"
shareId: "ba65c079"
targetUrl: "/posts/2026-05-08/#item-ba65c079"
originalUrl: "https://matklad.github.io/2026/05/08/steering-zig-fmt.html"
titleEn: "Steering Zig Fmt"
---
