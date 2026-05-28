---
title: "为什么不让 API 行为的变化取决于你链接的 SDK 版本？"
date: "2026-05-06T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "Windows API 的行为通常由运行时操作系统决定，而非编译时链接的 SDK 版本。文章解释了为何不能根据 SDK 版本改变 API 行为：静态库在编译时已嵌入代码，无法感知最终运行环境；动态库虽然可在运行时决定行为，但若根据 SDK 版本分支，会导致严重的兼容性矩阵问题和测试负担。这种设计确保了同一二进制文件在不同 Windows 版本上行为一致，避免因开发环境差异引入隐秘 bug。结论是，API 行为应基于运行时能力检测而非构建时 SDK 版本，以维护生态系统的稳定性和可预测性。"
source: "devblogs.microsoft.com/oldnewthing"
shareId: "db58fe4a"
targetUrl: "/posts/2026-05-06/#item-db58fe4a"
originalUrl: "https://devblogs.microsoft.com/oldnewthing/?p=112303"
titleEn: "Why not have changes in API behavior depend on the SDK you link against?"
---
