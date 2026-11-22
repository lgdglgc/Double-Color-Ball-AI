#!/usr/bin/env bash
# 同步上游仓库 lgdglgc/Double-Color-Ball-AI 的 main 到本 fork 的 main
# 冲突策略：
#   - 代码等非数据文件：保留 fork 本地改动（智谱 GLM API 适配）
#   - data/*.json、fetch_history/*.json：采用上游版本（自动生成的权威数据）
# 用法：bash sync_upstream.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

BRANCH="main"
UPSTREAM_REF="upstream/main"
ORIGIN="origin"

# ---------- 1. 前置检查 ----------
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "[同步失败] 当前分支为 $current_branch，需切换到 $BRANCH" >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[同步失败] 工作区存在未提交改动，请先提交或暂存" >&2
  exit 1
fi

# ---------- 2. 拉取上游 ----------
git fetch upstream --prune

# 上游没有新提交则直接退出
if git merge-base --is-ancestor "$UPSTREAM_REF" HEAD; then
  echo "[同步] 已是最新，无需操作"
  exit 0
fi

# ---------- 3. 合并（--no-commit 保留冲突现场供脚本处理） ----------
if ! git merge --no-commit --no-ff "$UPSTREAM_REF"; then
  echo "[同步] 存在冲突，按既定策略自动解决"
fi

git_dir="$(git rev-parse --git-dir)"
if [[ ! -f "$git_dir/MERGE_HEAD" ]]; then
  echo "[同步失败] 合并未正常启动，已回滚" >&2
  git merge --abort 2>/dev/null || true
  exit 1
fi

# ---------- 4. 冲突解决 ----------
while IFS= read -r file; do
  case "$file" in
    data/*.json|fetch_history/*.json)
      git checkout --theirs -- "$file"
      echo "  [采用上游] $file"
      ;;
    *)
      git checkout --ours -- "$file"
      echo "  [保留本地] $file"
      ;;
  esac
  git add -- "$file"
done < <(git diff --name-only --diff-filter=U)

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "[同步失败] 仍有未解决冲突，已回滚" >&2
  git merge --abort
  exit 1
fi

# ---------- 5. 提交并推送 ----------
git commit --no-edit -m "chore: sync upstream $(date '+%Y-%m-%d %H:%M:%S')"
git push "$ORIGIN" "$BRANCH"

echo "[同步完成] $(git log -1 --oneline)"
