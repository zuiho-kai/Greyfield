# GreyWind（灰风）— AGENTS.md

> 完整项目规则见 `CLAUDE.md`，本文件仅补充非 Claude Code 环境的额外要求。

## 编码

**强制 UTF-8**：所有文件读写必须使用 UTF-8 编码。写入文件前确认编码为 UTF-8，禁止使用 GBK/CP936/ANSI。

- Shell/Python 写文件时，必须显式使用 UTF-8。Python 设 `PYTHONUTF8=1`；PowerShell 写文件优先用 `Set-Content -Encoding utf8` 或其他明确指定 UTF-8 的方式。
- **PowerShell 调原生命令且内容含中文时，禁止只依赖 `chcp 65001`**。`gh`、`git`、`node` 等原生命令如果通过 stdin / 管道 / `--body-file -` 接收中文，必须先显式设置：

```powershell
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
```

- 向 `gh` 提交 review/comment、向其他原生命令传递中文正文时，**优先做法**是：先写入 UTF-8 文件，再让命令读取该文件；不要直接用 PowerShell here-string/管道把中文正文喂给原生命令。

## Code Review

做 PR code review 时，如果已经形成明确的 review finding，默认直接用 `gh` 提交到对应 PR（行内评论或 review summary），不要只停留在本地结论；仅当用户明确要求不要提交时例外。
