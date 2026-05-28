---
title: "微软Copilot Cowork泄露文件"
date: "2026-05-28T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "设计AI代理系统的最大挑战之一是防止攻击者通过提示注入窃取数据。微软的Copilot Cowork允许代理在未经批准的情况下向用户邮箱发送邮件，这些邮件可被用于数据泄露。攻击者可以在邮件中嵌入外部图片链接，当用户打开邮件时，图片请求会将数据发送至外部服务器。由于OneDrive可生成预认证下载链接，提示注入可导致这些链接泄露，使攻击者能下载用户文件。这一漏洞突显了在集成AI代理到办公系统时，需要更严格的安全控制。"
source: "simonwillison.net"
shareId: "6f30ae0a"
targetUrl: "/posts/2026-05-28/#item-6f30ae0a"
originalUrl: "https://simonwillison.net/2026/May/26/copilot-cowork-exfiltrates-files/#atom-everything"
titleEn: "Microsoft Copilot Cowork Exfiltrates Files"
---
