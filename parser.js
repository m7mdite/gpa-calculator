(function (root) {
  'use strict';

  function toDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseNum(s) {
    var t = toDigits(s).trim().replace(',', '.');
    if (t === '') return null;
    var v = Number(t);
    return isFinite(v) ? v : null;
  }

  var YEAR_KEYS = {};
  YEAR_KEYS[norm('\u0627\u0644\u0623\u0648\u0644\u0649').replace(/^\u0627\u0644/, '')] = 1;
  YEAR_KEYS[norm('\u0627\u0644\u062B\u0627\u0646\u064A\u0629').replace(/^\u0627\u0644/, '')] = 2;
  YEAR_KEYS[norm('\u0627\u0644\u062B\u0627\u0644\u062B\u0629').replace(/^\u0627\u0644/, '')] = 3;
  YEAR_KEYS[norm('\u0627\u0644\u0631\u0627\u0628\u0639\u0629').replace(/^\u0627\u0644/, '')] = 4;
  YEAR_KEYS[norm('\u0627\u0644\u062E\u0627\u0645\u0633\u0629').replace(/^\u0627\u0644/, '')] = 5;

  function yearNum(s) {
    var n = norm(s).replace(/^\u0627\u0644/, '');
    if (YEAR_KEYS[n]) return YEAR_KEYS[n];
    var d = toDigits(n);
    return /^[1-5]$/.test(d) ? Number(d) : 0;
  }

  // "20222021" -> "2021-2022"
  function acLabel(s) {
    var t = toDigits(s).trim();
    var m = /^(\d{4})(\d{4})$/.exec(t);
    if (m) {
      var a = Number(m[1]), b = Number(m[2]);
      return Math.min(a, b) + '-' + Math.max(a, b);
    }
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

  var GROUP_RE = /\u0639\u0627\u0645 \u0627\u0644\u062A\u0642\u062F\u064A\u0645\s*:\s*([0-9\u0660-\u0669\u06F0-\u06F9]+)\s*[,\u060C]\s*\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\s*:\s*(.+)$/;

  function parseText(text) {
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
      .filter(function (l) { return l.trim() !== ''; });
    var rows = [], skipped = 0;
    if (!lines.length) return { rows: rows, skipped: 0 };

    var d = detectDelimiter(lines);
    var ctx = { ac: '', term: '' };
    var map = null;

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var g = GROUP_RE.exec(line.replace(/\t/g, ' ').trim());
      if (g) { ctx = { ac: acLabel(g[1]), term: g[2].trim() }; continue; }

      var cells = splitLine(line, d).map(function (s) { return s.trim(); });
      var nc = cells.map(norm);

      if (nc.some(function (c) { return c.indexOf(norm('\u0627\u0633\u0645 \u0627\u0644\u0645\u0642\u0631\u0631')) !== -1; })) {
        var find = function (k) { return nc.findIndex(function (c) { return c.indexOf(norm(k)) !== -1; }); };
        map = {
          ac: find('\u0639\u0627\u0645 \u0627\u0644\u062A\u0642\u062F\u064A\u0645'),
          term: find('\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062F\u0631\u0627\u0633\u064A'),
          name: find('\u0627\u0633\u0645 \u0627\u0644\u0645\u0642\u0631\u0631'),
          cy: find('\u0633\u0646\u0629 \u0627\u0644\u0645\u0642\u0631\u0631'),
          p: find('\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u064A'),
          e: find('\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0627\u0645\u062A\u062D\u0627\u0646'),
          f: find('\u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629')
        };
        continue;
      }

      var m = map;
      if (!m) {
        m = cells.length >= 7
          ? { ac: 0, term: 1, name: 2, cy: 3, p: 4, e: 5, f: 6 }
          : { ac: -1, term: -1, name: 0, cy: 1, p: 2, e: 3, f: 4 };
      }
      var get = function (i) { return i >= 0 && i < cells.length ? cells[i] : ''; };

      var name = get(m.name);
      var cy = yearNum(get(m.cy));
      var p = parseNum(get(m.p));
      var e = parseNum(get(m.e));
      var f = parseNum(get(m.f));

      if (!name || !cy || (p === null && e === null && f === null)) { skipped++; continue; }
      if (f === null) f = (p || 0) + (e || 0);

      rows.push({
        ac: m.ac >= 0 ? acLabel(get(m.ac)) : ctx.ac,
        term: m.term >= 0 ? get(m.term) : ctx.term,
        name: name, cy: cy, p: p, e: e, f: f
      });
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
