# GreyWind 工程经验文档

## 当前状态

本文件作为错题本体系的入口。

具体错题条目按模块拆分到 `error-books/` 目录下。

## 错题本体系

| 文件 | 范围 |
|------|------|
| `error-books/_index.md` | 速查索引（每次必读） |
| `error-books/flow-rules.md` | 流程子文件索引（每次必读） |
| `error-books/flow-gate.md` | 门控/流程执行 |
| `error-books/flow-code-habit.md` | 代码修改习惯 |
| `error-books/flow-design.md` | 设计阶段 |
| `error-books/tool-rules.md` | 工具使用 |
| `error-books/interface-rules.md` | 接口协作 |
| `error-books/common-mistakes.md` | 跨角色通用错误 |

## 加载规则

1. 每次必读 `_index.md` + `flow-rules.md`
2. 根据当前任务类型读对应子文件
3. 遇到新错误按格式追加到对应文件，同时更新 `_index.md`

## 来源

错题本体系框架和通用条目从 bot_civ 项目复用，已去除项目专属内容（EvoMap A2A、五方PID评审流程、具体业务Bug），保留所有项目无关的通用经验。
