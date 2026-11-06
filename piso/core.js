// Shared store and form helpers for the personal notebook pages
(function () {
  var C = window.Core = { db: null, assets: null, canEdit: false, state: 'loading', data: {} }, render = function () {}, key = 'core', dlg = null;
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  C.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  C.uid = function () { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  C.today = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  C.days = function (f) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); if (!m) return null;
    var n = new Date();
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  };
  C.fmt = function (f) { var p = (f || '').split('-'); return p.length === 3 ? +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] : ''; };
  C.left = function (f) { var n = C.days(f); return n == null ? '' : n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 1 ? 'en ' + n + ' días' : n === -1 ? 'ayer' : 'hace ' + (-n) + ' días'; };
  C.safe = function (u) { return /^https:\/\/\S+$/i.test(String(u || '').trim()); };
  C.doc = function (col, id) { return (C.data[col] || []).filter(function (o) { return o.id === id; })[0] || null; };
  function say() {
    var el = document.getElementById('say'); if (!el) return;
    var t = { loading: 'Cargando tus datos…', noauth: 'Entra con tu cuenta de Google para ver y guardar tus datos.', error: 'No se han podido cargar los datos. Comprueba la conexión y recarga la página.', ok: '' }[C.state];
    el.textContent = t; el.hidden = !t;
  }
  function cache() { try { localStorage.setItem(key, JSON.stringify(C.data)); } catch (e) {} }
  C.notice = function (m) { var el = document.getElementById('say'); if (el) { el.textContent = m; el.hidden = false; } };
  C.start = async function (cols, fn, opts) {
    render = fn; key = opts.key;
    try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) C.data = c; } catch (e) {}
    cols.forEach(function (n) { C.data[n] = C.data[n] || []; });
    say(); render();
    var timer = setTimeout(function () { if (C.state === 'loading') { C.state = 'error'; say(); } }, 10000);
    if (!(window.claude && window.claude.use)) { clearTimeout(timer); C.state = 'noauth'; say(); render(); return; }
    try {
      C.db = await window.claude.use('db');
      if (!C.db) { clearTimeout(timer); C.state = 'noauth'; say(); render(); return; }
      var user = await window.claude.use('user');
      C.canEdit = user ? (await user.canEdit()) === true : false;
      document.documentElement.classList.toggle('can-edit', C.canEdit);
      if (opts.assets && C.canEdit) C.assets = await window.claude.use('assets');
      render();
      cols.forEach(function (n) {
        C.db.collection(n).onSnapshot(function (s) {
          if (s.metadata && s.metadata.fromCache && !s.size) return;
          clearTimeout(timer); C.state = 'ok'; say();
          C.data[n] = s.docs.map(function (x) { var o = Object.assign({}, x.data()); o.id = x.id; return o; });
          cache(); render();
        }, function () { clearTimeout(timer); C.state = 'error'; say(); });
      });
    } catch (e) { clearTimeout(timer); C.state = 'error'; say(); }
  };
  C.patch = async function (col, id, data) {
    var o = C.doc(col, id); if (o) { Object.assign(o, data); render(); }
    try { await C.db.doc(col + '/' + id).update(data); } catch (e) { C.notice('No se ha podido guardar el cambio. Comprueba la conexión y vuelve a probar.'); }
  };
  C.put = function (col, id, data) { return C.db.doc(col + '/' + id).set(data); };

  // A form described by its fields: {k, label, type, options, req, ph}
  C.form = function (o) {
    if (!dlg) { dlg = document.createElement('dialog'); document.body.appendChild(dlg); }
    var v = o.item || o.preset || {};
    dlg.innerHTML = '<form novalidate><h2>' + C.esc(o.title) + '</h2>' + o.fields.map(function (f) {
      var id = 'f_' + f.k, val = v[f.k] == null ? (f.value == null ? '' : f.value) : v[f.k], ph = f.ph ? ' placeholder="' + C.esc(f.ph) + '"' : '', c;
      if (f.type === 'textarea') c = '<textarea id="' + id + '"' + ph + ' maxlength="2000">' + C.esc(val) + '</textarea>';
      else if (f.type === 'select') c = '<select id="' + id + '">' + f.options.map(function (x) { return '<option' + (x === val ? ' selected' : '') + '>' + C.esc(x) + '</option>'; }).join('') + '</select>';
      else c = '<input id="' + id + '" type="' + (f.type || 'text') + '"' + ph + (f.type === 'number' ? ' step="any" inputmode="decimal"' : '') + ' value="' + C.esc(val) + '">';
      return '<label>' + C.esc(f.label) + c + '</label>';
    }).join('') + '<p class="err" hidden></p><div class="bar">' + (o.item ? '<button class="btn del" type="button" data-a="del">Eliminar</button>' : '') + '<button class="btn ghost" type="button" data-a="no">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
    var err = dlg.querySelector('.err');
    function fail(m) { err.textContent = m; err.hidden = false; }
    dlg.querySelector('[data-a=no]').onclick = function () { dlg.close(); };
    var del = dlg.querySelector('[data-a=del]');
    if (del) del.onclick = async function () {
      if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = '¿Seguro? Eliminar'; return; }
      try { await C.db.doc(o.col + '/' + o.item.id).delete(); dlg.close(); if (o.afterDelete) o.afterDelete(o.item); } catch (e) { fail('No se ha podido eliminar. Comprueba la conexión y vuelve a probar.'); }
    };
    dlg.querySelector('form').onsubmit = async function (e) {
      e.preventDefault();
      var data = Object.assign({}, o.extra || {});
      for (var i = 0; i < o.fields.length; i++) {
        var f = o.fields[i], raw = document.getElementById('f_' + f.k).value.trim();
        if (f.req && !raw) return fail('Falta: ' + f.label.toLowerCase() + '.');
        if (f.type === 'url' && raw && !C.safe(raw)) return fail('El enlace tiene que empezar por https://');
        if (f.type === 'number' && raw && isNaN(+raw)) return fail('Revisa el número de «' + f.label.toLowerCase() + '».');
        data[f.k] = f.type === 'number' ? (raw ? +raw : null) : raw;
      }
      if (o.item) { ['ts', 'hecha', 'leida', 'resuelta', 'listo', 'foto', 'asset'].forEach(function (k) { if (o.item[k] !== undefined && data[k] === undefined) data[k] = o.item[k]; }); }
      if (data.ts === undefined) data.ts = Date.now();
      if (!C.db) return fail('No se ha podido guardar: entra con tu cuenta de Google.');
      try { await C.put(o.col, o.id || (o.item && o.item.id) || C.uid(), data); dlg.close(); if (o.done) o.done(); }
      catch (x) { fail('No se ha podido guardar. Comprueba la conexión y vuelve a probar.'); }
    };
    dlg.showModal();
  };

  // One list row: optional tick box, title, detail and an edit link
  C.row = function (o) {
    return '<li class="row' + (o.done ? ' done' : '') + '">' + (o.check ? '<input type="checkbox" data-check="' + o.col + '|' + C.esc(o.id) + '|' + o.check + '"' + (o.done ? ' checked' : '') + ' aria-label="' + C.esc(o.title) + '">' : '<span></span>') +
      '<div><b>' + C.esc(o.title) + '</b>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div>' +
      '<div style="text-align:right">' + (o.right ? '<div class="small num">' + C.esc(o.right) + '</div>' : '') + '<button class="lnk edit-only" type="button" data-edit="' + o.col + '|' + C.esc(o.id) + '" aria-label="Editar ' + C.esc(o.title) + '">Editar</button></div></li>';
  };
  // Add, edit and tick buttons anywhere on the page, from a description of each list
  C.wire = function (defs) {
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var a = e.target.closest('[data-add]'), b = e.target.closest('[data-edit]');
      if (a) { var n = a.getAttribute('data-add'), d = defs[n]; C.form({ col: n, title: d.title, fields: d.fields, preset: d.preset && d.preset(), afterDelete: d.afterDelete }); }
      if (b) { var p = b.getAttribute('data-edit').split('|'), de = defs[p[0]]; C.form({ col: p[0], id: p[1], item: C.doc(p[0], p[1]), title: de.editTitle || de.title, fields: de.fields, afterDelete: de.afterDelete }); }
    });
    document.addEventListener('change', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-check'); if (!c) return;
      var p = c.split('|'), v = {}; v[p[2]] = e.target.checked; C.patch(p[0], p[1], v);
    });
  };

  // Photos are reduced before uploading
  C.upload = function (file) {
    return new Promise(function (res) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', .85);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    }).then(function (b) { return C.assets.upload(b); });
  };
})();
