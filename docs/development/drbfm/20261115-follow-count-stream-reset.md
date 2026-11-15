---
type: drbfm
repo: onecomme-counter
ticket_id: follow-count
change_title: フォロー計数の修正・配信開始での自動リセット・チャネポ/連続視聴の計数
version_tier: minor
status: draft
created: 2026-11-15
updated: 2026-11-15
owner: devuser
canonical_path: docs/development/drbfm/20261115-follow-count-stream-reset.md
tags: [drbfm, onecomme-counter]
---

# DRBFM: follow-count フォロー計数の修正・配信開始での自動リセット・チャネポ/連続視聴の計数

## 1. 変更概要

- 背景 / 目的: 0.1.0 を実配信で使ったところ、新規フォローが数えられない・チャンネルポイント交換と連続視聴の通知が数えられない・0 時をまたぐと「あいさつ済み」が消える、の 3 点が分かった。調査用ビルドの記録(2026-11-03 の配信)で、わんコメが渡すデータの形を確かめたうえで直す。
- バージョン区分と根拠: **minor(0.1.0 → 0.2.0)**。不具合修正だけでなく、数え方の仕様変更(チャネポ・連続視聴を +1、あいさつ済みを日付単位から配信単位へ)、機能追加(配信開始での自動リセット、フォロワー総数の表示、わんコメへの再接続)、設定欄の削除(フォロワー数の差分入力)、SDK の権限追加(meta)を含む。方針 §3 の「機能追加・仕様変更・互換を保つ変更」に当たる。保存データは移行して引き継ぐので major ではない。
- devuser が決めたこと(2026-11-15):
  1. チャンネルポイント交換と連続視聴の通知は、コメントとして +1 し、あいさつ判定にも含める。
  2. 配信開始で自動リセットする。わんコメが渡す配信の startTime が変わったら 0 に戻す。あいさつ済みは日付ではなく配信ごと。
  3. フォローは「〜さんにフォローされました」の systemComment で数える。meta の follower は総数の表示だけ。手入力欄(開始時・現在)と差分ボタンは削除。
- 変更内容: `template/index.html` の判定(handle)・状態と保存(freshState / load / save)・SDK 接続(startSdk / startDemo)・操作パネル、`README.md`、方針 docs の版表記、自動試験(`tests/`、repo 初)。
- 影響範囲候補: 画面(表示エリア・操作パネル)/ 外部 IF(わんコメ OneSDK の comments・systemComment・notification・connected・meta)/ 保存データ(localStorage `onecomme-generic-counter-v1`)。API・DB・帳票・権限はなし。
- 記録から分かった前提(見本 = 親から受け取った samples.json):
  - `item.id` はサービスの ID で全件同じ。1 件ごとの ID は `item.data.id`。
  - チャネポ交換と連続視聴は comments で届き、`data.meta.type` が `"system"`。本文に `<img>` `<small>` `<br />` が入る。
  - フォローとレイドは systemComment で届く(`data.id` が `tw-followed-…` / `tw.raid-…`)。わんコメ自身の通知(接続しました など)は `data.userId` が `onecomme.system`。
  - meta はサービスごとに別々に届く(YouTube と Twitch で startTime が 21 分違う。約 10 秒ごとに同じ値が再送される)。コールバックに渡る外側の形は未確認。

## 2. DRBFM 表

**S** = セキュリティの行。part はすべて `template/index.html`(行 24 は README・方針 docs を含む)。

