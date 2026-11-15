// 模擬 OneSDK。page.route で CONFIG.sdkUrl の応答として返す（index.html には試験用の分岐を置かない）
const SDK_BODY = `
(function () {
  var subs = {};
  window.__sdkCalls = { setup: [], connect: 0, subscribe: {} };
  window.OneSDK = {
    setup: function (o) { window.__sdkCalls.setup.push(o); },
    connect: function () { window.__sdkCalls.connect++; },
    subscribe: function (o) {
      (subs[o.action] = subs[o.action] || []).push(o.callback);
      window.__sdkCalls.subscribe[o.action] = (window.__sdkCalls.subscribe[o.action] || 0) + 1;
    }
  };
  window.__emit = function (action, payload) { (subs[action] || []).forEach(function (f) { f(payload); }); };
})();
`;
module.exports = { SDK_BODY };
