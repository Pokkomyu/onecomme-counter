---
type: dev_intent_log
repo: onecomme-counter
ticket_id: follow-count
status: draft
created: 2026-11-15
updated: 2026-11-15
owner: devuser
canonical_path: docs/development/dev-intent/follow-count.md
tags: [dev-intent, human-input, onecomme-counter]
---

# 開発意図ログ: follow-count フォロー数え方・配信開始リセット(0.2.0)

> 生成方針: `docs/development/test-asset-lifecycle-policy.md` §2.3

## 1. 人間入力の記録

| entry_id | 日時 | 入力(要旨) | 種別 | 読み取った意図 | 反映先 |
|---|---|---|---|---|---|
| DI-follow-count-001 | 2026-11-15 | 版は 0.2.0(minor)にする | 判断 | 仕組みの変更(リセット・移行)を含むため minor | `template/index.html` CONFIG.version、TC-OCC-064 |
| DI-follow-count-002 | 2026-11-15 | Playwright を入れてよい(この repo 初の package.json。zip には入れない) | 判断 | mock 試験を自動化する | `package.json`、`playwright.config.js`、`.gitignore` |
| DI-follow-count-003 | 2026-11-15 | 「配信開始で自動リセット」の ON/OFF 欄を足す。既定 ON | 判断 | 自動リセットを使う人が選べる | `#togAutoReset`、TC-OCC-042 |
| DI-follow-count-004 | 2026-11-15 | フォロワー総数は操作パネルにだけ出す | 判断 | OBS の表示エリアには出さない(0.1.0 の見た目を保つ) | `#followerTotal`、TC-OCC-047/048 |
| DI-follow-count-005 | 2026-11-15 | SDK の 10 秒ごとの再試行は仕様の既定案で実装 | 回答(devuser 未回答・既定案で実装) | 未回答のため既定案を採った。変更したければ後で言ってもらう | `loadSdk` / `sdkTimer`、TC-OCC-058〜061 |
| DI-follow-count-006 | 2026-11-15 | チャンネルポイント・連続視聴はコメント +1 とし、あいさつ判定も通す | 判断 | 通知もコメントとして数える | TC-OCC-013/014 |
| DI-follow-count-007 | 2026-11-15 | startTime が変わったら自動リセット。あいさつ済みの記録は配信単位 | 判断 | 日付ではなく配信で区切る | TC-OCC-031〜044、DRBFM 9〜15 |
| DI-follow-count-008 | 2026-11-15 | フォローは systemComment の通知から数える。フォロワー総数は表示専用。fStart/fNow と差分ボタンは削除 | 判断 | 差分方式をやめ、通知ベースに一本化 | TC-OCC-001〜004、049〜050 |

## 2. 意図から導いた指針(このチケットで)

| guideline_id | 指針(1文) | 由来 entry_id | 一般化できるか | 影響する試験観点 |
|---|---|---|---|---|
| DG-follow-count-001 | 外部から届く値(meta・保存値)は型と範囲を検証し、使えない値は無視する | 007, 008 | repo 全体 | TC-OCC-037/048/053 |
| DG-follow-count-002 | 配信の区切りは日付ではなく配信開始時刻(startTime)で判断する | 007 | この機能のみ | TC-OCC-031〜046 |

## 3. 試験の方向性への反映

- DRBFM に追加・修正した行: なし(既存 `20261115-follow-count-stream-reset.md` の行 1〜22 を使用)
- 新設した test_case_id: TC-OCC-001〜074(`test-cases/master/onecomme-counter.yaml`)。mock 065 件は自動、manual 066〜074 は実機待ち
- 試験観点台帳への追加: なし
- 反映できなかった入力と理由: なし

## 4. 設計者への問い合わせ(該当時)

| entry_id | 問い合わせ内容 | 回答 | 回答者 / 日時 | 反映先 docs |
|---|---|---|---|---|
| DI-follow-count-005 | SDK の 10 秒ごと再試行の可否 | 未回答(既定案で実装) | - | 本ログ |
