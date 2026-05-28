---
title: "ReLU函数的三种求导方式"
date: "2026-04-30T00:00:00+08:00"
type: share
private: true
build:
  list: never
summary: "ReLU激活函数在x=0处不可导，这给神经网络训练带来挑战。文章阐述了三种广义导数方案：次梯度、分布导数和基于光滑近似（如Softplus）的导数。次梯度允许在[0,1]区间取值，分布导数涉及狄拉克δ函数，光滑近似则完全可微。这些方法直接影响反向传播时的梯度计算，其中次梯度在实际中最为常用。作者指出，尽管有多种选择，但实际应用中通常采用简单约定。"
source: "johndcook.com"
shareId: "aa0ab06d"
targetUrl: "/posts/2026-04-30/#item-aa0ab06d"
originalUrl: "https://www.johndcook.com/blog/?p=246993"
titleEn: "Three ways to differentiate ReLU"
---
