# Site Check Automation (Codex + Playwright MCP)

## 概要
本プロジェクトは、商用Webサイトの改修・AWS移行後における不具合検知を半自動化するためのツールです。

以下を実現します：

- URLを1つ指定するだけで同一ドメインを巡回
- Consoleエラー / Networkエラーを収集
- 問題を重要度別に分類
- Markdownレポートとして出力
- Codexとのチャットで分析・考察まで可能

---

## アーキテクチャ

Codex (Agent)
├─ AGENTS.md (基本方針)
├─ .codex/rules/*.md (ルール定義)
├─ src/site-check-analyzer.ts (実行入口)
↓
Playwright
↓
Webサイト

本リポジトリでは `src/site-check-analyzer.ts` を入口にして Playwright ベースのチェックを実行します。

---

## セットアップ

### 1. MCPサーバー設定

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

## ディレクトリ構成

```bash
project-root/
├─ README.md
├─ AGENTS.md
├─ .codex/
│  ├─ rules/
│  │  └─ resuls-reports.md
│  └─ skills/
│     └─ site-check-analyzer/
│        └─ template/
│           └─ report.md
├─ src/
│  └─ site-check-analyzer.ts
└─ reports/
```

## 実行方法

Playwright を利用できる環境で、`site-check-analyzer` 入口を実行します。

```bash
npm run site-check-analyzer -- check \
  --url https://example.com/ \
  --output reports \
  --max-pages 100 \
  --max-depth 4 \
  --sample-limit 10
```

差分比較は JSON レポート 2 本を入力にします。

```bash
npm run site-check-analyzer -- diff \
  --before reports/example.com/result_example_com_2026-03-24.json \
  --after reports/example.com/result_example_com_2026-03-25.json \
  --output reports/example.com/diff_2026-03-25.md
```

## チェック内容
### 収集対象
- Console error / warning
- page error（未捕捉例外）
- failed request
- HTTP 4xx / 5xx
- JS / CSS / APIエラー
- 画面レンダリング異常の兆候

## 重要度分類

| Level     | Description |
|----------|------------|
| Critical | 画面表示不能、主要JS/CSS欠損、API失敗、致命的JSエラー |
| High     | 主要機能に影響、繰り返し発生するエラー、CORS/CSP問題 |
| Medium   | 一部表示崩れ、画像/フォント問題、軽微な機能影響 |
| Low      | 影響のない警告、サードパーティノイズ |

### Critical criteria
- main document request failed
- essential JS/CSS failed
- blocking API failure
- uncaught runtime error

### High criteria
- repeated console errors
- CORS/CSP/mixed content issues
- navigation broken

### Medium criteria
- image/font failure with visible impact
- partial feature degradation

### Low criteria
- analytics failure
- favicon error
- third-party noise

## レポート出力

- 出力先は `reports/` ディレクトリ配下
- ドメインごとにディレクトリを分割する
- ファイル名は以下形式とする

reports/
  example.com/
    result_example_com_YYYY-MM-DD.md

  type-a.example.com/
    result_type-a_example_com_YYYY-MM-DD.md
