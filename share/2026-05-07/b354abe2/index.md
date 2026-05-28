---
title: "Bourne Shell 中 -l 与 -c 选项共用的检测困局"
date: "2026-05-07T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "许多 Bourne shell 超越 POSIX 规范支持 -l 选项来模拟登录 shell，但与 -c 共用时行为分裂：bash 在指定 -c 时会忽略 -l，而 dash 等其他 shell 可能两者都处理，导致脚本兼容性隐患。检测进程或脚本中是否同时使用了这两个选项极为困难，因为进程参数可能被修改或继承，通过环境变量（如 $0 前缀 '-'）或 /proc 文件系统检查均不可靠。作者建议避免同时使用这两个选项，改为在脚本中显式设置所需环境以消除歧义。"
source: "utcc.utoronto.ca/~cks"
shareId: "b354abe2"
targetUrl: "/posts/2026-05-07/#item-b354abe2"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/unix/BourneShellLoginWithCommand"
titleEn: "Detecting (or not) the use of -l and -c together in Bourne shells"
---
