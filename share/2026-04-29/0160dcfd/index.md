---
title: "GitHub Actions 是最薄弱的一环"
date: "2026-04-29T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "CI/CD 流水线中的 GitHub Actions 正成为供应链安全的致命弱点。攻击者可通过恶意工作流注入、Pwn 请求、自托管运行器逃逸或泄露的 GITHUB_TOKEN 窃取代码和机密。文章分析了多起真实攻击案例，指出 Actions 的默认权限过高且日志审计不足，导致单次破坏即可横向移动至整个仓库生态。结论是必须启用最少权限原则、严格限制自托管运行器，并将 Actions 视为外部输入进行安全审查。"
source: "nesbitt.io"
shareId: "0160dcfd"
targetUrl: "/posts/2026-04-29/#item-0160dcfd"
originalUrl: "https://nesbitt.io/2026/04/28/github-actions-is-the-weakest-link.html"
titleEn: "GitHub Actions is the weakest link"
---
