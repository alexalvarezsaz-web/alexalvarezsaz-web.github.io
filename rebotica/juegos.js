// Juegos de principios activos y marcas para La Rebotica
var Juegos = (function () {
  var C = Core, $ = function (i) { return document.getElementById(i); };
  var mode = 'test', dir = 'mix', grupo = 'Todos', q = null, streak = 0, right = 0, total = 0, timer = null, left = 0, pairs = null, savedT = null;
  var GRUPOS = ['Todos'];
  BANCO.forEach(function (b) { if (GRUPOS.indexOf(b[0]) < 0) GRUPOS.push(b[0]); });
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
  function mine() { return C.data.fichas.map(function (f) { return ['Mis fichas', f.pa, String(f.marcas || '').split(',').map(function (m) { return m.trim(); }).filter(Boolean)]; }).filter(function (f) { return f[1] && f[2].length; }); }
  function pool() { var a = BANCO.concat(mine()); return grupo === 'Todos' ? a : a.filter(function (b) { return b[0] === grupo; }); }
  function rec() { return C.doc('marcador', 'yo') || { racha: 0, crono: 0, parejas: 0, fallos: {} }; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function save(patch) {
    var r = Object.assign({}, rec(), patch); r.id = 'yo';
    var list = C.data.marcador, i = list.findIndex(function (x) { return x.id === 'yo'; });
    if (i >= 0) list[i] = r; else list.push(r);
    stats();
    clearTimeout(savedT);
    savedT = setTimeout(function () { if (C.db && C.canEdit) { var d = Object.assign({}, r); delete d.id; C.put('marcador', 'yo', d).catch(function () {}); } }, 1200);
  }
  // Lo que más fallas sale más a menudo
  function weighted(a) {
    var f = rec().fallos || {}, sum = 0;
    a.forEach(function (b) { sum += 1 + Math.min(f[b[1]] || 0, 4) * 2; });
    var n = Math.random() * sum;
    for (var i = 0; i < a.length; i++) { n -= 1 + Math.min(f[a[i][1]] || 0, 4) * 2; if (n <= 0) return a[i]; }
    return a[0];
  }
  function newQ() {
    var a = pool(), e = q && a.length > 1 ? weighted(a.filter(function (b) { return b[1] !== q.pa; })) : weighted(a);
    var d = dir === 'mix' ? pickOne(['pa', 'marca']) : dir, others = BANCO.concat(mine()).filter(function (b) { return b[1] !== e[1]; });
    var near = shuffle(others.filter(function (b) { return b[0] === e[0]; })).concat(shuffle(others.filter(function (b) { return b[0] !== e[0]; })));
    var brand = pickOne(e[2]), opts;
    if (d === 'pa') opts = near.slice(0, 3).map(function (b) { return pickOne(b[2]); }).concat(brand);
    else opts = near.slice(0, 3).map(function (b) { return b[1]; }).concat(e[1]);
    q = { pa: e[1], marcas: e[2], dir: d, ask: d === 'pa' ? e[1] : brand, ans: d === 'pa' ? brand : e[1], opts: shuffle(opts), done: false, ok: null };
  }
  function score(ok) {
    q.done = true; q.ok = ok; total++;
    var f = Object.assign({}, rec().fallos || {}), patch = {};
    if (ok) { right++; streak++; if (f[q.pa]) { f[q.pa]--; if (!f[q.pa]) delete f[q.pa]; patch.fallos = f; } if (mode !== 'crono' && streak > (rec().racha || 0)) patch.racha = streak; }
    else { streak = 0; f[q.pa] = (f[q.pa] || 0) + 1; patch.fallos = f; }
    if (Object.keys(patch).length) save(patch); else stats();
  }
  function feedback() {
    if (!q.done) return '';
    var head = q.ok ? '✓ Correcto' : '✗ Era ' + C.esc(q.ans);
    return '<div class="fb ' + (q.ok ? 'good' : 'bad') + '" role="status"><b>' + head + '</b><span>' + C.esc(q.pa) + ': ' + C.esc(q.marcas.join(', ')) + '</span></div>';
  }
  function questionHtml() {
    var label = q.dir === 'pa' ? '¿Qué marca lleva este principio activo?' : '¿Qué principio activo lleva esta marca?';
    return '<p class="gq-l">' + label + '</p><p class="gq">' + C.esc(q.ask) + '</p>';
  }
  function draw() {
    var el = $('game'); if (!el) return;
    clearOpts(el);
    if (mode === 'pares') return drawPairs(el);
    if (mode === 'crono' && left <= 0 && !timer) {
      el.innerHTML = (total ? '<div class="fb good" role="status"><b>' + right + ' aciertos de ' + total + '</b><span>en 60 segundos</span></div>' : '<p class="gq-l">Tienes 60 segundos para acertar todas las que puedas.</p>') + '<button class="btn big" type="button" data-g="crono-go">' + (total ? 'Otra vez' : 'Empezar') + '</button>';
      return;
    }
    if (!q) newQ();
    var body = questionHtml();
    if (mode === 'escribe') {
      body += '<form id="gform" class="gtype"><input id="gtxt" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escribe la respuesta" aria-label="Respuesta"' + (q.done ? ' disabled' : '') + '><button class="btn" type="submit"' + (q.done ? ' disabled' : '') + '>Comprobar</button></form>';
    } else {
      body += '<div class="gopts">' + q.opts.map(function (o) {
        var cl = q.done ? (o === q.ans ? ' good' : o === q.picked ? ' bad' : ' off') : '';
        return '<button class="gopt' + cl + '" type="button" data-o="' + C.esc(o) + '"' + (q.done ? ' disabled' : '') + '>' + C.esc(o) + (q.done && o === q.ans ? ' ✓' : q.done && o === q.picked ? ' ✗' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (mode === 'crono') body = '<p class="clock num" aria-live="off">' + left + ' s</p>' + body;
    if (mode !== 'crono') body += feedback() + (q.done ? '<button class="btn big" type="button" data-g="next">Siguiente</button>' : '');
    el.innerHTML = body;
    if (mode === 'escribe' && !q.done) { var i = $('gtxt'); if (i && document.activeElement && document.activeElement.closest && document.activeElement.closest('#game')) i.focus(); }
    if (mode !== 'crono' && q.done) { var nx = el.querySelector('[data-g=next]'); if (nx) nx.focus(); }
  }
  function clearOpts() {}
  function drawPairs(el) {
    if (!pairs) {
      var src = shuffle(pool()).slice(0, 6).map(function (b) { return { pa: b[1], m: pickOne(b[2]) }; });
      pairs = { rows: src, left: shuffle(src.map(function (s) { return s.pa; })), right: shuffle(src.map(function (s) { return s.m; })), matched: {}, a: null, b: null, wrong: 0, t0: Date.now(), bad: null };
    }
    var doneN = Object.keys(pairs.matched).length, btn = function (side, v) {
      var pa = side === 'l' ? v : pairs.rows.filter(function (r) { return r.m === v; })[0].pa, on = !!pairs.matched[pa], sel = (side === 'l' ? pairs.a : pairs.b) === v, bad = pairs.bad && pairs.bad[side] === v;
      return '<button class="pair' + (on ? ' good' : sel ? ' sel' : bad ? ' bad' : '') + '" type="button" data-s="' + side + '" data-v="' + C.esc(v) + '" aria-pressed="' + sel + '"' + (on ? ' disabled' : '') + '>' + C.esc(v) + '</button>';
    };
    var html = '<p class="gq-l">Une cada principio activo con su marca.</p><div class="pairs"><div class="pcol"><span class="eyebrow">Principio activo</span>' + pairs.left.map(function (v) { return btn('l', v); }).join('') + '</div><div class="pcol"><span class="eyebrow">Marca</span>' + pairs.right.map(function (v) { return btn('r', v); }).join('') + '</div></div>';
    if (doneN === pairs.rows.length) {
      var s = Math.round((Date.now() - pairs.t0) / 1000);
      html += '<div class="fb good" role="status"><b>✓ Todas en ' + s + ' s</b><span>' + (pairs.wrong === 0 ? 'Sin ningún fallo.' : pairs.wrong + (pairs.wrong === 1 ? ' fallo.' : ' fallos.')) + '</span></div><button class="btn big" type="button" data-g="pares-new">Otra partida</button>';
    }
    el.innerHTML = html;
  }
  function pairClick(side, v) {
    pairs.bad = null;
    if (side === 'l') pairs.a = pairs.a === v ? null : v; else pairs.b = pairs.b === v ? null : v;
    if (pairs.a && pairs.b) {
      var row = pairs.rows.filter(function (r) { return r.pa === pairs.a; })[0], f = Object.assign({}, rec().fallos || {});
      if (row.m === pairs.b) {
        pairs.matched[row.pa] = 1;
        if (Object.keys(pairs.matched).length === pairs.rows.length) {
          var s = Math.round((Date.now() - pairs.t0) / 1000), best = rec().parejas || 0;
          if (!pairs.wrong && (!best || s < best)) save({ parejas: s });
        }
      } else { pairs.wrong++; f[row.pa] = (f[row.pa] || 0) + 1; save({ fallos: f }); pairs.bad = { l: pairs.a, r: pairs.b }; }
      pairs.a = null; pairs.b = null;
    }
    draw();
  }
  function stopClock() { clearInterval(timer); timer = null; }
  function startCrono() {
    right = 0; total = 0; streak = 0; left = 60; q = null; stopClock();
    timer = setInterval(function () {
      left--;
      if (left <= 0) { stopClock(); left = 0; q = null; if (right > (rec().crono || 0)) save({ crono: right }); draw(); return; }
      var c = document.querySelector('#game .clock'); if (c) c.textContent = left + ' s';
    }, 1000);
    draw();
  }
  function stats() {
    var r = rec(), weak = Object.keys(r.fallos || {}).sort(function (a, b) { return r.fallos[b] - r.fallos[a]; }).slice(0, 5), el = $('gstats');
    if (!el) return;
    el.innerHTML = '<div class="stat"><b>' + streak + '</b><span>Racha ahora</span></div><div class="stat"><b>' + (r.racha || 0) + '</b><span>Mejor racha</span></div><div class="stat"><b>' + (r.crono || 0) + '</b><span>Récord en 60 s</span></div><div class="stat"><b>' + (r.parejas ? r.parejas + ' s' : '–') + '</b><span>Parejas sin fallos</span></div>';
    $('gweak').textContent = weak.length ? 'Te cuestan más: ' + weak.join(', ') + '. Saldrán más a menudo.' : '';
    $('gweak').hidden = !weak.length;
  }
  function controls() {
    var chip = function (a, v, t, on) { return '<button class="chip" type="button" data-' + a + '="' + C.esc(v) + '" aria-pressed="' + on + '">' + C.esc(t) + '</button>'; };
    $('gmode').innerHTML = [['test', 'Test'], ['crono', '60 segundos'], ['pares', 'Parejas'], ['escribe', 'Escribir']].map(function (m) { return chip('m', m[0], m[1], mode === m[0]); }).join('');
    $('gdir').hidden = mode === 'pares';
    $('gdir').innerHTML = [['mix', 'Mezcla'], ['pa', 'Principio → marca'], ['marca', 'Marca → principio']].map(function (d) { return chip('d', d[0], d[1], dir === d[0]); }).join('');
    var names = GRUPOS.concat(mine().length ? ['Mis fichas'] : []);
    if (names.indexOf(grupo) < 0) grupo = 'Todos';
    $('ggrupo').innerHTML = names.map(function (g) { return '<option' + (g === grupo ? ' selected' : '') + '>' + C.esc(g) + '</option>'; }).join('');
    $('gcount').textContent = pool().length + ' principios activos · ' + pool().reduce(function (a, b) { return a + b[2].length; }, 0) + ' marcas';
  }
  function reset() { stopClock(); q = null; pairs = null; left = 0; right = 0; total = 0; streak = 0; controls(); draw(); stats(); }
  function nextSoon() { setTimeout(function () { if (timer) { newQ(); draw(); } }, 280); }

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#juegos')) return;
    var b = e.target.closest('button'); if (!b) return;
    var v;
    if ((v = b.getAttribute('data-m'))) { mode = v; return reset(); }
    if ((v = b.getAttribute('data-d'))) { dir = v; q = null; if (mode === 'crono') { reset(); } else { controls(); draw(); } return; }
    if ((v = b.getAttribute('data-g'))) {
      if (v === 'next') { newQ(); draw(); var f = $('gtxt'); if (f) f.focus(); }
      if (v === 'crono-go') startCrono();
      if (v === 'pares-new') { pairs = null; draw(); }
      return;
    }
    if (b.hasAttribute('data-s')) return pairClick(b.getAttribute('data-s'), b.getAttribute('data-v'));
    if (b.hasAttribute('data-o') && q && !q.done) {
      q.picked = b.getAttribute('data-o');
      score(q.picked === q.ans);
      draw();
      if (mode === 'crono') nextSoon();
    }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'ggrupo') { grupo = e.target.value; reset(); } });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'gform') return;
    e.preventDefault();
    if (!q || q.done) return;
    var t = fold($('gtxt').value); if (!t) return;
    // Pidiendo una marca vale cualquiera de las de ese principio activo
    var ok = q.dir === 'pa' ? q.marcas.some(function (m) { return fold(m) === t; }) : fold(q.ans) === t;
    score(ok); draw();
  });
  return { init: function () { reset(); }, sync: function () { controls(); stats(); } };
})();
