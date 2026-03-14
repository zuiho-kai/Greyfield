# GreyWind（灰风）— AGENTS.md

> 完整项目规则见 `CLAUDE.md`，本文件仅补充非 Claude Code 环境的额外要求。

## 编码

**强制 UTF-8**：所有文件读写必须使用 UTF-8 编码。写入文件前确认编码为 UTF-8，禁止使用 GBK/CP936/ANSI。如果需要用 shell 写文件，加 `export PYTHONUTF8=1` 或用 `chcp 65001`。

## Code Review

做 PR code review 时，如果已经形成明确的 review finding，默认直接用 `gh` 提交到对应 PR（行内评论或 review summary），不要只停留在本地结论；仅当用户明确要求不要提交时例外。
