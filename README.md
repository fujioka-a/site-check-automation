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
├─ SKILL: site-check-analyzer
├─ AGENTS.md (基本方針)
├─ rules/xxx.md (ルール定義)
↓
Playwright MCP (Browser Automation)
↓
Webサイト

Playwright MCPは、ブラウザ操作（遷移・クリック・取得）をMCP経由でLLMから実行可能にするサーバーです。 :contentReference[oaicite:0]{index=0}

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
│  └─ rules/
│  │  └─ xxx.md
│  └─ skills/
│     └─ site-check-analyzer/
│        ├─ SKILL.md
│        ├─ templates/
│        │  ├─ report.md
│        │  └─ ignore-rules.yaml
│        └─ config.yaml
└─ reports/
```

## 実行方法

スキルをCallして以下を実行するのみ
```bash
/site-check-analyzer https://example.comをチェックして
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