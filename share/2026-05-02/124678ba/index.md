---
title: "开发跨进程限制读者数的读写锁，第4部分：放弃处理"
date: "2026-05-02T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "跨进程读写锁需要处理锁持有者意外终止（进程崩溃或退出）的情况，否则会导致其他等待进程永久阻塞。本文提出一种放弃检测与恢复机制：通过内核对象（如事件、互斥体）的“所有者终止”特性来监控锁持有者存活状态。当检测到持有者已终止，自动清理锁状态并允许下一个等待者获取锁。作者强调，设计放弃逻辑时必须保证锁状态的一致性，避免部分更新的锁残留。最终实现了一个健壮的读写锁，能安全恢复而不丢失通知或泄漏资源。"
source: "devblogs.microsoft.com/oldnewthing"
shareId: "124678ba"
targetUrl: "/posts/2026-05-02/#item-124678ba"
originalUrl: "https://devblogs.microsoft.com/oldnewthing/?p=112291"
titleEn: "Developing a cross-process reader/writer lock with limited readers, part 4: Abandonment"
---
