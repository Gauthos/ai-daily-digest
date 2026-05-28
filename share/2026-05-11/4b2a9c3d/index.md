---
title: "控制 CreateProcess 继承哪些句柄的补充说明"
date: "2026-05-11T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "Windows 的 CreateProcess 函数默认允许子进程继承父进程的某些句柄，这可能带来安全风险或资源泄漏。控制句柄继承的传统方法较为繁琐且容易出错。Raymond Chen 提出了将需继承的句柄集中放入一个“私有容器”的思路，结合 STARTUPINFOEX 和属性列表，可以精确指定哪些句柄可被继承。该方法避免了修改进程级别句柄继承标志带来的副作用。结论：通过私有容器管理继承句柄，能更简洁、安全地控制子进程的句柄访问，是 Windows 编程中值得采纳的实践。"
source: "devblogs.microsoft.com/oldnewthing"
shareId: "4b2a9c3d"
targetUrl: "/posts/2026-05-11/#item-4b2a9c3d"
originalUrl: "https://devblogs.microsoft.com/oldnewthing/?p=112313"
titleEn: "Additional notes on controlling which handles are inherited by Create­Process"
---
