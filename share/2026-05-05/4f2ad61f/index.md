---
title: "包管理器威胁模型：CVE之外的另一半安全"
date: "2026-05-05T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "包管理器安全不仅限于已知漏洞（CVE），更需关注设计层面的威胁模型。文章系统梳理了包管理器的核心组件（客户端、注册表、存储库）及其交互中的攻击面，包括域名劫持、证书撤销、哈希不一致、混淆依赖和元数据篡改等。作者认为，通用的供应链安全标准（如SLSA）无法替代针对包管理器自身机制的威胁建模，开发者应基于特定生态（npm、PyPI、Go）的信任传递路径进行风险分析。"
source: "nesbitt.io"
shareId: "4f2ad61f"
targetUrl: "/posts/2026-05-05/#item-4f2ad61f"
originalUrl: "https://nesbitt.io/2026/05/05/package-manager-threat-models.html"
titleEn: "Package Manager Threat Models"
---
