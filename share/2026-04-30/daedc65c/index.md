---
title: "拷贝失败：仅732字节即可在所有主流Linux发行版上获取root权限"
date: "2026-04-30T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "漏洞CVE-2026-31431是一个由Xint Code披露的认证scratch-write bug，通过链式利用AF_ALG和splice()系统调用实现4字节页缓存写入。一个仅732字节的PoC即可在Ubuntu、Amazon Linux、RHEL、SUSE等主流系统上稳定获取root权限。该漏洞利用copy_fail机制，影响所有主要Linux发行版，构成严重安全威胁。"
source: "xint.io"
shareId: "daedc65c"
targetUrl: "/posts/2026-04-30/#item-daedc65c"
originalUrl: "https://xint.io/blog/copy-fail-linux-distributions"
titleEn: "Copy Fail: 732 Bytes to Root on Every Major Linux Distribution."
---
