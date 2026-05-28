---
title: "为何你的 Linux 发行版不再自动生成 SSH 主机密钥？"
date: "2026-05-07T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "传统 Linux 系统在检测到缺失 SSH 主机密钥时会自动生成，但 Fedora、RHEL 等近期发行版改变了这一行为，删除密钥后重启 sshd 或系统不再触发生成，导致服务启动失败。该变化源于 systemd 单元中对 sshd-keygen 服务条件的调整，可能出于安全考虑，避免意外生成非预期密钥。用户需手动执行 ssh-keygen -A 或修改 systemd 配置来重新生成密钥，系统管理员应更新运维流程以适配此变更。"
source: "utcc.utoronto.ca/~cks"
shareId: "d73ee19d"
targetUrl: "/posts/2026-05-07/#item-d73ee19d"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/linux/SSHHostKeysAndAutogeneration"
titleEn: "Your Linux distribution may no longer auto-generate new SSH host keys"
---
