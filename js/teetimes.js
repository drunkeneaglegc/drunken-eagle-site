/* =====================================================================
   TEE TIMES — shared simulator tee sheet.
   Tap an open start time, pick your name, enter the league PIN.
   Each reservation holds the sim for the configured length (default 2 hrs).
   ===================================================================== */
(function () {
  const S = window.Store, C = window.C;
  const { esc, icon, av, toast } = window.App;
  const $ = (s, el = document) => el.querySelector(s);
  const LS_PIN = "degl-tee-pin", LS_NAME = "degl-tee-name";
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const st = { day: null, data: [], rules: null, loadedAt: 0, loading: false, night: false, err: null };
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtT = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fmtD = (d, o) => d.toLocaleDateString(undefined, o || { weekday: "short", month: "short", day: "numeric" });
  const enrich = (b) => ({ ...b, s: new Date(b.slot_start), e: new Date(b.slot_end) });

  async function load(force) {
    if (st.loading) return;
    if (!force && Date.now() - st.loadedAt < 20000) return;
    st.loading = true;
    try {
      st.rules = await S.tee.rules();
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(from.getTime() + (st.rules.days_ahead + 2) * 864e5);
      st.data = (await S.tee.list(from.toISOString(), to.toISOString())).map(enrich);
      st.err = null;
    } catch (e) { st.err = e.message; }
    st.loadedAt = Date.now();
    st.loading = false;
    if (!modalOpen) App.render(true);
  }

  function days() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const n = st.rules ? st.rules.days_ahead : 14;
    return Array.from({ length: n + 1 }, (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + i));
  }
  function bookingsOn(day) {
    const e = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return st.data.filter((b) => b.s < e && b.e > day);
  }
  const player = (b) => (b.player_id ? C.player(b.player_id) : null);
  function gcalFor(b) {
    const f = (x) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const q = new URLSearchParams({ action: "TEMPLATE", text: `Sim tee time — ${b.player_name}`, dates: `${f(b.s)}/${f(b.e)}`, details: "Drunken Eagle Golf League simulator reservation" + (b.note ? ` · ${b.note}` : ""), location: S.settings().venue || "" });
    return `https://calendar.google.com/calendar/render?${q}`;
  }

  /* ---------------- page ---------------- */
  function page() {
    if (st.err && !st.rules) return `<div class="empty">${icon("clock")}<b>Couldn't load the tee sheet</b>${esc(st.err)}</div>`;
    if (!st.rules) return `<div class="empty">${icon("clock")}<b>Loading tee sheet…</b></div>`;
    const r = st.rules, ds = days();
    if (!st.day || !ds.some((d) => dkey(d) === st.day)) st.day = dkey(ds[0]);
    const lenH = r.length_min % 60 ? `${r.length_min} min` : `${r.length_min / 60}-hour`;
    let h = `<p class="muted" style="margin:-6px 0 14px">${lenH} tee times · start every ${r.step_min} min · book up to ${r.days_ahead} days ahead. Everyone can see who has the sim.</p>`;
    if (!r.pin_set) h += `<div class="notice warn mb">Booking opens once the league admin sets the league PIN.</div>`;
    h += `<div class="chips mb tee-days">${ds.map((d, i) => {
      const n = bookingsOn(d).length;
      return `<button class="chip tee-day ${dkey(d) === st.day ? "on" : ""}" data-tee-day="${dkey(d)}"><b>${i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmtD(d, { weekday: "short" })}</b><span>${fmtD(d, { month: "short", day: "numeric" })}</span><i>${n ? n + " booked" : "Open"}</i></button>`;
    }).join("")}</div>`;

    const day = parseKey(st.day), next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const step = r.step_min * 60000, len = r.length_min * 60000, now = Date.now();
    const bs = bookingsOn(day);
    const rows = [], seen = new Set();
    for (let t = new Date(day); t < next; t = new Date(t.getTime() + step)) {
      const tt = t.getTime();
      const cover = bs.find((b) => b.s.getTime() <= tt && b.e.getTime() > tt);
      if (cover) {
        if (!seen.has(cover.id) && cover.e.getTime() > now) { seen.add(cover.id); rows.push({ type: "booked", b: cover, t }); }
        continue;
      }
      if (tt < now) continue;
      const nb = bs.find((b) => b.s.getTime() > tt && b.s.getTime() < tt + len);
      rows.push({ type: nb ? "blocked" : "open", t, nb, late: t.getHours() < 6 });
    }
    const hiddenLate = rows.filter((x) => x.late && x.type !== "booked");
    const visible = st.night ? rows : rows.filter((x) => !(x.late && x.type !== "booked"));
    h += `<div class="lb tee-sheet"><div class="lb-head"><h3>${fmtD(day, { weekday: "long", month: "long", day: "numeric" })}</h3><span class="small">${bs.length} reservation${bs.length === 1 ? "" : "s"}</span></div>`;
    if (hiddenLate.length) h += `<button class="tee-night" data-tee-night>${st.night ? "Hide" : "Show"} late-night times (12:00–5:30 AM)</button>`;
    if (!visible.length) h += `<div class="empty" style="border:0">No more start times today. Pick another day above.</div>`;
    h += visible.map((x) => {
      const tl = `<span class="tt">${fmtT(x.t)}</span>`;
      if (x.type === "booked") {
        const b = x.b, p = player(b), live = b.s.getTime() <= now;
        return `<button class="tee-row booked ${live ? "live" : ""}" data-tee-view="${esc(b.id)}">${`<span class="tt">${fmtT(b.s)}</span>`}<span class="tee-who">${p ? av(p) : `<span class="av">${esc((b.player_name || "?").slice(0, 1).toUpperCase())}</span>`}<span><b>${esc(b.player_name)}</b><small>${fmtT(b.s)} – ${fmtT(b.e)}${b.s < day ? ` (from ${fmtD(b.s, { weekday: "short" })})` : ""}${b.note ? " · " + esc(b.note) : ""}</small></span></span><span class="tag ${live ? "live" : ""}" style="${live ? "color:var(--up)" : "color:var(--gold-2);border-color:rgba(201,162,74,.4)"}">${live ? "On the sim" : "Reserved"}</span></button>`;
      }
      if (x.type === "blocked") {
        const mins = Math.round((x.nb.s - x.t) / 60000);
        return `<div class="tee-row blocked">${tl}<span class="small">Only ${mins} min before ${esc(x.nb.player_name)}'s ${fmtT(x.nb.s)} tee time</span><span></span></div>`;
      }
      const end = new Date(x.t.getTime() + len);
      return `<button class="tee-row open" data-tee-book="${x.t.toISOString()}" ${r.pin_set ? "" : "disabled"}>${tl}<span class="tee-open">Open · until ${fmtT(end)}</span><span class="tee-cta">Book</span></button>`;
    }).join("");
    h += `</div><p class="small faint mt">Tap a reservation to add it to your calendar or cancel it. Tee sheet refreshes automatically.</p>`;
    return h;
  }

  function homeCard() {
    if (!st.rules) return "";
    const now = new Date(), end = new Date(now); end.setHours(23, 59, 59, 999);
    const today = st.data.filter((b) => b.e > now && b.s <= end);
    return `<div class="section reveal"><div class="sec-head"><h2>Today's Tee Sheet</h2><a class="more" href="#calendar">Tee times →</a></div>
      <div class="card">${today.length ? `<div class="grid" style="gap:8px">${today.map((b) => `<div class="row between"><span class="row">${player(b) ? av(player(b)) : `<span class="av">${esc(b.player_name.slice(0, 1))}</span>`}<b>${esc(b.player_name)}</b></span><span class="small ${b.s <= now ? "gold" : "muted"}">${b.s <= now ? "On the sim now · until " + fmtT(b.e) : fmtT(b.s) + " – " + fmtT(b.e)}</span></div>`).join("")}</div>` : `<p class="muted" style="margin:0">The sim is wide open today.</p>`}
      <a class="btn gold block mt" href="#calendar">${icon("clock")}Book a tee time</a></div></div>`;
  }

  /* ---------------- modals ---------------- */
  let modalOpen = false;
  function modal(html) {
    modalOpen = true;
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<form class="modal" novalidate>${html}</form>`;
    document.body.appendChild(bg);
    const close = () => { bg.remove(); modalOpen = false; App.render(true); };
    bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-x]")) close(); });
    return { form: $("form", bg), close };
  }
  function nameField(selected) {
    const ps = C.players().filter((p) => p.active !== false);
    const match = ps.find((p) => C.name(p).toLowerCase() === String(selected || "").toLowerCase());
    if (!ps.length) return `<div class="field"><label>Your name</label><input name="other" type="text" required value="${esc(selected || "")}" autocomplete="name"></div>`;
    return `<div class="field"><label>Your name</label><select name="who">${`<option value="">— Choose your name —</option>`}${ps.map((p) => `<option value="${p.id}" ${match && match.id === p.id ? "selected" : ""}>${esc(C.name(p))}</option>`).join("")}<option value="__other" ${selected && !match ? "selected" : ""}>Someone else…</option></select></div>
      <div class="field" data-other style="${selected && !match ? "" : "display:none"}"><label>Name</label><input name="other" type="text" value="${esc(selected && !match ? selected : "")}" autocomplete="name"></div>`;
  }
  function readName(form) {
    const sel = form.who;
    if (!sel) return { id: "", name: form.other.value.trim() };
    if (sel.value === "__other") return { id: "", name: form.other.value.trim() };
    const p = C.player(sel.value);
    return { id: p ? p.id : "", name: p ? C.name(p) : "" };
  }
  function bindName(form) {
    const sel = form.who;
    if (sel) sel.addEventListener("change", () => { form.querySelector("[data-other]").style.display = sel.value === "__other" ? "" : "none"; });
  }
  const pinField = () => `<div class="field"><label>League PIN</label><input name="pin" type="password" inputmode="numeric" autocomplete="off" value="${esc(ls.get(LS_PIN) || "")}" placeholder="Ask the league admin"></div>
    <label class="check"><input type="checkbox" name="remember" ${ls.get(LS_PIN) ? "checked" : ""}> Remember my name & PIN on this device</label>`;
  function remember(form, name, pin) {
    if (form.remember && form.remember.checked) { ls.set(LS_PIN, pin); ls.set(LS_NAME, name); }
    else { ls.del(LS_PIN); }
  }

  function openBook(iso) {
    const s = new Date(iso), e = new Date(s.getTime() + st.rules.length_min * 60000);
    const m = modal(`<h2>Book the sim</h2>
      <div class="tee-when"><b>${fmtD(s, { weekday: "long", month: "long", day: "numeric" })}</b><span>${fmtT(s)} – ${fmtT(e)}</span></div>
      ${nameField(ls.get(LS_NAME) || "")}
      <div class="field"><label>Note (optional)</label><input name="note" type="text" maxlength="120" placeholder="e.g. Playing with Mike, practicing for league night"></div>
      ${pinField()}
      <div class="modal-actions"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn gold" type="submit">Reserve ${fmtT(s)}</button></div>`);
    bindName(m.form);
    m.form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const who = readName(m.form), pin = m.form.pin.value.trim();
      if (!who.name) return toast("Choose your name", true);
      if (!pin) return toast("Enter the league PIN", true);
      const btn = m.form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        await S.tee.book(iso, who.id, who.name, pin, m.form.note.value);
        remember(m.form, who.name, pin);
        toast(`Booked! ${fmtT(s)} – ${fmtT(e)} is yours`);
        m.close(); load(true);
      } catch (err) { toast(err.message, true); btn.disabled = false; load(true); }
    });
  }

  function openView(id) {
    const b = st.data.find((x) => x.id === id);
    if (!b) return;
    const p = player(b);
    const m = modal(`<h2>Tee time</h2>
      <div class="tee-when"><b>${esc(b.player_name)}</b><span>${fmtD(b.s, { weekday: "long", month: "long", day: "numeric" })} · ${fmtT(b.s)} – ${fmtT(b.e)}</span>${b.note ? `<span class="muted">${esc(b.note)}</span>` : ""}</div>
      <div class="row wrap-row mb">${p ? `<a class="btn sm" href="#player-${p.id}" data-x>${icon("user")}View profile</a>` : ""}<a class="btn sm" href="${gcalFor(b)}" target="_blank" rel="noopener">${icon("plus")}Add to my Google Calendar</a></div>
      <details class="mt" ${ls.get(LS_NAME) && ls.get(LS_NAME).toLowerCase() === b.player_name.toLowerCase() ? "open" : ""}><summary style="font-weight:800;cursor:pointer;padding:8px 0">Cancel this reservation</summary>
        <p class="small muted">Only the person who booked it can cancel. Choose your name and enter the league PIN.</p>
        ${nameField(ls.get(LS_NAME) || "")}${pinField()}
        <button class="btn danger block mt" type="submit">Cancel reservation</button>
      </details>
      ${S.isAdmin() ? `<button type="button" class="btn danger block mt" data-admin-del>Remove reservation (admin)</button>` : ""}
      <div class="modal-actions"><button type="button" class="btn ghost" data-x>Close</button></div>`);
    bindName(m.form);
    m.form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const who = readName(m.form), pin = m.form.pin.value.trim();
      if (!who.name || !pin) return toast("Choose your name and enter the PIN", true);
      try { await S.tee.cancel(b.id, who.name, pin); remember(m.form, who.name, pin); toast("Reservation cancelled"); m.close(); load(true); }
      catch (err) { toast(err.message, true); }
    });
    const ad = m.form.querySelector("[data-admin-del]");
    if (ad) ad.addEventListener("click", async () => {
      try { await S.tee.adminDelete(b.id); toast("Reservation removed"); m.close(); load(true); } catch (err) { toast(err.message, true); }
    });
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tee-day],[data-tee-book],[data-tee-view],[data-tee-night]");
    if (!t || t.closest(".modal")) return;
    if (t.dataset.teeDay) { st.day = t.dataset.teeDay; App.render(true); return; }
    if (t.hasAttribute("data-tee-night")) { st.night = !st.night; App.render(true); return; }
    if (t.dataset.teeBook) return openBook(t.dataset.teeBook);
    if (t.dataset.teeView) return openView(t.dataset.teeView);
  });

  window.Tee = {
    state: st, page, homeCard, load,
    busy: () => modalOpen,
    after(routeName) {
      if (routeName === "calendar" || routeName === "home" || routeName === "admin") {
        load(false);
        App.timer(() => { if (!modalOpen && document.visibilityState === "visible") load(true); }, 30000);
        const sel = document.querySelector(".tee-day.on");
        if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: "center", block: "nearest" });
      }
    }
  };
})();
