---
type: evidence_index
repo: onecomme-counter
ticket_id: poko-chatcount
status: draft
created: 2026-11-16
updated: 2026-11-16
owner: devuser
canonical_path: docs/development/evidence/poko-chatcount/evidence-index.md
tags: [evidence, index, onecomme-counter]
---

# Evidence Index: poko-chatcount

## 1. 証跡一覧

| evidence_id | test_case_id | 種別 | path / URL | 取得日 | 版数 / 環境 | 関連 |
|---|---|---|---|---|---|---|
| EV-001 | TC-OCC-001〜065, 075〜089, 095〜100 | log | `docs/development/evidence/poko-chatcount/mock-test-run.log`(86 件 pass) | 2026-11-16 | 0.2.1 / Playwright 1.49.1 + Chrome(mock SDK、擬似時計) | poko-chatcount |

実行コマンド: `npm ci && npx playwright test`(repo 直下)

## 2. Fix確認(該当時)

該当なし

## 3. not_tested(証跡なし)

| test_case_id | skip_reason | accepted_risk | review_required |
|---|---|---|---|
| TC-OCC-066〜074 | 未実施(実機待ち)。follow-count から継続 | mock で担保(follow-count の evidence-index 参照) | true |
| TC-OCC-090 | handoff 作成後に zip の中身を確認する | run.sh の unzip -l で確認 | false |
| TC-OCC-091〜092 | 未実施(実機待ち)。わんコメ + OBS が必要 | mock(087, 089)で名前・キー不変は担保 | true |
| TC-OCC-093〜094 | 未実施(実機待ち) | mock(078〜083)で担保 | true |
| TC-OCC-101 | 未実施(実機待ち)。OBS のブラウザソースで全リセットの確認欄を押す | mock(095〜098)で担保。ダイアログが出たら mock は失敗する | true |

## 4. リンク

- test-case master: `docs/development/test-cases/master/onecomme-counter.yaml`
- 開発意図ログ: `docs/development/dev-intent/poko-chatcount.md`
- DRBFM: `docs/development/drbfm/20261116-poko-chatcount-rename-autoreset-off.md`
