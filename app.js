/* 화면 처리. 파일은 브라우저 안에서만 읽고, 밖으로 보내는 코드는 없습니다.
 * (fetch 는 같은 사이트의 rules/ 처방 파일을 읽을 때 한 번만 쓰며, 사용자의 파일 내용은 담지 않습니다.) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { name: '', baseName: '', aoa: null, rules: null, rulesFrom: '', result: null, tables: null };

  // ------------------------------------------------------------ 시트 탭(단계)
  var STEPS = [['파일 넣기', '엑셀 파일을 넣습니다'], ['처방', '이 파일에 적용되는 처방과 이유를 확인하고 정리합니다'], ['정리 결과', '정리본과 바꾼 기록을 받습니다'], ['대시보드', '수정 전과 수정 후를 같은 그림으로 비교합니다'], ['정답과 대조', '내 컴퓨터에 있는 정답 파일과 맞춰 봅니다']];
  var cur = 0, unlocked = 1;
  (function buildTabs() {
    var nav = document.getElementById('tabs');
    STEPS.forEach(function (st, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.i = i;
      var n = document.createElement('i'); n.textContent = i + 1; b.appendChild(n); b.appendChild(document.createTextNode(st[0]));
      b.addEventListener('click', function () { if (i < unlocked) goTab(i); });
      nav.appendChild(b);
    });
  })();
  function goTab(i) {
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    for (var k = 0; k < STEPS.length; k++) document.getElementById('p' + (k + 1)).hidden = k !== cur;
    var tabs = document.querySelectorAll('#tabs .tab');
    tabs.forEach(function (b, k) { b.classList.toggle('on', k === cur); b.classList.toggle('done', k < cur && k < unlocked); b.disabled = k >= unlocked; });
    document.getElementById('run').hidden = cur !== 1; // 처방 탭에서만 보인다
    document.getElementById('t').textContent = (cur + 1) + '. ' + STEPS[cur][0]; document.getElementById('d').textContent = STEPS[cur][1];
    document.getElementById('prev').style.visibility = cur > 0 ? 'visible' : 'hidden';
    document.getElementById('next').style.visibility = cur < STEPS.length - 1 ? 'visible' : 'hidden';
    document.getElementById('next').disabled = cur + 1 >= unlocked;
    window.scrollTo(0, 0);
  }
  function unlock(n) { unlocked = n; goTab(cur); }

  function tick() { return new Promise(function (r) { setTimeout(r, 40); }); }
  function setStatus(t) { var e = $('status'); e.textContent = t || ''; e.hidden = !t; }
  function setError(t) { var e = $('error'); e.textContent = t || ''; e.hidden = !t; }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }

  // ------------------------------------------------------------ 1. 파일 넣기
  function readBuffer(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('파일을 읽지 못했습니다.')); };
      fr.readAsArrayBuffer(file);
    });
  }

  async function handleFile(file) {
    setError(''); setStatus('파일을 읽는 중입니다. 잠시 기다려 주세요…');
    ['s2'].forEach(function (id) { $(id).hidden = true; });
    unlocked = 1; goTab(0);
    state.result = null; state.rules = null; $('run').disabled = true;
    try {
      await tick();
      var buf = await readBuffer(file);
      var wb = XLSX.read(buf, { type: 'array' });
      var sheet = wb.SheetNames.indexOf('근태') >= 0 ? '근태' : wb.SheetNames[0];
      if (!sheet) throw new Error('엑셀 안에 시트가 없습니다.');
      state.aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true });
      if (!state.aoa.length) throw new Error('시트가 비어 있습니다.');
    } catch (e) { setStatus(''); setError('이 파일은 열 수 없습니다: ' + (e && e.message ? e.message : e)); return; }
    state.name = file.name; state.baseName = file.name.replace(/\.[^.]+$/, '');
    var header = state.aoa[0].map(function (h) { return h === null ? '' : String(h).trim(); });
    $('fname').textContent = file.name;
    $('nrows').textContent = fmt(state.aoa.length - 1) + '줄 (머리글 줄 제외)';
    $('ncols').textContent = fmt(header.length) + '칸';
    $('colnames').textContent = header.join(' · ');
    var chips = $('colchips'); chips.textContent = ''; header.forEach(function (h) { chips.appendChild(el('span', h, 'chip blue')); });
    $('topfile').textContent = file.name + ' · ' + fmt(state.aoa.length - 1) + '줄';
    $('s2').hidden = false; setStatus('');
    await loadRules();
    unlock(2); goTab(1);
  }

  // ------------------------------------------------------------ 3. 처방
  async function loadRules() {
    $('norules').hidden = true; $('rules').textContent = ''; $('rulesrc').textContent = '처방 파일을 찾는 중입니다…';
    var doc = null;
    try {
      var resp = await fetch('rules/' + encodeURIComponent(state.baseName) + '.json', { cache: 'no-store' });
      if (resp.ok) doc = await resp.json();
    } catch (e) { doc = null; }
    if (doc && !Clean.checkRules(doc)) { setRules(doc, 'rules/' + state.baseName + '.json'); return; }
    $('rulesrc').textContent = '';
    $('norules').hidden = false;
  }

  function setRules(doc, from) {
    var bad = Clean.checkRules(doc);
    if (bad) { $('rulesrc').textContent = ''; $('norules').hidden = false; setError(bad); return; }
    setError('');
    state.rules = doc; state.rulesFrom = from;
    $('norules').hidden = true;
    $('rulesrc').textContent = '처방 파일: ' + from + ' · 책임: ' + (doc.owner || '-');
    var box = $('rules'); box.textContent = '';
    var header = state.aoa[0].map(function (h) { return h === null ? '' : String(h).trim(); });
    doc.rules.forEach(function (r) {
      var d = el('div', undefined, 'rule');
      var head = el('div', undefined, 'rhead'); head.appendChild(el('span', r.id, 'tag')); head.appendChild(el('b', r.짧은이름 || (r.칸 ? '«' + [].concat(r.칸).join('», «') + '» 칸' : '')));
      d.appendChild(head);
      d.appendChild(el('div', r.처방 || '', 'body'));
      d.appendChild(el('div', '이유: ' + (r.why || '(적혀 있지 않음)'), 'why'));
      var need = [].concat(r.칸 || [], r.수당칸 || [], r.기준칸 || []).filter(function (x) { return header.indexOf(x) < 0; });
      if (need.length) { d.classList.add('skipped'); d.appendChild(el('div', '이 파일에는 «' + need.join('», «') + '» 칸이 없어 이 처방은 건너뜁니다.', 'skip')); }
      box.appendChild(d);
    });
    $('run').disabled = false;
  }

  // ------------------------------------------------------------ 4. 정리
  function timeStamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  async function runClean() {
    if (!state.rules || !state.aoa) return;
    $('run').disabled = true; setError(''); setStatus('정리하는 중입니다. 파일이 크면 몇 초 걸립니다…');
    await tick();
    try {
      var res = Clean.run(state.aoa, state.rules);
      var first = Clean.fingerprint(res), same = true, TIMES = 5; // 처음 1번 + 다시 4번 = 모두 5번 돌려 같은지 본다
      for (var t = 2; t <= TIMES; t++) {
        setStatus('같은 결과가 나오는지 다시 돌려 보는 중입니다… (' + t + '/' + TIMES + ')'); await tick();
        if (Clean.fingerprint(Clean.run(state.aoa, state.rules)) !== first) { same = false; break; }
      }
      // 정리본을 다시 정리해도 더 바뀌는 것이 없는지
      var again = [res.header].concat(res.clean.map(function (r) { return r.vals; }));
      var res3 = Clean.run(again, state.rules);
      var idem = res3.counts.changes === 0 && res3.counts.excluded === 0 && res3.counts.flaggedRows === res.counts.flaggedRows;
      state.result = res; state.checks = { same: same, times: TIMES, idem: idem, again: res3.counts };
      render(res);
      state.tables = null;
      Dash.render($('dash'), { aoa: state.aoa, result: res, rules: state.rules });
      unlock(5); goTab(2);
    } catch (e) { setError('정리 중 문제가 생겼습니다: ' + (e && e.message ? e.message : e)); }
    setStatus(''); $('run').disabled = false;
  }

  function addRow(t, cells, head) {
    var tr = document.createElement('tr');
    cells.forEach(function (c, i) {
      var str = String(c === null || c === undefined ? '' : c), x = el(head ? 'th' : 'td');
      if (!head && str.indexOf(' / ') >= 0) { // 까닭이 여럿이면 « / » 뒤부터 아랫줄로 내린다
        str.split(' / ').forEach(function (part, k) { if (k) x.appendChild(document.createElement('br')); x.appendChild(document.createTextNode(part)); });
      } else x.textContent = str;
      if (i > 0 && /^[\d,.\-]+$/.test(str)) x.className = 'n';
      tr.appendChild(x);
    });
    t.appendChild(tr);
  }

  function render(res) {
    var c = res.counts, t = $('beforeafter'); t.textContent = '';
    addRow(t, ['', '줄 수'], true);
    addRow(t, ['넣은 파일', fmt(c.input)]);
    addRow(t, ['정리본', fmt(c.clean)]);
    addRow(t, ['지운 줄 (제외 시트로 이동, 삭제 아님)', fmt(c.excluded)]);
    addRow(t, ['고친 값 (칸 수)', fmt(c.changes)]);
    addRow(t, ['표시한 줄 (정리본 안, 값은 그대로)', fmt(c.flaggedRows)]);
    var p = $('perrule'); p.textContent = '';
    addRow(p, ['처방', '고친 값', '표시', '제외한 줄', '비고'], true);
    state.rules.rules.forEach(function (r) {
      var s = res.stat[r.id];
      addRow(p, [r.id + ' ' + (r.why || ''), fmt(s.changed), fmt(s.flagged), fmt(s.excluded), res.skipped[r.id] || '']);
    });
    var ul = $('checks'); ul.textContent = '';
    function line(ok, text) { var li = el('li'); li.appendChild(el('span', ok ? '✔ ' : '✘ ', ok ? 'ok' : 'bad')); li.appendChild(document.createTextNode(text)); ul.appendChild(li); }
    line(c.clean + c.excluded === c.input, '줄 수 맞춤: 정리본 ' + fmt(c.clean) + ' + 지운 줄 ' + fmt(c.excluded) + ' = 넣은 파일 ' + fmt(c.input));
    line(state.checks.same, state.checks.same ? '5번 돌려도 같은 결과입니다.' : '5번 돌렸더니 결과가 달랐습니다. (문제입니다)');
    line(state.checks.idem, state.checks.idem ? '정리본을 다시 정리해도 더 바뀌는 것이 없습니다.' : '정리본을 다시 정리했더니 또 바뀌는 것이 있었습니다: 고친 값 ' + fmt(state.checks.again.changes) + ', 제외 ' + fmt(state.checks.again.excluded) + '.');
    renderPreview(res);
    $('cmpout').textContent = ''; $('cmperr').hidden = true;
  }

  function previewTable(title, head, rows, total) {
    var box = $('preview');
    box.appendChild(el('h3', title + ' (' + fmt(total) + '건 중 ' + Math.min(rows.length, 8) + '건)'));
    if (!rows.length) { box.appendChild(el('p', '없습니다.', 'note')); return; }
    var wrap = el('div', undefined, 'scroll'), t = document.createElement('table');
    addRow(t, head, true);
    rows.slice(0, 8).forEach(function (r) { addRow(t, r.map(function (x) { var s = x === null || x === undefined ? '' : String(x); return s.length > 80 ? s.slice(0, 80) + '…' : s; })); });
    wrap.appendChild(t); box.appendChild(wrap);
  }
  function renderPreview(res) {
    $('preview').textContent = '';
    previewTable('고친 값', ['원본줄', '칸', '원래 값', '바뀐 값', '처방'], res.changes.map(function (c) { return [c.line, c.col, c.from, c.to, c.rule]; }), res.changes.length);
    previewTable('표시한 줄', ['원본줄', '칸', '값', '까닭'], res.flags.map(function (f) { return [f.line, f.col, f.val, f.reason]; }), res.flags.length);
    previewTable('지운 줄', ['원본줄', '처방', '까닭'], res.excluded.map(function (e) { return [e.line, e.rule, e.reason]; }), res.excluded.length);
  }

  // ------------------------------------------------------------ 내려받기
  function summaryLines() {
    var res = state.result, c = res.counts, L = [];
    L.push(['원본 파일', state.name]);
    L.push(['처방 파일', state.rulesFrom]);
    L.push(['넣은 줄 수', c.input]); L.push(['정리본 줄 수', c.clean]); L.push(['지운 줄 수(제외 시트)', c.excluded]);
    L.push(['고친 값(칸 수)', c.changes]); L.push(['표시한 줄 수', c.flaggedRows]);
    state.rules.rules.forEach(function (r) {
      var s = res.stat[r.id];
      L.push([r.id + ' ' + (r.why || ''), '고침 ' + s.changed + ' · 표시 ' + s.flagged + ' · 제외 ' + s.excluded + (res.skipped[r.id] ? ' · ' + res.skipped[r.id] : '')]);
    });
    L.push(['5번 돌려도 같은 결과', state.checks.same ? '예' : '아니오']);
    return L;
  }
  function getTables() { if (!state.tables) state.tables = Clean.tables(state.result, state.rules, summaryLines()); return state.tables; }
  function save(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function xlsxBlob() {
    var T = getTables(), wb = XLSX.utils.book_new();
    ['요약', '정리본', '바꾼기록', '표시', '제외'].forEach(function (n) {
      var ws = XLSX.utils.aoa_to_sheet(T[n]);
      var w = T[n][0].map(function (_, i) { var m = 6; for (var r = 0; r < Math.min(T[n].length, 200); r++) { var v = T[n][r][i]; var l = v === null || v === undefined ? 0 : String(v).length; if (l > m) m = l; } return { wch: Math.min(m + 2, 60) }; });
      ws['!cols'] = w;
      XLSX.utils.book_append_sheet(wb, ws, n);
    });
    return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function csvBlob(name) { return new Blob([Clean.csvText(getTables()[name])], { type: 'text/csv;charset=utf-8' }); }

  // ------------------------------------------------------------ 5. 정답과 대조
  async function handleAnswer(file) {
    var err = $('cmperr'), out = $('cmpout'); err.hidden = true; out.textContent = '';
    if (!state.result) return;
    try {
      out.textContent = '대조하는 중입니다…'; await tick();
      var aoa;
      if (/\.csv$/i.test(file.name)) {
        var text = new TextDecoder('utf-8').decode(await readBuffer(file)).replace(/^﻿/, '');
        var wb = XLSX.read(text, { type: 'string', raw: true });
        aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
      } else {
        var wb2 = XLSX.read(await readBuffer(file), { type: 'array' });
        aoa = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
      }
      var r = Clean.compare(state.result, aoa, state.rules);
      out.textContent = '';
      if (r.error) { err.textContent = r.error; err.hidden = false; return; }
      function box(title, intro) { var c = el('section', undefined, 'card'); c.appendChild(el('h3', title)); if (intro) c.appendChild(el('p', intro, 'explain')); out.appendChild(c); return c; }
      function table(head, rows, cls) {
        var wrap = el('div', undefined, 'scroll'), t = document.createElement('table'); if (cls) t.className = cls;
        addRow(t, head, true); rows.forEach(function (row) { addRow(t, row); }); wrap.appendChild(t); return wrap;
      }
      // 1) 요약
      var c1 = box('1. 대조 결과 요약', '정답 파일의 줄과 정리본의 줄을 «근무일자 + 사번»이 같은 것끼리 짝지어, 모든 칸이 같은지 비교했습니다. «정리기가 정답과 같게 정리했는지»를 보는 표입니다.');
      c1.appendChild(table(['항목', '줄 수', '무슨 뜻인가요?'], [
        ['정답 행', fmt(r.answerRows), '정답 파일에 들어 있는 줄 수입니다. (머리글과 빈 줄은 뺍니다)'],
        ['일치', fmt(r.matched), '정리본의 짝 줄과 모든 칸이 같은 줄입니다. 정리기가 정답대로 정리한 줄입니다.'],
        ['어긋난 행', fmt(r.mismatched), '짝은 찾았지만 한 칸이라도 정답과 다른 줄입니다.'],
        ['  └ 표시가 있는 줄', fmt(r.marked), '정리기가 «틀렸을 수 있다»고 정리본의 _표시 칸에 적어 둔 줄입니다. 값을 일부러 고치지 않고 사람이 확인하게 한 것이라 정상입니다.'],
        ['  └ 표시가 없는 줄', fmt(r.unmarked), '정답과 다른데 아무 표시도 없는 줄입니다. 정리기가 놓친 것이므로 가장 먼저 살펴볼 줄입니다.'],
        ['정리본에서 못 찾은 정답 행', fmt(r.notFound), '정답 줄과 근무일자·사번이 같은 줄이 정리본에 없습니다. 날짜나 사번이 틀린 채(또는 빈칸으로) 남아 짝을 못 맞춘 경우입니다.'],
        ['정답에 없는 정리본 행', fmt(r.onlyOurs), '정리본에는 있는데 정답 파일에는 짝이 없는 줄입니다. 위 «못 찾은 정답 행»의 짝 줄, 합계·머리글·빈 줄, 같은 날짜·사번이 둘 남은 줄 등입니다.']
      ], 'cmp'));
      if (r.missing.length) c1.appendChild(el('p', '정답 파일에 없어서 비교하지 않은 칸: ' + r.missing.join(', '), 'note'));
      // 2) 어긋난 칸
      var names = Object.keys(r.byCol).sort(function (a, b) { return r.byCol[b] - r.byCol[a]; });
      var c2 = box('2. 어긋난 칸', '위 «어긋난 행» 안에서 어느 칸이 정답과 달랐는지 칸 이름별로 센 것입니다. 한 줄에서 두 칸이 다르면 두 칸을 각각 셉니다.');
      if (!names.length) c2.appendChild(el('p', '어긋난 칸이 없습니다.', 'note'));
      else c2.appendChild(table(['칸', '어긋난 칸 수', '전체 어긋남 중 비율'], names.map(function (n) {
        var tot = names.reduce(function (a, k) { return a + r.byCol[k]; }, 0);
        return [n, fmt(r.byCol[n]), (100 * r.byCol[n] / tot).toFixed(1) + '%'];
      }), 'cmp2'));
      // 3) 어긋난 예
      if (names.length) {
        var c3 = box('3. 어긋난 예 (앞의 ' + r.examples.length + '건)', '어긋난 칸 중 앞쪽 몇 건입니다. «정리본 값»은 정리기가 만든 값, «정답 값»은 정답 파일의 값입니다. «정리기가 남긴 표시»가 있으면 정리기가 그 줄을 이미 알려 준 것입니다.');
        c3.appendChild(table(['원본줄', '칸', '정리본 값', '정답 값', '정리기가 남긴 표시'], r.examples.map(function (x) { return [x.line, x.col, x.ours === '' ? '(빈칸)' : x.ours, x.theirs === '' ? '(빈칸)' : x.theirs, x.mark || '(표시 없음)']; }), 'cmp3'));
      }
      state.lastCompare = r;
    } catch (e) { out.textContent = ''; err.textContent = '정답 파일을 읽지 못했습니다: ' + (e && e.message ? e.message : e); err.hidden = false; }
  }

  // ------------------------------------------------------------ 이어 붙이기
  function pick(id, fn) { $(id).addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) fn(f); e.target.value = ''; }); }
  pick('file', handleFile);
  pick('answer', handleAnswer);
  pick('rulefile', function (f) {
    var fr = new FileReader();
    fr.onload = function () {
      try { setRules(JSON.parse(String(fr.result).replace(/^﻿/, '')), f.name + ' (직접 고른 파일)'); }
      catch (e) { setError('처방 파일을 읽지 못했습니다. JSON 형식이 아닙니다.'); }
    };
    fr.readAsText(f, 'utf-8');
  });
  $('run').addEventListener('click', runClean);
  $('prev').addEventListener('click', function () { goTab(cur - 1); });
  $('next').addEventListener('click', function () { if (cur + 1 < unlocked) goTab(cur + 1); });
  $('dl-xlsx').addEventListener('click', function () { save('정리결과_' + state.baseName + '_' + timeStamp() + '.xlsx', xlsxBlob()); });
  $('dl-clean').addEventListener('click', function () { save('정리본_' + state.baseName + '_' + timeStamp() + '.csv', csvBlob('정리본')); });
  $('dl-changes').addEventListener('click', function () { save('바꾼기록_' + state.baseName + '_' + timeStamp() + '.csv', csvBlob('바꾼기록')); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  goTab(0);
  window.CleanerApp = { state: state, handleFile: handleFile, handleAnswer: handleAnswer, run: runClean, setRules: setRules, xlsxBlob: xlsxBlob, csvBlob: csvBlob };
})();
