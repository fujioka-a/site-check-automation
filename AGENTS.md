# AGENTS.md

```md
# Agent Policy

## 基本方針
- Webサイトチェックは必ず `site-check-analyzer` を使用
- Playwright MCPを優先使用
- 同一ドメイン制限を守る

## 禁止事項
- 購入 / 削除 / フォーム送信
- ログアウト操作
- データ更新系操作

## 評価基準
- 見た目に影響するエラーを最優先
- Consoleノイズは過剰に重要視しない
- AWS移行に関連するエラーを優先検出

## 出力ルール
- Markdownで構造化
- 重大度別に整理
- 原因推定を必ず記載