---
type: security_review
repo: repo
ticket_id: follow-count
status: reviewed
reviewed_at: 2026-11-15
reviewed_head: 1a2cd63
reviewed_code_digest: 2f2c08b8f8c6028633c9f5211a68dff8706b7a43
reviewer: Claude Code (段取り役 Opus 5.5, 差分の手動レビュー。構築役 Sonnet の下書きを再確認)
scope: origin/main..HEAD + index
open_findings: 0
review_required: false
canonical_path: docs/development/evidence/follow-count/security-review.md
tags: [security-review, evidence, follow-count]
---

# Security Review: follow-count

> 雛形: SQA templates/security-review.md / 手順: SQA docs/development/test-asset-lifecycle-policy.md §4.2
> 所見を書いたら status: reviewed にする。未解消の所見が残るなら open_findings に件数、review_required: true(握りつぶし禁止)。

## 1. 対象と観点

- 差分: template/index.html(自動リセット・フォロー集計・SDK 再試行)、tests/、package.json / package-lock.json / playwright.config.js、docs
- 観点: 入力検証 / injection / 認証・認可 / secret・個人情報 / SSRF・外部呼び出し / 依存・設定

## 2. 所見

| finding_id | severity | 箇所 | 内容 | 対応 | 対応先 |
|---|---|---|---|---|---|
| SR-001 | info | template/index.html | eval / new Function / new RegExp は不使用。キーワード判定は includes のみ(ReDoS なし) | fixed(設計で回避) | TC-OCC-010 |
| SR-002 | info | template/index.html | コメント・meta 由来の文字列は textContent で描画(デバッグ欄・フォロワー総数も)。innerHTML は CONFIG/定数と検証済みの数値だけで組み立てる(#vRows・操作パネル生成) | fixed | TC-OCC 系 |
| SR-003 | info | template/index.html | 色は #RRGGBB 正規表現で検証、localStorage は読込時に検証・Set は 5000 件で上限 | fixed | TC-OCC 系 |
| SR-004 | info | template/index.html | 通信は Google Fonts と localhost:11180 の OneSDK(CONFIG 固定、URL を外から差し替える口なし)のみ。SDK 再試行は 10 秒間隔で外部入力に依存しない。meta の follower は 12 桁以内の非負整数だけ採用 | accepted | DI-005 |
| SR-005 | info | package.json | 依存は @playwright/test 1.49.1(版固定)の devDependency のみ、lock の取得元は registry.npmjs.org だけ。zip に含めない | accepted | evidence-index |
| SR-006 | low | tests/fixtures/samples.json | 実配信の記録から作った fixture に視聴者 1 名の実ニックネームが残っていた。ダミー名「テスト視聴者C」に置換し、元記録の名前欄 19 件と staged 差分を突き合わせて残りがないことを確認(一致はシステム名 わんコメ・onecomme.system・#Twitch・#Youtube のみ) | fixed | TC-OCC 系(fixture 利用試験) |

## 3. DRBFM / 試験への反映

- DRBFM に追加した故障モード行: 既存 docs/development/drbfm/20261115-follow-count-stream-reset.md を参照(追加なし)
- 追加した回帰試験(test_case_id): TC-OCC-001..065(mock、65/65 pass)

## 4. 残リスク

- 所見はすべて info。受容の判断は devuser。
