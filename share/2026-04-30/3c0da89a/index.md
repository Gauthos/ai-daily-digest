---
title: "开发跨进程读写锁（有限读者），第三部分：公平性"
date: "2026-04-30T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "跨进程读写锁设计中，写锁可能因连续的读请求而饥饿。文章提出公平性方案，使独占写操作与共享读操作竞争时获得合理机会。通过修改锁获取逻辑，确保写请求在有限读者释放后能及时获取写锁。该方案在Windows跨进程锁实现中，兼顾了有限读者数量的约束。公平性机制有效防止了写饥饿，提升了系统稳定性。"
source: "devblogs.microsoft.com/oldnewthing"
shareId: "3c0da89a"
targetUrl: "/posts/2026-04-30/#item-3c0da89a"
originalUrl: "https://devblogs.microsoft.com/oldnewthing/?p=112288"
titleEn: "Developing a cross-process reader/writer lock with limited readers, part 3: Fairness"
---
