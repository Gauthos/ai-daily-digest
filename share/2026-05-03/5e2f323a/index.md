---
title: "png-cmp：专为 PNG 图片设计的 cmp 命令"
date: "2026-05-03T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "开发者在实验中需要一个工具来检查两张 PNG 图片是否在视觉上相同，而非二进制数据完全相同。png-cmp 应运而生，它模仿了 Unix cmp 命令的行为：相同则静默退出，不同则报错。与 cmp 不同，png-cmp 比较的是像素数据，会忽略文本元数据、压缩差异等不影响视觉表现的信息。该工具通过解析 PNG 块结构并对比解码后的像素值实现快速判断。结论是：对于需要验证图片渲染结果或去重视觉重复文件的场景，png-cmp 比传统二进制比较更准确高效。"
source: "evanhahn.com"
shareId: "5e2f323a"
targetUrl: "/posts/2026-05-03/#item-5e2f323a"
originalUrl: "https://evanhahn.com/png-cmp-is-cmp-but-for-pngs/"
titleEn: "png-cmp: like cmp for PNGs"
---
