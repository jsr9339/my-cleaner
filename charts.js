/* 가안용 그래프 도구: 외부 라이브러리 없이 SVG 로 그린다. (가안 화면 전용, 실제 정리기와는 무관) */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  function css(name, fallback) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
  function el(tag, attrs, parent, text) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
  function nice(max) { var p = Math.pow(10, Math.floor(Math.log10(max || 1))), m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

  // 묶음 막대: labels[], series[{name,color,values[]}]
  function bars(host, labels, series, o) {
    o = o || {}; host.textContent = '';
    var W = o.width || 520, Hh = o.height || 220, L = 44, R = 8, T = 10, B = 26;
    var all = [].concat.apply([], series.map(function (s) { return s.values; }));
    var ymax = o.max || nice(Math.max.apply(null, all) * 1.08), n = labels.length, g = (W - L - R) / n;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: '100%', role: 'img' }, host);
    for (var i = 0; i <= 4; i++) {
      var y = T + (Hh - T - B) * (1 - i / 4);
      el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: css('--grid', '#e5eaf3'), 'stroke-dasharray': i ? '3 4' : '0' }, svg);
      el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: css('--muted', '#646a73') }, svg, fmt(Math.round(ymax * i / 4)));
    }
    var bw = Math.min(26, g / (series.length + 1.2));
    labels.forEach(function (lb, k) {
      var cx = L + g * k + g / 2;
      series.forEach(function (s, j) {
        var v = s.values[k], h = (Hh - T - B) * (v / ymax), x = cx - (series.length * bw) / 2 + j * bw;
        el('rect', { x: x, y: Hh - B - h, width: bw - 2, height: h, rx: 3, fill: s.color }, svg).appendChild(el('title', {}, null, lb + ' · ' + s.name + ' ' + fmt(v)));
      });
      el('text', { x: cx, y: Hh - 8, 'text-anchor': 'middle', 'font-size': 11, fill: css('--muted', '#646a73') }, svg, lb);
    });
  }

  // 가로 막대: items[{label,value,color}]
  function hbars(host, items, o) {
    o = o || {}; host.textContent = '';
    var max = o.max || Math.max.apply(null, items.map(function (x) { return x.value; })) || 1;
    items.forEach(function (it) {
      var row = document.createElement('div'); row.className = 'hb-row';
      var lb = document.createElement('span'); lb.className = 'hb-label'; lb.textContent = it.label;
      var tr = document.createElement('span'); tr.className = 'hb-track';
      var fl = document.createElement('span'); fl.className = 'hb-fill'; fl.style.width = Math.max(1.5, 100 * it.value / max) + '%'; fl.style.background = it.color || css('--blue', '#3370ff');
      tr.appendChild(fl);
      var vv = document.createElement('span'); vv.className = 'hb-val'; vv.textContent = fmt(it.value);
      row.appendChild(lb); row.appendChild(tr); row.appendChild(vv); host.appendChild(row);
    });
  }

  // 도넛: parts[{label,value,color}]
  function donut(host, parts, o) {
    o = o || {}; host.textContent = '';
    var S = 150, r = 56, sw = 18, c = 2 * Math.PI * r, total = parts.reduce(function (a, p) { return a + p.value; }, 0), off = 0;
    var wrap = document.createElement('div'); wrap.className = 'donut';
    var svg = el('svg', { viewBox: '0 0 ' + S + ' ' + S, width: 150, height: 150, role: 'img' }, wrap);
    el('circle', { cx: S / 2, cy: S / 2, r: r, fill: 'none', stroke: css('--grid', '#e5eaf3'), 'stroke-width': sw }, svg);
    parts.forEach(function (p) {
      var len = c * p.value / total;
      el('circle', { cx: S / 2, cy: S / 2, r: r, fill: 'none', stroke: p.color, 'stroke-width': sw, 'stroke-dasharray': len + ' ' + (c - len), 'stroke-dashoffset': -off, transform: 'rotate(-90 ' + S / 2 + ' ' + S / 2 + ')' }, svg);
      off += len;
    });
    el('text', { x: S / 2, y: S / 2 - 2, 'text-anchor': 'middle', 'font-size': 11, fill: css('--muted', '#646a73') }, svg, o.centerTop || '합계');
    el('text', { x: S / 2, y: S / 2 + 18, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: css('--ink', '#1f2329') }, svg, o.centerText || fmt(total));
    var lg = document.createElement('ul'); lg.className = 'legend';
    parts.forEach(function (p) {
      var li = document.createElement('li');
      var dot = document.createElement('i'); dot.style.background = p.color;
      var nm = document.createElement('span'); nm.textContent = p.label;
      var vv = document.createElement('b'); vv.textContent = fmt(p.value);
      li.appendChild(dot); li.appendChild(nm); li.appendChild(vv); lg.appendChild(li);
    });
    wrap.appendChild(lg); host.appendChild(wrap);
  }

  window.Charts = { bars: bars, hbars: hbars, donut: donut, fmt: fmt };
})();
