(function () {
  'use strict';

  var P = window.Parser;
  var PASS = 60;
  var YEARS = [1, 2, 3, 4, 5];
  var YN = { 1: 'الأولى', 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة' };

  var courses = [];
  var snapshot = [];
  var nextId = 1;
  var filter = 'all';

  function $(id) { return document.getElementById(id); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function el(tag, opts, kids) {
    var n = document.createElement(tag);
    if (opts) {
      Object.keys(opts).forEach(function (k) {
        if (k === 'text') n.textContent = opts[k];
        else if (k === 'class') n.className = opts[k];
        else if (k === 'on') Object.keys(opts.on).forEach(function (ev) { n.addEventListener(ev, opts.on[ev]); });
        else n.setAttribute(k, opts[k]);
      });
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function setMsg(text, kind) {
    var m = $('msg');
    m.textContent = text;
    m.className = 'msg ' + (kind || '');
  }

  /* ---------- الحسابات ---------- */
  function compute() {
    var byYear = {};
    YEARS.forEach(function (y) { byYear[y] = []; });
    courses.forEach(function (c) { if (byYear[c.cy]) byYear[c.cy].push(c); });

    var yearAvg = {};
    YEARS.forEach(function (y) {
      var a = byYear[y];
      yearAvg[y] = a.length ? a.reduce(function (s, c) { return s + c.f; }, 0) / a.length : null;
    });

    var avail = YEARS.filter(function (y) { return yearAvg[y] !== null; });
    var sum = avail.reduce(function (s, y) { return s + yearAvg[y]; }, 0);
    var divisor = $('divisor').value === 'available' ? Math.max(avail.length, 1) : 5;
    var overall = avail.length ? sum / divisor : null;

    var sorted = courses.slice().sort(function (a, b) { return b.f - a.f; });
    var passed = courses.filter(function (c) { return c.f >= PASS; }).length;
    var mean = courses.length ? courses.reduce(function (s, c) { return s + c.f; }, 0) / courses.length : null;

    return { byYear: byYear, yearAvg: yearAvg, avail: avail, overall: overall, divisor: divisor,
             sorted: sorted, passed: passed, failed: courses.length - passed, mean: mean };
  }

  /* ---------- العرض ---------- */
  function card(label, value, sub, cls) {
    var kids = [el('div', { class: 'card-label', text: label }), el('div', { class: 'card-value', text: value })];
    if (sub) kids.push(el('div', { class: 'card-sub', text: sub }));
    return el('div', { class: 'card ' + (cls || '') }, kids);
  }

  function barList(box, items) {
    clear(box);
    items.forEach(function (it) {
      var fill = el('div', { class: 'bar-fill ' + (it.cls || '') });
      fill.style.width = Math.max(0, Math.min(100, it.pct)) + '%';
      box.appendChild(el('div', { class: 'bar-row' }, [
        el('div', { class: 'bar-label', text: it.label }),
        el('div', { class: 'bar-track' }, [fill]),
        el('div', { class: 'bar-value', text: it.value })
      ]));
    });
  }

  function rankList(box, list) {
    clear(box);
    list.forEach(function (c) {
      box.appendChild(el('li', {}, [
        el('span', { class: 'rk-name', text: c.name }),
        el('span', { class: 'rk-year', text: YN[c.cy] }),
        el('span', { class: 'rk-mark ' + (c.f >= PASS ? 'ok' : 'bad'), text: fmt(c.f) })
      ]));
    });
  }

  function renderStats() {
    var s = compute();

    var sum = $('summary'); clear(sum);
    var overallSub = s.avail.length < 5 && $('divisor').value === 'five'
      ? 'السنوات المتوفرة: ' + s.avail.length + ' من 5' : 'مجموع معدلات السنوات ÷ ' + s.divisor;
    sum.appendChild(card('المعدل العام', fmt(s.overall), overallSub, 'main'));
    sum.appendChild(card('عدد المواد', String(courses.length), ''));
    sum.appendChild(card('ناجح / راسب', s.passed + ' / ' + s.failed, 'حد النجاح ' + PASS, s.failed ? 'warn' : ''));
    sum.appendChild(card('متوسط كل المواد', fmt(s.mean), 'بدون تجميع بالسنوات'));
    if (s.sorted.length) {
      var top = s.sorted[0], low = s.sorted[s.sorted.length - 1];
      sum.appendChild(card('أعلى علامة', fmt(top.f), top.name));
      sum.appendChild(card('أدنى علامة', fmt(low.f), low.name));
    }

    var ys = $('years'); clear(ys);
    YEARS.forEach(function (y) {
      var n = s.byYear[y].length;
      ys.appendChild(card('السنة ' + YN[y], fmt(s.yearAvg[y]), n ? n + ' مواد' : 'لا مواد', n ? '' : 'empty'));
    });

    barList($('chart-years'), YEARS.map(function (y) {
      var v = s.yearAvg[y];
      return { label: YN[y], value: fmt(v), pct: v === null ? 0 : v, cls: v !== null && v < PASS ? 'bad' : '' };
    }));

    var bins = [
      { label: 'أقل من 60 (راسب)', test: function (v) { return v < 60; }, cls: 'bad' },
      { label: '60 – 69', test: function (v) { return v >= 60 && v < 70; } },
      { label: '70 – 79', test: function (v) { return v >= 70 && v < 80; } },
      { label: '80 – 89', test: function (v) { return v >= 80 && v < 90; } },
      { label: '90 فأكثر', test: function (v) { return v >= 90; }, cls: 'good' }
    ];
    var total = Math.max(courses.length, 1);
    barList($('chart-dist'), bins.map(function (b) {
      var n = courses.filter(function (c) { return b.test(c.f); }).length;
      return { label: b.label, value: String(n), pct: n / total * 100, cls: b.cls };
    }));

    rankList($('top'), s.sorted.slice(0, 5));
    rankList($('bottom'), s.sorted.slice(-5).reverse());
  }

  function statusFor(c) { return c.f >= PASS ? 'ناجح' : 'راسب'; }

  function renderTable() {
    var body = $('tbody'); clear(body);
    var list = courses.filter(function (c) {
      if (filter === 'all') return true;
      if (filter === 'custom') return !!c.custom;
      return c.cy === Number(filter);
    });
    list.sort(function (a, b) { return a.cy - b.cy; });

    list.forEach(function (c) {
      var badgeHost = el('div', { class: 'badges' });
      if (c.custom) badgeHost.appendChild(el('span', { class: 'badge', text: 'مضافة' }));
      else if (c.edited) badgeHost.appendChild(el('span', { class: 'badge', text: 'معدّلة' }));
      function markEdited() {
        if (!c.edited && !c.custom) { c.edited = true; badgeHost.appendChild(el('span', { class: 'badge', text: 'معدّلة' })); }
      }

      var nameIn = el('input', { type: 'text', maxlength: '80', 'aria-label': 'اسم المقرر' });
      nameIn.value = c.name;
      nameIn.addEventListener('change', function () {
        var v = nameIn.value.trim();
        if (!v) { nameIn.value = c.name; return; }
        c.name = v; markEdited(); renderStats();
      });
      var meta = (c.ac || c.term) ? [c.ac, c.term].filter(Boolean).join(' · ') : '';
      var nameCell = el('td', { class: 'name-cell' }, [nameIn, el('div', { class: 'meta', text: meta }), badgeHost]);

      var sel = el('select', { 'aria-label': 'سنة المقرر' });
      YEARS.forEach(function (y) {
        var o = el('option', { value: String(y), text: YN[y] });
        if (y === c.cy) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { c.cy = Number(sel.value); markEdited(); renderStats(); if (filter !== 'all') renderTable(); });

      var statusCell = el('td', { class: 'status ' + (c.f >= PASS ? 'ok' : 'bad'), text: statusFor(c) });

      function numIn(key, label) {
        var i = el('input', { type: 'number', min: '0', max: '100', step: 'any', inputmode: 'decimal', 'aria-label': label });
        i.value = c[key] === null ? '' : String(c[key]);
        return i;
      }
      var pIn = numIn('p', 'علامة العملي');
      var eIn = numIn('e', 'علامة الامتحان');
      var fIn = numIn('f', 'العلامة النهائية');

      function refreshStatus() {
        statusCell.textContent = statusFor(c);
        statusCell.className = 'status ' + (c.f >= PASS ? 'ok' : 'bad');
      }
      function onPE() {
        var pv = P.parseNum(pIn.value), ev = P.parseNum(eIn.value);
        c.p = pv === null ? null : clamp(pv);
        c.e = ev === null ? null : clamp(ev);
        c.f = clamp((c.p || 0) + (c.e || 0));
        fIn.value = String(c.f);
        markEdited(); refreshStatus(); renderStats();
      }
      pIn.addEventListener('input', onPE);
      eIn.addEventListener('input', onPE);
      fIn.addEventListener('input', function () {
        var v = P.parseNum(fIn.value);
        c.f = v === null ? 0 : clamp(v);
        markEdited(); refreshStatus(); renderStats();
      });

      var del = el('button', { type: 'button', class: 'btn-icon', title: 'حذف المقرر', 'aria-label': 'حذف المقرر', text: '✕' });
      del.addEventListener('click', function () {
        courses = courses.filter(function (x) { return x.id !== c.id; });
        renderAll();
      });

      body.appendChild(el('tr', {}, [
        nameCell,
        el('td', {}, [sel]),
        el('td', {}, [pIn]), el('td', {}, [eIn]), el('td', {}, [fIn]),
        statusCell,
        el('td', {}, [del])
      ]));
    });

    $('empty-table').hidden = list.length !== 0;
  }

  function renderAll() {
    $('results').hidden = courses.length === 0 && snapshot.length === 0;
    renderStats();
    renderTable();
  }

  /* ---------- التحميل ---------- */
  function loadText(text) {
    var res = P.parseText(text);
    if (!res.rows.length) {
      setMsg('لم أجد أي علامات صالحة. تأكد أنك نسخت الجدول كاملاً أو رفعت ملف CSV الصحيح.', 'error');
      return;
    }
    courses = res.rows.map(function (r) {
      return { id: nextId++, ac: r.ac, term: r.term, name: r.name, cy: r.cy, p: r.p, e: r.e, f: r.f };
    });
    snapshot = JSON.parse(JSON.stringify(courses));
    filter = 'all'; $('filter').value = 'all';
    renderAll();
    var note = res.skipped ? ' (تم تجاهل ' + res.skipped + ' سطر غير صالح أو عناوين)' : '';
    setMsg('تم تحميل ' + courses.length + ' مقرراً' + note + '. البيانات تبقى في متصفحك فقط.', 'ok');
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleFile(file) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setMsg('ملفات Excel غير مدعومة مباشرة. افتح الملف واحفظه بصيغة CSV (أو انسخ الجدول والصقه في المربع).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { setMsg('الملف كبير جداً (الحد 5 ميغابايت).', 'error'); return; }
    var fr = new FileReader();
    fr.onload = function () { loadText(P.decodeBytes(fr.result)); };
    fr.onerror = function () { setMsg('تعذّرت قراءة الملف.', 'error'); };
    fr.readAsArrayBuffer(file);
  }

  /* ---------- التصدير ---------- */
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var head = ['عام التقديم', 'الفصل الدراسي', 'اسم المقرر', 'سنة المقرر', 'علامة العملي', 'علامة الامتحان', 'العلامة النهائية'];
    var lines = [head.map(csvCell).join(',')];
    courses.slice().sort(function (a, b) { return a.cy - b.cy; }).forEach(function (c) {
      lines.push([c.ac, c.term, c.name, YN[c.cy], c.p, c.e, c.f].map(csvCell).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'marks.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- الأحداث ---------- */
  $('file').addEventListener('change', function (e) { handleFile(e.target.files[0]); e.target.value = ''; });

  var dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
  });
  dz.addEventListener('drop', function (e) { handleFile(e.dataTransfer.files[0]); });

  $('btn-paste').addEventListener('click', function () {
    var t = $('paste').value;
    if (!t.trim()) { setMsg('الصق الجدول أولاً.', 'error'); return; }
    loadText(t);
  });

  $('divisor').addEventListener('change', renderStats);
  $('filter').addEventListener('change', function (e) { filter = e.target.value; renderTable(); });
  $('btn-export').addEventListener('click', exportCsv);

  $('btn-reset').addEventListener('click', function () {
    courses = JSON.parse(JSON.stringify(snapshot));
    renderAll();
    setMsg('تمت إعادة البيانات الأصلية.', 'ok');
  });

  $('btn-clear').addEventListener('click', function () {
    courses = []; snapshot = [];
    $('paste').value = '';
    $('results').hidden = true;
    setMsg('تم مسح كل البيانات من الصفحة.', 'ok');
  });

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('a-name').value.trim();
    var cy = Number($('a-year').value);
    var p = P.parseNum($('a-p').value), ev = P.parseNum($('a-e').value), f = P.parseNum($('a-f').value);
    if (!name) { setMsg('اكتب اسم المقرر.', 'error'); return; }
    if (p === null && ev === null && f === null) { setMsg('أدخل علامة العملي أو الامتحان أو النهائية.', 'error'); return; }
    var fin = f !== null ? clamp(f) : clamp((p || 0) + (ev || 0));
    courses.push({ id: nextId++, ac: '', term: '', name: name, cy: cy,
      p: p === null ? null : clamp(p), e: ev === null ? null : clamp(ev), f: fin, custom: true });
    $('add-form').reset();
    renderAll();
    setMsg('أُضيف المقرر «' + name + '».', 'ok');
  });

  // قائمة سنوات نموذج الإضافة
  YEARS.forEach(function (y) { $('a-year').appendChild(el('option', { value: String(y), text: YN[y] })); });
})();
