/* 정리 엔진. 이 파일에는 «무엇을 고칠지»가 적혀 있지 않습니다.
 * 고치는 규칙(처방)은 rules/<파일이름>.json 에만 있고, 여기서는 그 파일에 적힌 «종류»대로 실행하기만 합니다.
 * 계산은 전부 브라우저 안에서 하고, 네트워크 통신은 없습니다. */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- 작은 도구
  function isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function validYMD(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function iso(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function serialToIso(v) {
    var t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function show(v) { return v === null || v === undefined ? '' : String(v); }
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (isBlank(v)) return NaN;
    return Number(String(v).trim().replace(',', '.'));
  }

  // 날짜 글자 읽기 → {iso} | {ambiguous:'까닭'} | null(날짜 모양이 아님)
  function readDateText(raw) {
    var s = String(raw).normalize('NFKC').trim(), m, y, mo, d;
    if ((m = s.match(/^(\d{4})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{1,2})$/)) || (m = s.match(/^(\d{4})(\d{2})(\d{2})$/)) ||
        (m = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/))) {
      y = +m[1]; mo = +m[2]; d = +m[3];
      return validYMD(y, mo, d) ? { iso: iso(y, mo, d) } : { ambiguous: '존재하지 않는 날짜라 고치지 않음' };
    }
    if ((m = s.match(/^(\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/))) {
      y = 2000 + +m[1]; mo = +m[2]; d = +m[3];
      return validYMD(y, mo, d) ? { iso: iso(y, mo, d) } : { ambiguous: '존재하지 않는 날짜라 고치지 않음' };
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
      var a = +m[1], b = +m[2]; y = +m[3];
      if (a === b) return validYMD(y, a, b) ? { iso: iso(y, a, b) } : { ambiguous: '존재하지 않는 날짜라 고치지 않음' };
      if (a > 12 && b <= 12) return validYMD(y, b, a) ? { iso: iso(y, b, a) } : { ambiguous: '존재하지 않는 날짜라 고치지 않음' };
      if (b > 12 && a <= 12) return validYMD(y, a, b) ? { iso: iso(y, a, b) } : { ambiguous: '존재하지 않는 날짜라 고치지 않음' };
      return { ambiguous: '앞의 두 수가 일·월 어느 쪽인지 알 수 없어 고치지 않음' };
    }
    if (/^\d{1,2}\s*[\/.-]\s*\d{1,2}\s*[\/.-]\s*\d{1,2}$/.test(s)) return { ambiguous: '연도가 두 자리라 뜻이 갈려 고치지 않음' };
    return null;
  }

  // 시각 글자 읽기 → {out:'HH:MM'} | {flag:'까닭'} | null(시각 모양이 아니거나 이미 HH:MM)
  function readTimeText(raw, ambig) {
    var s = String(raw).normalize('NFKC').trim(), m, h, mi = 0, ap = null;
    if (/^\d{2}:\d{2}$/.test(s)) { h = +s.slice(0, 2); mi = +s.slice(3); if (h < 24 && mi < 60) return String(raw) === s ? null : { out: s }; } // 이미 HH:MM 이면 그대로, 전각·공백만 다르면 모양만 맞춤
    if ((m = s.match(/^(오전|오후|am|pm)\s*(.*)$/i))) { ap = m[1].toLowerCase(); s = m[2]; }
    else if ((m = s.match(/^(.*?)\s*(오전|오후|am|pm)$/i))) { ap = m[2].toLowerCase(); s = m[1]; }
    if ((m = s.match(/^(\d{1,2})\s*[:.]\s*(\d{2})$/))) { h = +m[1]; mi = +m[2]; }
    else if ((m = s.match(/^(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분?)?$/))) { h = +m[1]; mi = m[2] ? +m[2] : 0; }
    else if ((m = s.match(/^(\d{2})(\d{2})$/))) { h = +m[1]; mi = +m[2]; }
    else return null;
    if (mi >= 60) return { flag: '분이 60 이상이라 읽을 수 없어 고치지 않음' };
    if (ap) {
      if (h < 1 || h > 12) return { flag: '오전·오후와 시가 맞지 않아 고치지 않음' };
      h = (h % 12) + (/^(오후|pm)$/.test(ap) ? 12 : 0);
    } else {
      if (h >= 30) return { flag: '시가 30 이상이라 읽을 수 없어 고치지 않음' };
      if (h >= 24) h -= 24;
      else if (ambig && h >= ambig[0] && h <= ambig[1]) return { flag: '오전·오후 글자 없이 적어 뜻이 갈려 고치지 않음' };
    }
    return { out: pad2(h) + ':' + pad2(mi) };
  }

  // 시간 값 글자 읽기 → {num} | {flag} | null
  function readHoursText(raw) {
    var s = String(raw).normalize('NFKC').trim(), m, x;
    if ((m = s.match(/^(-?\d+)\s*,\s*(\d+)$/))) s = m[1] + '.' + m[2];
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      if (/^\d+\.\d{2}$/.test(s) && +s.split('.')[1] < 60) return { flag: '«' + s + '» 이(가) 시간인지 분인지 뜻이 갈려 고치지 않음' };
      return { num: Number(s) };
    }
    if ((m = s.match(/^(\d+)\s*시간\s*(\d+)\s*분$/))) return { num: Math.round((+m[1] + m[2] / 60) * 100) / 100 };
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:시간|h|hr|hrs)$/i))) return { num: Number(m[1]) };
    if ((m = s.match(/^(\d+)\s*분$/))) return { num: Math.round(m[1] / 60 * 100) / 100 };
    if ((m = s.match(/^(\d{1,2}):(\d{2})$/))) {
      if (+m[2] >= 60) return { flag: '분이 60 이상이라 고치지 않음' };
      x = +m[1] + m[2] / 60; return { num: Math.round(x * 100) / 100 };
    }
    return null;
  }

  function colsOf(c) { return Array.isArray(c) ? c : (c === undefined ? [] : [c]); }
  function emptyish(v) { return isBlank(v) || toNum(v) === 0; }
  function dayKind(isoDate, holidays) {
    var p = isoDate.split('-'), w = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    if (w === 0 || holidays[isoDate]) return '휴일';
    return w === 6 ? '토' : '평일';
  }

  // ---------------------------------------------------------------- 시각으로 근로시간 다시 계산 (기획서 6-1)
  function mins(s) { var q = String(s).split(':'); return +q[0] * 60 + +q[1]; }
  function overlapMin(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
  function classifyDay(dtype, start, end, soj, brkIn, P) {
    var s = Math.max(start, P.recStart), B, i, m, left, t;
    function isNight(x) { t = x % 1440; return t >= P.night[0] || t < P.night[1]; }
    if (brkIn !== null) B = brkIn;
    else if (P.wk && P.wk.days[dtype]) { B = 0; var gr = end - s; for (i = 0; i < P.wk.cut.length; i++) if (gr >= P.wk.cut[i][0]) { B = P.wk.cut[i][1]; break; } if (B === null) return { skip: true, B: 0, hours: {} }; } // 토·휴일: 근무 길이로 휴게
    else if (soj === 0) B = 0;
    else {
      B = 0;
      for (i = 0; i < 5; i++) { var nb = overlapMin(s, Math.min(end, s + soj + B), P.lunch[0], P.lunch[1]); if (nb === B) break; B = nb; }
      if (B === 0) {
        var winEnd = Math.min(end, s + soj), hasNight = false;
        for (m = s; m < winEnd; m++) if (isNight(m)) { hasNight = true; break; }
        if (hasNight) { var gross = winEnd - s; for (i = 0; i < P.legal.length; i++) if (gross >= P.legal[i][0]) { B = P.legal[i][1]; break; } }
      }
    }
    var brk = {}; left = B;
    for (m = s; m < end; m++) if (left && P.lunch[0] <= m % 1440 && m % 1440 < P.lunch[1]) { brk[m] = 1; left--; }
    if (left) for (m = s; m < end; m++) if (left && P.nb[0] <= m % 1440 && m % 1440 < P.nb[1]) { brk[m] = 1; left--; }
    var res = {}, cum = 0;
    for (m = s; m < end; m++) {
      if (brk[m]) continue;
      cum++;
      var key = P.tbl[dtype][cum <= soj ? '이내' : '초과'][isNight(m) ? '밤' : '낮'];
      if (key) res[key] = (res[key] || 0) + 1;
    }
    return { hours: res, B: B };
  }

  // ---------------------------------------------------------------- 처방 파일 검사
  var FIX = { '이름통일': 1, '날짜한모양': 1, '숫자자리통일': 1, '팀따라본부': 1, '시각한모양': 1, '시간값숫자로': 1, '위칸채우기': 1 };
  var POST = { '같은날짜사번겹침표시': 1 };
  var MARK = { '0인데수당': 1, '쉬는날기록': 1, '튀는값표시': 1, '토일칸구분': 1, '이름오타표시': 1, '빈칸표시': 1, '시각순서표시': 1, '시각으로다시계산': 1, '반차시각비교': 1, '사번오타표시': 1, '같은달팀바뀜표시': 1 };
  function checkRules(doc) {
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.rules) || !doc.rules.length) return '처방 파일에 rules 목록이 없습니다.';
    for (var i = 0; i < doc.rules.length; i++) {
      var r = doc.rules[i];
      if (!r.id || !(FIX[r.종류] || MARK[r.종류] || POST[r.종류] || r.종류 === '같은줄하나만')) return '처방 ' + (r.id || (i + 1) + '번째') + ' 의 «종류»를 알 수 없습니다.';
    }
    return '';
  }

  // ---------------------------------------------------------------- 정리 실행
  function run(aoa, doc) {
    var header = (aoa[0] || []).map(function (h) { return show(h).trim(); });
    var n = header.length, col = {};
    header.forEach(function (h, i) { if (h && col[h] === undefined) col[h] = i; });
    var data = aoa.slice(1), len = data.length;
    var rows = new Array(len), raws = new Array(len), flagsOf = new Array(len), headerRepeat = new Array(len), inert = new Array(len);
    var changes = [], flags = [], skipped = {}, stat = {};
    var i, j;
    doc.rules.forEach(function (r) { stat[r.id] = { changed: 0, flagged: 0, excluded: 0 }; });

    for (i = 0; i < len; i++) {
      var r0 = data[i] || [], vals = new Array(n), same = 0;
      for (j = 0; j < n; j++) {
        var c = r0[j]; vals[j] = c === undefined ? null : c;
        if (typeof vals[j] === 'string' && vals[j].trim() === header[j] && header[j]) same++;
      }
      rows[i] = vals; raws[i] = vals.slice(); flagsOf[i] = []; headerRepeat[i] = same >= 3; // 머리글이 다시 적힌 줄
      // 뜻 없는 줄(머리글 반복·빈 줄·합계 줄): 빈칸·위칸 처방은 이런 줄을 건너뛴다
      inert[i] = headerRepeat[i] || vals.every(isBlank) || vals.some(function (x) { return typeof x === 'string' && x.trim() === '합계'; });
    }
    function change(i, c, from, to, rule) {
      rows[i][col[c]] = to;
      changes.push({ line: i + 2, col: c, from: from, to: to, rule: rule.id, why: rule.why || '' });
      stat[rule.id].changed++;
    }
    function flag(i, c, val, reason, rule) {
      flagsOf[i].push(reason);
      flags.push({ line: i + 2, col: c, val: val, rule: rule.id, reason: reason + (rule.why ? ' (' + rule.why + ')' : '') });
      stat[rule.id].flagged++;
    }
    function missingCols(rule, names) {
      var miss = names.filter(function (x) { return col[x] === undefined; });
      if (miss.length) { skipped[rule.id] = '이 파일에 «' + miss.join('», «') + '» 칸이 없어 건너뜀'; return true; }
      return false;
    }
    // 오타로 알려 준 이름은 이름통일이 «표에 없음»으로 또 표시하지 않는다
    var typoOf = {};
    doc.rules.forEach(function (r) { if (r.종류 === '이름오타표시') colsOf(r.칸).forEach(function (cn) { typoOf[cn] = Object.assign(typoOf[cn] || {}, r.오타 || {}); }); });

    function apply(rule) {
      var kind = rule.종류, c, idx, cs, v;
      if (kind === '이름통일') {
        c = rule.칸; idx = col[c];
        if (missingCols(rule, [c])) return;
        var official = {}, alias = {}, typos = typoOf[c] || {};
        (rule.정식이름 || []).forEach(function (s) { official[s] = 1; });
        var table = rule.다르게적은것 || {};
        Object.keys(table).forEach(function (std) { official[std] = 1; table[std].forEach(function (a) { alias[a] = std; }); });
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          v = rows[i][idx];
          if (typeof v !== 'string' || isBlank(v)) continue;
          var t = v.trim(), to = null;
          if (Object.prototype.hasOwnProperty.call(alias, t)) to = alias[t];
          else if (official[t]) to = t;
          if (to === null) { if (!Object.prototype.hasOwnProperty.call(typos, t)) flag(i, c, v, '«' + t + '» 은(는) 처방 표에 없는 이름이라 고치지 않음', rule); }
          else if (to !== v) change(i, c, v, to, rule);
        }
      } else if (kind === '날짜한모양') {
        c = rule.칸; idx = col[c];
        if (missingCols(rule, [c])) return;
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          var dv = rows[i][idx];
          if (typeof dv === 'number') {
            if (dv > 20000 && dv < 80000) rows[i][idx] = serialToIso(dv); // 엑셀 날짜값: 같은 날짜, 보이는 모양만 통일
            continue;
          }
          if (typeof dv !== 'string' || isBlank(dv)) continue;
          var rd = readDateText(dv);
          if (!rd) continue;
          if (rd.iso) { if (rd.iso !== dv) change(i, c, dv, rd.iso, rule); }
          else flag(i, c, dv, rd.ambiguous, rule);
        }
      } else if (kind === '숫자자리통일') {
        c = rule.칸; idx = col[c];
        if (missingCols(rule, [c])) return;
        var erase = rule.지울글자 || [], digits = rule.자리수 || 9;
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          v = rows[i][idx];
          if (typeof v !== 'string' || isBlank(v)) continue;
          var sv = v.normalize('NFKC');
          erase.forEach(function (ch) { sv = sv.split(ch).join(''); });
          if (/^\d+$/.test(sv) && sv.length === digits) { if (sv !== v) change(i, c, v, sv, rule); }
          else flag(i, c, v, '«' + v + '» 은(는) 지울 글자를 지워도 ' + digits + '자리 숫자가 아니라 고치지 않음', rule);
        }
      } else if (kind === '팀따라본부') {
        var hq = rule.칸, by = rule.기준칸;
        if (missingCols(rule, [hq, by])) return;
        var map = rule.팀본부표 || {};
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          var tv = rows[i][col[by]], hv = rows[i][col[hq]];
          if (typeof tv !== 'string') continue;
          if (isBlank(hv) && !rule.빈칸도채움) continue;
          if (!isBlank(hv) && typeof hv !== 'string') continue;
          var want = map[tv.trim()];
          if (want && (isBlank(hv) || hv.trim() !== want)) change(i, hq, hv, want, rule);
        }
      } else if (kind === '시각한모양') {
        cs = colsOf(rule.칸);
        if (missingCols(rule, cs)) return;
        cs.forEach(function (cn) {
          var amb = (rule.오전오후글자없으면뜻이갈리는시 || {})[cn] || null;
          for (i = 0; i < len; i++) {
            if (headerRepeat[i]) continue;
            v = rows[i][col[cn]];
            if (typeof v !== 'string' || isBlank(v)) continue;
            var rt = readTimeText(v, amb);
            if (!rt) continue;
            if (rt.out) { if (rt.out !== v) change(i, cn, v, rt.out, rule); }
            else flag(i, cn, v, rt.flag, rule);
          }
        });
      } else if (kind === '시간값숫자로') {
        cs = colsOf(rule.칸);
        if (missingCols(rule, cs)) return;
        cs.forEach(function (cn) {
          for (i = 0; i < len; i++) {
            if (headerRepeat[i]) continue;
            v = rows[i][col[cn]];
            if (typeof v !== 'string' || isBlank(v)) continue;
            var rh = readHoursText(v);
            if (!rh) continue;
            if (rh.flag) flag(i, cn, v, rh.flag, rule); else change(i, cn, v, rh.num, rule);
          }
        });
      } else if (kind === '0인데수당') {
        var pay = col[rule.수당칸];
        if (missingCols(rule, [rule.수당칸])) return;
        var hourCols = (rule.시간칸 || []).filter(function (h) { return col[h] !== undefined; });
        var zeroSets = rule['0으로보는것'] || {};
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          var p = toNum(rows[i][pay]);
          if (!(p > 0)) continue;
          var why0 = [];
          Object.keys(zeroSets).forEach(function (cn) {
            if (col[cn] !== undefined && zeroSets[cn].indexOf(show(rows[i][col[cn]]).trim()) >= 0) why0.push(cn + ' ' + show(rows[i][col[cn]]).trim());
          });
          if (hourCols.length && hourCols.every(function (h) { return emptyish(rows[i][col[h]]); })) why0.push('시간 칸이 모두 0');
          if (why0.length) flag(i, rule.수당칸, rows[i][pay], '수당이 0보다 큰데 ' + why0.join(', '), rule);
        }
      } else if (kind === '쉬는날기록') {
        var cond = rule.조건 || {}, must = rule.비어야할칸 || [];
        if (missingCols(rule, [cond.칸].concat(must))) return;
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          var lv = show(rows[i][col[cond.칸]]).trim();
          if ((cond.값 || []).indexOf(lv) < 0) continue;
          var filled = must.filter(function (cn) { return !emptyish(rows[i][col[cn]]); });
          if (filled.length) flag(i, filled[0], rows[i][col[filled[0]]], cond.칸 + ' «' + lv + '» 인데 ' + filled.join('·') + ' 에 값이 있음', rule);
        }
      } else if (kind === '튀는값표시') {
        (rule.검사 || []).forEach(function (chk) {
          cs = colsOf(chk.칸);
          if (missingCols(rule, cs)) return;
          cs.forEach(function (cn) {
            for (i = 0; i < len; i++) {
              if (headerRepeat[i]) continue;
              v = rows[i][col[cn]];
              if (chk.종류 === '범위') {
                var x = typeof v === 'number' ? v : (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
                if (isFinite(x) && (x < chk.최소 || x > chk.최대)) flag(i, cn, v, '값 ' + v + ' 이(가) ' + chk.최소 + '~' + chk.최대 + ' 밖이라 튀는 값', rule);
              } else if (chk.종류 === '연도') {
                var my = typeof v === 'string' && v.match(/^(\d{4})-\d{2}-\d{2}$/);
                if (my && chk.허용.indexOf(+my[1]) < 0) flag(i, cn, v, '연도 ' + my[1] + ' 이(가) ' + chk.허용.join('·') + ' 밖이라 튀는 값', rule);
              } else if (chk.종류 === '사번연월') {
                if (typeof v === 'string' && /^\d{9}$/.test(v)) { var mm = +v.slice(4, 6); if (mm < 1 || mm > 12) flag(i, cn, v, '사번의 연월(' + v.slice(0, 6) + ')에서 월이 1~12가 아니라 튀는 값', rule); }
              }
            }
          });
        });
      } else if (kind === '토일칸구분') {
        c = rule.칸;
        var sat = rule.토요일에는비어야 || [], sun = rule['일요일·공휴일에는비어야'] || [];
        if (missingCols(rule, [c].concat(sat, sun))) return;
        var hol = {}; (rule.공휴일 || []).forEach(function (d) { hol[d] = 1; });
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          v = rows[i][col[c]];
          if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
          var dk = dayKind(v, hol), list = dk === '토' ? sat : (dk === '휴일' ? sun : []);
          var bad = list.filter(function (cn) { return !emptyish(rows[i][col[cn]]); });
          if (bad.length) flag(i, bad[0], rows[i][col[bad[0]]], (dk === '토' ? '토요일' : '일요일·공휴일') + ' 근무인데 ' + bad.join('·') + ' 에 값이 있음', rule);
        }
      } else if (kind === '위칸채우기') {
        cs = colsOf(rule.칸);
        var need = colsOf(rule.함께있어야하는칸);
        if (missingCols(rule, cs.concat(need))) return;
        var carry = null;
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          var vs = cs.map(function (cn) { return rows[i][col[cn]]; });
          if (vs.every(function (x) { return !isBlank(x); })) { carry = vs.slice(); continue; }
          if (!vs.every(isBlank)) continue;
          if (need.some(function (cn) { return isBlank(rows[i][col[cn]]); })) continue;
          if (rule.방식 === '표시') { flag(i, cs[0], '', '« ' + cs.join('·') + ' » 이(가) 모두 비어 있음(병합 셀로 보임)', rule); continue; }
          if (!carry) continue;
          cs.forEach(function (cn, k) { change(i, cn, rows[i][col[cn]], carry[k], rule); });
        }
      } else if (kind === '빈칸표시') {
        var always = colsOf(rule.칸), punch = colsOf(rule.시각칸), okc = rule.빈칸이어도되는경우 || {};
        if (missingCols(rule, always.concat(punch, Object.keys(okc)))) return;
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          always.forEach(function (cn) { if (isBlank(rows[i][col[cn]])) flag(i, cn, rows[i][col[cn]], '« ' + cn + ' » 칸이 비어 있음', rule); });
          var exempt = Object.keys(okc).some(function (cn) { return okc[cn].indexOf(show(rows[i][col[cn]]).trim()) >= 0; });
          if (!exempt) punch.forEach(function (cn) { if (isBlank(rows[i][col[cn]])) flag(i, cn, rows[i][col[cn]], '« ' + cn + ' » 칸이 비어 있음(쉬는 날이 아님)', rule); });
        }
      } else if (kind === '시각순서표시') {
        var inC = rule.출근칸, outC = rule.퇴근칸, ng = rule.야간으로보는경우 || {};
        if (missingCols(rule, [inC, outC])) return;
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          var a = rows[i][col[inC]], b = rows[i][col[outC]];
          if (typeof a !== 'string' || typeof b !== 'string' || !/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) continue;
          if (a <= b) continue;
          if (ng.자정넘김퇴근이이전 && b <= ng.자정넘김퇴근이이전) continue; // 자정을 넘겨 퇴근한 늦은 퇴근
          if (ng.출근이이후 && ng.퇴근이이전 && a >= ng.출근이이후 && b <= ng.퇴근이이전) continue; // 야간 근무: 다음 날 퇴근
          flag(i, outC, b, '출근(' + a + ')이 퇴근(' + b + ')보다 늦음', rule);
        }
      } else if (kind === '시각으로다시계산') {
        var dC = rule.날짜칸, inC2 = rule.출근칸, outC2 = rule.퇴근칸, brC = rule.휴게칸, lvC = rule.휴가칸, fmC = rule.형태칸, shC = rule.근무제칸, stC = rule.근태구분칸;
        var hc = colsOf(rule.시간칸);
        if (missingCols(rule, [dC, inC2, outC2, brC, lvC, fmC, shC, stC].concat(hc))) return;
        var hr = doc.rules.filter(function (x) { return x.id === rule.공휴일처방; })[0], hol2 = {};
        ((hr && hr.공휴일) || []).forEach(function (d) { hol2[d] = 1; });
        var P = { recStart: mins(rule.인정시작), lunch: [mins(rule.점심[0]), mins(rule.점심[1])], night: [mins(rule.야간[0]), mins(rule.야간[1])],
          nb: [mins(rule.야간휴게시작[0]), mins(rule.야간휴게시작[1])], tbl: rule.구분표,
          legal: (rule.법정휴게 || []).map(function (x) { return [x.이상 * 60, x.분]; }).sort(function (x, y) { return y[0] - x[0]; }) };
        if (rule.주말휴게) { P.wk = { days: {}, cut: (rule.주말휴게.구간 || []).map(function (x) { return [x.이상 * 60, x.분 === undefined || x.분 === null ? null : x.분]; }).sort(function (x, y) { return y[0] - x[0]; }) }; (rule.주말휴게.적용 || []).forEach(function (x) { P.wk.days[x] = 1; }); }
        var tol = rule.허용오차 || 0.25, nightIn = mins(rule.야간교대.출근), nightOut = mins(rule.야간교대.퇴근);
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          var dv2 = rows[i][col[dC]];
          if (typeof dv2 !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dv2) || +dv2.slice(0, 4) !== rule.연도) continue;
          var lv2 = show(rows[i][col[lvC]]).trim();
          if ((rule.쉬는날 || []).indexOf(lv2) >= 0) continue;
          var a2 = rows[i][col[inC2]], b2 = rows[i][col[outC2]];
          var okA = typeof a2 === 'string' && /^\d{2}:\d{2}$/.test(a2), okB = typeof b2 === 'string' && /^\d{2}:\d{2}$/.test(b2);
          var dt2 = dayKind(dv2, hol2), half = (rule.반차 || []).indexOf(lv2) >= 0, form = show(rows[i][col[fmC]]).trim();
          var stIn = rows[i][col[stC]], expS = null, bad2 = [], st2, en2, cr;
          if (okA && okB) {
            st2 = mins(a2); en2 = mins(b2); if (en2 <= st2) en2 += 1440;
            var bi = rows[i][col[brC]]; bi = isBlank(bi) ? null : toNum(bi); if (bi !== null && !isFinite(bi)) bi = null;
            cr = classifyDay(dt2, st2, en2, (half ? rule.반차소정시간 : (dt2 === '토' ? rule.토요일소정시간 : rule.소정시간)) * 60, bi, P);
            if (!cr.skip) hc.forEach(function (cn) {
              var inp = rows[i][col[cn]], x = isBlank(inp) ? 0 : toNum(inp);
              if (!isFinite(x)) return;
              var e = (cr.hours[cn] || 0) / 60;
              if (Math.abs(x - e) > tol + 1e-9) bad2.push([cn, x, Math.round(e * 100) / 100]);
            });
            if (half || dt2 !== '평일' || (rule.판정제외형태 || []).indexOf(form) >= 0) expS = '정상';
            else if (st2 === nightIn && en2 - 1440 === nightOut) expS = '정상';
            else {
              var type = (rule.근무제값 || {})[show(rows[i][col[shC]]).trim()];
              if (type) {
                var late = st2 > mins(rule.지각기준[type]), early;
                if (type === '일반') early = en2 < mins(rule.조퇴기준.일반);
                else early = en2 < Math.max(st2, P.recStart) + rule.소정시간 * 60 + cr.B;
                expS = late && early ? '지각·조퇴' : late ? '지각' : early ? '조퇴' : '정상';
              }
            }
          } else if (isBlank(a2) && isBlank(b2) && lv2 === '없음' && dt2 === '평일') expS = '결근';
          bad2.forEach(function (b3) { flag(i, b3[0], rows[i][col[b3[0]]], b3[0] + ' 입력 ' + b3[1] + ' 인데 출퇴근 시각으로 계산하면 ' + b3[2], rule); });
          if (expS && !isBlank(stIn) && String(stIn).trim() !== expS) flag(i, stC, stIn, stC + ' «' + String(stIn).trim() + '» 인데 출퇴근 시각으로 계산하면 «' + expS + '»', rule);
        }
      } else if (kind === '반차시각비교') {
        var lc = rule.칸, ic = rule.출근칸, th = mins(rule.기준시각);
        if (missingCols(rule, [lc, ic])) return;
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          var lvv = show(rows[i][col[lc]]).trim(), aa = rows[i][col[ic]];
          if (typeof aa !== 'string' || !/^\d{2}:\d{2}$/.test(aa)) continue;
          if (lvv === rule.오전 && mins(aa) < th) flag(i, lc, lvv, '«' + lvv + '» 인데 출근이 ' + rule.기준시각 + ' 보다 이름(오후 반차가 아닌지 확인)', rule);
          else if (lvv === rule.오후 && mins(aa) >= th) flag(i, lc, lvv, '«' + lvv + '» 인데 출근이 ' + rule.기준시각 + ' 이후(오전 반차가 아닌지 확인)', rule);
        }
      } else if (kind === '사번오타표시') {
        c = rule.칸; idx = col[c];
        if (missingCols(rule, [c])) return;
        var cnt = {};
        for (i = 0; i < len; i++) { if (inert[i]) continue; v = rows[i][idx]; if (typeof v === 'string' && /^\d{9}$/.test(v)) cnt[v] = (cnt[v] || 0) + 1; }
        var near = {};
        Object.keys(cnt).forEach(function (sid) {
          if (cnt[sid] > rule.드문횟수) return;
          for (var pp = 0; pp < sid.length && !near[sid]; pp++) for (var dd = 0; dd < 10; dd++) {
            var cand = sid.slice(0, pp) + dd + sid.slice(pp + 1);
            if (cand !== sid && (cnt[cand] || 0) >= rule.많은횟수) { near[sid] = cand; break; }
          }
        });
        for (i = 0; i < len; i++) {
          if (inert[i]) continue; v = rows[i][idx];
          if (typeof v === 'string' && near[v]) flag(i, c, v, '사번 «' + v + '» 은(는) ' + cnt[v] + '줄뿐이고 «' + near[v] + '» (' + cnt[near[v]] + '줄)와 한 자리만 다름', rule);
        }
      } else if (kind === '같은달팀바뀜표시') {
        var tmC = rule.팀칸, sdC = rule.사번칸, dtC = rule.날짜칸;
        if (missingCols(rule, [tmC, sdC, dtC])) return;
        var r1 = doc.rules.filter(function (x) { return x.id === rule.정식이름처방; })[0], offi = {};
        ((r1 && r1.정식이름) || []).forEach(function (x) { offi[x] = 1; });
        var groups = {};
        for (i = 0; i < len; i++) {
          if (inert[i]) continue;
          var tm = rows[i][col[tmC]], sd = rows[i][col[sdC]], dd2 = rows[i][col[dtC]];
          if (typeof tm !== 'string' || !offi[tm.trim()] || typeof sd !== 'string' || typeof dd2 !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dd2)) continue;
          var gk = sd + '|' + dd2.slice(0, 7);
          var g = groups[gk] = groups[gk] || { teams: {}, idx: [] };
          g.teams[tm.trim()] = (g.teams[tm.trim()] || 0) + 1; g.idx.push(i);
        }
        Object.keys(groups).forEach(function (gk) {
          var g = groups[gk], names = Object.keys(g.teams);
          if (names.length < 2) return;
          var first = g.idx[0];
          g.idx.forEach(function (ri) { if (rows[ri][col[dtC]] < rows[first][col[dtC]]) first = ri; }); // 그 달 가장 이른 날짜의 줄
          var base = rows[first][col[tmC]].trim();
          g.idx.forEach(function (ri) {
            if (rows[ri][col[tmC]].trim() === base) return;
            flag(ri, tmC, rows[ri][col[tmC]], '같은 달(' + gk.split('|')[1] + ')에 같은 사번이 «' + base + '» 로 시작해 중간에 «' + rows[ri][col[tmC]].trim() + '» 로 적혀 있음', rule);
          });
        });
      } else if (kind === '이름오타표시') {
        c = rule.칸; idx = col[c];
        if (missingCols(rule, [c])) return;
        var typo = rule.오타 || {};
        for (i = 0; i < len; i++) {
          if (headerRepeat[i]) continue;
          v = rows[i][idx];
          if (typeof v !== 'string') continue;
          var tk = v.trim();
          if (Object.prototype.hasOwnProperty.call(typo, tk)) flag(i, c, v, '«' + tk + '» 은(는) 오타로 보임 («' + typo[tk] + '» 인지 확인)', rule);
        }
      }
    }
    // 고치는 처방 먼저(적힌 순서대로) → 표시만 하는 처방 → 같은 줄 하나만(맨 마지막, 모양을 다 맞춘 뒤)
    doc.rules.filter(function (r) { return FIX[r.종류]; }).forEach(apply);
    doc.rules.filter(function (r) { return MARK[r.종류]; }).forEach(apply);

    var excluded = [], dropped = new Array(len);
    doc.rules.forEach(function (rule) {
      if (rule.종류 !== '같은줄하나만') return;
      var last = {}, keys = new Array(len);
      for (i = 0; i < len; i++) { keys[i] = JSON.stringify(rows[i]); last[keys[i]] = i; }
      for (i = 0; i < len; i++) {
        var keep = last[keys[i]];
        if (keep !== i && !dropped[i]) {
          dropped[i] = true; stat[rule.id].excluded++;
          excluded.push({ line: i + 2, rule: rule.id, reason: '같은 줄이 뒤(' + (keep + 2) + '줄)에 또 있어 뒤의 줄을 남김' + (rule.why ? ' (' + rule.why + ')' : ''), raw: raws[i] });
        }
      }
    });

    // 줄을 하나만 남긴 뒤에 남은 줄끼리 비교하는 표시
    doc.rules.filter(function (r) { return POST[r.종류]; }).forEach(function (rule) {
      var cs = colsOf(rule.칸);
      if (missingCols(rule, cs)) return;
      var groups = {};
      for (i = 0; i < len; i++) {
        if (dropped[i] || inert[i]) continue;
        var vv = cs.map(function (cn) { return rows[i][col[cn]]; });
        if (vv.some(isBlank)) continue;
        var k = JSON.stringify(vv);
        (groups[k] = groups[k] || []).push(i);
      }
      Object.keys(groups).forEach(function (k) {
        var g = groups[k];
        if (g.length < 2) return;
        g.forEach(function (ri) { flag(ri, cs[cs.length - 1], rows[ri][col[cs[cs.length - 1]]], cs.join('·') + ' 이(가) 같은 줄이 ' + g.length + '줄 있음(원본줄 ' + g.map(function (x) { return x + 2; }).join(', ') + ')', rule); });
      });
    });

    var clean = [], flaggedRows = 0;
    for (i = 0; i < len; i++) {
      if (dropped[i]) continue;
      if (flagsOf[i].length) flaggedRows++;
      clean.push({ line: i + 2, vals: rows[i], mark: flagsOf[i].join(' / ') });
    }
    return {
      header: header, clean: clean, excluded: excluded, changes: changes, flags: flags, skipped: skipped, stat: stat,
      counts: { input: len, columns: n, clean: clean.length, excluded: excluded.length, changes: changes.length, flaggedRows: flaggedRows }
    };
  }

  // ---------------------------------------------------------------- 내려받을 표
  function tables(res, rulesDoc, summaryLines) {
    var T = {};
    T['요약'] = [['항목', '값']].concat(summaryLines || []);
    T['정리본'] = [res.header.concat(['원본줄', '_표시'])].concat(res.clean.map(function (r) { return r.vals.concat([r.line, r.mark]); }));
    T['바꾼기록'] = [['원본줄', '칸', '원래 값', '바뀐 값', '처방', '이유']].concat(res.changes.map(function (c) { return [c.line, c.col, show(c.from), show(c.to), c.rule, c.why]; }));
    T['표시'] = [['원본줄', '칸', '값', '처방', '까닭']].concat(res.flags.map(function (f) { return [f.line, f.col, show(f.val), f.rule, f.reason]; }));
    T['제외'] = [['원본줄', '처방', '까닭'].concat(res.header)].concat(res.excluded.map(function (e) { return [e.line, e.rule, e.reason].concat(e.raw); }));
    return T;
  }
  function csvText(aoa) {
    function cell(v) {
      var s = show(v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    // 맨 앞의 ﻿ 는 엑셀이 한글(UTF-8)을 알아보게 하는 표식
    return '﻿' + aoa.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  }
  function fingerprint(res) {
    return JSON.stringify([res.clean, res.excluded, res.changes, res.flags, res.counts]);
  }

  // ---------------------------------------------------------------- 정답과 대조
  function compare(res, ansAoa, rulesDoc) {
    var keyCols = (rulesDoc && rulesDoc.대조키) || [], dateCol = null;
    (rulesDoc.rules || []).forEach(function (r) { if (r.종류 === '날짜한모양') dateCol = r.칸; });
    var ah = (ansAoa[0] || []).map(function (h) { return show(h).trim(); }), aidx = {};
    ah.forEach(function (h, i) { if (h && aidx[h] === undefined) aidx[h] = i; });
    var hidx = {}; res.header.forEach(function (h, i) { if (h && hidx[h] === undefined) hidx[h] = i; });
    var cols = res.header.filter(function (h) { return h && aidx[h] !== undefined; });
    var missing = res.header.filter(function (h) { return h && aidx[h] === undefined; });
    var out = { answerRows: 0, matched: 0, mismatched: 0, marked: 0, unmarked: 0, notFound: 0, onlyOurs: 0, byCol: {}, examples: [], cols: cols, missing: missing, error: '' };
    if (!keyCols.length || keyCols.some(function (k) { return aidx[k] === undefined || hidx[k] === undefined; })) {
      out.error = '정답 파일에 짝을 맞출 칸(' + keyCols.join('·') + ')이 없습니다.'; return out;
    }
    function norm(v, c) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return (c === dateCol && v > 20000 && v < 80000) ? serialToIso(v) : String(v);
      return String(v);
    }
    function eq(a, b) {
      if (a === b) return true;
      if (a === '' || b === '') return false;
      var x = Number(a), y = Number(b);
      return isFinite(x) && isFinite(y) && Math.abs(x - y) < 1e-9;
    }
    var index = {};
    res.clean.forEach(function (r, ri) {
      var key = keyCols.map(function (k) { return norm(r.vals[hidx[k]], k); }).join('\u0001');
      (index[key] = index[key] || []).push(ri);
    });
    var used = {};
    for (var i = 1; i < ansAoa.length; i++) {
      var ar = ansAoa[i] || [];
      if (ar.every(isBlank)) continue;
      out.answerRows++;
      var key = keyCols.map(function (k) { return norm(ar[aidx[k]], k); }).join('\u0001');
      var cand = index[key];
      if (!cand) { out.notFound++; continue; }
      var best = null, bestDiff = null, bestRi = -1;
      for (var q = 0; q < cand.length; q++) {
        var rv = res.clean[cand[q]], diff = [];
        for (var c = 0; c < cols.length; c++) {
          var cn = cols[c], ours = norm(rv.vals[hidx[cn]], cn), theirs = norm(ar[aidx[cn]], cn);
          if (!eq(ours, theirs)) diff.push([cn, ours, theirs]);
        }
        if (bestDiff === null || diff.length < bestDiff.length) { best = rv; bestDiff = diff; bestRi = cand[q]; }
        if (!diff.length) break;
      }
      used[bestRi] = 1;
      if (!bestDiff.length) out.matched++;
      else {
        out.mismatched++;
        if (best.mark) out.marked++; else out.unmarked++;
        bestDiff.forEach(function (d) {
          out.byCol[d[0]] = (out.byCol[d[0]] || 0) + 1;
          if (out.examples.length < 15) out.examples.push({ line: best.line, col: d[0], ours: d[1], theirs: d[2], mark: best.mark || '' });
        });
      }
    }
    out.onlyOurs = res.clean.length - Object.keys(used).length;
    return out;
  }

  root.Clean = { run: run, tables: tables, csvText: csvText, fingerprint: fingerprint, compare: compare, checkRules: checkRules, readDateText: readDateText };
})(typeof window !== 'undefined' ? window : globalThis);
