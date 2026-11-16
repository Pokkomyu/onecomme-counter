---
type: dev_intent_log
repo: onecomme-counter
ticket_id: poko-chatcount
status: draft
created: 2026-11-16
updated: 2026-11-16
owner: devuser
canonical_path: docs/development/dev-intent/poko-chatcount.md
tags: [dev-intent, human-input, onecomme-counter]
---

# 開発意図ログ: poko-chatcount 名前の変更・自動リセットの既定 OFF(0.2.1)

> 生成方針: docs/development/test-asset-lifecycle-policy.md §2.3

## 1. 人間入力の記録

| entry_id | 日時 | 入力(要旨) | 種別 | 読み取った意図 | 反映先 |
|---|---|---|---|---|---|
| DI-poko-chatcount-001 | 2026-11-16 | (配信者の要望)数を見て報告するときに自分でリセットしたい。DbD のクラッシュで OBS ごと落ちて再配信すると消えてしまう | 要望 | 0 に戻すタイミングは配信者が決める。配信の切れ目を道具が勝手に区切りにしない | DRBFM 行 1, 4, 5, 6 / TC-OCC-076, 077, 084, 094 |
| DI-poko-chatcount-002 | 2026-11-16 | 「配信が始まったら自動で 0 に戻す」の既定を OFF にする。保存済みの値があればそちらを使う | 判断 | はじめて使う人は手動リセットで始める。0.2.0 で使っていた人の設定は勝手に変えない(強制では変えない) | DRBFM 行 1, 2, 3 / `CONFIG.defaults.autoReset` / TC-OCC-075, 078〜081, 093 |
| DI-poko-chatcount-003 | 2026-11-16 | 名前を「Poko-ChatCount」にする。変えるのは表に出る名前だけ(zip 内のフォルダ名、zip 名、`<title>` と冒頭コメント、README、AGENTS.md、package.json の description、policy の repo 表記、Release の題) | 判断 | 利用者に見える名前をそろえる。作業の範囲は小さく保つ | DRBFM 行 9, 11〜14 / TC-OCC-086, 088, 090, 091 |
| DI-poko-chatcount-004 | 2026-11-16 | GitHub の repo 名 `onecomme-counter` と保存キー `onecomme-generic-counter-v1` は変えない | 判断 | 入れ替えても設定とカウントを引き継ぐ。リンクや clone 先を壊さない | DRBFM 行 10, 14 / TC-OCC-087, 089, 092 |
| DI-poko-chatcount-005 | 2026-11-16 | 版は patch の見立て。最終判断は設計レビュー役 | 委任 | 版の区分は方針(新しい道具・仕組み = minor、小さな調整・見た目・修正 = patch)に沿って決める | DRBFM §1(patch、0.2.1)/ TC-OCC-064, 089 |
| DI-poko-chatcount-006 | 2026-11-16 | 試験は削除・skip しない。既定の変更に合わせて前提を直すのはよい | 制約 | 0.2.0 で確かめた挙動の確認を弱めない | DRBFM 行 8 / 既存 TC-OCC-026, 031〜045 の前提 |

## 2. 意図から導いた指針

- 0 に戻すのは利用者の操作を基本にする。自動で戻す仕組みは残すが、選んだ人だけが使う。
- 利用者が保存した設定は、版を上げても勝手に変えない。変えてほしいときは案内で伝える。
- 名前を変えるときも、保存先と配布元(repo)は変えない。見える名前と中の識別子を分けて扱う。
- 既定を変えたら、README の説明と注意も同じ変更で直す。

## 3. 試験の方向性への反映

- 既定 OFF の挙動(保存なし・値なし・型違い)と、保存値が ON / OFF のときの挙動を分けて確かめる。
- ON のときのリセット判定は 0.2.0 の試験をそのまま使い、前提だけ「ON の保存値」に直す。
- OFF のとき、あいさつ済みが配信をまたいで残ることを試験で固定し、README にも書く。
- 保存キー・SDK の URL が変わっていないことを、値を直接書いた試験で確かめる。
- 名前と版の表記は、ファイルを読む試験で取りこぼしを見つける。
- わんコメの一覧名、旧フォルダからの引き継ぎ、クラッシュ後の再配信は実機で確かめる。
- 新設した test_case_id: TC-OCC-075〜094(`test-cases/master/onecomme-counter.yaml`)。mock 075〜089 は自動、manual 090〜094 は handoff 作成時と実機で確認
- 試験観点台帳への追加: なし
- 反映できなかった入力と理由: なし

## 4. 設計者への問い合わせ(該当時)

| entry_id | 問い合わせ内容 | 回答 | 回答者 / 日時 | 反映先 docs |
|---|---|---|---|---|
| DI-poko-chatcount-007 | 0.2.0 を使っていた配信者は ON のまま。入れ替えた後に 1 回チェックを外す案内でよいか | 未回答(案内を README と Release に書く案で進める) | - | DRBFM §4 行 2 |
| DI-poko-chatcount-008 | OFF の間、挨拶は「全リセットしてからはじめてコメントした人」になる。この見え方でよいか | 未回答(README に 1 文足す案で進める) | - | DRBFM §4 行 5 |
