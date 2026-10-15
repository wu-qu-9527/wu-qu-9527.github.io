# 无趣 · 个人博客

基于 Astro 和 Tailwind CSS v4 的静态博客。文章使用 Markdown 编写，放在 `source/_posts/`。

## 本地开发

```sh
pnpm install
pnpm dev
```

## 添加专题

在文章 frontmatter 中添加 `topics`。专题使用稳定且唯一的英文 `slug` 作为网址；相同 `slug` 的文章会自动归并到同一个专题。文章可同时属于多个专题。

```yaml
---
title: 七段数码管数字电路逻辑控制
slug: seven-segment-display
date: 2025-09-28
description: 从真值表出发，用卡诺图化简七段数码管的输出逻辑。
topics:
  - slug: digital-logic
    title: 数字逻辑入门
    description: 从真值表、逻辑表达式到组合电路设计，循序理解数字逻辑基础。
---
```

保存后，专题会自动出现在首页和 `/topics/`；本例专题页为 `/topics/digital-logic/`，其中列出所有使用同一个专题 slug 的文章。
