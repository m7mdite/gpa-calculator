(function () {
  'use strict';

  const P = window.Parser;
  const YEARS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
  const BANDS = [
    { key: 'g1', min: 90, label: 'ممتاز' },
    { key: 'g2', min: 80, label: 'جيد جداً' },
    { key: 'g3', min: 70, label: 'جيد' },
    { key: 'g4', min: 60, label: 'مقبول' },
    { key: 'g5', min: -Infinity, label: 'راسب' }
  ];
  const PASS = 60;

  let courses = [];
  let snapshot = [];
  let nextId = 1;
  let mode = 'course';      // course | study
  let weighted = false;
  let divMode = 'five';     // five | avail
  let tab = 'courses';
  let yearFilter = 'all';
  let query = '';
  let editing = null;
  let finalManual = false;
  let delArmed = false;
  let clearArmed = false;
  let clearT;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const norm = P.norm;
  const num = P.parseNum;
  const band = v => BANDS.find(b => v >= b.min);
  const fmt = (v, d = 2) => v == null ? '–' : v.toFixed(d);
  const fmtMark = v => v == null ? '–' : (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const semRank = s => { const r = norm(s); return r.includes('اول') ? 1 : r.includes('ثاني') ? 2 : 3; };
  const termCmp = (a, b) => (a.ay || '').localeCompare(b.ay || '') || semRank(a.sem) - semRank(b.sem);
  const yearLabel = y => y === 0 ? 'غير محدد' : (YEARS[y - 1] ? 'السنة ' + YEARS[y - 1] : 'السنة ' + y);

  // العروض تُضبط عبر CSSOM (مسموح بها في CSP) وليس عبر سمة style
  function applyWidths(root) {
    root.querySelectorAll('[data-w]').forEach(n => { n.style.width = n.getAttribute('data-w') + '%'; });
  }
  function setHTML(node, html) { node.innerHTML = html; applyWidths(node); }

  function addCourse(o) {
    courses.push({
      id: nextId++, name: o.name, cy: o.cy, ay: o.ay || '', sem: o.sem || 'فصل أول',
      p: o.p ?? null, e: o.e ?? null, f: o.f, h: o.h ?? null, custom: !!o.custom, edited: !!o.edited
    });
  }

  /* ---------- الحسابات ---------- */
  const wOf = c => (c.h && c.h > 0) ? c.h : 1;
  function avg(list) {
    const l = list.filter(c => c.f != null);
    if (!l.length) return null;
    if (weighted) {
      const w = l.reduce((s, c) => s + wOf(c), 0);
      return l.reduce((s, c) => s + c.f * wOf(c), 0) / w;
    }
    return l.reduce((s, c) => s + c.f, 0) / l.length;
  }
  function studyMap(list = courses) {
    const ays = [...new Set(list.map(c => c.ay).filter(Boolean))].sort();
    const m = {}; ays.forEach((a, i) => m[a] = i + 1); return m;
  }
  function yearOf(c, sm) { return mode === 'course' ? c.cy : (c.ay ? sm[c.ay] : 0); }
  function groupByYear(list = courses) {
    const sm = studyMap(list), g = new Map();
    list.forEach(c => { const y = yearOf(c, sm); if (!g.has(y)) g.set(y, []); g.get(y).push(c); });
    return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([y, l]) => ({ y, list: l, avg: avg(l) }));
  }
  function divisorOf(groups) {
    const k = groups.filter(g => g.avg != null).length;
    return divMode === 'five' ? Math.max(5, k) : k;
  }
  function overall(groups) {
    const a = groups.map(g => g.avg).filter(v => v != null);
    if (!a.length) return null;
    return a.reduce((s, v) => s + v, 0) / divisorOf(groups);
  }

  /* ---------- العرض ---------- */
  function renderHero() {
    const groups = groupByYear();
    const ov = overall(groups);
    const cum = avg(courses);
    const sm = studyMap();
    const mismatch = courses.filter(c => c.ay && sm[c.ay] !== c.cy).length;
    const rows = groups.map(g => {
      const b = g.avg != null ? band(g.avg) : null;
      const w = g.avg == null ? 0 : Math.max(0, Math.min(100, g.avg));
      return `<div class="rrow ${b ? 'b-' + b.key : ''}">
        <div class="yl">${esc(yearLabel(g.y))}<small>${g.list.length} مقرراً</small></div>
        <div class="track"><div class="fill" data-w="${w}"></div><span class="pass"></span></div>
        <div class="v num">${fmt(g.avg)}</div></div>`;
    }).join('');
    setHTML($('hero'), `
      <div>
        <p class="lab">المعدل العام</p>
        <p class="big num">${fmt(ov)}</p>
        <p class="sub">مجموع معدلات السنوات ÷ <b class="num">${divisorOf(groups) || 5}</b> · المعدل التراكمي لكل المقررات: <b class="num">${fmt(cum)}</b> من <b class="num">${courses.length}</b> مقرراً</p>
        <p class="lab2">تجميع السنوات</p>
        <div class="seg" role="group" aria-label="طريقة تجميع السنوات">
          <button type="button" data-mode="course" aria-pressed="${mode === 'course'}">حسب سنة المقرر</button>
          <button type="button" data-mode="study" aria-pressed="${mode === 'study'}">حسب سنة الدراسة</button>
        </div>
        <p class="lab2">القسمة في المعدل العام</p>
        <div class="seg" role="group" aria-label="القاسم">
          <button type="button" data-div="five" aria-pressed="${divMode === 'five'}">على 5 سنوات</button>
          <button type="button" data-div="avail" aria-pressed="${divMode === 'avail'}">على السنوات المتوفرة</button>
        </div>
        <label class="tgl"><input type="checkbox" id="wTgl" ${weighted ? 'checked' : ''}> ترجيح المعدل بعدد الساعات</label>
        ${weighted ? '<p class="hint">المقررات بدون ساعات تُحسب بساعة واحدة.</p>' : ''}
        ${mismatch && mode === 'course' ? `<p class="hint">${mismatch} مقرراً درسته في سنة غير سنته الأصلية، وهو محسوب مع سنة المقرر.</p>` : ''}
      </div>
      <div class="ruler">
        ${rows || '<p class="sub">أضف مواد لتظهر معدلات السنوات.</p>'}
        ${rows ? '<div class="rlegend">الخط الرمادي عند 60: حد النجاح</div>' : ''}
      </div>`);
  }

  function renderCourses() {
    const hadFocus = document.activeElement && document.activeElement.id === 'q';
    const caret = hadFocus ? document.activeElement.selectionStart : 0;
    const groups = groupByYear();
    const sm = studyMap();
    const q = norm(query);
    const years = groups.map(g => g.y);
    if (yearFilter !== 'all' && !years.map(String).includes(String(yearFilter))) yearFilter = 'all';

    let html = `<div class="tools">
      <input class="search" id="q" type="search" placeholder="ابحث عن مادة" value="${esc(query)}" aria-label="بحث">
      <div class="chips" role="group" aria-label="تصفية حسب السنة">
        <button type="button" class="chip" data-year="all" aria-pressed="${yearFilter === 'all'}">الكل</button>
        ${years.map(y => `<button type="button" class="chip" data-year="${y}" aria-pressed="${String(yearFilter) === String(y)}">${esc(y === 0 ? 'غير محدد' : YEARS[y - 1] || y)}</button>`).join('')}
      </div></div>`;

    if (!courses.length) {
      html += `<div class="empty"><p>ما في مواد بعد. ارفع ملف CSV، أو الصق الجدول من موقع الجامعة، أو أضف مادة يدوياً.</p>
        <div class="btns">
          <button class="btn primary" type="button" id="emptyUpload">رفع ملف CSV</button>
          <button class="btn primary" type="button" id="emptyPaste">لصق الجدول</button>
          <button class="btn" type="button" id="emptyAdd">إضافة مادة</button>
        </div>
        <p class="privacy">🔒 كل شيء يتم داخل متصفحك فقط: لا تُرسل علاماتك لأي خادم، ولا يُخزَّن شيء على جهازك.</p></div>`;
      setHTML($('viewCourses'), html);
      return;
    }

    let shown = 0;
    groups.forEach(g => {
      if (yearFilter !== 'all' && String(g.y) !== String(yearFilter)) return;
      const list = g.list.filter(c => !q || norm(c.name).includes(q));
      if (!list.length) return;
      shown += list.length;
      const terms = new Map();
      list.forEach(c => { const k = c.ay + '|' + c.sem; if (!terms.has(k)) terms.set(k, []); terms.get(k).push(c); });
      const termList = [...terms.values()].map(l => ({ ay: l[0].ay, sem: l[0].sem, l })).sort(termCmp);
      html += `<section class="year"><div class="yhead"><h2>${esc(yearLabel(g.y))}</h2><span class="ya num">${fmt(g.avg)}</span></div>`;
      termList.forEach(t => {
        html += `<div class="term"><span>${t.ay ? esc(t.ay) + ' · ' : ''}${esc(t.sem)}</span><span class="num">معدل الفصل ${fmt(avg(t.l))}</span></div><div class="list">`;
        t.l.forEach(c => {
          const b = c.f != null ? band(c.f) : null;
          const parts = [];
          if (c.p != null) parts.push('عملي ' + fmtMark(c.p));
          if (c.e != null) parts.push('امتحان ' + fmtMark(c.e));
          if (mode === 'study' && c.cy !== g.y) parts.push('مقرر ' + (YEARS[c.cy - 1] || c.cy));
          if (mode === 'course' && c.ay && sm[c.ay] !== c.cy) parts.push('درسته في السنة ' + (YEARS[sm[c.ay] - 1] || ''));
          if (c.h) parts.push(c.h + ' ساعة');
          if (c.custom) parts.push('مضافة');
          else if (c.edited) parts.push('معدّلة');
          html += `<button type="button" class="row" data-edit="${c.id}"><div><div class="nm">${esc(c.name)}</div>
            <div class="meta num">${esc(parts.join(' · ') || 'تعديل')}</div></div>
            <div class="mark num ${b ? 'b-' + b.key : ''}">${fmtMark(c.f)}</div></button>`;
        });
        html += `</div>`;
      });
      html += `</section>`;
    });
    if (!shown) html += `<div class="empty"><p>ما في مواد مطابقة للبحث.</p></div>`;
    setHTML($('viewCourses'), html);
    if (hadFocus) { const qi = $('q'); qi.focus(); qi.setSelectionRange(caret, caret); }
  }

  function termSeries() {
    const m = new Map();
    courses.filter(c => c.f != null).forEach(c => { const k = c.ay + '|' + c.sem; if (!m.has(k)) m.set(k, []); m.get(k).push(c); });
    return [...m.values()].map(l => ({ ay: l[0].ay, sem: l[0].sem, avg: avg(l), n: l.length })).sort(termCmp);
  }

  function renderChart(series) {
    if (!series.length) return '<p class="note">ما في بيانات كافية.</p>';
    const W = 400, H = 200, pr = 34, pl = 14, pt = 20, pb = 40;
    const lo = Math.min(50, Math.floor(Math.min(...series.map(s => s.avg)) / 10) * 10), hi = 100;
    const y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
    const x = i => series.length === 1 ? (W - pr + pl) / 2 : (W - pr) - i * (W - pr - pl) / (series.length - 1);
    let g = '';
    for (let v = lo; v <= hi; v += 10) {
      const isPass = v === PASS;
      g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="${isPass ? 'var(--g5)' : 'var(--line)'}"${isPass ? ' stroke-dasharray="4 4"' : ''}/>
            <text x="${W - pr + 6}" y="${y(v) + 3.5}" class="num">${v}</text>`;
    }
    const pts = series.map((s, i) => `${x(i)},${y(s.avg)}`).join(' ');
    let dots = '';
    series.forEach((s, i) => {
      const b = band(s.avg);
      const ay = /^\d{4}-\d{4}$/.test(s.ay || '') ? s.ay.slice(2, 4) + '/' + s.ay.slice(7) : '';
      dots += `<circle cx="${x(i)}" cy="${y(s.avg)}" r="4.5" fill="var(--${b.key})" stroke="var(--surface)" stroke-width="2"/>
        <text class="val num" x="${x(i)}" y="${y(s.avg) - 9}" text-anchor="middle">${s.avg.toFixed(1)}</text>
        <text x="${x(i)}" y="${H - 22}" text-anchor="middle">ف${semRank(s.sem)}</text>
        <text x="${x(i)}" y="${H - 9}" text-anchor="middle" class="num">${esc(ay)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="معدل كل فصل دراسي">${g}
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
  }

  function renderStats() {
    const done = courses.filter(c => c.f != null);
    if (!done.length) { setHTML($('viewStats'), '<div class="empty"><p>أضف مواد لتظهر الإحصائيات.</p></div>'); return; }
    const sorted = [...done].sort((a, b) => b.f - a.f);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const failing = done.filter(c => c.f < PASS).length;
    const high = done.filter(c => c.f >= 80).length;
    const series = termSeries();
    const bestTerm = series.length ? [...series].sort((a, b) => b.avg - a.avg)[0] : null;
    const counts = BANDS.map(b => ({ ...b, n: done.filter(c => band(c.f) === b).length }));
    const maxN = Math.max(...counts.map(c => c.n), 1);
    const li = c => `<li><span>${esc(c.name)}</span><span class="mark num b-${band(c.f).key}">${fmtMark(c.f)}</span></li>`;
    const mean = key => { const l = done.filter(c => c[key] != null); return l.length ? l.reduce((s, c) => s + c[key], 0) / l.length : null; };

    setHTML($('viewStats'), `
      <div class="cards">
        <div class="card"><p class="k">أعلى علامة</p><p class="n num">${fmtMark(best.f)}</p><p class="d">${esc(best.name)}</p></div>
        <div class="card"><p class="k">أدنى علامة</p><p class="n num">${fmtMark(worst.f)}</p><p class="d">${esc(worst.name)}</p></div>
        <div class="card"><p class="k">علامات 80 فما فوق</p><p class="n num">${high} <small>من ${done.length}</small></p><p class="d num">${(high / done.length * 100).toFixed(0)}% من المقررات</p></div>
        <div class="card"><p class="k">مقررات تحت ${PASS}</p><p class="n num ${failing ? 'bad' : ''}">${failing}</p><p class="d">${failing ? 'تحتاج إعادة' : 'لا يوجد رسوب'}</p></div>
      </div>
      <div class="panel"><h3>معدل كل فصل</h3>${renderChart(series)}
        ${bestTerm ? `<p class="note">أفضل فصل: ${esc(bestTerm.ay)} · ${esc(bestTerm.sem)} بمعدل <b class="num">${bestTerm.avg.toFixed(2)}</b></p>` : ''}</div>
      <div class="panel"><h3>توزيع التقديرات</h3><div class="dist">
        ${counts.map(c => `<div class="drow b-${c.key}"><span>${c.label}</span><div class="dbar"><i data-w="${c.n / maxN * 100}"></i></div><span class="c num">${c.n}</span></div>`).join('')}
      </div></div>
      <div class="two">
        <div class="panel"><h3>أعلى 5 علامات</h3><ul class="mini">${sorted.slice(0, 5).map(li).join('')}</ul></div>
        <div class="panel"><h3>أدنى 5 علامات</h3><ul class="mini">${[...sorted].reverse().slice(0, 5).map(li).join('')}</ul></div>
      </div>
      <div class="panel"><h3>العملي والامتحان</h3>
        <p class="sm">متوسط علامة العملي (للمواد التي لها عملي): <b class="num">${fmt(mean('p'), 1)}</b><br>
        متوسط علامة الامتحان: <b class="num">${fmt(mean('e'), 1)}</b></p></div>`);
  }

  function render() {
    renderHero(); renderCourses(); renderStats();
    $('viewCourses').hidden = tab !== 'courses';
    $('viewStats').hidden = tab !== 'stats';
    $('tabCourses').setAttribute('aria-selected', tab === 'courses');
    $('tabStats').setAttribute('aria-selected', tab === 'stats');
    $('fab').hidden = tab !== 'courses';
    $('btnExport').hidden = !courses.length;
    $('btnReset').hidden = !snapshot.length;
    $('btnClear').hidden = !courses.length && !snapshot.length;
  }

  let toastT;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }

  /* ---------- نافذة الإضافة والتعديل ---------- */
  function ensureOption(sel, value) {
    if (value && ![...sel.options].some(o => o.value === value)) {
      const o = document.createElement('option'); o.textContent = value; o.value = value; sel.appendChild(o);
    }
  }
  function refreshAyList() {
    const dl = $('ayList');
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    [...new Set(courses.map(c => c.ay).filter(Boolean))].sort().forEach(a => {
      const o = document.createElement('option'); o.value = a; dl.appendChild(o);
    });
  }
  function readForm() {
    const p = num($('fP').value), e = num($('fE').value);
    let f = num($('fF').value);
    if (f == null && (p != null || e != null)) f = (p || 0) + (e || 0);
    return {
      name: $('fName').value.trim(), cy: +$('fCy').value, sem: $('fSem').value,
      ay: $('fAy').value.trim().replace('/', '-'), p, e, f, h: num($('fH').value)
    };
  }
  function updatePreview() {
    const d = readForm(), out = $('prev');
    if (d.f == null || d.f < 0 || d.f > 100) { out.textContent = ''; return; }
    const before = overall(groupByYear());
    const list = courses.filter(c => c !== editing).concat([Object.assign({ id: -1 }, d)]);
    const after = overall(groupByYear(list));
    out.textContent = 'المعدل العام: ' + fmt(before) + '  ←  ' + fmt(after) + '  (إن حفظت)';
  }
  function openEdit(id) {
    editing = id ? courses.find(c => c.id === id) : null;
    delArmed = false; $('btnDel').textContent = 'حذف المادة'; $('btnDel').classList.remove('armed');
    $('err').textContent = '';
    $('dlgTitle').textContent = editing ? 'تعديل المادة' : 'إضافة مادة';
    $('btnDel').hidden = !editing;
    refreshAyList();
    const last = courses[courses.length - 1];
    const c = editing || { name: '', cy: last ? last.cy : 1, ay: last ? last.ay : '', sem: last ? last.sem : 'فصل أول', p: null, e: null, f: null, h: null };
    ensureOption($('fSem'), c.sem);
    $('fName').value = c.name;
    $('fCy').value = c.cy;
    $('fSem').value = c.sem;
    $('fAy').value = c.ay;
    $('fP').value = c.p ?? ''; $('fE').value = c.e ?? ''; $('fF').value = c.f ?? ''; $('fH').value = c.h ?? '';
    finalManual = editing ? (c.f != null && c.f !== (c.p || 0) + (c.e || 0)) : false;
    updatePreview();
    $('dlg').showModal();
    if (!editing) $('fName').focus();
  }
  function autoFinal() {
    if (finalManual) return;
    const p = num($('fP').value), e = num($('fE').value);
    $('fF').value = (p == null && e == null) ? '' : String(Math.round(((p || 0) + (e || 0)) * 100) / 100);
  }
  function saveCourse() {
    const d = readForm();
    const err = m => { $('err').textContent = m; };
    if (!d.name) return err('اكتب اسم المقرر.');
    if (d.f == null) return err('أدخل العلامة النهائية، أو علامتي العملي والامتحان.');
    if (d.f < 0 || d.f > 100 || (d.p != null && d.p < 0) || (d.e != null && d.e < 0)) return err('العلامات لازم تكون بين 0 و100.');
    if (d.h != null && d.h <= 0) return err('عدد الساعات لازم يكون أكبر من صفر.');
    if (d.ay && !/^\d{4}-\d{4}$/.test(d.ay)) return err('اكتب العام بالشكل 2025-2026، أو اتركه فارغاً.');
    const wasEdit = !!editing;
    if (editing) {
      const changed = ['name', 'cy', 'sem', 'ay', 'p', 'e', 'f', 'h'].some(k => editing[k] !== d[k]);
      Object.assign(editing, d);
      if (changed && !editing.custom) editing.edited = true;
    } else {
      addCourse(Object.assign({ custom: true }, d));
    }
    $('dlg').close(); render();
    toast(wasEdit ? 'تم حفظ التعديل وتحدّثت الإحصائيات' : 'تمت إضافة المادة وتحدّثت الإحصائيات');
  }

  /* ---------- الاستيراد والتصدير ---------- */
  function loadText(text) {
    const res = P.parseText(text);
    if (!res.rows.length) return 0;
    courses = []; nextId = 1;
    res.rows.forEach(r => addCourse({ name: r.name, cy: r.cy, p: r.p, e: r.e, f: r.f, h: r.h, ay: r.ac, sem: r.term || 'فصل أول' }));
    snapshot = JSON.parse(JSON.stringify(courses));
    yearFilter = 'all'; query = '';
    render();
    return courses.length;
  }
  function handleFile(file) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) { toast('ملفات Excel غير مدعومة. احفظها CSV أو انسخ الجدول والصقه.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('الملف كبير جداً (الحد 5 ميغابايت).'); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const n = loadText(P.decodeBytes(rd.result));
      toast(n ? 'تم تحميل ' + n + ' مقرراً' : 'ما لقيت مواد في الملف. تأكد أنه جدول العلامات.');
    };
    rd.onerror = () => toast('تعذّرت قراءة الملف.');
    rd.readAsArrayBuffer(file);
  }
  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    const head = ['عام التقديم', 'الفصل الدراسي', 'اسم المقرر', 'سنة المقرر', 'علامة العملي', 'علامة الامتحان', 'العلامة النهائية', 'الساعات'];
    const lines = [head.map(csvCell).join(',')];
    [...courses].sort((a, b) => (a.ay || '').localeCompare(b.ay || '') || semRank(a.sem) - semRank(b.sem))
      .forEach(c => lines.push([c.ay, c.sem, c.name, YEARS[c.cy - 1] || c.cy, c.p, c.e, c.f, c.h].map(csvCell).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'marks.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تنزيل الملف');
  }

  /* ---------- الأحداث ---------- */
  function refocus(sel) { const n = document.querySelector(sel); if (n) n.focus(); }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('button, input#wTgl'); if (!t) return;
    if (t.dataset.mode) { mode = t.dataset.mode; render(); refocus('[data-mode="' + mode + '"]'); }
    else if (t.dataset.div) { divMode = t.dataset.div; render(); refocus('[data-div="' + divMode + '"]'); }
    else if (t.id === 'wTgl') { weighted = t.checked; render(); refocus('#wTgl'); }
    else if (t.dataset.year) { yearFilter = t.dataset.year; render(); }
    else if (t.dataset.edit) { openEdit(+t.dataset.edit); }
    else if (t.id === 'fab' || t.id === 'emptyAdd') { openEdit(null); }
    else if (t.id === 'emptyUpload') { $('file').click(); }
    else if (t.id === 'emptyPaste') { openPaste(); }
  });
  $('tabCourses').onclick = () => { tab = 'courses'; render(); };
  $('tabStats').onclick = () => { tab = 'stats'; render(); };
  $('btnUpload').onclick = () => $('file').click();
  $('file').onchange = e => { handleFile(e.target.files[0]); e.target.value = ''; };
  $('btnExport').onclick = exportCsv;

  document.addEventListener('input', ev => {
    const id = ev.target.id;
    if (id === 'q') { query = ev.target.value; renderCourses(); }
    else if (id === 'fP' || id === 'fE') { autoFinal(); updatePreview(); }
    else if (id === 'fF') { finalManual = ev.target.value.trim() !== ''; if (!finalManual) autoFinal(); updatePreview(); }
    else if (ev.target.closest && ev.target.closest('#form')) updatePreview();
  });
  $('form').addEventListener('change', updatePreview);
  $('form').addEventListener('submit', ev => { ev.preventDefault(); saveCourse(); });
  $('btnCancel').onclick = () => $('dlg').close();
  $('dlg').addEventListener('click', ev => { if (ev.target === $('dlg')) $('dlg').close(); });
  $('btnDel').onclick = () => {
    if (!delArmed) { delArmed = true; $('btnDel').textContent = 'اضغط مرة ثانية للتأكيد'; $('btnDel').classList.add('armed'); return; }
    courses = courses.filter(c => c !== editing); $('dlg').close(); render(); toast('تم حذف المادة وتحدّثت الإحصائيات');
  };

  function openPaste() {
    $('pText').value = ''; $('perr').textContent = '';
    $('pdlg').showModal(); $('pText').focus();
  }
  $('btnPaste').onclick = openPaste;
  $('pCancel').onclick = () => $('pdlg').close();
  $('pdlg').addEventListener('click', ev => { if (ev.target === $('pdlg')) $('pdlg').close(); });
  $('pform').addEventListener('submit', ev => {
    ev.preventDefault();
    const text = $('pText').value;
    if (!text.trim()) { $('perr').textContent = 'الصق الجدول أولاً.'; return; }
    const n = loadText(text);
    if (!n) { $('perr').textContent = 'ما لقيت علامات صالحة. تأكد أنك نسخت الجدول كاملاً.'; return; }
    $('pText').value = '';
    $('pdlg').close(); toast('تم تحميل ' + n + ' مقرراً');
  });

  $('btnReset').onclick = () => {
    courses = JSON.parse(JSON.stringify(snapshot));
    nextId = courses.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    render(); toast('تمت إعادة البيانات الأصلية');
  };
  $('btnClear').onclick = () => {
    const b = $('btnClear');
    if (!clearArmed) {
      clearArmed = true; b.textContent = 'اضغط مرة ثانية للتأكيد'; b.classList.add('armed');
      clearT = setTimeout(() => { clearArmed = false; b.textContent = 'مسح الكل'; b.classList.remove('armed'); }, 4000);
      return;
    }
    clearTimeout(clearT); clearArmed = false; b.textContent = 'مسح الكل'; b.classList.remove('armed');
    courses = []; snapshot = []; nextId = 1; yearFilter = 'all'; query = '';
    render(); toast('تم مسح كل البيانات من الصفحة');
  };

  $('fCy').innerHTML = YEARS.map((y, i) => `<option value="${i + 1}">${y}</option>`).join('');
  render();
})();
