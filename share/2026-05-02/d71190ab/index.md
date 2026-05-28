---
title: "服务器意外自行重启"
date: "2026-05-02T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "在整栋楼计划停电前，团队提前手动关闭了机房里所有服务器，却发现部分机器在无人操作的情况下自动重新启动。故障排查指向两类常见原因：BIOS 中“断电后恢复供电时自动开机”的设置，以及局域网中的 Wake-on-LAN 魔法包意外触发了启动。即使是手动 shutdown -h 命令，某些硬件或 IPMI 仍可能在交流电恢复时强制上电。结论是彻底断电前需检查 BIOS 电源管理策略，并物理断开网络或禁用 WoL 以防止意外复活。"
source: "utcc.utoronto.ca/~cks"
shareId: "d71190ab"
targetUrl: "/posts/2026-05-02/#item-d71190ab"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/sysadmin/ServersSurpriseRevival"
titleEn: "Some of our servers revived themselves unexpectedly"
---
