---
name: sync-release-tags
description: |
  将本仓库（clash-verge-self fork，owner = oomeow）的 git tag 与 GitHub releases 同步：只保留发行版 tag，删除其余本地与远程 tag，并把每个发行版 tag 重新指向 origin/dev 上由 oomeow 提交的对应 commit。

  Manual trigger only: use this skill only when the user explicitly asks to "同步tag", "同步 tag", "同步发行版tag", "清理tag", "清理 tags", "sync tags with releases", "clean up git tags", "把tag指向对应提交", "重新指向tag", or explicitly names `sync-release-tags`.

  Do not auto-trigger for generic tag creation, single-tag edits, branch cleanup, or unrelated git housekeeping.
---

# Sync Release Tags

Align this repo's git tags with the GitHub releases of `oomeow/clash-verge-self`:

- keep only the 25 release tags (the exact set published on the releases page),
- delete every other local and remote tag,
- point each kept tag at the corresponding commit authored by `oomeow` in `origin/dev`.

This skill is destructive (it deletes remote tags). Run it only on explicit request, and confirm with the user before any remote push-delete.

## Workflow

### 0. Preflight

1. Confirm the worktree is clean: `git status`.
2. Make sure `origin/dev` is up to date: `git fetch origin dev`.
3. Confirm the release set hasn't changed since the baseline in [Reference mapping](#reference-mapping) (a new release invalidates the table). If it has changed, re-derive the mapping with the rules in [Resolving the mapping](#resolving-the-mapping).

### 1. Gather the release tag set (the "keep" list)

The releases page is the source of truth — it has exactly the tags that must survive:

```shell
gh api repos/oomeow/clash-verge-self/releases --paginate \
  --jq '.[] | .tag_name' | sort -u > /tmp/release_tags.txt
```

Count them and eyeball the list. Today there are 25; any drift means re-deriving the mapping.

### 2. Delete non-release local tags

Use a `while read` loop, not `for t in $VAR` — zsh does not word-split unquoted variables, so a bare `for` over the command substitution iterates once over the whole blob and deletes nothing.

```shell
KEEP=$(cat /tmp/release_tags.txt | tr '\n' ' ' | tr ' ' '\n' | sort)
while IFS= read -r t; do
  if [ -n "$t" ] && ! printf '%s\n' "$KEEP" | grep -qx "$t"; then
    git tag -d "$t"
  fi
done < <(git tag -l)
```

Stop and verify: `git tag -l | wc -l` must equal the release count, and the list must match `/tmp/release_tags.txt` exactly. If anything looks off, restore with `git fetch --tags origin` before proceeding.

### 3. Build the tag → commit mapping

For each release tag, the target is the `oomeow`-authored commit in `origin/dev` that the release corresponds to. Resolution priority:

1. The GitHub release's `target_commitish`, if it is a full SHA that is an oomeow-authored ancestor of `origin/dev`. This is the fork owner's own declared association.
2. Otherwise the git tag's actual target on GitHub (dereference annotated tags via `gh api .../git/tags/<sha>`), if it is an oomeow-authored ancestor of `origin/dev`.
3. Otherwise, fall back by tag kind:
   - **Version tags** (`vX.Y.Z` / `vX.Y.Z-beta.*` / `vX.Y.Z-patch`): the oomeow release commit in `origin/dev` — `:tada: release vX.Y.Z`, `release: X.Y.Z`, `chore: bump version to X.Y.Z`, or (failing all of those) the last commit that set that version in `package.json` / `src-tauri/Cargo.toml` (e.g. `git log origin/dev -S 'X.Y.Z' -- package.json`).
   - **Special tags** (`alpha`, `updater`, `service-*`): the fork's `target_commitish` if oomeow-authored, else the first oomeow-authored descendant of the fork's tag target: `git log --format='%H %ad %s' --date=short --ancestry-path <tag-target>..origin/dev --author='oomeow' --reverse | head -1`.

Verification before applying — every target MUST satisfy both:

```shell
git merge-base --is-ancestor <commit> origin/dev   # present on dev
git log -1 --format='%an' <commit>                  # == oomeow
```

If any candidate fails these, stop and ask the user rather than guessing.

