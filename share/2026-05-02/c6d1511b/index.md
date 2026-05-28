---
title: "备份如何工作，取决于设置者的目标"
date: "2026-05-02T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "某软件误删了公司的生产数据库及其所有备份，引发业界哗然。该SaaS提供商将卷级备份存储在同一个卷中，文档明确写着“删除卷会清空所有备份”。作者对提供商表示部分同情，认为备份方案的设计完全取决于恢复目标和风险承受能力，而非通用最佳实践。结论是：备份策略必须基于明确的恢复场景（如防误删、防勒索、防区域性故障），盲目复制惯例可能导致灾难性后果。"
source: "utcc.utoronto.ca/~cks"
shareId: "c6d1511b"
targetUrl: "/posts/2026-05-02/#item-c6d1511b"
originalUrl: "https://utcc.utoronto.ca/~cks/space/blog/sysadmin/BackupsDependOnGoals"
titleEn: "How backups work depends on the goals of the people setting them up"
---