| # | part | change_point | function | possible_risk | impact | detection | test_to_add | skip_reason | review_required | review_reason |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | external_if | フォローを systemComment の本文で数える。重複は data.id と本文(タグを除く)で除く | 新規フォロー 1 人につき +1 | 同じ通知の再送で二重に数える / フォロー解除→再フォローで増える / 別の人が同じ本文になり数え落とす / OFF 中の通知が重複記録に残り ON 後に数えない | フォロー数がずれる | 模擬 SDK+実機 | TC-OCC-001〜004, 011, 066 | | false | |
| 2 | external_if | systemComment のうちフォロー以外(レイド・わんコメ自身の通知)を数えない | フォロー以外を除く | レイドや「接続しました」をフォローやコメントに数える / わんコメ自身の通知の本文にキーワードが入り誤って数える | カウントが増えすぎる | 模擬 SDK | TC-OCC-005〜007 | | false | |
| 3 | screen | フォロー判定キーワードを「,」区切りで複数に(既定「フォロー,follow」) | 日本語・英語どちらの通知も拾う | 空欄や「,」だけで全件一致する / 大文字小文字で落とす / 入力を正規表現として解釈し例外や固まり(ReDoS)になる **S** | 全通知をフォロー扱い / 表示が止まる | 模擬 SDK | TC-OCC-008〜010 | | false | |
| 4 | external_if | 重複の判定を item.id ではなく data.id で行う | 同じ 1 件を 2 回数えない | item.id(全件同じ)で判定し 2 件目以降を全部捨てる / data.id が無い件を捨てる | コメントが 1 から増えない | 模擬 SDK | TC-OCC-002, 020, 021 | | false | |
| 5 | external_if | comments で届く `meta.type:"system"`(チャネポ交換・連続視聴)をコメントとして数え、あいさつ判定にも含める | チャネポ交換・連続視聴 1 回で コメント +1、条件に合えばあいさつ +1 | フォロー側と二重に数える / C 方式で本文のタグ名・属性(img, small, alt など)に挨拶ワードが当たる / B 方式の isFirstTime を見落とす | コメント・あいさつがずれる | 模擬 SDK+実機 | TC-OCC-012〜018, 067 | | false | |
| 6 | screen | 本文に HTML(`<img>` `<small>`)が入った入力を扱う。本文・名前・設定値を画面に出す箇所 | 受け取った文字列を文字として扱う | 本文や名前を innerHTML に入れてスクリプトが動く(XSS)/ 本文の img を描画して外部へ通信する / デバッグ表示や設定欄の値がタグとして解釈される **S** | 配信画面で任意のスクリプトが動く・視聴者の操作で外部通信が起きる | 模擬 SDK(`window.__xss`・通信記録・DOM)+コードレビュー | TC-OCC-027〜030, 048 | | false | |
| 7 | external_if | 配信者本人(`isOwner === true`)のコメントを数えない | 視聴者の分だけ数える | 本人の発言でコメント・あいさつが増える / isOwner が無いサービスで全員を除く | カウントが増えすぎる・0 のまま | 模擬 SDK | TC-OCC-019 | | false | |
| 8 | external_if | SDK の permissions に meta を足し、meta を購読する | 配信の開始時刻とフォロワー総数を受け取る | 権限不足で meta が来ない / 追加した権限で setup が失敗し全部止まる | 自動リセットが働かない・接続できない | 模擬 SDK(setup の引数) | TC-OCC-062 | | false | |
| 9 | external_if | meta の startTime が変わったらカウントと記録(重複 ID・あいさつ済み・フォロー済み)を 0 に戻す | 配信ごとに 0 から数える | 同じ startTime の再送(約 10 秒ごと・再接続)で配信中に 0 に戻る / 新しい配信で戻らない / 手動の全リセットの後にもう一度戻る | 配信中にカウントが消える(取り返せない)/ 前回の数が残る | 模擬 SDK+実機 | TC-OCC-026, 031, 032, 035, 068 | | false | |
| 10 | external_if | 複数の配信(YouTube と Twitch の同時接続)で startTime が 2 つある | 同時配信でも戻すのは最初の 1 回 | 2 つの startTime が交互に届くたびに戻り続ける / 後から始めた側の startTime で配信中に戻る / 次の配信で片方しか変わらず戻らない | 配信中にカウントが消える | 模擬 SDK(時間を進める)+実機 | TC-OCC-033〜035, 069 | | true | 同時配信の実機確認(TC-OCC-069)が要る。片方を 45 秒以上遅れて「接続」した場合の挙動も実機で見る |
| 11 | external_if | 配信前・配信後の meta(isLive:false)と再接続中の meta | 配信していない間の値で戻さない | 配信前に isLive:false で届いた古い startTime や仮の値で戻る / 切断→再接続で戻る | 配信前の準備中や回線の瞬断でカウントが消える | 模擬 SDK | TC-OCC-036, 045 | | false | |
| 12 | external_if | startTime が無い・数値でない・秒単位・未来の値 | おかしな値では何もしない | undefined / NaN を「変わった」と見て戻る / 文字列と数値の違いで「変わった」と見る / 例外で以後の処理が止まる **S**(外から来た値の検証) | カウントが消える・止まる | 模擬 SDK | TC-OCC-037, 038 | | false | |
| 13 | screen | ブラウザソースの読み込み直し(シーン切替・OBS 再起動)後の最初の meta | 配信中の読み込み直しではカウントを保つ | 読み込み直しの後、同時配信の「後から始めた側」の meta が先に届いて戻る / 読み込み直しの間に新しい配信が始まっていたのに戻らない | 配信中にカウントが消える / 前回の数が残る | 模擬 SDK(保存値を仕込んで読み込み)+実機 | TC-OCC-039〜041, 070 | | false | |
| 14 | screen | 設定に「配信開始で自動リセット」の ON/OFF を足す(既定 ON) | 自動リセットが合わない配信(枠の取り直しが多い等)で止められる | OFF なのに戻る / OFF→ON にした瞬間に戻る | カウントが消える | 模擬 SDK | TC-OCC-042 | | true | 欄を足すこと自体が devuser 未確認(設計側の安全弁) |
| 15 | screen | あいさつ済みの記録を日付単位(day / seenToday)から配信単位(greeted)に変える | 1 回の配信で 1 人 1 回 | 0 時をまたぐと同じ人をもう一度数える / 新しい配信でも「済み」が残り数えない | あいさつ数がずれる | 模擬 SDK(時計を進める)+実機 | TC-OCC-043, 044, 074 | | false | |
| 16 | external_if | meta コールバックに渡る値の外側の形(`{service, data}` / data そのまま / 配列) | どの形でも startTime と follower を取り出す | 想定と違う形で startTime が取れず、自動リセットが一度も働かない / 例外 | 自動リセットが働かない(手動リセットは使える) | 模擬 SDK+実機(TC-OCC-068) | TC-OCC-046 | | true | 外側の形は記録で確かめられていない。実機で 1 回確認する |
| 17 | screen | meta の follower(総数)を操作パネルに表示する | 総数を見せるだけ。カウントには使わない | 総数の増減でフォローのカウントが動く / YouTube の meta(follower 無し)で表示が消える / 数値でない値をそのまま出す **S** | フォロー数がずれる・表示が崩れる | 模擬 SDK | TC-OCC-047, 048 | | true | 表示する場所(操作パネルだけ)が devuser 未確認 |
| 18 | screen | 「フォロワー数の差分入力」(開始時・現在・差分ボタン)を削除 | 手入力に頼らない | 消した要素を参照するコードが残り、起動時に例外で全部止まる | 何も数えない | 模擬 SDK(DOM と console) | TC-OCC-049 | | false | |
| 19 | db_table | 保存データの移行(0.1.0 → schema 2): followKeyword「フォロー」→「フォロー,follow」、fStart / fNow / day / seenToday を捨てる | 設定とカウントを引き継ぐ | 利用者が変えたキーワードを上書きする / 移行が毎回走り、あとで「フォロー」に戻した値をまた書き換える / 旧キーが残り続ける / 見出し・倍率・色が既定に戻る | 設定が消える・勝手に変わる | 模擬 SDK(保存値を仕込む)+実機 | TC-OCC-050〜052, 054, 072 | | false | |
| 20 | db_table | 保存データを読むときの検証・件数の上限・保存の失敗 | 壊れた値・大きすぎる値でも動く | 型の違う値で例外になり起動しない / 色の値に CSS を混ぜられ外部へ通信する / `__proto__` などで既定値を汚す / あいさつ済み・フォロー済みが増え続け保存できなくなる / 保存の例外で数える処理が止まる **S** | 起動しない・外部通信・長時間配信で止まる | 模擬 SDK | TC-OCC-053, 056, 057 | | false | |
| 21 | db_table | 調査用ビルドが残した記録(`onecomme-generic-counter-v1-probe`)を起動時に消す | 視聴者名入りの記録を残さない | 調査用の記録(視聴者の名前・本文)が OBS の保存領域に残り続ける / 本体のキーまで消す **S** | 個人の情報が残る / 設定が消える | 模擬 SDK | TC-OCC-055 | | false | |
| 22 | screen | わんコメにつながらないときのデモ表示と、つながるまでの再試行 | わんコメなしで見た目を確かめられる。後からわんコメを起動してもつながる | OBS を先に起動するとデモのまま戻らない / 再試行で SDK を二重に読み、1 件を 2 回数える / デモのフォロー文言が新しい判定に合わず増えない / デモで増やした数が本番のカウントに残る | 配信で何も数えない・2 倍に数える | 模擬 SDK(404・遅延)+実機 | TC-OCC-058〜061, 071 | | true | 再試行を今回入れることが devuser 未確認(設計側の追加) |
| 23 | external_if | 外部への通信先(SDK の URL・フォント) | 決まった相手とだけ通信する | SDK の URL を URL パラメータや保存値で差し替えられ、任意のスクリプトを読む / 新しい通信先が増える **S** | 配信画面で任意のスクリプトが動く | 模擬 SDK(通信記録)+コードレビュー | TC-OCC-063 | | false | |
| 24 | screen | 版の表記(操作パネル・README・方針 docs) | 入っている版が分かる | zip 名や説明が 0.1.0 のまま / 削除した欄の説明が README に残る | 利用者が古い手順で迷う | 模擬 SDK+目視 | TC-OCC-064 | README・docs は目視 | false | |
| 回帰 | screen | 既存機能(あいさつ A〜C・倍率・ON/OFF・手動補正・全リセット・テーマ・表示幅) | 0.1.0 と同じに動く | handle と保存の書き換えで既存の動きが変わる | 表示・合計がずれる | 模擬 SDK+実機 | TC-OCC-012, 018, 022〜026, 065, 073 | | false | |

