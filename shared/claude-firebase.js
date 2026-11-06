// Stands in for the claude.ai runtime (window.claude.use) with Firebase, so the apps run on any host.
// Load after the Firebase compat scripts and firebase-config.js, with data-app="<app name>":
// each app keeps its data under apps/<app name>/ in Firestore.
(function () {
  var script = document.currentScript, appName = script.dataset.app;
  firebase.initializeApp(window.FIREBASE_CONFIG);
  var auth = firebase.auth(), fs = firebase.firestore();
  fs.enablePersistence({ synchronizeTabs: true }).catch(function () {});
  var base = fs.collection('apps').doc(appName);

  // Resolves with the signed-in user, or null once Firebase knows nobody is signed in
  var ready = new Promise(function (res) {
    var off = auth.onAuthStateChanged(function (u) { off(); res(u); });
  });
  ready.then(function (u) { if (!u) loginBar(); });

  function loginBar() {
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Iniciar sesión');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:9999;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;background:#1d1d1f;color:#fff;font:600 15px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)';
    bar.innerHTML = '<span>Entra para ver y guardar tus datos</span><button type="button" style="min-height:40px;padding:0 14px;border:0;border-radius:9px;background:#fff;color:#1d1d1f;font:inherit;cursor:pointer">Entrar con Google</button>';
    bar.querySelector('button').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(p).then(function () { location.reload(); }).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) auth.signInWithRedirect(p);
      });
    };
    document.body.appendChild(bar);
  }

  // Same shape as the claude.ai db: collection('x') and doc('x/id') give Firestore refs
  var db = {
    collection: function (p) { return base.collection(p); },
    doc: function (p) { var s = p.split('/'); return base.collection(s[0]).doc(s.slice(1).join('/')); }
  };

  var user = {
    id: async function () { var u = await ready; return u ? u.uid : null; },
    me: async function () { var u = await ready; return u ? { id: u.uid, name: u.displayName || '', email: u.email || '' } : null; },
    canEdit: async function () { return !!(await ready); },
    can: async function () { return !!(await ready); },
    isOwner: async function () { return !!(await ready); },
    profiles: async function () { return {}; }
  };

  // Photos live as reduced JPEG data URLs in apps/<app>/_assets, and pages show them as /_blob/<id>
  function shrink(blob, max) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(blob);
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        res(c.toDataURL('image/jpeg', .8));
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('No es una imagen')); };
      img.src = u;
    });
  }
  var blobs = {};
  function blobUrl(id) {
    if (!blobs[id]) blobs[id] = base.collection('_assets').doc(id).get().then(function (d) { return d.exists ? d.data().data : ''; }).catch(function () { return ''; });
    return blobs[id];
  }
  var assets = {
    upload: async function (blob) {
      var data = await shrink(blob, 1280), id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await base.collection('_assets').doc(id).set({ data: data, ts: Date.now() });
      blobs[id] = Promise.resolve(data);
      return { id: id };
    },
    delete: function (id) { delete blobs[id]; return base.collection('_assets').doc(id).delete(); }
  };
  var BLOB = /\/_blob\/([\w-]+)/;
  function fix(el) {
    var src = el.getAttribute && el.getAttribute('src'), m = src && BLOB.exec(src);
    if (m) { el.removeAttribute('src'); blobUrl(m[1]).then(function (u) { if (u) el.setAttribute('src', u); }); }
    var st = el.getAttribute && el.getAttribute('style'), n = st && BLOB.exec(st);
    if (n) { el.style.backgroundImage = 'none'; blobUrl(n[1]).then(function (u) { if (u) el.style.backgroundImage = 'url("' + u + '")'; }); }
  }
  function scan(root) { if (root.nodeType !== 1) return; fix(root); root.querySelectorAll('[src*="/_blob/"],[style*="/_blob/"]').forEach(fix); }
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { if (m.type === 'attributes') fix(m.target); else m.addedNodes.forEach(scan); });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });
  document.addEventListener('DOMContentLoaded', function () { scan(document.body); });

  window.claude = {
    use: async function (name) {
      var u = await ready;
      if (name === 'db') return u ? db : null;
      if (name === 'user') return user;
      if (name === 'assets') return u ? assets : null;
      // Asking Claude from the page (sample) and file downloads have no stand-in yet
      return null;
    }
  };
})();
