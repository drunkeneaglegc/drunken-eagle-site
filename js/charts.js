/* Lightweight SVG charts (no library = fast on mobile data). */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function niceRange(min, max, ticks = 4) {
    if (min === max) { min -= 2; max += 2; }
    const span = max - min;
    const step = Math.pow(10, Math.floor(Math.log10(span / ticks)));
    const err = span / ticks / step;
    const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    const st = mult * step;
    const lo = Math.floor(min / st) * st, hi = Math.ceil(max / st) * st;
    const out = [];
    for (let v = lo; v <= hi + 1e-9; v += st) out.push(Math.round(v * 100) / 100);
    return { lo, hi, ticks: out };
  }

  function draw(el) {
    const cfg = JSON.parse(el.getAttribute("data-chart"));
    const pts = cfg.points || [];
    if (!pts.length) { el.innerHTML = ""; return; }
    const W = 600, H = cfg.height || 220, L = 40, R = 14, T = 16, B = 32;
    const ys = pts.map((p) => p.y);
    const zero = cfg.type === "bar";
    const r = niceRange(zero ? 0 : Math.min(...ys), Math.max(...ys));
    const x = (i) => (cfg.type === "bar" ? L + ((W - L - R) / pts.length) * (i + 0.5) : pts.length === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (pts.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - r.lo) / (r.hi - r.lo || 1));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.label || "Chart")}">`;
    r.ticks.forEach((t) => {
      s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(233,228,210,.08)"/>`;
      s += `<text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="#8fa196">${t}</text>`;
    });
    pts.forEach((p, i) => { s += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#8fa196">${esc(p.label)}</text>`; });
    if (cfg.type === "bar") {
      const bw = Math.min(34, ((W - L - R) / pts.length) * 0.56);
      pts.forEach((p, i) => {
        const top = y(p.y), base = y(0), h = Math.max(0, base - top);
        if (h > 0) s += `<path d="M${x(i) - bw / 2} ${base} V${top + 4} q0 -4 4 -4 H${x(i) + bw / 2 - 4} q4 0 4 4 V${base} Z" fill="${cfg.color || "#c9a24a"}"/>`;
      });
    } else {
      const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.y)}`).join(" ");
      s += `<path d="${d}" fill="none" stroke="${cfg.color || "#e8cc7a"}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((p, i) => { s += `<circle cx="${x(i)}" cy="${y(p.y)}" r="4.5" fill="${cfg.color || "#e8cc7a"}" stroke="#0f2219" stroke-width="2"/>`; });
    }
    s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="rgba(233,228,210,.3)" stroke-dasharray="3 3" opacity="0"/>`;
    const slot = (W - L - R) / Math.max(1, cfg.type === "bar" ? pts.length : pts.length - 1 || 1);
    pts.forEach((p, i) => {
      const w = cfg.type === "bar" ? slot : pts.length === 1 ? W - L - R : slot;
      s += `<rect data-i="${i}" x="${x(i) - w / 2}" y="${T}" width="${w}" height="${H - T - B}" fill="transparent"/>`;
    });
    s += `</svg><div class="tip"></div>`;
    el.innerHTML = s;
    const tip = el.querySelector(".tip"), xh = el.querySelector(".xh"), svg = el.querySelector("svg");
    const show = (i) => {
      const p = pts[i];
      const rect = svg.getBoundingClientRect(), k = rect.width / W;
      tip.innerHTML = `<b>${esc(p.tip || p.label)}</b><br>${esc(cfg.unit || "")} ${esc(p.y)}`;
      tip.style.left = x(i) * k + "px";
      tip.style.top = y(p.y) * k + "px";
      tip.classList.add("on");
      if (cfg.type !== "bar") { xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", "1"); }
    };
    const hide = () => { tip.classList.remove("on"); xh.setAttribute("opacity", "0"); };
    el.querySelectorAll("rect[data-i]").forEach((rc) => {
      rc.addEventListener("pointerenter", () => show(+rc.dataset.i));
      rc.addEventListener("pointerdown", () => show(+rc.dataset.i));
    });
    svg.addEventListener("pointerleave", hide);
  }

  window.Charts = {
    html(cfg) { return `<div class="chart" data-chart='${esc(JSON.stringify(cfg))}'></div>`; },
    mount(root) { (root || document).querySelectorAll(".chart[data-chart]").forEach(draw); }
  };
})();
