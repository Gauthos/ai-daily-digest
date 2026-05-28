---
title: "利用 ReadDirectoryChangesW 跟踪重命名时提升可靠性"
date: "2026-05-08T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "使用 ReadDirectoryChangesW 监控目录变化时，仅依靠文件名跟踪重命名容易出错。Windows 开发者可通过追踪文件 ID 实现更可靠的跟踪，因为文件 ID 是系统分配的持久标识符，不受重命名影响。具体做法是打开文件句柄，调用 GetFileInformationByHandle 获取文件 ID，再与 ReadDirectoryChangesW 的通知结合。该方法能避免重命名导致的漏检或误报，尤其适合文件同步与备份工具。核心在于利用文件 ID 的稳定性，为变更监控构建更健壮的逻辑。"
source: "devblogs.microsoft.com/oldnewthing"
shareId: "b1e027b8"
targetUrl: "/posts/2026-05-08/#item-b1e027b8"
originalUrl: "https://devblogs.microsoft.com/oldnewthing/?p=112310"
titleEn: "Developing more confidence when tracking renames via Read­Directory­ChangesW"
---
