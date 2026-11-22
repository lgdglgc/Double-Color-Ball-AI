#!/usr/bin/env bash
# 同步上游仓库 lgdglgc/Double-Color-Ball-AI 的 main 到本 fork 的 main
# 冲突策略：
#   - 代码等非数据文件：保留 fork 本地改动（智谱 GLM API 适配）
#   - data/*.json、fetch_history/*.json：采用上游版本（自动生成的权威数据）
# 新增：合并前输出"上游更新摘要"，列出博主改了哪些说明/代码/数据
# 用法：bash sync_upstream.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

BRANCH="main"
UPSTREAM_REF="upstream/main"
ORIGIN="origin"

# ---------- 上游更新摘要 ----------
show_update_summary() {
  local range="HEAD..$UPSTREAM_REF"
  local three_dot="HEAD...$UPSTREAM_REF"

  mapfile -t commits < <(git log --reverse --no-merges --date=format:'%Y-%m-%d %H:%M' \
    --pretty=format:'%h  %ad  %s%n' "$range")
  mapfile -t dates < <(git log --reverse --no-merges --date=format:'%Y-%m-%d %H:%M' \
    --pretty=format:'%ad%n' "$range")
  mapfile -t files < <(git diff --name-only "$three_dot")

  echo "========================================"
  echo " 上游更新摘要"
  echo "========================================"
  if [[ ${#dates[@]} -gt 0 ]]; then
    echo "时间范围: ${dates[0]}  ~  ${dates[${#dates[@]}-1]}"
  fi
  echo "新增提交: ${#commits[@]} 个"
  echo "改动文件: ${#files[@]} 个"
  echo

  # [1] 提交记录
  echo "[提交记录]"
  local c
  for c in "${commits[@]}"; do
    [[ -n "$c" ]] && echo "  $c"
  done
  echo

  # [2] 文件清单（按类型分组）
  local docs=() codes=() datas=() others=() f add del
  for f in "${files[@]}"; do
    case "$f" in
      data/*.json|fetch_history/*.json) datas+=("$f") ;;
      *.md|*.txt|doc/*|prompts/*)        docs+=("$f") ;;
      *.py|*.js|*.sh|*.yml|*.yaml|*.html|*.css|Dockerfile|nginx.conf|docker-compose.yml) codes+=("$f") ;;
      *)                                  others+=("$f") ;;
    esac
  done
  echo "[改动文件清单]"
  for f in "${docs[@]}"; do
    read -r add del _ < <(git diff --numstat "$three_dot" -- "$f")
    echo "  [说明] $f  (+$add -$del)"
  done
  for f in "${codes[@]}"; do
    read -r add del _ < <(git diff --numstat "$three_dot" -- "$f")
    echo "  [代码] $f  (+$add -$del)"
  done
  for f in "${datas[@]}"; do
    read -r add del _ < <(git diff --numstat "$three_dot" -- "$f")
    echo "  [数据] $f  (+$add -$del)"
  done
  for f in "${others[@]}"; do
    read -r add del _ < <(git diff --numstat "$three_dot" -- "$f")
    echo "  [其他] $f  (+$add -$del)"
  done
  echo

  # [3] 说明文档具体内容（新增/删除行）
  if [[ ${#docs[@]} -gt 0 ]]; then
    echo "[说明文档改动详情]"
    for f in "${docs[@]}"; do
      echo "  --- $f ---"
      local lines n=0
      mapfile -t lines < <(git diff --unified=0 "$three_dot" -- "$f" | grep -E '^[+-][^+-]' | head -n 40 || true)
      for line in "${lines[@]}"; do
        echo "    $line"
        n=$((n + 1))
      done
      if [[ $n -ge 40 ]]; then echo "    ... 内容较多，仅显示前 40 行"; fi
      echo
    done
  fi

  # [4] 代码改动具体内容
  if [[ ${#codes[@]} -gt 0 ]]; then
    echo "[代码改动详情]"
    for f in "${codes[@]}"; do
      echo "  --- $f ---"
      local clines cn=0
      mapfile -t clines < <(git diff --unified=0 "$three_dot" -- "$f" | grep -E '^[+-][^+-]' | head -n 30 || true)
      for line in "${clines[@]}"; do
        echo "    $line"
        cn=$((cn + 1))
      done
      if [[ $cn -ge 30 ]]; then echo "    ... 内容较多，仅显示前 30 行"; fi
      echo
    done
  fi

  # [5] 数据文件提示
  if [[ ${#datas[@]} -gt 0 ]]; then
    echo "[数据文件] 上游自动生成数据，已按统计显示，合并时采用上游版本"
    echo
  fi

  echo "========================================"
  echo " 以上为博主本次更新内容，开始合并..."
  echo "========================================"
  echo
}

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

# 有更新则先展示摘要
show_update_summary

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
