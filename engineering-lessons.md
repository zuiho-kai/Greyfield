# GreyWind 工程经验文档

## 当前状态

这个文件当前不作为独立主文档使用。

原因：

- 之前内容与 `context-runtime.md` 完全重复
- 会造成“看起来多了一篇主文档”的错觉
- 反而增加阅读成本

## 现在怎么处理

当前关于系统连续性、thread、session、handoff、context packet 的设计，以 `context-runtime.md` 为准。

如果后续真的要写“工程经验 / lessons learned”，再在这个文件里重写，不再复制设计文档内容。

## 临时规则

- 不要在新文档里把它当规范引用
- 需要理解连续性时，直接看 `context-runtime.md`
- 需要看全局入口时，先看 `MAP.md` 和 `INDEX.md`
