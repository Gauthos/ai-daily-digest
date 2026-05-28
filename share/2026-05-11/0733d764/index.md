---
title: "用线性代数逆向工程梅森旋转算法"
date: "2026-05-11T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "梅森旋转（Mersenne Twister）是一种广泛使用的伪随机数生成器，统计性能优良但缺乏密码学安全性。文章演示了如何利用线性代数从MT的输出序列中恢复其完整的内部状态。将MT的状态转移和输出函数在GF(2)域上表示为线性变换，逆向问题即化为求解线性方程组。该方法揭示了MT算法在密码学场景下的脆弱性。作者强调，需区分普通PRNG和密码学安全的CSPRNG，后者必须能抵抗此类状态恢复攻击。"
source: "johndcook.com"
shareId: "0733d764"
targetUrl: "/posts/2026-05-11/#item-0733d764"
originalUrl: "https://www.johndcook.com/blog/?p=247013"
titleEn: "Reverse engineering Mersenne Twister with Linear Algebra"
---
