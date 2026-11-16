# ドキュメント索引

`onecomme-counter` の docs/ 索引。docs を追加・移動・改名・削除したら、この索引も同時に更新する。

## Development(開発)

- [AI開発フロー](development/ai-workflow.md) — 三層オーケストレーション(設計レビュー役 / 段取り役 / 構築役)の役割分担とこの repo の固有値。正本は templete-project

## Testing / QA(試験資産ライフサイクル)

- [試験資産ライフサイクル方針](development/test-asset-lifecycle-policy.md) — バージョン区分(patch/minor/major)別の必須試験、開発中テストの資産化、DRBFM→全通り試験、開発意図ログ(人間入力の証跡)、メジャー前棚卸(蒸留→再構成)→フルテスト、設計者問い合わせ。手順・テンプレートは `brantechs/SQA`
- [dev-intent/](development/dev-intent/README.md) — 開発意図ログ(チケット単位)
- [test-inventory/](development/test-inventory/README.md) — 試験観点台帳・棚卸報告
- [drbfm/](development/drbfm/20261115-follow-count-stream-reset.md) — DRBFM(チケット単位。follow-count: フォローの数え方と配信開始リセット)
- [drbfm/](development/drbfm/20261116-poko-chatcount-rename-autoreset-off.md) — DRBFM(poko-chatcount: 名前の変更と自動リセットの既定 OFF)
- [test-cases/master/](development/test-cases/master/onecomme-counter.yaml) — test-case master(TC-OCC-001〜094。mock 80 件・manual 14 件)
- [evidence/](development/evidence/follow-count/evidence-index.md) — 証跡(チケット単位。follow-count の mock 試験結果・実機待ちの記録)
- [evidence/](development/evidence/poko-chatcount/evidence-index.md) — 証跡(poko-chatcount の mock 試験結果・実機待ちの記録)
