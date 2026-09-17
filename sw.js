/* 天纪排盘 Service Worker —— 策略：网络优先 + 缓存回落
 * 1) 只处理同源 GET 请求，绝不代管任何跨域请求；
 * 2) 有网时永远取网络最新版本，并把成功响应写回缓存；
 * 3) 断网时回落到缓存；连缓存都没有时返回 503 与一行提示。
 * 本应用自身不发任何网络请求，此文件只影响页面本身的加载。
 */
var CACHE = 'nhtj-shell-v3';
var ASSETS = ['./', './index.html', './icon.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () { return null; });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        return caches.match('./index.html').then(function (h2) {
          return h2 || caches.match('./').then(function (h3) {
            return h3 || new Response('离线，且本页尚未被缓存过。', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        });
      });
    })
  );
});
