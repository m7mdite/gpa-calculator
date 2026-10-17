(function (root) {
  'use strict';

  function toDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseNum(s) {
    var t = toDigits(s).trim().replace(',', '.');
    if (t === '') return null;
    var v = Number(t);
    return isFinite(v) ? v : null;
  }

  var YEAR_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];
  var YEAR_KEYS = {};
  YEAR_NAMES.forEach(function (n, i) { YEAR_KEYS[norm(n).replace(/^ال/, '')] = i + 1; });

  function yearNum(s) {
    var n = norm(s).replace(/^ال/, '');
    if (YEAR_KEYS[n]) return YEAR_KEYS[n];
    var d = toDigits(n);
    return /^[1-6]$/.test(d) ? Number(d) : 0;
  }

  // "20222021" -> "2021-2022"
  function acLabel(s) {
    var t = toDigits(s).trim();
    var m = /^(\d{4})(\d{4})$/.exec(t);
    if (m) {
      var a = Number(m[1]), b = Number(m[2]);
      return Math.min(a, b) + '-' + Math.max(a, b);
    }
    var m2 = /^(\d{4})\s*[-\/]\s*(\d{4})$/.exec(t);
    if (m2) return m2[1] + '-' + m2[2];
    return t;
  }

  function splitLine(line, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
        } else { cur += ch; }
      } else if (ch === '"' && cur === '') {
        q = true;
      } else if (ch === d) {
        out.push(cur); cur = '';
      } else { cur += ch; }
    }
    out.push(cur);
    return out;
  }

  function detectDelimiter(lines) {
    var sample = lines.slice(0, 8).join('\n');
    if (sample.indexOf('\t') !== -1) return '\t';
    var sc = (sample.match(/;/g) || []).length;
    var cm = (sample.match(/,/g) || []).length;
    return sc > cm ? ';' : ',';
  }

  var GROUP_RE = /عام\s+التقديم\s*:\s*([0-9٠-٩۰-۹]+)\s*[,،]\s*الفصل\s+الدراسي\s*:\s*(.+)$/;

  function parseText(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/)
      .filter(function (l) { return l.trim() !== ''; });
    var rows = [], skipped = 0;
    if (!lines.length) return { rows: rows, skipped: 0 };

    var d = detectDelimiter(lines);
    var ctx = { ac: '', term: '' };
    var map = null;
    var NAME_KEY = norm('اسم المقرر');

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var g = GROUP_RE.exec(line.replace(/\t/g, ' ').trim());
      if (g) { ctx = { ac: acLabel(g[1]), term: g[2].trim() }; continue; }

      var cells = splitLine(line, d).map(function (s) { return s.trim(); });
      var nc = cells.map(norm);

      if (nc.some(function (c) { return c.indexOf(NAME_KEY) !== -1; })) {
        var find = function (k) { return nc.findIndex(function (c) { return c.indexOf(norm(k)) !== -1; }); };
        map = {
          ac: find('عام التقديم'),
          term: find('الفصل الدراسي'),
          name: find('اسم المقرر'),
          cy: find('سنة المقرر'),
          p: find('علامة العملي'),
          e: find('علامة الامتحان'),
          f: find('العلامة النهائية'),
          h: find('الساعات')
        };
        continue;
      }

      var m = map;
      if (!m) {
        m = cells.length >= 7
          ? { ac: 0, term: 1, name: 2, cy: 3, p: 4, e: 5, f: 6, h: -1 }
          : { ac: -1, term: -1, name: 0, cy: 1, p: 2, e: 3, f: 4, h: -1 };
      }
      var get = function (i) { return i >= 0 && i < cells.length ? cells[i] : ''; };

      var name = get(m.name);
      var cy = yearNum(get(m.cy));
      var p = parseNum(get(m.p));
      var e = parseNum(get(m.e));
      var f = parseNum(get(m.f));
      var h = m.h >= 0 ? parseNum(get(m.h)) : null;

      if (!name || !cy || (p === null && e === null && f === null)) { skipped++; continue; }
      if (f === null) f = (p || 0) + (e || 0);

      var ac = m.ac >= 0 ? acLabel(get(m.ac)) : ctx.ac;
      var term = m.term >= 0 ? get(m.term) : ctx.term;
      rows.push({ ac: ac || ctx.ac, term: term || ctx.term, name: name, cy: cy, p: p, e: e, f: f, h: h });
    }
    return { rows: rows, skipped: skipped };
  }

  function decodeBytes(buf) {
    var u8 = new Uint8Array(buf);
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(u8);
    } catch (err) {
      return new TextDecoder('windows-1256').decode(u8);
    }
  }

  var api = { parseText: parseText, decodeBytes: decodeBytes, norm: norm, acLabel: acLabel, yearNum: yearNum, parseNum: parseNum };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; } else { root.Parser = api; }
})(typeof window !== 'undefined' ? window : globalThis);
