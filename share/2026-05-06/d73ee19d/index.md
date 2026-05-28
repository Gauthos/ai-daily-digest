---
title: "你的 Linux 发行版可能不再自动生成新的 SSH 主机密钥"
date: "2026-05-06T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "Linux 发行版传统上会在系统启动或 SSH 服务重启时自动生成缺失的 SSH 主机密钥。这种机制允许管理员通过删除现有密钥并重启服务来重置密钥。但作者最近发现某些发行版已取消这一自动生成功能，可能导致 SSH 服务因密钥丢失而无法启动。这一变化可能与 systemd 的密钥生成单元（如 sshd-keygen）的启用策略调整有关。用户需手动运行 ssh-keygen -A 或调整服务配置来确保密钥存在。作者提醒系统管理员注意这一行为变更，避免因密钥缺失导致远程访问中断。"
source: "utcc.utoronto.ca/~cks"
shareId: "d73ee19d"
targetUrl: "/posts/2026-05-06/#item-d73ee19d"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/linux/SSHHostKeysAndAutogeneration"
titleEn: "Your Linux distribution may no longer auto-generate new SSH host keys"
---
