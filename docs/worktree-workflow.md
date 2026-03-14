# Worktree 工作流

## 为什么用 worktree

每次开始一项工作，在独立 worktree 中进行，好处：

- 主分支始终干净，不会被半成品污染
- 多项工作可以并行，互不干扰
- 每个 worktree 有明确的职责边界，做完合回来就删

## 流程

### 1. 开工：创建 worktree

```bash
# 从主分支创建新 worktree（本仓库主分支为 master，按实际情况替换）
git worktree add ../Greyfield-<短名> -b <分支名> <主分支>

# 例：
git worktree add ../Greyfield-voice -b feat/voice-spine master
```

分支命名规范：
- 功能：`feat/<模块名>`
- 修复：`fix/<问题简述>`
- 文档：`docs/<主题>`
- 重构：`refactor/<范围>`

### 2. 登记：更新跟踪表

在 `docs/worktree-log.md` 追加一行记录。

### 3. 干活

在 worktree 目录里正常开发、提交。

### 4. 收工：推送 + 开 PR + 清理

```bash
# 在 worktree 目录里推送分支
git push -u origin <分支名>

# 去 GitHub 开 PR，合并后再执行清理
```

PR 合并后清理：

```bash
# 必须先回到主仓库目录，不能在 worktree 里执行 remove
cd E:/a7/Greyfield

# 删除 worktree
git worktree remove ../Greyfield-<短名>

# 删除本地分支
git branch -d <分支名>
```

> ⚠️ 禁止在主仓库执行 `git merge <分支名>` 直接合入。所有分支必须通过 GitHub PR 合并。（DEV-76）

在 `docs/worktree-log.md` 更新状态为「已合并」。

## 注意事项

- worktree 目录统一放在 `E:/a7/` 下，与主仓库同级
- 命名格式：`Greyfield-<短名>`，短名用英文、不带空格
- 长期不用的 worktree 及时清理，避免磁盘浪费
