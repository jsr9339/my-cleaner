/* 대시보드: 넣은 파일(수정 전)과 정리본(수정 후)을 같은 그림으로 비교한다. 계산은 모두 브라우저 안에서 한다.
 * 이 파일은 «보여 주기» 전용이며 값을 고치지 않는다. 쓰는 칸 이름(팀·근무제·근무일자·연장)이 없으면 그 그림은 빼고 보여 준다. */
(function () {
  'use strict';
  var C = window.Charts, fmt = C.fmt;
  var COLS = { team: '팀', shift: '근무제', date: '근무일자', over: '연장' };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function css(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function sOf(v) { return v === null || v === undefined ? '' : String(v); }
  function isHeaderRow(row, header) { var same = 0; for (var j = 0; j < header.length; j++) if (typeof row[j] === 'string' && row[j].trim() === header[j] && header[j]) same++; return same >= 3; }

  function serialYMD(v) { var t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; }
  function ymdOf(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) return serialYMD(v);
    if (typeof v === 'string') { var m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return [+m[1], +m[2], +m[3]]; var r = window.Clean.readDateText(v); if (r && r.iso) { m = r.iso.split('-'); return [+m[0], +m[1], +m[2]]; } }
    return null;
  }
  function dateForm(v) {
    if (v === null || v === undefined || sOf(v).trim() === '') return '빈칸';
    if (typeof v === 'number') return (v > 20000 && v < 80000) ? '엑셀 날짜값' : '글자·그 밖';
    var s = String(v).normalize('NFKC').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'YYYY-MM-DD 한 모양';
    if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(s)) return '2026.1.2 점';
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) return '2026/01/06 슬래시';
    if (/^\d{8}$/.test(s)) return '20260107 8자리';
    if (/^\d{2,4}\s*년/.test(s)) return '26년 3월 5일 한글';
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return '05/01/2026 일·월 모호';
    return '글자·그 밖';
  }

  // 한 쪽(수정 전 또는 수정 후)의 숫자를 센다. rows: 값 배열의 배열, header: 칸 이름들
  function stats(header, rows, officialTeams) {
    var ix = {}; header.forEach(function (h, i) { if (h && ix[h] === undefined) ix[h] = i; });
    var out = { rows: 0, has: { team: ix[COLS.team] !== undefined, shift: ix[COLS.shift] !== undefined, date: ix[COLS.date] !== undefined, over: ix[COLS.over] !== undefined } };
    var team = {}, otherT = {}, teamBlank = 0, shift = {}, forms = {}, ymCount = {}, monthSum = {}, i, r;
    var rowsKept = [];
    for (i = 0; i < rows.length; i++) {
      r = rows[i] || [];
      if (r.every(function (x) { return x === null || x === undefined || sOf(x).trim() === ''; })) { out.rows++; continue; } // 빈 줄도 줄 수에는 센다
      out.rows++;
      if (isHeaderRow(r, header)) continue;
      rowsKept.push(r);
    }
    rowsKept.forEach(function (r) {
      if (out.has.team) { var t = r[ix[COLS.team]]; if (sOf(t).trim() === '') teamBlank++; else if (officialTeams.indexOf(t) >= 0) team[t] = (team[t] || 0) + 1; else otherT[sOf(t).trim()] = (otherT[sOf(t).trim()] || 0) + 1; }
      if (out.has.shift) { var s = sOf(r[ix[COLS.shift]]).trim() || '(빈칸)'; shift[s] = (shift[s] || 0) + 1; }
      if (out.has.date) { var f = dateForm(r[ix[COLS.date]]); forms[f] = (forms[f] || 0) + 1; var y = ymdOf(r[ix[COLS.date]]); if (y) ymCount[y[0]] = (ymCount[y[0]] || 0) + 1; }
    });
    var year = Object.keys(ymCount).sort(function (a, b) { return ymCount[b] - ymCount[a]; })[0];
    if (out.has.date && out.has.over) rowsKept.forEach(function (r) {
      var y = ymdOf(r[ix[COLS.date]]); if (!y || String(y[0]) !== year) return;
      var v = r[ix[COLS.over]], x = typeof v === 'number' ? v : (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
      if (isFinite(x)) monthSum[y[1]] = (monthSum[y[1]] || 0) + x;
    });
    var months = []; for (i = 1; i <= 12; i++) months.push(Math.round(monthSum[i] || 0));
    out.team = team; out.otherT = otherT; out.teamBlank = teamBlank; out.shift = shift; out.forms = forms; out.months = months; out.year = year;
    out.teamKinds = officialTeams.length + Object.keys(otherT).length;
    out.shiftKinds = Object.keys(shift).filter(function (k) { return k !== '(빈칸)' && k !== COLS.shift; }).length;
    out.dateKinds = Object.keys(forms).filter(function (k) { return k !== '빈칸' && k.indexOf('글자') < 0 && k.indexOf('모호') < 0; }).length;
    return out;
  }

  function officialTeams(rules, header, rows) {
    var rule = (rules.rules || []).filter(function (r) { return r.종류 === '이름통일' && r.칸 === COLS.team; })[0];
    if (rule && rule.정식이름) return rule.정식이름;
    var i = header.indexOf(COLS.team), c = {}; if (i < 0) return [];
    rows.forEach(function (r) { var t = sOf(r[i]).trim(); if (t) c[t] = (c[t] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, 14);
  }

  function compute(ctx) {
    var header = ctx.result.header, before = ctx.aoa.slice(1), after = ctx.result.clean.map(function (r) { return r.vals; });
    var teams = officialTeams(ctx.rules, header, before);
    return { teams: teams, before: stats(header, before, teams), after: stats(header, after, teams), rules: ctx.rules.rules, stat: ctx.result.stat, counts: ctx.result.counts };
  }

  // ---------------------------------------------------------------- 그리기
  function tile(label, value, sub, subStrong) {
    var t = el('div', 'tile'); t.appendChild(el('div', 't-label', label)); t.appendChild(el('div', 't-value', value));
    var s = el('div', 't-sub', sub || ''); if (subStrong) { s.appendChild(document.createTextNode(' ')); s.appendChild(el('b', 't-delta down', subStrong)); } t.appendChild(s); return t;
  }
  function kpi(D, mode) {
    var g = el('div', 'grid g4'), b = D.before, a = D.after, m = mode === 'before' ? b : a;
    function mk(label, key, unit) {
      if (mode === 'both') return tile(label, fmt(a[key]), fmt(b[key]) + ' →', fmt(a[key]) + ' ' + unit);
      if (mode === 'after') return tile(label, fmt(m[key]), '정리 전 ' + fmt(b[key]) + ' →', fmt(a[key]) + ' ' + unit);
      return tile(label, fmt(m[key]), unit);
    }
    g.appendChild(mk('줄 수', 'rows', '줄')); g.appendChild(mk('팀 이름 종류', 'teamKinds', '종'));
    g.appendChild(mk('근무제 표기 종류', 'shiftKinds', '종')); g.appendChild(mk('날짜 모양', 'dateKinds', '종'));
    return g;
  }
  function card(title, small) { var c = el('div', 'card'); var h = el('h3', null, title); if (small) h.appendChild(el('small', null, small)); c.appendChild(h); var ch = el('div', 'ch'); c.appendChild(ch); c._ch = ch; return c; }
  function parts(dict, skip) {
    var pal = [css('--blue', '#4a5cf0'), css('--blue2', '#b5bdfa'), css('--teal', '#12b5a6'), css('--orange', '#f59e0b'), css('--red', '#e5484d'), css('--gray', '#bbbfc4'), '#7b61ff', '#9ad0f5'], i = 0;
    return Object.keys(dict).filter(function (k) { return k !== skip; }).sort(function (x, y) { return dict[y] - dict[x]; }).map(function (k) { return { label: k, value: dict[k], color: pal[i++ % pal.length] }; });
  }
  function cardsOf(D, mode, tall) {
    var S = D[mode], out = {}, blue = css('--blue', '#4a5cf0'), blue2 = css('--blue2', '#b5bdfa'), orange = css('--orange', '#f59e0b'), gray = css('--gray', '#bbbfc4');
    if (S.has.over && S.has.date) {
      var cm = card('월별 연장근무 합계', '시간' + (S.year ? ' · ' + S.year + '년' : '')); 
      C.bars(cm._ch, ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], [{ name: mode === 'before' ? '정리 전' : '정리 후', color: mode === 'before' ? blue2 : blue, values: S.months }], { height: tall ? 320 : 230 });
      out.month = cm;
    }
    if (S.has.team) {
      var ct = card('팀별 줄 수', '정식 이름 ' + D.teams.length + '팀 + 그 밖'); out.team = ct;
      var items = D.teams.map(function (n) { return { label: n, value: S.team[n] || 0, color: blue }; });
      var oRows = Object.keys(S.otherT).reduce(function (a, k) { return a + S.otherT[k]; }, 0);
      items.push({ label: '다른 표기 ' + Object.keys(S.otherT).length + '종', value: oRows, color: orange }); items.push({ label: '빈칸', value: S.teamBlank, color: gray });
      C.hbars(ct._ch, items);
    }
    if (S.has.shift) { var cs = card('근무제 표기', '줄 수'); out.shift = cs; C.donut(cs._ch, parts(S.shift, COLS.shift), { centerTop: '줄', centerText: fmt(Object.keys(S.shift).reduce(function (a, k) { return k === COLS.shift ? a : a + S.shift[k]; }, 0)) }); }
    if (S.has.date) { var cd = card('근무일자 모양', '줄 수'); out.date = cd; C.donut(cd._ch, parts(S.forms), { centerTop: '줄', centerText: fmt(Object.keys(S.forms).reduce(function (a, k) { return a + S.forms[k]; }, 0)) }); }
    var ci = card(mode === 'before' ? '정리 전에 찾은 문제' : '정리 후 확인이 필요한 항목', '처방별 줄 수'); out.issue = ci;
    var its = D.rules.map(function (r) { var s = D.stat[r.id] || { changed: 0, flagged: 0, excluded: 0 }; return { label: r.id + ' ' + (r.짧은이름 || r.why || ''), value: mode === 'before' ? s.changed + s.flagged + s.excluded : s.flagged, color: mode === 'before' ? blue : orange }; })
      .filter(function (x) { return x.value > 0; }).sort(function (x, y) { return y.value - x.value; }).slice(0, 8);
    if (its.length) C.hbars(ci._ch, its); else ci._ch.appendChild(el('p', 'muted', '없습니다.'));
    return out;
  }
  // 한 쪽만 보여 줄 때: 위 줄(월별·팀별), 아래 줄(근무제·날짜·문제). 상자 사이 간격은 가로·세로 모두 같다.
  function set(D, mode) {
    var c = cardsOf(D, mode, true), root = el('div', 'dash');
    var r1 = el('div', 'grid g21'), r2 = el('div', 'grid g3');
    [c.month, c.team].forEach(function (x) { if (x) r1.appendChild(x); });
    [c.shift, c.date, c.issue].forEach(function (x) { if (x) r2.appendChild(x); });
    root.appendChild(r1); root.appendChild(r2); return root;
  }
  // 나란히: 같은 내용의 상자를 한 줄에 «수정 전 | 수정 후» 로 놓는다. 한 줄의 두 상자는 높이가 같다.
  function pairs(D) {
    var b = cardsOf(D, 'before', false), a = cardsOf(D, 'after', false), root = el('div', 'dash');
    var head = el('div', 'grid g2');
    [['수정 전', '넣은 파일 그대로', 'gray'], ['수정 후', '정리본', 'blue']].forEach(function (x) { var t = el('div', 'sec-title'); t.appendChild(document.createTextNode(x[0] + ' ')); t.appendChild(el('span', 'chip ' + x[2], x[1])); head.appendChild(t); });
    root.appendChild(head);
    ['month', 'team', 'shift', 'date', 'issue'].forEach(function (k) {
      if (!b[k] && !a[k]) return;
      var row = el('div', 'grid g2'); if (b[k]) row.appendChild(b[k]); if (a[k]) row.appendChild(a[k]); root.appendChild(row);
    });
    return root;
  }

  function render(host, ctx) {
    host.textContent = '';
    var D = compute(ctx), mode = 'after';
    var bar = el('div', 'dash-bar'); bar.appendChild(el('div', 'muted', '수정 전 = 넣은 파일 그대로, 수정 후 = 정리본'));
    var seg = el('div', 'seg'); var kpiBox = el('div'), body = el('div', 'mt16');
    var btn = {};
    [['after', '수정 후'], ['before', '수정 전'], ['both', '나란히']].forEach(function (x) { var b = el('button', null, x[1]); b.type = 'button'; b.addEventListener('click', function () { draw(x[0]); }); btn[x[0]] = b; seg.appendChild(b); });
    bar.appendChild(seg); host.appendChild(bar); host.appendChild(kpiBox); host.appendChild(body);
    function draw(m) {
      mode = m; Object.keys(btn).forEach(function (k) { btn[k].classList.toggle('on', k === m); });
      kpiBox.textContent = ''; kpiBox.appendChild(kpi(D, m)); body.textContent = '';
      if (m === 'both') {
        body.appendChild(pairs(D));
      } else body.appendChild(set(D, m));
    }
    draw('after');
    return D;
  }
  window.Dash = { render: render, compute: compute };
})();
