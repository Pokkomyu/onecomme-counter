// onecomme-counter 0.2.1 自動試験（mock）TC-OCC-001..065, 075..089, 095..100
// 実行: npm test   （模擬 SDK は page.route で差し込む。index.html に試験用のフックは無い）
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { SDK_BODY } = require("./helpers/mock-sdk");
const FX = require("./fixtures/samples.json");

const INDEX = path.resolve(__dirname, "../template/index.html");
const HTML = fs.readFileSync(INDEX, "utf8");
const SDK_URL = HTML.match(/sdkUrl:\s*"([^"]+)"/)[1];
const KEY = HTML.match(/storageKey:\s*"([^"]+)"/)[1];
const PROBE = KEY + "-probe";

const T_TW = 1794066966000;           // fixture の Twitch startTime
const T_YT = 1794068226000;           // fixture の YouTube startTime
const T0 = T_TW + 3600000;            // 時計の初期値（Twitch 開始の 1 時間後）
const HOUR = 3600000;

const cl = o => JSON.parse(JSON.stringify(o));
const S = k => cl(FX.notable_samples[k].item);
const normal = () => cl(FX.normal_comment.item);
const M = { twitch: FX.meta_samples.twitch.map(x => cl(x.data)), youtube: FX.meta_samples.youtube.map(x => cl(x.data)) };
const mt = (i, over) => Object.assign(cl(M.twitch[i || 0]), over || {});
const my = (i, over) => Object.assign(cl(M.youtube[i || 0]), over || {});
// 通常コメントを別人・別 data.id で作る
function cm(i, over, dataOver) {
  const it = normal();
  it.data.id = "tw-cm-" + i; it.data.userId = "tw-3000000" + String(i).padStart(2, "0");
  it.data.name = "テスト" + i; it.data.comment = "テストコメント" + i;
  Object.assign(it, over || {}); Object.assign(it.data, dataOver || {});
  return it;
}
const withId = (it, id) => { const c = cl(it); c.data.id = id; return c; };
const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>`;

function tc(id, name, fn) {
  test(id + " " + name, async ({ page }) => {
    const ctx = makeCtx(page);
    await fn(ctx, page);
    expect(ctx.errs, "pageerror / console error").toEqual([]);
  });
}

function makeCtx(page) {
  const ctx = { errs: [], reqs: [], sdk: "ok", sdkDelay: 0, opts: {} };
  page.on("pageerror", e => ctx.errs.push("pageerror: " + e.message));
  page.on("console", m => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return;   // 404 / 遮断した通信のブラウザ通知（ページの例外ではない）
    ctx.errs.push("console: " + m.text());
  });
  // OBS のブラウザソースは JS のダイアログを出せないので、出たら失敗にする（0.2.0 の全リセット不具合を隠していた）
  page.on("dialog", d => { ctx.errs.push("dialog: " + d.type() + " " + d.message()); d.dismiss().catch(() => {}); });
  page.on("request", r => { if (!r.url().startsWith("file:")) ctx.reqs.push(r.url()); });

  ctx.ready = async () => {
    if (ctx.opts.wait === false) return;
    if (ctx.sdk === "ok") await page.waitForFunction(() => window.__sdkCalls && window.__sdkCalls.subscribe.meta >= 1);
    else await page.waitForFunction(() => document.querySelector("#status").className === "demo");
  };
  ctx.pause = async () => {
    for (let gap = 50; ; gap *= 4) {      // 評価〜停止の間に時計が進んで失敗することがあるため、余裕を広げて再試行
      const now = await page.evaluate(() => Date.now());
      try { await page.clock.pauseAt(now + gap); return; } catch (e) { if (gap > 5000) throw e; }
    }
  };
  ctx.adv = ms => page.clock.runFor(ms);
  ctx.boot = async (o = {}) => {
    ctx.opts = o;
    ctx.sdk = o.sdk === undefined ? "ok" : o.sdk;
    await page.clock.install({ time: T0 });
    const seed = o.seed !== undefined ? JSON.stringify(o.seed) : o.seedRaw;
    const extra = o.extra || {};
    await page.addInitScript(([key, seedStr, extraObj, code]) => {
      try {
        if (!sessionStorage.getItem("__seeded")) {      // 読み込み直しでは仕込み直さない
          sessionStorage.setItem("__seeded", "1");
          if (seedStr !== undefined && seedStr !== null) localStorage.setItem(key, seedStr);
          Object.keys(extraObj).forEach(k => localStorage.setItem(k, extraObj[k]));
        }
      } catch (e) {}
      if (code) (0, eval)(code);
    }, [KEY, seed === undefined ? null : seed, extra, o.init || ""]);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.route(u => /example\.invalid/.test(u.href) && u.protocol !== "file:", r => r.abort());
    await page.route("http://localhost:11180/**", r => r.abort());   // 本物のわんコメへは出さない
    await page.route(SDK_URL, async r => {
      if (ctx.sdk === "down") return r.fulfill({ status: 404, body: "not found" });
      if (typeof ctx.sdk === "number") await new Promise(res => setTimeout(res, ctx.sdk));
      return r.fulfill({ status: 200, contentType: "application/javascript", body: SDK_BODY });
    });
    await page.goto("file://" + INDEX + (o.query || ""), { waitUntil: "domcontentloaded" });
    await ctx.settle();
  };
  ctx.settle = async () => {
    const o = ctx.opts;
    await ctx.ready();
    if (o.wait === false) return;
    await ctx.pause();
    const adv = o.adv === undefined ? 21000 : o.adv;
    if (adv) await ctx.adv(adv);
  };
  ctx.reload = async () => {
    await page.clock.resume();
    await page.reload({ waitUntil: "domcontentloaded" });
    await ctx.settle();
  };
  ctx.emit = (action, payload) => page.evaluate(([a, p]) => window.__emit(a, p), [action, payload]);
  ctx.com = (...items) => ctx.emit("comments", items);
  ctx.sys = (...items) => ctx.emit("systemComment", items);
  ctx.meta = (data, service) => ctx.emit("meta", { service: service || "twitch", data });
  ctx.counts = () => page.evaluate(() => {
    const g = id => parseInt(document.querySelector(id).textContent.replace(/,/g, ""), 10);
    return { greet: g("#cnt_greet"), follow: g("#cnt_follow"), comment: g("#cnt_comment") };
  });
  ctx.store = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  ctx.text = sel => page.locator(sel).first().textContent();
  ctx.fill = (sel, v) => page.fill(sel, v);
  ctx.click = sel => page.click(sel);
  ctx.setRaw = v => page.evaluate(([k, x]) => localStorage.setItem(k, x), [KEY, v]);
  ctx.sdkCalls = () => page.evaluate(() => window.__sdkCalls);
  ctx.active = sel => page.locator(sel).first().evaluate(e => e.className);
  return ctx;
}
const C = (greet, follow, comment) => ({ greet, follow, comment });
const goodSeed = (counts, extra) => Object.assign({ schema: 2, counts, seenIds: [], greeted: [], followed: [], live: { starts: [] } }, extra || {});
// 自動リセット ON の保存値(0.2.0 の既定と同じ状態)。既定は 0.2.1 から OFF
const onSeed = (counts, extra) => goodSeed(counts || C(0, 0, 0), Object.assign({ autoReset: true }, extra || {}));

/* ======================= フォロー(1〜11) ======================= */
tc("TC-OCC-001", "フォロー通知を systemComment で 1 回", async ctx => {
  await ctx.boot();
  await ctx.sys(S("follow"));
  expect(await ctx.counts()).toEqual(C(0, 1, 0));
});
tc("TC-OCC-002", "同じ data.id のフォロー通知 2 回", async ctx => {
  await ctx.boot();
  await ctx.sys(S("follow")); await ctx.sys(S("follow"));
  expect((await ctx.counts()).follow).toBe(1);
});
tc("TC-OCC-003", "data.id だけ別の再フォロー", async ctx => {
  await ctx.boot();
  await ctx.sys(S("follow"));
  await ctx.sys(withId(S("follow"), "tw-followed-100000001-1794076999999"));
  expect((await ctx.counts()).follow).toBe(1);
});
tc("TC-OCC-004", "別の人のフォロー通知", async ctx => {
  await ctx.boot();
  const b = S("follow");
  b.data.id = "tw-followed-100000009-1794076599999"; b.data.userId = "tw-100000009";
  b.data.comment = "テストB(@testuser_b)さんにフォローされました";
  await ctx.sys(S("follow")); await ctx.sys(b);
  expect((await ctx.counts()).follow).toBe(2);
});
tc("TC-OCC-005", "レイド通知は数えない", async ctx => {
  await ctx.boot();
  await ctx.sys(S("raid"));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
});
tc("TC-OCC-006", "わんコメのシステム通知 5 件", async ctx => {
  await ctx.boot();
  for (const k of ["接続しました", "切断されました", "再接続中", "終了", "<strong>"]) await ctx.sys(S("onecomme_system:" + k));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
});
tc("TC-OCC-007", "onecomme.system はフォローに数えない", async ctx => {
  await ctx.boot();
  const it = S("onecomme_system:接続しました"); it.data.comment = "フォローを確認しました";
  await ctx.sys(it);
  expect((await ctx.counts()).follow).toBe(0);
});
tc("TC-OCC-008", "キーワードは大文字小文字を区別しない", async ctx => {
  await ctx.boot();
  const it = S("follow"); it.data.id = "tw-followed-100000008-1"; it.data.comment = "userA Followed you";
  await ctx.sys(it);
  expect((await ctx.counts()).follow).toBe(1);
});
tc("TC-OCC-009", "キーワードが空・区切りだけ", async ctx => {
  await ctx.boot();
  await ctx.fill("#inFollowKw", "");
  await ctx.sys(S("follow"));
  await ctx.fill("#inFollowKw", " , ,");
  const b = withId(S("follow"), "tw-followed-100000001-2"); b.data.comment = "テストA2さんにフォローされました";
  await ctx.sys(b);
  expect((await ctx.counts()).follow).toBe(0);
});
tc("TC-OCC-010", "キーワードを正規表現として解釈しない", async ctx => {
  await ctx.boot();
  await ctx.fill("#inFollowKw", ".*");
  await ctx.sys(S("follow"));
  await ctx.fill("#inFollowKw", "(");
  const p = withId(S("follow"), "tw-followed-100000001-3"); p.data.comment = "テストCさんにフォローされました";   // 本文に括弧を含まない
  await ctx.sys(p);
  expect((await ctx.counts()).follow).toBe(0);
});
tc("TC-OCC-011", "フォロー OFF 中は重複記録に入れない", async (ctx, page) => {
  await ctx.boot();
  await page.click('[data-tog="follow"]');
  await ctx.sys(S("follow"));
  expect((await ctx.counts()).follow).toBe(0);
  await page.click('[data-tog="follow"]');
  await ctx.sys(withId(S("follow"), "tw-followed-100000001-4"));
  expect((await ctx.counts()).follow).toBe(1);
});

/* ======================= あいさつ・コメント(12〜30) ======================= */
const mode = (page, m) => page.click(`[data-mode="${m}"]`);
tc("TC-OCC-012", "通常コメント(A 方式): 同じ人の 2 件目", async ctx => {
  await ctx.boot();
  await ctx.com(normal()); await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-013", "チャネポ(A 方式)", async ctx => {
  await ctx.boot();
  await ctx.com(S("channel_point"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});
tc("TC-OCC-014", "連続視聴(A 方式)", async ctx => {
  await ctx.boot();
  await ctx.com(S("watch_streak"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});
tc("TC-OCC-015", "B 方式: isFirstTime だけ", async (ctx, page) => {
  await ctx.boot(); await mode(page, "B");
  await ctx.com(S("channel_point")); await ctx.com(S("watch_streak"));
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-016", "C 方式: タグ・属性の文字では当たらない", async (ctx, page) => {
  await ctx.boot(); await mode(page, "C");
  await ctx.fill("#inGreetWords", "img,gift-image,small,alt");
  await ctx.com(S("channel_point")); await ctx.com(S("watch_streak"));
  expect(await ctx.counts()).toEqual(C(0, 0, 2));
});
tc("TC-OCC-017", "C 方式: タグを除いた本文・大文字小文字無視", async (ctx, page) => {
  await ctx.boot(); await mode(page, "C");
  await ctx.fill("#inGreetWords", "KONPOKO");
  await ctx.com(S("watch_streak"));
  expect((await ctx.counts()).greet).toBe(1);
});
tc("TC-OCC-018", "C 方式: 同じ人の 2 件目はあいさつ判定しない", async (ctx, page) => {
  await ctx.boot(); await mode(page, "C");
  await ctx.fill("#inGreetWords", "こんばんは");
  const a = normal(); a.data.comment = "こんばんは！";
  const b = withId(normal(), "tw-c-2"); b.data.comment = "こんばんは";
  await ctx.com(a); await ctx.com(b);
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-019", "配信者本人は数えない", async ctx => {
  await ctx.boot();
  const o = normal(); o.data.isOwner = true;
  await ctx.com(o);
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});
tc("TC-OCC-020", "data.id なしは item.id で重複除外しない", async ctx => {
  await ctx.boot();
  const a = cm(1), b = cm(2);
  delete a.data.id; delete b.data.id; a.id = b.id = "same-service-id";
  await ctx.com(a); await ctx.com(b);
  expect((await ctx.counts()).comment).toBe(2);
});
tc("TC-OCC-021", "同じ data.id は 1 回", async ctx => {
  await ctx.boot();
  await ctx.com(normal()); await ctx.com(normal());
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-022", "あいさつ OFF 中は記録せず、ON 後の 2 件目で数える", async (ctx, page) => {
  await ctx.boot();
  await page.click('[data-tog="greet"]');
  await ctx.com(normal());
  expect(await ctx.counts()).toEqual(C(0, 0, 1));
  await page.click('[data-tog="greet"]');
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-023", "コメント OFF", async (ctx, page) => {
  await ctx.boot();
  await page.click('[data-tog="comment"]');
  await ctx.com(normal());
  expect(await ctx.counts()).toEqual(C(1, 0, 0));
  expect(await ctx.text("#vRows")).not.toContain("コメント");
  expect(await ctx.text("#vTotal")).toBe("10");
});
tc("TC-OCC-024", "合計 = 倍率の和", async (ctx, page) => {
  await ctx.boot();
  await ctx.fill('[data-mult="greet"]', "10"); await ctx.fill('[data-mult="follow"]', "100"); await ctx.fill('[data-mult="comment"]', "1");
  await ctx.com(cm(1), cm(2), cm(3)); await ctx.sys(S("follow"));
  expect(await ctx.text("#vTotal")).toBe("133");
  await page.click('[data-tog="follow"]');
  expect(await ctx.text("#vTotal")).toBe("33");
});
tc("TC-OCC-025", "手動補正は 0 で止まる", async (ctx, page) => {
  await ctx.boot();
  for (let i = 0; i < 2; i++) await page.click('[data-adj="greet"][data-v="1"]');
  expect((await ctx.counts()).greet).toBe(2);
  for (let i = 0; i < 3; i++) await page.click('[data-adj="greet"][data-v="-1"]');
  expect((await ctx.counts()).greet).toBe(0);
});
tc("TC-OCC-026", "全リセットは設定を残し、記録(live.starts)は変えない", async (ctx, page) => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(mt(0));
  await ctx.fill("#inTitle", "保持確認");
  await ctx.com(normal()); await ctx.sys(S("follow"));
  await page.click("#btnReset"); await page.click("#btnResetYes");
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  expect((await ctx.store()).title).toBe("保持確認");
  await ctx.meta(mt(0));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
  expect((await ctx.store()).live.starts).toEqual([T_TW]);
});
const noXss = async (page) => {
  expect(await page.evaluate(() => typeof window.__xss)).toBe("undefined");
  expect(await page.locator("#view img, #view script, #ctrl img, #ctrl script").count()).toBe(0);
};
tc("TC-OCC-027", "コメントの HTML を実行しない", async (ctx, page) => {
  await ctx.boot();
  const it = normal(); it.data.comment = XSS; it.data.name = XSS;
  await ctx.com(it);
  await noXss(page);
});
tc("TC-OCC-028", "チャネポの img で外部通信しない", async ctx => {
  await ctx.boot();
  await ctx.com(S("channel_point"));
  expect(ctx.reqs.filter(u => u.includes("static-cdn.jtvnw.net")).length).toBe(0);
});
tc("TC-OCC-029", "デバッグ表示は文字として出す", async (ctx, page) => {
  await ctx.boot();
  await page.click("#btnDebug");
  const it = normal(); it.data.comment = XSS; it.data.meta = { type: "system" };
  await ctx.com(it); await ctx.sys(S("onecomme_system:<strong>"));
  expect(await page.locator("#debugOut > *").count()).toBe(0);
  expect(await ctx.text("#debugOut")).toContain("<strong>");
  await noXss(page);
});
tc("TC-OCC-030", "設定欄の HTML は文字として表示・再読込後も", async (ctx, page) => {
  await ctx.boot();
  const IMG = `<img src=x onerror="window.__xss=1">`;
  for (const id of ["#inTitle", "#inUnit", "#inGreetWords", "#inFollowKw"]) await ctx.fill(id, IMG);
  expect(await ctx.text("#vTitle")).toBe(IMG);
  expect(await ctx.text("#vUnit")).toBe(IMG);
  await noXss(page);
  await ctx.reload();
  // 読み込み時の長さ上限: 見出し 60 / 単位 20 / 欄 200 文字。上限内の文字は同じ
  expect(await ctx.text("#vTitle")).toBe(IMG);
  expect(await ctx.text("#vUnit")).toBe(IMG.slice(0, 20));
  expect(await page.inputValue("#inGreetWords")).toBe(IMG);
  expect(await page.inputValue("#inFollowKw")).toBe(IMG);
  await noXss(page);
});

/* ======================= 配信開始リセット(31〜48) ======================= */
const seededCounts = () => goodSeed(C(4, 3, 7), { autoReset: true, greeted: ["old-user"], followed: ["old-follow"], seenIds: ["old-id"] });
tc("TC-OCC-031", "記録なし + 最初の meta でリセット", async ctx => {
  await ctx.boot({ seed: seededCounts() });
  expect((await ctx.counts())).toEqual(C(4, 3, 7));
  await ctx.meta(M.twitch[0]);
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  const st = await ctx.store();
  expect(st.greeted).toEqual([]); expect(st.followed).toEqual([]);
});
tc("TC-OCC-032", "同じ startTime の meta ではリセットしない", async ctx => {
  await ctx.boot({ seed: seededCounts() });
  await ctx.meta(M.twitch[0]);
  await ctx.com(normal()); await ctx.sys(S("follow"));
  await ctx.meta(M.twitch[1]); await ctx.meta(M.twitch[2]);
  expect(await ctx.counts()).toEqual(C(1, 1, 1));
});
tc("TC-OCC-033", "同時配信の相方 meta で 2 回目のリセットなし", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.adv(500);
  await ctx.meta(M.youtube[0], "youtube");
  expect((await ctx.counts()).comment).toBe(1);
  expect((await ctx.store()).live.starts).toEqual([T_TW, T_YT]);
});
tc("TC-OCC-034", "meta が届き続ける間は 21 分後の相方でもリセットしない", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  for (let i = 0; i < 126; i++) { await ctx.adv(10000); await ctx.meta(M.twitch[0]); }
  await ctx.meta(M.youtube[0], "youtube");
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-035", "1 時間後の新配信は Twitch の meta で戻り、相方では戻らない", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.adv(500); await ctx.meta(M.youtube[0], "youtube");
  await ctx.adv(HOUR);
  await ctx.meta(mt(0, { startTime: T_TW + 2 * HOUR }));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  await ctx.com(normal());
  await ctx.meta(my(0, { startTime: T_YT + 2 * HOUR }), "youtube");
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-036", "isLive false は記録せず、true で戻る", async ctx => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7), { live: { starts: [T_TW] } }) });
  const T2 = T_TW + HOUR;
  await ctx.meta(mt(0, { isLive: false, startTime: T2 }));
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  expect((await ctx.store()).live.starts).toEqual([T_TW]);
  await ctx.meta(mt(0, { isLive: true, startTime: T2 }));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  expect((await ctx.store()).live.starts).toEqual([T2]);
});
tc("TC-OCC-037", "使えない startTime は無視", async (ctx, page) => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7)) });
  const bad = [undefined, null, "abc", 0, -1, 1794066966, T0 + 2.5 * 24 * HOUR, 1.5e12 + 0.5, {}];
  for (const v of bad) {
    const m = mt(0);
    if (v === undefined) delete m.startTime; else m.startTime = v;
    await ctx.meta(m);
    expect(await ctx.counts(), String(v)).toEqual(C(4, 3, 7));
    expect((await ctx.store()).live.starts, String(v)).toEqual([]);
  }
});
tc("TC-OCC-038", "文字列の startTime は同じ配信として扱う", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.meta(mt(0, { startTime: String(T_TW) }));
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-039", "読み込み直し(猶予の中)で記録済みの startTime", async ctx => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7), { live: { starts: [T_TW] } }), adv: 0 });
  await ctx.meta(M.twitch[0]);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
});
tc("TC-OCC-040", "猶予の中で未知 → 既知の順なら相方として記録", async ctx => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7), { live: { starts: [T_TW] } }), adv: 0 });
  await ctx.adv(5000); await ctx.meta(M.youtube[0], "youtube");
  await ctx.adv(1000); await ctx.meta(M.twitch[0]);
  await ctx.adv(30000);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  expect((await ctx.store()).live.starts).toEqual([T_TW, T_YT]);
});
tc("TC-OCC-041", "猶予の中で未知だけなら 20 秒の時点で戻る", async ctx => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7), { live: { starts: [T_TW - 5 * HOUR] } }), adv: 0 });
  await ctx.adv(5000); await ctx.meta(M.twitch[0]);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  await ctx.adv(16000);
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  expect((await ctx.store()).live.starts).toEqual([T_TW]);
});
tc("TC-OCC-042", "自動リセット OFF の間はリセットせず記録だけ進む", async (ctx, page) => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7)) });
  await page.uncheck("#togAutoReset");
  const m = mt(0, { startTime: T_TW + HOUR });
  await ctx.meta(m);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  expect((await ctx.store()).live.starts).toEqual([T_TW + HOUR]);
  await page.check("#togAutoReset");
  await ctx.meta(m);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
});
tc("TC-OCC-043", "日付をまたいでもあいさつは配信単位", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.adv(120000);
  await ctx.meta(M.twitch[0]); await ctx.com(withId(normal(), "tw-c-2"));
  expect((await ctx.counts()).greet).toBe(1);
});
tc("TC-OCC-044", "新しい配信ではあいさつを数え直す", async ctx => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.adv(120000); await ctx.com(withId(normal(), "tw-c-2"));
  await ctx.adv(HOUR);
  await ctx.meta(mt(0, { startTime: T_TW + 2 * HOUR }));
  await ctx.com(withId(normal(), "tw-c-3"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});
tc("TC-OCC-045", "再接続中の meta ではリセットしない", async (ctx, page) => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(M.twitch[0]); await ctx.com(normal());
  await ctx.meta(mt(0, { isReconnecting: true }));
  await ctx.emit("connected", false);
  expect(await ctx.text("#status")).toContain("未接続");
  await ctx.emit("connected", true);
  expect(await ctx.text("#status")).toContain("接続OK");
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-046", "meta の 3 通りの形", async ctx => {
  await ctx.boot();
  await ctx.emit("meta", { service: "twitch", data: mt(0) });
  await ctx.adv(1000); await ctx.emit("meta", mt(0, { startTime: T_TW + 1000 }));
  await ctx.adv(1000); await ctx.emit("meta", [mt(0, { startTime: T_TW + 2000 })]);
  expect((await ctx.store()).live.starts).toEqual([T_TW, T_TW + 1000, T_TW + 2000]);
});
tc("TC-OCC-047", "フォロワー総数は操作パネルにだけ出る", async ctx => {
  await ctx.boot();
  await ctx.meta(M.twitch[0]);
  expect(await ctx.text("#followerTotal")).toBe("4,043");
  await ctx.meta(M.youtube[0], "youtube");
  expect(await ctx.text("#followerTotal")).toBe("4,043");
  await ctx.meta(mt(0, { follower: 4044 }));
  expect(await ctx.text("#followerTotal")).toBe("4,044");
  expect((await ctx.counts()).follow).toBe(0);
});
tc("TC-OCC-048", "不正な follower は表示を変えない", async (ctx, page) => {
  await ctx.boot();
  await ctx.meta(M.twitch[0]);
  for (const v of ["<b>1</b>", -1, NaN, Infinity]) {
    await ctx.meta(mt(0, { follower: v }));
    expect(await ctx.text("#followerTotal"), String(v)).toBe("4,043");
  }
  await ctx.meta(mt(0, { follower: "12" }));
  expect(await ctx.text("#followerTotal")).toBe("12");
  expect(await page.locator("#followerTotal *").count()).toBe(0);
});

/* ======================= 保存・移行(49〜57) ======================= */
tc("TC-OCC-049", "差分入力欄は無い", async (ctx, page) => {
  await ctx.boot();
  expect(await page.locator("#inFStart, #inFNow, #btnDiff").count()).toBe(0);
});
const OLD = () => ({
  counts: { greet: 5, follow: 3, comment: 7 }, mult: { greet: 3, follow: 4, comment: 2 },
  title: "移行見出し", unit: "回", greetMode: "C", greetWords: "a,b", followKeyword: "フォロー",
  fStart: 100, fNow: 120, day: "2026-11-10", seenToday: ["x"], followed: ["y"], seenIds: ["s1"],
  enabled: { greet: false, follow: true, comment: false },
  colors: { bg: "#112233", card: "#223344", accent: "#334455", accentSub: "#445566", text: "#556677", sub: "#667788" },
  transparentBg: true, frame: true
});
tc("TC-OCC-050", "0.1.0 の保存値の移行", async (ctx, page) => {
  await ctx.boot({ seed: OLD() });
  expect(await page.inputValue("#inFollowKw")).toBe("フォロー,follow");
  expect(await ctx.counts()).toEqual(C(5, 3, 7));
  await page.uncheck("#togAutoReset"); await page.check("#togAutoReset");   // 保存させる
  const st = await ctx.store(), o = OLD();
  for (const k of ["fStart", "fNow", "day", "seenToday"]) expect(st, k).not.toHaveProperty(k);
  expect(st.schema).toBe(2);
  for (const k of ["counts", "mult", "title", "unit", "greetMode", "greetWords", "enabled", "colors", "transparentBg", "frame"]) expect(st[k], k).toEqual(o[k]);
  expect(st.followKeyword).toBe("フォロー,follow");
});
tc("TC-OCC-051", "0.1.0 の独自キーワードはそのまま", async (ctx, page) => {
  await ctx.boot({ seed: Object.assign(OLD(), { followKeyword: "フォローされました" }) });
  expect(await page.inputValue("#inFollowKw")).toBe("フォローされました");
});
tc("TC-OCC-052", "schema 2 では移行しない", async (ctx, page) => {
  await ctx.boot({ seed: goodSeed(C(0, 0, 0), { followKeyword: "フォロー" }) });
  expect(await page.inputValue("#inFollowKw")).toBe("フォロー");
});
tc("TC-OCC-053", "壊れた保存値でも起動する", async (ctx, page) => {
  await ctx.boot();
  const big = "あ".repeat(10000);
  const V = [
    ["not json", "not json {"], ["null", "null"], ["array", "[]"],
    ["counts string", `{"counts":{"greet":"5","follow":"x","comment":"1"}}`],
    ["counts negative", `{"counts":{"greet":-5,"follow":-1,"comment":-9}}`],
    ["counts float", `{"counts":{"greet":1.5,"follow":2.7,"comment":0.2}}`],
    ["counts 1e400", `{"counts":{"greet":1e400,"follow":1e400,"comment":1e400}}`],
    ["mult negative", `{"mult":{"greet":-1,"follow":-5,"comment":-2}}`],
    ["greetMode Z", `{"greetMode":"Z"}`],
    ["colors css injection", `{"colors":{"bg":"red;background:url(//example.invalid/x)","card":"url(//example.invalid/y)"}}`],
    ["title 10000", JSON.stringify({ title: big, unit: big, greetWords: big })],
    ["seenIds string", `{"seenIds":"abc","greeted":"x","followed":5,"schema":2}`],
    ["live.starts bad", `{"live":{"starts":"abc"}}`], ["live.starts negative", `{"live":{"starts":[-1,-5,0,1.5]}}`],
    ["enabled strings", `{"enabled":{"greet":"false","follow":0,"comment":"no"}}`],
    ["__proto__", `{"__proto__":{"polluted":1},"counts":{"__proto__":{"greet":5}},"mult":{"__proto__":{"greet":9}}}`]
  ];
  for (const [name, raw] of V) {
    await ctx.setRaw(raw);
    await ctx.reload();
    const c = await ctx.counts();
    for (const k of Object.keys(c)) { expect(Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 999999999, name + " counts " + k).toBe(true); }
    expect(await page.evaluate(() => ({}).polluted), name).toBeUndefined();
    if (name === "counts string" || name === "counts negative" || name === "counts 1e400" || name === "__proto__") expect(c, name).toEqual(C(0, 0, 0));
    if (name === "counts float") expect(c, name).toEqual(C(1, 2, 0));
    if (name === "mult negative" || name === "__proto__") for (const [k, v] of [["greet", "10"], ["follow", "10"], ["comment", "0"]]) expect(await page.inputValue(`[data-mult="${k}"]`), name).toBe(v);
    if (name === "greetMode Z") expect(await ctx.active('[data-mode="A"]'), name).toContain("on");
    if (name === "title 10000") { expect((await ctx.text("#vTitle")).length).toBeLessThanOrEqual(60); expect((await ctx.text("#vUnit")).length).toBeLessThanOrEqual(20); }
    if (name === "enabled strings") for (const k of ["greet", "follow", "comment"]) expect(await ctx.active(`[data-tog="${k}"]`), name).toContain("on");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg")), name).not.toContain("example.invalid");
    expect(ctx.errs, name).toEqual([]);
  }
  expect(ctx.reqs.filter(u => u.includes("example.invalid")).length).toBe(0);
});
tc("TC-OCC-054", "旧形式 showComment:false", async (ctx, page) => {
  await ctx.boot({ seed: { counts: { greet: 0, follow: 0, comment: 0 }, showComment: false } });
  expect(await ctx.active('[data-tog="comment"]')).not.toContain("on");
  expect(await ctx.text('[data-tog="comment"]')).toContain("OFF");
});
tc("TC-OCC-055", "古い probe キーを消す", async (ctx, page) => {
  await ctx.boot({ seed: goodSeed(C(1, 2, 3)), extra: { [PROBE]: "x" } });
  expect(await page.evaluate(k => localStorage.getItem(k), PROBE)).toBeNull();
  expect(await page.evaluate(k => localStorage.getItem(k), KEY)).not.toBeNull();
});
tc("TC-OCC-056", "保存できなくても数え続ける", async (ctx, page) => {
  await ctx.boot({ init: `Storage.prototype.setItem = function () { throw new Error("quota"); };` });
  await ctx.com(cm(1), cm(2), cm(3));
  expect((await ctx.counts()).comment).toBe(3);
  expect(await ctx.text("#vRows")).toContain("3");
});
tc("TC-OCC-057", "記録は上限 5000 件", async (ctx, page) => {
  test.setTimeout(300000);
  await ctx.boot();
  for (let b = 0; b < 5001; b += 500) {
    await page.evaluate(([lo, hi]) => {
      for (let i = lo; i < hi; i++) window.__emit("comments", [{ data: { id: "c" + i, userId: "u" + i, name: "n", comment: "x" } }]);
      for (let i = lo; i < hi; i++) window.__emit("systemComment", [{ data: { id: "f" + i, userId: "tw-" + i, name: "s", comment: "ユーザー" + i + "さんにフォローされました" } }]);
    }, [b, Math.min(b + 500, 5001)]);
  }
  const st = await ctx.store();
  for (const k of ["seenIds", "greeted", "followed"]) expect(st[k].length, k).toBeLessThanOrEqual(5000);
  expect(await ctx.counts()).toEqual(C(5001, 5001, 5001));
});

/* ======================= 接続(58〜64) ======================= */
tc("TC-OCC-058", "SDK が読めないとデモモード", async (ctx, page) => {
  await ctx.boot({ sdk: "down", adv: 0 });
  expect(await ctx.text("#status")).toContain("デモモード");
  expect(await page.isVisible("#demoBox")).toBe(true);
});
tc("TC-OCC-059", "デモボタン", async (ctx, page) => {
  await ctx.boot({ sdk: "down", adv: 0 });
  for (const k of ["greet", "first", "normal", "follow"]) await page.click(`[data-demo="${k}"]`);
  let c = await ctx.counts();
  expect(c.comment).toBe(3); expect(c.follow).toBe(1);
  await page.click('[data-demo="follow"]');
  expect((await ctx.counts()).follow).toBe(2);
});
const sdkReady = page => expect.poll(() => page.evaluate(() => !!(window.__sdkCalls && window.__sdkCalls.subscribe.meta)), { timeout: 15000 }).toBe(true);
tc("TC-OCC-060", "後から SDK が読めたら再試行で接続", async (ctx, page) => {
  await ctx.boot({ sdk: "down", adv: 0 });
  await ctx.adv(15000);                     // 10 秒の再試行は失敗
  expect(await ctx.text("#status")).toContain("デモモード");
  ctx.sdk = "ok";
  await ctx.adv(5500);                      // 20 秒の再試行
  await sdkReady(page);
  expect(await ctx.text("#status")).toContain("接続OK");
  expect(await page.isVisible("#demoBox")).toBe(false);
  await ctx.com(normal());
  expect((await ctx.counts()).comment).toBe(1);
  await ctx.adv(30000);                     // 以後は再試行しない
  const calls = await ctx.sdkCalls();
  expect(calls.subscribe.comments).toBe(1);
});
tc("TC-OCC-061", "SDK の応答が遅くても二重購読しない", async (ctx, page) => {
  await ctx.boot({ sdk: 5000, wait: false, manual: true });
  await page.waitForFunction(() => document.querySelector("#status").className === "demo", null, { timeout: 15000 });
  await sdkReady(page);
  await ctx.pause();
  expect(await ctx.text("#status")).toContain("接続OK");
  expect(await page.isVisible("#demoBox")).toBe(false);
  const calls = await ctx.sdkCalls();
  for (const a of ["comments", "systemComment", "connected", "meta"]) expect(calls.subscribe[a], a).toBe(1);
  await ctx.com(normal());
  expect((await ctx.counts()).comment).toBe(1);
});
tc("TC-OCC-062", "setup の引数", async ctx => {
  await ctx.boot();
  const c = await ctx.sdkCalls();
  expect(c.setup.length).toBe(1);
  expect(c.setup[0].mode).toBe("diff");
  expect(c.setup[0].permissions).toEqual(["comments", "systemComment", "notification", "connected", "meta"]);
});
tc("TC-OCC-063", "通信先は決まった所だけ", async ctx => {
  await ctx.boot({ query: "?sdkUrl=https://example.invalid/x.js" });
  const hosts = new Set(ctx.reqs.map(u => new URL(u).host));
  const allowed = new Set(["fonts.googleapis.com", "fonts.gstatic.com", "localhost:11180"]);
  for (const h of hosts) expect(allowed.has(h), h).toBe(true);
  expect(ctx.reqs.filter(u => u.includes("example.invalid")).length).toBe(0);
});
tc("TC-OCC-064", "版表示", async ctx => {
  await ctx.boot();
  expect(await ctx.text("#ver")).toBe("v0.2.1");
});
tc("TC-OCC-065", "設定とカウントは読み込み直しで残る", async (ctx, page) => {
  await ctx.boot();
  await page.click('[data-theme]:nth-of-type(2)');
  await page.click("#btnFrame"); await page.click("#btnTransp");
  await ctx.fill("#inTitle", "見出し65"); await ctx.fill("#inUnit", "個");
  await ctx.fill('[data-mult="greet"]', "7");
  await ctx.com(normal());
  const before = await ctx.store();
  const ui = () => page.evaluate(() => [document.querySelector("#vTitle").textContent, document.querySelector("#vUnit").textContent, document.querySelector("#vTotal").textContent, document.querySelector("#btnFrame").textContent, document.querySelector("#btnTransp").textContent].join("|"));
  const u1 = await ui();
  await ctx.reload();
  expect(await ctx.store()).toEqual(before);
  expect(await ui()).toBe(u1);
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});

/* ======================= 既定 OFF と名前(75〜89) ======================= */
tc("TC-OCC-075", "既定は自動リセット OFF で、切り替えが保存される", async (ctx, page) => {
  await ctx.boot();
  expect(await page.isChecked("#togAutoReset")).toBe(false);
  await page.check("#togAutoReset"); await page.uncheck("#togAutoReset");
  expect((await ctx.store()).autoReset).toBe(false);
});
tc("TC-OCC-076", "既定 OFF では最初の meta でも戻らず、記録だけ進む", async ctx => {
  await ctx.boot({ seed: goodSeed(C(4, 3, 7), { greeted: ["old-user"], followed: ["old-follow"], seenIds: ["old-id"] }) });
  await ctx.meta(M.twitch[0]);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  const st = await ctx.store();
  expect(st.greeted).toEqual(["old-user"]); expect(st.followed).toEqual(["old-follow"]);
  expect(st.live.starts).toEqual([T_TW]);
});
tc("TC-OCC-077", "既定 OFF では猶予の 20 秒を過ぎても戻らない", async ctx => {
  await ctx.boot({ seed: goodSeed(C(4, 3, 7), { live: { starts: [T_TW - 5 * HOUR] } }), adv: 0 });
  await ctx.adv(5000); await ctx.meta(M.twitch[0]);
  await ctx.adv(16000);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
  expect((await ctx.store()).live.starts).toEqual([T_TW]);
});
tc("TC-OCC-078", "ON の保存値は ON のまま開き、meta で戻る", async (ctx, page) => {
  await ctx.boot({ seed: onSeed(C(4, 3, 7)) });
  expect(await page.isChecked("#togAutoReset")).toBe(true);
  await ctx.meta(M.twitch[0]);
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
});
tc("TC-OCC-079", "autoReset:false の保存値は OFF のまま", async (ctx, page) => {
  await ctx.boot({ seed: goodSeed(C(4, 3, 7), { autoReset: false }) });
  await ctx.meta(M.twitch[0]);
  expect(await page.isChecked("#togAutoReset")).toBe(false);
  expect(await ctx.counts()).toEqual(C(4, 3, 7));
});
tc("TC-OCC-080", "autoReset が真偽値でない保存値は OFF になる", async (ctx, page) => {
  for (const v of ["true", 1, null, {}]) {
    await ctx.boot({ seed: goodSeed(C(4, 3, 7), { autoReset: v }) });
    await ctx.meta(M.twitch[0]);
    expect(await page.isChecked("#togAutoReset"), JSON.stringify(v)).toBe(false);
    expect(await ctx.counts(), JSON.stringify(v)).toEqual(C(4, 3, 7));
    expect(ctx.errs).toEqual([]);
    await page.close();
    page = await page.context().newPage();
    ctx = makeCtx(page);
  }
});
tc("TC-OCC-081", "0.1.0 の保存値からの移行でも OFF", async (ctx, page) => {
  await ctx.boot({ seed: OLD() });
  await ctx.meta(M.twitch[0]);
  expect(await page.isChecked("#togAutoReset")).toBe(false);
  expect(await ctx.counts()).toEqual(C(5, 3, 7));
});
tc("TC-OCC-082", "途中で ON にすると次の配信から戻る", async (ctx, page) => {
  await ctx.boot();
  await ctx.meta(mt(0)); await ctx.com(normal());
  await page.check("#togAutoReset");
  await ctx.meta(mt(0));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
  await ctx.adv(HOUR);
  await ctx.meta(mt(0, { startTime: T_TW + HOUR }));
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
});
tc("TC-OCC-083", "自動リセットの切り替えは読み込み直しで残る", async (ctx, page) => {
  await ctx.boot();
  await page.check("#togAutoReset");
  await ctx.reload();
  expect(await page.isChecked("#togAutoReset")).toBe(true);
  await page.uncheck("#togAutoReset");
  await ctx.reload();
  expect(await page.isChecked("#togAutoReset")).toBe(false);
});
tc("TC-OCC-084", "既定 OFF でも全リセットの後は 0 から数え直す", async (ctx, page) => {
  await ctx.boot();
  await ctx.meta(mt(0)); await ctx.com(normal());
  await page.click("#btnReset"); await page.click("#btnResetYes");
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
});
tc("TC-OCC-085", "既定 OFF では次の配信になってもあいさつは 1 回", async ctx => {
  await ctx.boot();
  await ctx.meta(mt(0)); await ctx.com(normal());
  await ctx.adv(HOUR);
  await ctx.meta(mt(0, { startTime: T_TW + HOUR }));
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-086", "名前は Poko-ChatCount で、旧名は残っていない", async (ctx, page) => {
  await ctx.boot();
  expect(await page.title()).toContain("Poko-ChatCount");
  expect(HTML).not.toContain("汎用カウンター");
  expect(HTML).not.toContain("色々カウンター");
});
tc("TC-OCC-087", "保存キー・SDK の場所・旧キー・schema は変わらない", async () => {
  expect(HTML).toContain('storageKey: "onecomme-generic-counter-v1"');
  expect(HTML).toContain('sdkUrl: "http://localhost:11180/templates/preset/__origin/js/onesdk.js"');
  expect(HTML).toContain('legacyKeys: ["onecomme-generic-counter-v1-probe"]');
  expect(HTML).toContain("schema: 2");
});
const ROOT = path.resolve(__dirname, "..");
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const VER = HTML.match(/version:\s*"([^"]+)"/)[1];
tc("TC-OCC-088", "README・AGENTS・package・方針の名前と zip 名", async () => {
  const readme = rd("README.md");
  expect(readme).toContain("Poko-ChatCount");
  expect(readme).toContain("`Poko-ChatCount-" + VER + ".zip`");
  expect(readme).not.toContain("配信が始まると自動で 0 に戻ります");
  expect(readme).not.toContain("onecomme-counter-0");
  for (const f of ["AGENTS.md", "package.json", "docs/development/test-asset-lifecycle-policy.md"]) {
    const t = rd(f);
    expect(t, f).not.toContain("色々カウンター");
    expect(t, f).toContain("Poko-ChatCount");
  }
});
tc("TC-OCC-089", "package の名前と版が index.html と合っている", async () => {
  const pk = JSON.parse(rd("package.json")), lk = JSON.parse(rd("package-lock.json"));
  expect(pk.name).toBe("onecomme-counter-tests");
  expect(pk.version).toBe(VER);
  expect(lk.version).toBe(VER);
  expect(lk.packages[""].version).toBe(VER);
});

/* ======================= 全リセットの確認欄・テーマの選択表示(95〜100) ======================= */
const shown = (page, sel) => page.locator(sel).isVisible();
const onThemes = page => page.evaluate(() => [...document.querySelectorAll("[data-theme].on")].map(b => b.dataset.theme));
tc("TC-OCC-095", "全リセットを押すと確認欄が出て、まだ数は変わらない", async (ctx, page) => {
  await ctx.boot();
  expect(await shown(page, "#resetConfirm")).toBe(false);
  await ctx.com(normal()); await ctx.sys(S("follow"));
  await page.click("#btnReset");
  expect(await shown(page, "#resetConfirm")).toBe(true);
  expect(await ctx.text("#resetConfirm")).toContain("本当に 0 に戻しますか?");
  expect(await ctx.counts()).toEqual(C(1, 1, 1));
});
tc("TC-OCC-096", "確認欄で「やめる」を押すと何も変わらない", async (ctx, page) => {
  await ctx.boot();
  await ctx.com(normal());
  await page.click("#btnReset"); await page.click("#btnResetNo");
  expect(await shown(page, "#resetConfirm")).toBe(false);
  expect(await ctx.counts()).toEqual(C(1, 0, 1));
  await ctx.com(withId(normal(), "tw-c-2"));
  expect(await ctx.counts()).toEqual(C(1, 0, 2));
});
tc("TC-OCC-097", "確認欄で「0 に戻す」を押すと 0 に戻り設定は残る", async (ctx, page) => {
  await ctx.boot({ seed: onSeed() });
  await ctx.meta(mt(0));
  await ctx.fill("#inTitle", "保持確認97");
  await ctx.com(normal()); await ctx.sys(S("follow"));
  const starts = (await ctx.store()).live.starts;
  expect(starts.length).toBeGreaterThan(0);
  await page.click("#btnReset"); await page.click("#btnResetYes");
  expect(await shown(page, "#resetConfirm")).toBe(false);
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  const st = await ctx.store();
  expect(st.title).toBe("保持確認97");
  expect(st.live.starts).toEqual(starts);
  await ctx.reload();
  expect(await ctx.counts()).toEqual(C(0, 0, 0));
  expect(await shown(page, "#resetConfirm")).toBe(false);
});
tc("TC-OCC-098", "画面が confirm・alert・prompt を使っていない", async () => {
  expect(HTML).not.toMatch(/\b(confirm|alert|prompt)\s*\(/);
});
tc("TC-OCC-099", "押したテーマのボタンだけ色が付き、開き直しても残る", async (ctx, page) => {
  await ctx.boot();
  expect(await onThemes(page)).toEqual(["ピンク"]);
  const names = await page.evaluate(() => [...document.querySelectorAll("[data-theme]")].map(b => b.dataset.theme));
  expect(names.length).toBeGreaterThan(1);
  for (const n of names) {
    await page.click(`[data-theme="${n}"]`);
    expect(await onThemes(page), n).toEqual([n]);
  }
  await page.click('[data-theme="宇宙猫"]'); await page.click('[data-theme="ブルー"]');
  await ctx.reload();
  expect(await onThemes(page)).toEqual(["ブルー"]);
});
tc("TC-OCC-100", "どのテーマとも一致しない色ならどれにも付かず、選択色はピンク", async (ctx, page) => {
  await ctx.boot({ seed: goodSeed(C(0, 0, 0), { colors: { bg: "#123456" } }) });
  expect(await onThemes(page)).toEqual([]);
  await page.click('[data-theme="ミント"]');
  const bg = sel => page.locator(sel).first().evaluate(e => getComputedStyle(e).backgroundColor);
  expect(await bg('[data-theme="ミント"]')).toBe("rgb(255, 98, 201)");
  expect(await ctx.active("#status")).toBe("ok");
  expect(await bg("#status")).toBe("rgb(63, 195, 128)");
});
