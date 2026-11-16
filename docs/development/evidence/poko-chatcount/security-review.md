---
type: security_review
repo: repo
ticket_id: poko-chatcount
status: reviewed
reviewed_at: 2026-11-16
reviewed_head: 7ae5112
reviewed_code_digest: 87e9e0e2f6d8098a589474b13e54b884bfb4241d
reviewer: Claude Code (段取り役 Opus 5.5, 差分の手動レビュー)
scope: origin/main..HEAD + index
open_findings: 0
review_required: false
canonical_path: docs/development/evidence/poko-chatcount/security-review.md
tags: [security-review, evidence, poko-chatcount]
---

# Security Review: poko-chatcount

> 雛形: SQA templates/security-review.md / 手順: SQA docs/development/test-asset-lifecycle-policy.md §4.2
> 所見を書いたら status: reviewed にする。未解消の所見が残るなら open_findings に件数、review_required: true(握りつぶし禁止)。

## 1. 対象と観点

- 差分: template/index.html(`<title>`・見出しコメント・version・CONFIG.autoReset の既定値、全リセットの確認欄、テーマボタンの選択表示、選択色 --sel)、tests/occ.spec.js(前提の明示、TC-OCC-075〜089・095〜100、ダイアログが出たら失敗にする)、package.json / package-lock.json(version と description のみ)、docs
- 観点: 入力検証 / injection / 認証・認可 / secret・個人情報 / SSRF・外部呼び出し / 依存・設定

## 2. 所見

| finding_id | severity | 箇所 | 内容 | 対応 | 対応先 |
|---|---|---|---|---|---|
| SR-001 | info | template/index.html | 変更は固定文字列と既定値だけ。新しい入力経路・描画経路・通信先はない。storageKey と sdkUrl は据え置き、localStorage の読込検証(follow-count SR-003)はそのまま | accepted | TC-OCC-087, 089 |
| SR-002 | info | template/index.html | autoReset の既定を false にしても、保存値の検証(boolean 以外は既定に戻す)は変わらない。保存値 true は優先されるが、これは利用者が自分で選んだ値で権限の問題はない | accepted | TC-OCC-078〜083 |
| SR-003 | info | package.json / package-lock.json | 依存の追加・版の変更なし(@playwright/test 1.49.1 のまま)。lock の差分は自パッケージの version だけ | accepted | — |
| SR-004 | info | tests/ | 追加試験は既存の fake SDK と合成データのみを使い、実配信の記録や実名は追加していない | accepted | TC-OCC-075〜089, 095〜100 |
| SR-005 | info | template/index.html | 全リセットの確認を confirm() から画面内の確認欄に変えた。確認欄は固定文字列の静的 HTML で、表示切替は style.display だけ。innerHTML や利用者の入力は使わない。「0 に戻す」は従来と同じ resetCounts() を呼ぶだけで、消す範囲(カウントとあいさつ済み)は変わらない | accepted | TC-OCC-095〜098 |
| SR-006 | info | template/index.html | テーマの選択表示は、固定の THEMES と state.colors(読込時に #rrggbb だけ通す検証済み)を比べて class を付け外しするだけ。data-theme はテンプレートが THEMES のキーから作った値で、外から入らない。DOM に値を書き込まない | accepted | TC-OCC-099, 100 |

## 3. DRBFM / 試験への反映

- DRBFM に追加した故障モード行: 既存 docs/development/drbfm/20261116-poko-chatcount-rename-autoreset-off.md を参照(追加なし)
- DRBFM 行 18〜21(全リセットの確認欄・テーマ選択表示・選択色)を追加
- 追加した回帰試験(test_case_id): TC-OCC-075〜089・095〜100(mock)。mock 全 86 件 pass

## 4. 残リスク

- 所見はすべて info。受容の判断は devuser。