## 3. 追加する試験項目(全通り)

見本の書き方: `N.<名前>` = `tests/fixtures/samples.json` の `notable_samples.<名前>.item`、`normal` = `normal_comment` の item、`M.twitch[i]` / `M.youtube[i]` = `meta_samples.<service>[i].data`(元は親から受け取った samples.json。fixture は実装指示書 §8.2 の置換をかけたもの)。「改」は見本の一部の値だけを書き換えた入力。mock はすべて模擬 SDK から該当 action で流す(`N.follow` `N.raid` `N["onecomme_system:…"]` は systemComment、それ以外は comments)。時刻は Playwright の `page.clock` で進める。「3 つとも」= あいさつ・フォロー・コメントのカウント。

| ID | 種別 | DRBFM | 入力 | 期待 |
|---|---|---|---|---|
| TC-OCC-001 | mock | 1 | `N.follow` を systemComment で 1 回 | フォロー 1、コメント 0、あいさつ 0 |
| TC-OCC-002 | mock | 1,4 | `N.follow` を同じ data.id で 2 回 | フォロー 1 のまま |
| TC-OCC-003 | mock | 1 | `N.follow` 改(data.id だけ別、本文同じ=再フォロー) | フォロー 1 のまま |
| TC-OCC-004 | mock | 1 | `N.follow` と、改(本文の名前・userId・data.id が別)を 1 回ずつ | フォロー 2 |
| TC-OCC-005 | mock | 2 | `N.raid` を systemComment で | 3 つとも 0 のまま |
| TC-OCC-006 | mock | 2 | `N["onecomme_system:接続しました"]`「切断されました」「再接続中」「終了」「<strong>」の 5 件 | 3 つとも 0 のまま。例外なし |
| TC-OCC-007 | mock | 2 | `N["onecomme_system:接続しました"]` 改(本文を「フォローを確認しました」に) | フォロー 0(userId `onecomme.system` は除外) |
| TC-OCC-008 | mock | 3 | followKeyword=`フォロー,follow`。`N.follow` 改(本文 `userA Followed you`、data.id 別) | フォロー +1(大文字小文字を区別しない) |
| TC-OCC-009 | mock | 3 | followKeyword を空、` , ,` にして `N.follow` | どちらもフォロー 0。例外なし |
| TC-OCC-010 | mock | 3 | followKeyword=`.*`(括弧入りの本文)、`(`(括弧なしの本文)にして `N.follow` | どちらもフォロー 0。例外なし(文字どおりの部分一致で、正規表現として解釈しない) |
| TC-OCC-011 | mock | 1 | フォローを OFF にして `N.follow` → ON に戻し `N.follow` 改(data.id 別・本文同じ) | OFF 中は 0。ON 後は +1(OFF 中は重複記録に入れない) |
| TC-OCC-012 | mock | 5 | `normal` を 1 回、同じ userId で data.id 別を 1 回(A 方式) | コメント 2、あいさつ 1 |
| TC-OCC-013 | mock | 5 | `N.channel_point` を comments で(A 方式) | コメント 1、あいさつ 1、フォロー 0 |
| TC-OCC-014 | mock | 5 | `N.watch_streak` を comments で(A 方式) | コメント 1、あいさつ 1、フォロー 0 |
| TC-OCC-015 | mock | 5 | B 方式。`N.channel_point`(isFirstTime true)と `N.watch_streak`(false) | コメント 2、あいさつ 1 |
| TC-OCC-016 | mock | 5,6 | C 方式。挨拶ワード=`img,gift-image,small,alt`。`N.channel_point` と `N.watch_streak` | コメント 2、あいさつ 0(タグ・属性の文字では当たらない) |
| TC-OCC-017 | mock | 5 | C 方式。挨拶ワード=`KONPOKO`。`N.watch_streak`(fixture の利用者コメント部分は `konpoko ganbare`) | あいさつ 1(タグを除いた本文・大文字小文字を区別しない) |
| TC-OCC-018 | mock | 5 | C 方式。挨拶ワード=`こんばんは`。`normal` 改(本文「こんばんは！」)→ 同じ人の 2 件目も「こんばんは」 | あいさつ 1、コメント 2 |
| TC-OCC-019 | mock | 7 | `normal` 改(isOwner true)。A 方式 | 3 つとも 0。その後 isOwner false で同じ userId が来たらあいさつ +1 |
| TC-OCC-020 | mock | 4 | `normal` 改 2 件(data.id を消す。item.id は同じ、userId は別) | コメント 2(item.id では重複除外しない) |
| TC-OCC-021 | mock | 4 | `normal` を同じ data.id で 2 回 | コメント 1 |
| TC-OCC-022 | mock | 回帰 | あいさつ OFF で `normal` → ON にして同じ人の 2 件目(A 方式) | OFF 中はコメントだけ +1。ON 後の 2 件目であいさつ +1 |
| TC-OCC-023 | mock | 回帰 | コメント OFF で `normal` | コメント 0、あいさつ 1。表示エリアと合計にコメントが出ない |
| TC-OCC-024 | mock | 回帰 | 倍率 あいさつ 10 / フォロー 100 / コメント 1。`normal` 3 人分+`N.follow` | 合計 = 3×10 + 1×100 + 3×1 = 133。フォロー OFF で 33 |
| TC-OCC-025 | mock | 回帰 | 手動補正 +1 を 2 回、−1 を 3 回 | 0 で止まる。負にならない |
| TC-OCC-026 | mock | 回帰,9 | 数えた後に「全リセット」→ 同じ startTime の meta → `normal`(同じ人) | カウント 0、設定は残る。meta で再リセットされない。同じ人であいさつ +1 |
| TC-OCC-027 | mock | 6 | `normal` 改: comment と name に `<img src=x onerror="window.__xss=1">` `<script>window.__xss=1</script>` | `window.__xss` が未定義。表示エリア・操作パネルに img / script 要素が増えない |
| TC-OCC-028 | mock | 6 | `N.channel_point`(本文に jtvnw.net の img) | `static-cdn.jtvnw.net` への通信が 0 件 |
| TC-OCC-029 | mock | 6 | デバッグ表示 ON で TC-OCC-027 の入力と `N["onecomme_system:<strong>"]` | `#debugOut` の子要素が 0(文字として出る)。`window.__xss` 未定義 |
| TC-OCC-030 | mock | 6 | 見出し・単位・挨拶ワード・フォロー判定キーワードの各欄に `<img src=x onerror="window.__xss=1">` | 文字として表示。`window.__xss` 未定義。再読み込み後も同じ |
| TC-OCC-031 | mock | 9 | 保存済みカウントあり・配信の記録なし。`M.twitch[0]` | 3 つとも 0。あいさつ済み・フォロー済みの記録も空 |
| TC-OCC-032 | mock | 9 | TC-OCC-031 の後に数え、`M.twitch[1]` `M.twitch[2]`(同じ startTime) | カウントはそのまま |
| TC-OCC-033 | mock | 10 | `M.twitch[0]` → `normal` → 0.5 秒後に `M.youtube[0]` | コメント 1 のまま(2 回目のリセットなし)。配信の記録に 2 つ |
| TC-OCC-034 | mock | 10 | `M.twitch[0]` を 10 秒ごとに流しつつ数え、21 分後に `M.youtube[0]` | カウントはそのまま |
| TC-OCC-035 | mock | 9,10 | TC-OCC-033 の後 1 時間 meta なし → `M.twitch[0]` 改(startTime 別)→ `normal` → `M.youtube[0]` 改(startTime 別) | Twitch の meta で 0 に戻る。YouTube の meta では戻らない(コメント 1 のまま) |
| TC-OCC-036 | mock | 11 | 配信の記録あり。`M.twitch[0]` 改(isLive false、startTime 別)→ 同じ startTime で isLive true | isLive false では戻らず記録にも入らない。true で 0 に戻る |
| TC-OCC-037 | mock | 12 | `M.twitch[0]` 改: startTime を 消す / null / `"abc"` / 0 / −1 / 1794066966(秒)/ 現在+2 日 / 1.5e12+0.5 / `{}` | どれもリセットなし・記録なし・例外なし |
| TC-OCC-038 | mock | 12 | `M.twitch[0]` → 数える → 改(startTime を文字列 `"1794066966000"`) | リセットなし(同じ配信として扱う) |
| TC-OCC-039 | mock | 13 | 配信の記録 [T]・カウントありで読み込み直し → `M.twitch[0]`(T) | カウントはそのまま |
| TC-OCC-040 | mock | 13 | 配信の記録 [T]・カウントありで読み込み直し → 5 秒後 `M.youtube[0]`(未知)→ 6 秒後 `M.twitch[0]`(T)→ 30 秒進める | リセットなし。記録は [T, Y] |
| TC-OCC-041 | mock | 13 | 配信の記録 [古い T]・カウントありで読み込み直し → 5 秒後 `M.twitch[0]`(未知)→ 読み込みから 20 秒まで進める | 20 秒の時点で 0 に戻る。記録は [新しい T] だけ |
| TC-OCC-042 | mock | 14 | 自動リセット OFF。カウントあり → `M.twitch[0]` 改(startTime 別)→ ON に戻す → 同じ meta | OFF 中も ON 後もカウントはそのまま(記録だけ進む) |
| TC-OCC-043 | mock | 15 | 23:59 に `normal`(A 方式)→ 時計を翌 00:01 に → 同じ人の 2 件目。meta は同じ startTime | あいさつ 1 のまま |
| TC-OCC-044 | mock | 15 | TC-OCC-043 の後、1 時間後に startTime 別の meta → 同じ人のコメント | あいさつ 1(新しい配信で数え直す) |
| TC-OCC-045 | mock | 11 | `M.twitch[0]` 改(isReconnecting true、startTime 同じ)。connected に false → true | リセットなし。表示は「未接続」→「接続OK」 |
| TC-OCC-046 | mock | 16 | meta を 3 通りで渡す: `{service:"twitch", data:M.twitch[0]}` / `M.twitch[0]` そのまま / その配列 | どれも同じ startTime として扱い、例外なし |
| TC-OCC-047 | mock | 17 | `M.twitch[0]`(follower 4043)→ `M.youtube[0]` → `M.twitch[0]` 改(follower 4044) | 操作パネルの総数が 4,043 → そのまま → 4,044。フォローのカウントは 0 のまま |
| TC-OCC-048 | mock | 17,6 | `M.twitch[0]` 改: follower を `"<b>1</b>"` / −1 / NaN / 1e400 / `"12"` | `"12"` だけ 12 と出る。他は表示が変わらない。要素が増えない |
| TC-OCC-049 | mock | 18 | 読み込み直後の DOM と console | `#inFStart` `#inFNow` `#btnDiff` が無い。console の error が 0 件 |
| TC-OCC-050 | mock | 19 | 0.1.0 の保存値(followKeyword「フォロー」、fStart 100、fNow 120、day、seenToday、followed、カウント・見出し・単位・倍率・色・方式・ON/OFF を既定以外に) | followKeyword が「フォロー,follow」。設定とカウントは同じ値。保存し直した JSON に fStart / fNow / day / seenToday が無く schema が 2 |
| TC-OCC-051 | mock | 19 | 0.1.0 の保存値で followKeyword「フォローされました」 | そのまま残る |
| TC-OCC-052 | mock | 19 | schema 2 の保存値で followKeyword「フォロー」 | そのまま残る(移行は 1 回だけ) |
| TC-OCC-053 | mock | 20 | 壊れた保存値を 1 つずつ: JSON でない文字列 / `null` / 配列 / counts が文字列・負・小数・1e400 / mult が負 / greetMode `Z` / colors.bg=`red;background:url(//example.invalid/x)` / title 1 万文字 / seenIds が文字列 / live.starts が文字列や負数 / enabled が文字列 / `__proto__` を含む | 例外なく起動。範囲外は既定値か上限に丸める。`example.invalid` への通信 0 件 |
| TC-OCC-054 | mock | 19 | 旧形式 `showComment:false`(enabled なし) | コメントが OFF |
| TC-OCC-055 | mock | 21 | `onecomme-generic-counter-v1-probe` に値を入れて読み込み | そのキーが消える。本体のキーは残る |
| TC-OCC-056 | mock | 20 | `localStorage.setItem` が例外を投げる状態で `normal` を 3 件 | コメント 3 と表示。例外が外に出ない |
| TC-OCC-057 | mock | 20 | data.id と userId が別のコメントを 5,001 件、フォローを 5,001 件(本文別) | 保存値の seenIds / greeted / followed がそれぞれ 5,000 件以下 |
| TC-OCC-058 | mock | 22 | SDK の URL が 404 | 3 秒以内に「デモモード」とデモボタンが出る |
| TC-OCC-059 | mock | 22 | デモモードで 4 つのボタンを 1 回ずつ(A 方式) | 挨拶・初コメ・通常でコメント 3、フォロー通知でフォロー 1。フォロー通知を 2 回目に押すと 2 |
| TC-OCC-060 | mock | 22 | SDK が最初 404、15 秒後から読める | 次の再試行で「接続OK」、デモボタンが消える。`normal` 1 件でコメント +1(+2 にならない) |
| TC-OCC-061 | mock | 22 | SDK の応答が 5 秒かかる | いったんデモ → 読めた時点で接続。subscribe は各 action 1 回。`normal` 1 件で +1 |
| TC-OCC-062 | mock | 8 | 模擬 SDK が受けた setup の引数 | mode が `diff`。permissions が comments / systemComment / notification / connected / meta |
| TC-OCC-063 | mock | 23 | `?sdkUrl=https://example.invalid/x.js` を付けて開き、通信を記録 | 通信先は `fonts.googleapis.com` `fonts.gstatic.com` と `localhost:11180` の SDK だけ |
| TC-OCC-064 | mock | 24 | 操作パネルの版表示 | 「v0.2.0」と出る |
| TC-OCC-065 | mock | 回帰 | テーマ・枠・背景透明・見出し・単位・倍率を変えて読み込み直し(meta なし) | 設定もカウントも残る |
| TC-OCC-066 | manual | 1 | わんコメ+OBS に 0.2.0 の zip を入れ、別アカウントで Twitch をフォロー | フォロー +1、コメントは増えない。フォロー解除 → 再フォローでは増えない |
| TC-OCC-067 | manual | 5 | 実配信でチャンネルポイント交換(文字入力なし・あり)と連続視聴の通知 | 1 回につきコメント +1(+2 にならない)。その人が配信で初めてならあいさつも +1 |
| TC-OCC-068 | manual | 9 | 前回のカウントが残った状態で Twitch だけ配信開始 | 開始後に 0 に戻り、以後は戻らない |
| TC-OCC-069 | manual | 10 | YouTube と Twitch を同時配信(片方を数分遅らせて開始) | 0 に戻るのは最初の 1 回だけ |
| TC-OCC-070 | manual | 13 | 配信中にシーンを切り替えてブラウザソースを読み込み直す / OBS を再起動 | カウントが残る |
| TC-OCC-071 | manual | 22 | OBS を先に起動 → 後からわんコメを起動 | 10 秒ほどで「接続OK」になり、コメントを数える |
| TC-OCC-072 | manual | 19 | 0.1.0 を使っていた環境に 0.2.0 を上書き | 見出し・単位・倍率・色・方式が残る。差分入力欄が無い |
| TC-OCC-073 | manual | 回帰 | OBS で幅 1920・高さ 1080、右をクロップ | 表示エリア(幅 850px)の見た目が 0.1.0 と同じ。操作パネルが映らない |
| TC-OCC-074 | manual | 15 | 0 時をまたぐ配信で、0 時前にあいさつ済みの人が 0 時後にコメント | あいさつが増えない |

