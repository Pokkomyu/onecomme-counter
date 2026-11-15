---
type: evidence_index
repo: onecomme-counter
ticket_id: follow-count
status: draft
created: 2026-11-15
updated: 2026-11-15
owner: devuser
canonical_path: docs/development/evidence/follow-count/evidence-index.md
tags: [evidence, index, onecomme-counter]
---

# Evidence Index: follow-count

## 1. 証跡一覧

| evidence_id | test_case_id | 種別 | path / URL | 取得日 | 版数 / 環境 | 関連 |
|---|---|---|---|---|---|---|
| EV-001 | TC-OCC-001〜065 | log | `docs/development/evidence/follow-count/mock-test-run.log`(65 件 pass) | 2026-11-15 | 0.2.0 / Playwright 1.49.1 + Chrome(mock SDK、擬似時計) | follow-count |
| EV-002 | (チケット全体) | log | `docs/development/evidence/follow-count/qa-gate.md` | 2026-11-15 | scripts/qa-gate.sh change | follow-count |
| EV-003 | (チケット全体) | review | `docs/development/evidence/follow-count/security-review.md` | 2026-11-15 | 0.2.0 | follow-count |

実行コマンド: `npm ci && npx playwright test`(repo 直下)

## 2. Fix確認(該当時)

該当なし

## 3. not_tested(証跡なし)

| test_case_id | skip_reason | accepted_risk | review_required |
|---|---|---|---|
| TC-OCC-066 | 未実施(実機待ち)。わんコメ + OBS + 別アカウントが必要 | mock(001〜004)で通知の数え方は担保 | true |
| TC-OCC-067 | 未実施(実機待ち) | mock(013/014)で担保 | true |
| TC-OCC-068 | 未実施(実機待ち) | mock(031/032)で担保 | true |
| TC-OCC-069 | 未実施(実機待ち)。2 サービス同時配信が必要 | mock(033〜035)で担保 | true |
| TC-OCC-070 | 未実施(実機待ち) | mock(039/065)で担保 | true |
| TC-OCC-071 | 未実施(実機待ち) | mock(058〜061)で担保 | true |
| TC-OCC-072 | 未実施(実機待ち) | mock(049〜052)で担保 | true |
| TC-OCC-073 | 未実施(実機待ち) | 見た目は実機でのみ確認可 | true |
| TC-OCC-074 | 未実施(実機待ち) | mock(043)で担保 | true |

## 4. リンク

- test-case master: `docs/development/test-cases/master/onecomme-counter.yaml`
- 開発意図ログ: `docs/development/dev-intent/follow-count.md`
- DRBFM: `docs/development/drbfm/20261115-follow-count-stream-reset.md`
