# Worktree 工作流

## 为什么用 worktree

每次开始一项工作，在独立 worktree 中进行，好处：

- 主分支始终干净，不会被半成品污染
- 多项工作可以并行，互不干扰
- 每个 worktree 有明确的职责边界，做完合回来就删

## 流程

### 1. 开工：创建 worktree

```bash
# 从 master 创建新 worktree
git worktree add ../Greyfield-<短名> -b <分支名> master

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

### 4. 收工：合并 + 清理

```bash
# 回到主仓库
cd E:\a7\Greyfield

# 合并
git merge <分支名>

# 删除 worktree
git worktree remove ../Greyfield-<短名>

# 删除分支（已合并）
git branch -d <分支名>
```

在 `docs/worktree-log.md` 更新状态为「已合并」。

## 注意事项

- worktree 目录统一放在 `E:\a7\` 下，与主仓库同级
- 命名格式：`Greyfield-<短名>`，短名用英文、不带空格
- 长期不用的 worktree 及时清理，避免磁盘浪费