→ test-case master(`docs/development/test-cases/master/onecomme-counter.yaml`)へ反映する。mock は `tests/` の自動試験、manual は手順書として登録する。

## 4. 要確認(review_required)

| 行 | review_reason | blocking_release | note |
|---|---|---|---|
| 10 | 同時配信の実機確認が要る | false | 自動リセットを OFF にできるので公開は止めない。TC-OCC-069 を次の同時配信で確認 |
| 14 | 「配信開始で自動リセット」ON/OFF 欄を足すか(devuser 確認) | true | 既定は「足す・既定 ON」で指示書を書いた |
| 16 | meta の外側の形が未確認 | false | 3 通りを受ける実装にした。TC-OCC-068 で実機確認 |
| 17 | フォロワー総数を出す場所(devuser 確認) | true | 既定は「操作パネルだけ(配信に映らない側)」 |
| 22 | わんコメへの再試行を今回入れるか(devuser 確認) | true | 既定は「入れる(10 秒ごと)」 |
| — | 自動試験に Playwright を入れるか(devuser 確認) | true | repo 初の package.json。配布 zip には入れない |

## 5. メモ

- 省略した試験と理由:
  - YouTube のフォロー相当(チャンネル登録)の通知: 記録に見本が無い。キーワード欄で対応できる形にとどめ、見本が取れたら項目を足す。
  - 3 つ以上の配信の同時接続: 記録の上限(8 件)と同じ規則で扱うので、2 つの場合(TC-OCC-033〜035)で代表させる。
  - notification で届くイベント: 記録に 1 件も無い。0.1.0 と同じく購読しない(権限の宣言だけ残す)ので、試験は立てない。
- 残リスク:
  - Twitch だけの配信で、配信が落ちて 45 秒より後に再開すると startTime が変わり 0 に戻る(わんコメからは「新しい配信」と区別できない)。README に書く。自動リセットを OFF にすれば避けられる。
  - 0.1.0 から上書きした直後の最初の配信開始の meta で 1 回 0 に戻る(配信の記録が無いため)。配信中に上書きしないよう README に書く。
  - フォロー通知が comments でも届くサービスがあれば、コメントにも +1 される。TC-OCC-066 で Twitch は確認する。
  - 同じ本文になる別人のフォロー(表示名と ID が同じ)は 1 回の配信で 1 回しか数えない。実害は小さい。
  - YouTube の startTime が配信中に変わるかは見本 3 件(同じ値)でしか確かめていない。TC-OCC-069 で確認する。