The current known-good mapping is the [Reference mapping](#reference-mapping) table.

### 4. Re-point the local tags

Lightweight tags are preferred so the ref points at the commit directly:

```shell
while IFS=$'\t' read -r tag commit; do
  git update-ref "refs/tags/$tag" "$commit"
done <<'EOF'
<tag>	<commit>
...
EOF
```

### 5. Clean the remote tags

1. **Confirm with the user before pushing any deletions.** Show the list of tags that will be removed and note that each was verified to have no GitHub release attached (a release-less tag is safe to delete; a tag backing a release must NEVER be deleted or the release goes with it).
2. Compare kept tags against the remote to see whether re-pointing is needed at all — in practice the fork's remote tags already point at the right commits:

```shell
while IFS= read -r t; do
  remote=$(git ls-remote origin "refs/tags/$t" | awk '{print $1}')
  local=$(git rev-parse "$t")
  [ "$remote" = "$local" ] && echo "OK   $t" || echo "DIFF $t remote=$remote local=$local"
done < /tmp/release_tags.txt
```

Re-point only the DIFF entries if any, mirroring step 4 but on the remote:
`git push origin refs/tags/<tag>:refs/tags/<tag>` (force if the remote is an annotated tag).

3. Compute and push the deletions. `git ls-remote` lists annotated tags twice (with a `^{}` deref line) — filter those out. Batch the deletions through `xargs` so each refspec arrives as its own argument:

```shell
git ls-remote --tags origin \
  | awk -F'\t' '$2 !~ /\^\{}$/ {sub("refs/tags/", "", $2); print $2}' | sort -u \
  > /tmp/remote_tags.txt
comm -23 /tmp/remote_tags.txt /tmp/release_tags.txt > /tmp/delete_tags.txt
# guard: the delete list must not contain any release tag
[ -z "$(comm -12 /tmp/delete_tags.txt /tmp/release_tags.txt)" ] || { echo "ABORT: release tag in delete list"; exit 1; }
cat /tmp/delete_tags.txt | sed 's#^#:refs/tags/#' | xargs git push origin
```

### 6. Verify

```shell
git ls-remote --tags origin \
  | awk -F'\t' '$2 !~ /\^\{}$/ {sub("refs/tags/", "", $2); print $2}' | sort \
  | diff /tmp/release_tags.txt - && echo "remote == releases only"
```

Local and remote tag lists must both equal the release set, and every kept tag must point at an oomeow commit in `origin/dev`.

## Resolving the mapping

The [Reference mapping](#reference-mapping) is the baseline as of this skill's creation. Re-derive it whenever the release set changes:

1. Get each release's association: `gh api repos/oomeow/clash-verge-self/releases --paginate --jq '.[] | "\(.tag_name)\t\(.target_commitish)"'`.
2. Get each git tag's actual target (dereference annotated tags): `gh api repos/oomeow/clash-verge-self/git/refs/tags/<tag>` then, if `type == "tag"`, `gh api .../git/tags/<sha> --jq '.object.sha'`.
3. Apply the priority in [step 3](#step-3-build-the-tag-→-commit-mapping), then verify every candidate with the two checks.

Known quirks observed while building the baseline:

- The fork re-published several upstream releases (`v2.3.0`, `v2.3.1`, the `v1.6.x-patch` set, `updater`, `service-alpha`). Their tags point at upstream commits (wonfen / renovate[bot] / Damian Johnson), so those need the fallback rules — there is often no `oomeow` release commit for them.
- `target_commitish` can drift from the actual git tag (e.g. `alpha` release metadata points at one commit while the tag points elsewhere), and can be a branch name (`dev`) or a SHA that no longer exists in the repo.
- A commit being "in the local object store" does not mean it is an ancestor of `origin/dev` (some upstream tag targets live on other branches) — always run the `merge-base --is-ancestor` check.

## Reference mapping

Established 2026-08-01. All targets are oomeow-authored ancestors of `origin/dev`:

| tag | commit |
|---|---|
| `alpha` | `4f9cd3e0c` |
| `v2.3.2` | `75c8c4167` |
| `service-v2.1.0` | `ae903eb36` |
| `service-alpha` | `50ebc2e81` |
| `v2.2.0` | `76186b5f3` |
| `v2.1.4` | `dd0cb8f31` |
| `v2.1.3` | `ac9b0c4b9` |
| `v2.1.2` | `2a69c4528` |
| `v2.1.1` | `c12cf073e` |
| `v2.3.1` | `be7d61fd6` |
| `v2.3.0` | `a7de29ff1` |
| `v2.1.0` | `1bef15164` |
| `v2.0.0` | `406b8f088` |
| `v2.0.0-beta.3` | `7001f54d4` |
| `v2.0.0-beta.2` | `e0945fdf7` |
| `v2.0.0-beta.1` | `3f36df393` |
| `v1.7.1` | `3f08f5daa` |
| `v1.7.0` | `db6c7f063` |
| `v1.6.8` | `a464d9616` |
| `v1.6.7` | `7ae0f59be` |
| `v1.6.6-patch` | `b11e1a832` |
| `v1.6.2-patch` | `654889949` |
| `v1.6.1-patch` | `2720f101e` |
| `updater` | `9c1f499c3` |
| `v1.6.0-patch` | `9c1f499c3` |
