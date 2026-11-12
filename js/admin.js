/* =====================================================================
   ADMIN DASHBOARD — manage the whole league with no code.
   ===================================================================== */
(function () {
  const S = window.Store, C = window.C;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { esc, icon, av, toast } = window.App;

  const TABS = [
    ["overview", "Overview"], ["scores", "Scores"], ["players", "Players"], ["teams", "Teams"],
    ["schedule", "Schedule"], ["tee", "Tee Times"], ["courses", "Courses"], ["handicaps", "Handicaps"], ["potw", "Player of Week"],
    ["news", "News"], ["photos", "Photos"], ["season", "Season & Settings"], ["data", "Backup"]
  ];
  const CATS = ["Weekly Update", "Player of the Week", "Standings Update", "Schedule Change", "Upcoming Event", "Championship", "Important"];
  const st = { tab: "overview", week: null, holesOpen: {}, showAll: false, modalOpen: false };

  const num = (v) => (v === "" || v === null || v === undefined || isNaN(+v) ? null : +v);
  const today = () => new Date().toISOString().slice(0, 10);
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(l)}</option>`;
  async function guard(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); } catch (e) { console.error(e); toast(e.message || "Something went wrong", true); }
  }

  /* ---------- modal + confirm ---------- */
  function modal(title, body, onSave, saveLabel = "Save") {
    st.modalOpen = true;
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<form class="modal" novalidate><h2>${esc(title)}</h2>${body}<div class="modal-actions"><button type="button" class="btn ghost" data-x>Cancel</button>${onSave ? `<button class="btn gold" type="submit">${esc(saveLabel)}</button>` : ""}</div></form>`;
    document.body.appendChild(bg);
    const form = $("form", bg);
    const close = () => { bg.remove(); st.modalOpen = false; window.App.render(true); };
    $("[data-x]", bg).onclick = close;
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bindPhotos(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try { const r = await onSave(form); if (r !== false) close(); } catch (err) { console.error(err); toast(err.message || "Couldn't save", true); }
      btn.disabled = false;
    });
    const first = $("input,select,textarea", form);
    if (first && window.innerWidth > 720) first.focus();
    return { form, close };
  }
  function confirmBox(msg, label = "Delete") {
    return new Promise((res) => {
      st.modalOpen = true;
      const bg = document.createElement("div");
      bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal"><h2>Are you sure?</h2><p class="muted">${esc(msg)}</p><div class="modal-actions"><button class="btn ghost" data-n>Cancel</button><button class="btn danger" data-y>${esc(label)}</button></div></div>`;
      document.body.appendChild(bg);
      const done = (v) => { bg.remove(); st.modalOpen = false; res(v); if (!v) window.App.render(true); };
      $("[data-n]", bg).onclick = () => done(false);
      $("[data-y]", bg).onclick = () => done(true);
    });
  }
  const fd = (form) => Object.fromEntries(new FormData(form).entries());

  function photoField(name, val, label = "Photo", maxW = 1000) {
    return `<div class="field"><span class="lbl">${esc(label)}</span><label class="photo-drop">${val ? `<img src="${esc(val)}" alt="">` : `${icon("camera")}<span>Tap to upload a photo</span>`}<input type="file" accept="image/*" data-photo="${name}" data-maxw="${maxW}"></label><input type="hidden" name="${name}" value="${esc(val || "")}">${val ? `<button type="button" class="btn sm ghost" data-clearphoto="${name}">Remove photo</button>` : ""}</div>`;
  }
  function bindPhotos(root) {
    $$("input[data-photo]", root).forEach((inp) => {
      inp.addEventListener("change", async () => {
        const f = inp.files[0];
        if (!f) return;
        const drop = inp.closest(".photo-drop");
        drop.querySelector("span") && (drop.querySelector("span").textContent = "Uploading…");
        try {
          const url = await S.uploadImage(f, +inp.dataset.maxw || 1000);
          $(`input[name="${inp.dataset.photo}"]`, root).value = url;
          drop.innerHTML = `<img src="${esc(url)}" alt="">`;
          drop.appendChild(inp);
        } catch (e) { toast("Photo upload failed: " + e.message, true); }
      });
    });
    $$("[data-clearphoto]", root).forEach((b) => b.addEventListener("click", () => {
      $(`input[name="${b.dataset.clearphoto}"]`, root).value = "";
      b.previousElementSibling.previousElementSibling.innerHTML = `${icon("camera")}<span>Photo removed — tap to upload</span><input type="file" accept="image/*" data-photo="${b.dataset.clearphoto}">`;
      bindPhotos(b.parentElement);
      b.remove();
    }));
  }

  /* =====================================================================
     VIEW
     ===================================================================== */
  function view() {
    if (!S.isAdmin()) return loginView();
    const season = C.season();
    let h = `<div class="wrap"><div class="page-head"><div class="eyebrow">Signed in · ${esc(S.adminEmail())}</div><div class="row between wrap-row"><h1>Admin</h1><button class="btn sm ghost" data-a="logout">Sign out</button></div></div>`;
    if (!S.LIVE) h += `<div class="notice warn mb small"><b>Preview mode.</b> Changes are saved in this browser only. Connect the free Supabase database (README, Step 1) so every member sees live results.</div>`;
    h += `<div class="admin-tabs"><div class="chips">${TABS.map(([k, l]) => `<button class="chip ${st.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div></div>`;
    if (!season && !["season", "data", "photos", "courses", "players", "news", "tee"].includes(st.tab)) {
      h += `<div class="section">${seasonSetupCard(true)}</div></div>`;
      return h;
    }
    const fn = { overview, scores, players, teams, schedule, tee: teeTab, courses, handicaps, potw, news, photos, season: seasonTab, data }[st.tab];
    h += `<div class="section" style="padding-top:8px">${fn(season)}</div></div>`;
    return h;
  }

  function loginView() {
    return `<div class="wrap" style="max-width:460px"><div class="page-head center"><img src="${esc(S.settings().photos.logo || (window.DEGL_ASSETS || {}).logo || "")}" alt="" style="width:170px;margin:10px auto 14px;display:block;border-radius:16px;border:1px solid rgba(201,162,74,.45)"><h1>Admin Login</h1><p class="muted" style="margin:8px auto">League administrators only.</p></div>
      <form class="card" id="login-form">
        ${S.LIVE ? `<div class="field"><label for="le">Email</label><input id="le" name="email" type="email" autocomplete="username" required></div>` : ""}
        <div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn gold block" type="submit">${icon("lock")}Sign in</button>
        ${S.LIVE ? "" : `<p class="small faint mt">Preview mode: the password is set in <code>js/config.js</code> (default <b>eagle</b>).</p>`}
      </form><div class="center mt"><a class="small gold" href="#home">← Back to site</a></div></div>`;
  }

  /* ---------------- OVERVIEW ---------------- */
  function overview(season) {
    const sid = season.id, cur = C.currentWeek(sid);
    const ps = C.seasonPlayers(sid), ts = C.teams(sid);
    const noHcp = ps.filter((p) => num(p.handicap) === null);
    const unassigned = C.players().filter((p) => p.active !== false && !C.teamOf(p.id, sid));
    const issues = [];
    if (!ts.length) issues.push(["Create your two-man teams", "teams"]);
    if (unassigned.length) issues.push([`${unassigned.length} active player${unassigned.length > 1 ? "s are" : " is"} not on a team`, "teams"]);
    if (noHcp.length && cur && cur.number > 2) issues.push([`${noHcp.length} player${noHcp.length > 1 ? "s have" : " has"} no handicap`, "handicaps"]);
    C.weeks(sid).filter((w) => w.phase === "bestball").forEach((w) => {
      const need = ts.filter((t) => { const b = C.bestBall(sid, w.number, t.id); return b && b.source === "needs-entry"; });
      if (need.length) issues.push([`Week ${w.number}: ${need.length} team best-ball score${need.length > 1 ? "s" : ""} need entering (no hole-by-hole scores)`, "scores", w.number]);
    });
    C.potwArchive(sid).filter((x) => !x.winner).forEach((x) => issues.push([`Week ${x.week.number}: Player of the Week is tied — pick a winner`, "potw"]));
    C.weeks(sid).filter((w) => w.status === "upcoming" && C.weekDate(w) && C.weekDate(w) < new Date() && C.weekScores(sid, w.number).length).forEach((w) => issues.push([`Week ${w.number} has scores — mark it completed`, "schedule"]));
    return `<div class="grid g2">
      <div class="card"><div class="label">${esc(season.name)}</div><div class="bigweek mt" style="margin-top:6px">Week ${cur ? cur.number : "—"}<small>of 14</small></div><div class="muted">${cur ? C.PHASES[cur.phase].label : ""} · ${cur ? C.fmtDate(C.weekDate(cur)) : ""}</div>
        <div class="row wrap-row mt">${cur ? `<button class="btn gold" data-tab="scores" data-week="${cur.number}">${icon("edit")}Enter Week ${cur.number} scores</button>` : ""}${cur && cur.status !== "completed" ? `<button class="btn" data-a="complete-week" data-n="${cur.number}">Mark Week ${cur.number} complete</button>` : ""}</div></div>
      <div class="card"><div class="label">League at a glance</div><div class="kv mt">
        <div><div class="k">Players</div><div class="v">${ps.length}</div></div><div><div class="k">Teams</div><div class="v">${ts.length}</div></div>
        <div><div class="k">Rounds posted</div><div class="v">${C.scores(sid).length}</div></div><div><div class="k">Courses</div><div class="v">${C.courses().length}</div></div></div></div>
    </div>
    <div class="section"><div class="sec-head"><h2>To-do</h2></div>${issues.length ? `<div class="card pad0">${issues.map(([t, tab, w]) => `<button class="admin-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left" data-tab="${tab}" ${w ? `data-week="${w}"` : ""}><span class="phase-dot" style="background:var(--gold)"></span><span class="t"><b>${esc(t)}</b></span>${icon("arrow")}</button>`).join("")}</div>` : `<div class="notice ok">All caught up. Standings, stats and Player of the Week are up to date.</div>`}</div>
    <div class="section"><div class="sec-head"><h2>Quick actions</h2></div><div class="grid g3">
      <button class="btn" data-a="add-player">${icon("plus")}Add player</button><button class="btn" data-a="add-team">${icon("plus")}Create team</button><button class="btn" data-a="add-post">${icon("plus")}Post announcement</button>
      <button class="btn" data-a="add-course">${icon("plus")}Add course</button><button class="btn" data-tab="schedule">${icon("cal")}Edit schedule</button><button class="btn" data-tab="handicaps">${icon("gauge")}Update handicaps</button></div></div>`;
  }

  /* ---------------- SCORES ---------------- */
  function scores(season) {
    const sid = season.id, ws = C.weeks(sid);
    if (!st.week) st.week = (C.currentWeek(sid) || ws[0]).number;
    const w = C.week(sid, st.week);
    const course = C.course(w.courseId);
    const holeMode = C.hasHolePars(course);
    const teamed = C.teams(sid).flatMap((t) => C.teamPlayers(t).map((p) => ({ p, t })));
    const others = C.players().filter((p) => p.active !== false && !teamed.some((x) => x.p.id === p.id)).map((p) => ({ p, t: null }));
    const withScores = C.scores(sid).filter((s) => s.week === w.number).map((s) => s.playerId);
    const list = teamed.concat(others.filter((x) => st.showAll || withScores.includes(x.p.id)));
    let h = `<div class="chips mb">${ws.map((x) => `<button class="chip ${x.number === st.week ? "on" : ""}" data-week="${x.number}">Wk ${x.number}${x.status === "completed" ? " ✓" : ""}</button>`).join("")}</div>`;
    h += `<div class="card mb"><div class="row between wrap-row"><div><div class="label">Week ${w.number}${C.leagueWeek(w.number) ? " · League Week " + C.leagueWeek(w.number) : ""}</div><h3 style="margin-top:4px">${C.PHASES[w.phase].label}</h3><div class="small muted">${C.fmtDate(C.weekDate(w))} · ${course ? esc(course.name) : "No course selected"}</div></div><span class="tag ${w.status}">${w.status}</span></div>
      <div class="f2 mt"><div class="field" style="margin:0"><label>Course</label><select data-weekcourse="${w.id}">${opt("", "— Select course —")}${C.courses().map((c) => opt(c.id, c.name, c.id === w.courseId)).join("")}</select></div>
      <div class="field" style="margin:0"><label>Status</label><select data-weekstatus="${w.id}">${["upcoming", "completed", "postponed"].map((s) => opt(s, s[0].toUpperCase() + s.slice(1), w.status === s)).join("")}</select></div></div>
      ${w.phase === "hcp" ? `<p class="small muted" style="margin-bottom:0">Handicap-setting round: tracked for handicaps, not counted in standings.</p>` : ""}
      ${!holeMode ? `<p class="small faint" style="margin-bottom:0">Tip: add hole pars to this course to enter hole-by-hole scores — birdies, eagles, pars and best ball then calculate automatically.</p>` : ""}</div>`;
    if (!list.length) return h + `<div class="empty">Add players and teams first.</div>`;
    h += `<div class="card pad0" id="score-form">${list.map(({ p, t }) => scoreRow(sid, w, p, t, course, holeMode)).join("")}</div>
      <label class="check mt"><input type="checkbox" data-a="showall" ${st.showAll ? "checked" : ""}> Show players not on a team (subs)</label>
      <div class="row mt" style="position:sticky;bottom:calc(var(--nav-h) + var(--safe-b) + 8px);z-index:5"><button class="btn gold block" data-a="save-scores" style="box-shadow:var(--shadow)">Save Week ${w.number} scores</button></div>`;
    if (w.phase === "bestball") {
      h += `<div class="section"><div class="sec-head"><h2>Team Net Best Ball</h2></div><p class="small muted">Calculated automatically when both partners have hole-by-hole scores. Otherwise enter the team's net best ball score here (an entry here always overrides).</p>
      <div class="card pad0">${C.teams(sid).map((tm) => { const b = C.bestBall(sid, w.number, tm.id); const man = S.all("teamscore").find((x) => x.seasonId === sid && x.week === w.number && x.teamId === tm.id); return `<div class="admin-row"><span class="t"><b>${esc(tm.name)}</b><span>${b ? (b.source === "auto" ? `Auto: ${b.net}` : b.source === "solo" ? `One player only: ${b.net}` : b.source === "manual" ? `Entered: ${b.net}` : "Needs entry") : "No scores yet"}</span></span><span></span><input type="number" inputmode="decimal" style="width:96px" placeholder="Override" data-bb="${tm.id}" data-bbid="${man ? man.id : ""}" value="${man ? esc(man.net) : ""}"></div>`; }).join("")}</div>
      <button class="btn green block mt" data-a="save-bb">Save best ball scores</button></div>`;
    }
    return h;
  }
  function scoreRow(sid, w, p, t, course, holeMode) {
    const s = C.scores(sid).find((x) => x.week === w.number && x.playerId === p.id);
    const hcp = s ? s.hcp : p.handicap;
    const d = s ? C.detail(s) : null;
    const open = st.holesOpen[p.id] || (s && s.holes && s.holes.length === 18);
    return `<div class="score-entry" data-pid="${p.id}" data-sid="${s ? s.id : ""}">
      <div class="row" style="margin-bottom:8px">${av(p)}<div style="min-width:0;flex:1"><b>${esc(C.name(p))}</b><div class="small muted">${t ? esc(t.name) : "Sub / no team"}</div></div>${s ? `<button class="icon-btn" data-a="del-score" data-id="${s.id}" aria-label="Delete score" title="Delete score">${icon("x")}</button>` : ""}</div>
      <div class="line"><div class="field" style="margin:0"><label>Gross</label><input type="number" inputmode="numeric" name="gross" value="${s && !(s.holes && s.holes.length === 18) ? esc(s.gross ?? "") : d ? d.gross : ""}" ${open && holeMode ? "readonly" : ""} placeholder="—"></div>
        <div class="field" style="margin:0"><label>HCP used</label><input type="number" inputmode="decimal" step="0.1" name="hcp" value="${esc(hcp ?? "")}" placeholder="0"></div>
        <div><div class="lbl center">Net</div><div class="net" data-net>${d ? d.net : "—"}</div></div></div>
      ${holeMode ? `<button type="button" class="btn sm ghost mt" style="margin-top:8px" data-a="toggle-holes" data-pid="${p.id}">${open ? "Hide" : "Enter"} hole-by-hole</button>` : ""}
      ${holeMode && open ? `<div class="holes-grid mt">${course.holes.map((hh, i) => `<label>${i + 1}<span class="faint">P${hh.par}</span><input type="number" inputmode="numeric" data-hole="${i}" value="${s && s.holes ? esc(s.holes[i] ?? "") : ""}"></label>`).join("")}</div>` : ""}
      ${!(holeMode && open) ? `<div class="f3 mt"><div class="field" style="margin:0"><label>Birdies</label><input type="number" inputmode="numeric" name="birdies" value="${esc(s ? s.birdies ?? "" : "")}"></div><div class="field" style="margin:0"><label>Eagles</label><input type="number" inputmode="numeric" name="eagles" value="${esc(s ? s.eagles ?? "" : "")}"></div><div class="field" style="margin:0"><label>Pars</label><input type="number" inputmode="numeric" name="pars" value="${esc(s ? s.pars ?? "" : "")}"></div></div>` : `<div class="small muted mt" data-auto>${d ? `Auto: ${d.birdies} birdies · ${d.eagles} eagles · ${d.pars} pars` : "Birdies, eagles & pars calculate automatically"}</div>`}
      <details class="mt small"><summary class="faint">Net override (rarely needed)</summary><input type="number" inputmode="decimal" step="0.1" name="netOverride" value="${esc(s && s.netOverride !== undefined && s.netOverride !== null ? s.netOverride : "")}" placeholder="Leave blank to calculate" style="margin-top:6px"></details>
    </div>`;
  }
  function liveNet(row) {
    const holes = $$("[data-hole]", row).map((i) => num(i.value));
    let gross = num($("[name=gross]", row).value);
    if (holes.length && holes.every((x) => x !== null)) { gross = holes.reduce((a, b) => a + b, 0); $("[name=gross]", row).value = gross; }
    const hcp = num($("[name=hcp]", row).value) || 0;
    const ov = num($("[name=netOverride]", row).value);
    $("[data-net]", row).textContent = ov !== null ? ov : gross !== null ? C.round1(gross - C.playingHcp(hcp)) : "—";
  }
  async function saveScores() {
    const season = C.season(), sid = season.id, w = C.week(sid, st.week);
    const items = [];
    $$(".score-entry").forEach((row) => {
      const holes = $$("[data-hole]", row).map((i) => num(i.value));
      const hasHoles = holes.length === 18 && holes.every((x) => x !== null);
      const partialHoles = holes.some((x) => x !== null) && !hasHoles;
      const gross = hasHoles ? holes.reduce((a, b) => a + b, 0) : num($("[name=gross]", row).value);
      if (gross === null && !partialHoles) return;
      if (partialHoles) throw new Error(`${C.name(C.player(row.dataset.pid))}: fill in all 18 holes or clear them`);
      const existing = row.dataset.sid ? S.get("score", row.dataset.sid) : null;
      const data = {
        ...(existing || {}), seasonId: sid, week: w.number, playerId: row.dataset.pid, gross,
        hcp: num($("[name=hcp]", row).value) ?? 0,
        netOverride: num($("[name=netOverride]", row).value)
      };
      const holeInputs = $$("[data-hole]", row).length > 0;
      if (hasHoles) data.holes = holes;
      else if (holeInputs) data.holes = null;
      else data.holes = existing && existing.holes && existing.holes.length === 18 && existing.holes.reduce((a, b) => a + b, 0) === gross ? existing.holes : null;
      ["birdies", "eagles", "pars"].forEach((k) => { const el = $(`[name=${k}]`, row); if (el) data[k] = num(el.value) ?? 0; });
      items.push({ kind: "score", data });
    });
    if (!items.length) throw new Error("No scores entered yet.");
    await S.saveMany(items);
    toast(`Saved ${items.length} score${items.length > 1 ? "s" : ""} — standings updated`);
  }

  /* ---------------- PLAYERS ---------------- */
  function players(season) {
    const sid = season && season.id;
    const ps = C.players();
    return `<button class="btn gold block mb" data-a="add-player">${icon("plus")}Add player</button>
      ${ps.length ? `<div class="card pad0">${ps.map((p) => { const t = sid && C.teamOf(p.id, sid); return `<div class="admin-row">${av(p)}<span class="t"><b>${esc(C.name(p))}${p.active === false ? ` <span class="tag">inactive</span>` : ""}</b><span>${t ? esc(t.name) : "No team"} · HCP ${C.fmtHcp(p.handicap)}</span></span><span class="row" style="gap:6px"><button class="icon-btn" data-a="edit-player" data-id="${p.id}" aria-label="Edit">${icon("edit")}</button><button class="icon-btn" data-a="del-player" data-id="${p.id}" aria-label="Remove">${icon("x")}</button></span></div>`; }).join("")}</div>` : `<div class="empty">No players yet. Add your first golfer.</div>`}`;
  }
  function playerForm(p = {}) {
    const season = C.season(), sid = season && season.id;
    const cur = sid && p.id ? C.teamOf(p.id, sid) : null;
    const open = sid ? C.teams(sid).filter((t) => !t.player1Id || !t.player2Id || (cur && t.id === cur.id)) : [];
    modal(p.id ? "Edit player" : "Add player", `
      <div class="f2"><div class="field"><label>First name</label><input name="first" type="text" required value="${esc(p.first || "")}"></div><div class="field"><label>Last name</label><input name="last" type="text" value="${esc(p.last || "")}"></div></div>
      <div class="f2"><div class="field"><label>Nickname</label><input name="nickname" type="text" value="${esc(p.nickname || "")}"></div><div class="field"><label>Handicap</label><input name="handicap" type="number" step="0.1" inputmode="decimal" value="${esc(p.handicap ?? "")}" placeholder="Set later"><span class="hint">Plus handicap? Enter a negative number.</span></div></div>
      ${sid ? `<div class="field"><label>Team (${esc(season.name)})</label><select name="teamId">${opt("", "— No team —")}${open.map((t) => opt(t.id, t.name, cur && cur.id === t.id)).join("")}</select></div>` : ""}
      ${photoField("photo", p.photo, "Player photo", 900)}
      <div class="field"><label>Bio / fun fact</label><textarea name="bio">${esc(p.bio || "")}</textarea></div>
      <label class="check"><input type="checkbox" name="active" ${p.active === false ? "" : "checked"}> Active this season</label>`,
      async (form) => {
        const v = fd(form);
        if (!v.first.trim()) throw new Error("First name is required.");
        const hc = num(v.handicap);
        const saved = await S.save("player", { ...p, first: v.first.trim(), last: v.last.trim(), nickname: v.nickname.trim(), photo: v.photo, bio: v.bio, active: !!form.active.checked, handicap: hc });
        if (hc !== num(p.handicap) && hc !== null) await S.save("hcphist", { playerId: saved.id, seasonId: sid, value: hc, prev: num(p.handicap), date: new Date().toISOString(), note: p.id ? "Updated" : "Initial handicap" });
        if (sid && "teamId" in v) {
          if (cur && cur.id !== v.teamId) await S.save("team", { ...cur, player1Id: cur.player1Id === saved.id ? null : cur.player1Id, player2Id: cur.player2Id === saved.id ? null : cur.player2Id });
          if (v.teamId && (!cur || cur.id !== v.teamId)) { const t = C.team(v.teamId); await S.save("team", { ...t, [t.player1Id ? "player2Id" : "player1Id"]: saved.id }); }
        }
        toast("Player saved");
      });
  }

  /* ---------------- TEAMS ---------------- */
  function teams(season) {
    const sid = season.id, ts = C.teams(sid);
    const free = C.players().filter((p) => p.active !== false && !C.teamOf(p.id, sid));
    return `<button class="btn gold block mb" data-a="add-team">${icon("plus")}Create team</button>
      ${free.length ? `<div class="notice mb small">Not on a team yet: ${free.map((p) => esc(C.name(p))).join(", ")}</div>` : ""}
      ${ts.length ? `<div class="card pad0">${ts.map((t) => `<div class="admin-row"><span class="av-pair">${C.teamPlayers(t).map((p) => av(p)).join("") || av(null)}</span><span class="t"><b>${esc(t.name)}</b><span>${C.teamPlayers(t).map((p) => esc(C.name(p))).join(" & ") || "No players"}</span></span><span class="row" style="gap:6px"><button class="icon-btn" data-a="edit-team" data-id="${t.id}" aria-label="Edit">${icon("edit")}</button><button class="icon-btn" data-a="del-team" data-id="${t.id}" aria-label="Delete">${icon("x")}</button></span></div>`).join("")}</div>` : `<div class="empty">No teams yet for ${esc(season.name)}.</div>`}`;
  }
  function teamForm(t = {}) {
    const season = C.season(), sid = season.id;
    const avail = C.players().filter((p) => { const tm = C.teamOf(p.id, sid); return !tm || tm.id === t.id; });
    const sel = (name, val) => `<select name="${name}">${opt("", "— Choose player —")}${avail.map((p) => opt(p.id, C.name(p), p.id === val)).join("")}</select>`;
    modal(t.id ? "Edit team" : "Create team", `
      <div class="field"><label>Team name</label><input name="name" type="text" required value="${esc(t.name || "")}" placeholder="e.g. Fore Play"></div>
      <div class="f2"><div class="field"><label>Player 1</label>${sel("player1Id", t.player1Id)}</div><div class="field"><label>Player 2</label>${sel("player2Id", t.player2Id)}</div></div>
      <div class="field"><label>Team motto</label><input name="motto" type="text" value="${esc(t.motto || "")}"></div>
      ${photoField("photo", t.photo, "Team photo (optional)", 1200)}`,
      async (form) => {
        const v = fd(form);
        if (!v.name.trim()) throw new Error("Team name is required.");
        if (v.player1Id && v.player1Id === v.player2Id) throw new Error("Pick two different players.");
        await S.save("team", { ...t, seasonId: sid, name: v.name.trim(), player1Id: v.player1Id || null, player2Id: v.player2Id || null, motto: v.motto, photo: v.photo });
        toast("Team saved");
      });
  }

  /* ---------------- SCHEDULE ---------------- */
  function schedule(season) {
    const sid = season.id;
    return `<div class="row wrap-row mb"><button class="btn" data-a="roundrobin">${icon("users")}Auto-fill matchups (round robin)</button><button class="btn ghost" data-a="shift-dates">${icon("cal")}Shift dates</button></div>
      <div class="card pad0">${C.weeks(sid).map((w) => { const c = C.course(w.courseId); return `<div class="admin-row"><span class="wk-num" style="min-width:52px"><span>Wk</span><b style="font-size:24px">${w.number}</b></span><span class="t"><b>${C.fmtDate(C.weekDate(w))} · ${C.fmtTime(w)}</b><span>${C.PHASES[w.phase].short} · ${c ? esc(c.name) : "No course"} · ${(w.matchups || []).length} matchups · <span class="tag ${w.status}" style="padding:1px 6px">${w.status}</span></span></span><button class="icon-btn" data-a="edit-week" data-id="${w.id}" aria-label="Edit week">${icon("edit")}</button></div>`; }).join("")}</div>
      <p class="small faint mt">Tip: keep the league's Google Calendar updated too — it powers the Calendar page.</p>`;
  }
  function weekForm(w) {
    const sid = w.seasonId, ts = C.teams(sid);
    const tsel = (val, i, ab) => `<select data-mu="${i}" data-ab="${ab}">${opt("", "— Team —")}${ts.map((t) => opt(t.id, t.name, t.id === val)).join("")}</select>`;
    const mus = (w.matchups || []).length ? w.matchups : [];
    const muHtml = (list) => list.map((m, i) => `<div class="mu" style="grid-template-columns:1fr auto 1fr auto;margin-bottom:6px">${tsel(m.a, i, "a")}<span class="vs">VS</span>${tsel(m.b, i, "b")}<button type="button" class="icon-btn" data-delmu="${i}">${icon("x")}</button></div>`).join("");
    const ref = modal(`Week ${w.number} · ${C.PHASES[w.phase].short}`, `
      <div class="f2"><div class="field"><label>Date</label><input type="date" name="date" value="${esc(w.date || "")}"></div><div class="field"><label>Start time</label><input type="time" name="time" value="${esc(w.time || "")}"></div></div>
      <div class="field"><label>Course of the week</label><select name="courseId">${opt("", "— Select course —")}${C.courses().map((c) => opt(c.id, c.name, c.id === w.courseId)).join("")}</select></div>
      <div class="field"><label>Status</label><select name="status">${["upcoming", "completed", "postponed"].map((s) => opt(s, s[0].toUpperCase() + s.slice(1), w.status === s)).join("")}</select></div>
      <div class="field"><label>Notes (shown on schedule)</label><input type="text" name="notes" value="${esc(w.notes || "")}" placeholder="e.g. Rain-out makeup · Championship night"></div>
      ${w.phase !== "hcp" ? `<div class="field"><span class="lbl">Team matchups</span><div id="mu-list">${muHtml(mus)}</div><button type="button" class="btn sm" id="add-mu">${icon("plus")}Add matchup</button></div>` : ""}`,
      async (form) => {
        const v = fd(form);
        const list = [];
        $$("#mu-list .mu", form).forEach((row) => { const a = $("[data-ab=a]", row).value, b = $("[data-ab=b]", row).value; if (a || b) list.push({ a, b }); });
        await S.save("week", { ...w, date: v.date, time: v.time, courseId: v.courseId || null, status: v.status, notes: v.notes, matchups: list });
        toast(`Week ${w.number} updated`);
      });
    const f = ref.form;
    const cur = () => $$("#mu-list .mu", f).map((row) => ({ a: $("[data-ab=a]", row).value, b: $("[data-ab=b]", row).value }));
    const rebind = () => $$("[data-delmu]", f).forEach((b) => b.onclick = () => { const l = cur(); l.splice(+b.dataset.delmu, 1); $("#mu-list", f).innerHTML = muHtml(l); rebind(); });
    if ($("#add-mu", f)) $("#add-mu", f).onclick = () => { const l = cur(); l.push({ a: "", b: "" }); $("#mu-list", f).innerHTML = muHtml(l); rebind(); };
    rebind();
  }
  function roundRobin(ids, rounds) {
    const t = ids.slice();
    if (t.length % 2) t.push(null);
    const n = t.length, out = [];
    for (let r = 0; r < rounds; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) pairs.push({ a, b }); }
      out.push(pairs);
      t.splice(1, 0, t.pop());
    }
    return out;
  }

  /* ---------------- TEE TIMES ---------------- */
  function teeTab() {
    const T = window.Tee.state, r = T.rules;
    if (!r) { window.Tee.load(true); return `<div class="empty">Loading tee sheet settings…</div>`; }
    const now = new Date();
    const up = T.data.filter((b) => b.e > now);
    const fmt = (d) => d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `<form class="card mb" id="tee-form"><h3 class="mb">Tee time booking</h3>
      ${r.pin_set ? `<div class="notice ok small mb">Booking is open. Members book with their name + the league PIN.</div>` : `<div class="notice warn small mb">Set a league PIN to open booking. Share it with members (group text, league night).</div>`}
      <div class="field"><label>League PIN</label><input name="pin" type="text" inputmode="numeric" autocomplete="off" placeholder="${r.pin_set ? "PIN is set — type a new one to change it" : "e.g. 1919"}"><span class="hint">Members need this to book or cancel. Change it anytime.</span></div>
      <div class="f3"><div class="field"><label>Days ahead</label><input name="days" type="number" min="1" max="60" value="${r.days_ahead}"></div>
      <div class="field"><label>Length</label><select name="len">${[60, 90, 120, 150, 180].map((m) => opt(m, m % 60 ? m + " min" : m / 60 + " hr" + (m > 60 ? "s" : ""), +r.length_min === m)).join("")}</select></div>
      <div class="field"><label>Start every</label><select name="step">${[15, 30, 60].map((m) => opt(m, m + " min", +r.step_min === m)).join("")}</select></div></div>
      <button class="btn gold block" type="submit">Save booking settings</button></form>
      <div class="sec-head"><h2>Upcoming reservations</h2></div>
      ${up.length ? `<div class="card pad0">${up.map((b) => `<div class="admin-row"><span class="av">${esc((b.player_name || "?").slice(0, 1))}</span><span class="t"><b>${esc(b.player_name)}</b><span>${fmt(b.s)} – ${b.e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}${b.note ? " · " + esc(b.note) : ""}</span></span><button class="icon-btn" data-a="tee-del" data-id="${esc(b.id)}" aria-label="Remove reservation">${icon("x")}</button></div>`).join("")}</div>` : `<div class="empty">No upcoming reservations.</div>`}`;
  }

  /* ---------------- COURSES ---------------- */
  function courses() {
    const cs = C.courses();
    return `<button class="btn gold block mb" data-a="add-course">${icon("plus")}Add course</button>
      ${cs.length ? `<div class="card pad0">${cs.map((c) => `<div class="admin-row"><span class="av" style="border-radius:10px">${c.photo ? `<img src="${esc(c.photo)}" alt="">` : icon("flag")}</span><span class="t"><b>${esc(c.name)}</b><span>${esc(c.location || "")} · Par ${C.coursePar(c)}${C.hasHolePars(c) ? " · scorecard ✓" : ""}</span></span><span class="row" style="gap:6px"><button class="icon-btn" data-a="edit-course" data-id="${c.id}" aria-label="Edit">${icon("edit")}</button><button class="icon-btn" data-a="del-course" data-id="${c.id}" aria-label="Delete">${icon("x")}</button></span></div>`).join("")}</div>` : `<div class="empty">No courses yet. Add the courses your simulator plays.</div>`}`;
  }
  function courseForm(c = {}) {
    const holes = c.holes && c.holes.length === 18 ? c.holes : null;
    const ref = modal(c.id ? "Edit course" : "Add course", `
      <div class="field"><label>Course name</label><input name="name" type="text" required value="${esc(c.name || "")}"></div>
      <div class="field"><label>Location</label><input name="location" type="text" value="${esc(c.location || "")}" placeholder="City, State / Country"></div>
      ${photoField("photo", c.photo, "Course photo", 1600)}
      <div class="field"><label>Description</label><textarea name="description">${esc(c.description || "")}</textarea></div>
      <div class="f2"><div class="field"><label>Difficulty</label><select name="difficulty">${[1, 2, 3, 4, 5].map((n) => opt(n, "★".repeat(n) + " " + ["Easy", "Moderate", "Challenging", "Hard", "Brutal"][n - 1], +c.difficulty === n)).join("")}</select></div><div class="field"><label>Par</label><input name="par" type="number" inputmode="numeric" value="${esc(c.par || 72)}"></div></div>
      <div class="f3"><div class="field"><label>Rating</label><input name="rating" type="number" step="0.1" inputmode="decimal" value="${esc(c.rating || "")}"></div><div class="field"><label>Slope</label><input name="slope" type="number" inputmode="numeric" value="${esc(c.slope || "")}"></div><div class="field"><label>Yardage</label><input name="yardage" type="number" inputmode="numeric" value="${esc(c.yardage || "")}"></div></div>
      <div class="field"><label>Interesting facts (one per line)</label><textarea name="facts">${esc((c.facts || []).join("\n"))}</textarea></div>
      <label class="check"><input type="checkbox" id="use-holes" ${holes ? "checked" : ""}> Add hole-by-hole scorecard (par, handicap index, yards)</label>
      <div id="holes-box" style="${holes ? "" : "display:none"}"><p class="small faint">Needed for automatic birdies/eagles/pars and automatic best ball. HCP = the hole's stroke index (1 = hardest).</p>
        ${Array.from({ length: 18 }, (_, i) => { const hh = holes ? holes[i] : { par: 4, si: i < 9 ? 2 * i + 1 : 2 * (i - 9) + 2, yds: "" }; return `<div class="f3" style="grid-template-columns:40px 1fr 1fr 1fr;align-items:center;margin-bottom:6px"><b class="center">${i + 1}</b><input type="number" inputmode="numeric" name="hp${i}" value="${esc(hh.par)}" aria-label="Hole ${i + 1} par" placeholder="Par"><input type="number" inputmode="numeric" name="hs${i}" value="${esc(hh.si)}" aria-label="Hole ${i + 1} handicap" placeholder="HCP"><input type="number" inputmode="numeric" name="hy${i}" value="${esc(hh.yds || "")}" aria-label="Hole ${i + 1} yards" placeholder="Yds"></div>`; }).join("")}
      </div>`,
      async (form) => {
        const v = fd(form);
        if (!v.name.trim()) throw new Error("Course name is required.");
        const useH = $("#use-holes", form).checked;
        let hs = null;
        if (useH) {
          hs = Array.from({ length: 18 }, (_, i) => ({ par: num(v["hp" + i]), si: num(v["hs" + i]), yds: num(v["hy" + i]) }));
          if (hs.some((h) => !h.par)) throw new Error("Every hole needs a par.");
          const sis = hs.map((h) => h.si).filter(Boolean);
          if (new Set(sis).size !== sis.length) throw new Error("Hole handicap indexes must each be different (1–18).");
        }
        await S.save("course", { ...c, name: v.name.trim(), location: v.location, photo: v.photo, description: v.description, difficulty: +v.difficulty, par: hs ? hs.reduce((a, h) => a + h.par, 0) : num(v.par) || 72, rating: num(v.rating), slope: num(v.slope), yardage: num(v.yardage) || (hs && hs.every((h) => h.yds) ? hs.reduce((a, h) => a + h.yds, 0) : null), facts: v.facts.split("\n").map((x) => x.trim()).filter(Boolean), holes: hs });
        toast("Course saved");
      });
    $("#use-holes", ref.form).onchange = (e) => { $("#holes-box", ref.form).style.display = e.target.checked ? "" : "none"; };
  }

  /* ---------------- HANDICAPS ---------------- */
  function handicaps(season) {
    const sid = season.id, s = S.settings(), h = s.hcp;
    const rows = C.handicapRows(sid);
    return `<div class="card mb"><h3>League handicap formula</h3><p class="small muted">Nothing is assumed — choose how your league calculates handicaps. Suggested values are never applied until you save them.</p>
      <form id="hcp-form"><div class="field"><label>Method</label><select name="method">
        ${opt("manual", "Manual — admin enters every handicap", h.method === "manual")}
        ${opt("avgOverPar", "Average over par — (avg gross − course par) × %", h.method === "avgOverPar")}
        ${opt("differential", "Differential — (gross − rating) × 113 ÷ slope, best X of last Y × %", h.method === "differential")}</select></div>
        <div class="f3"><div class="field"><label>Last rounds (Y)</label><input name="rounds" type="number" value="${esc(h.rounds)}"></div><div class="field"><label>Best of (X)</label><input name="best" type="number" value="${esc(h.best)}"></div><div class="field"><label>Percent %</label><input name="pct" type="number" value="${esc(h.pct)}"></div></div>
        <div class="f3"><div class="field"><label>Max HCP</label><input name="max" type="number" value="${esc(h.max ?? "")}"></div><div class="field"><label>Rounds used</label><select name="source">${opt("all", "All season rounds", h.source === "all")}${opt("hcp", "Weeks 1–2 only", h.source === "hcp")}</select></div><div class="field"><label>Decimals</label><select name="rounding">${opt(0, "Whole numbers", +h.rounding === 0)}${opt(1, "One decimal", +h.rounding === 1)}</select></div></div>
        <button class="btn green" type="submit">Save formula</button></form></div>
      <div class="sec-head"><h2>Player handicaps</h2></div>
      ${rows.length ? `<div class="card pad0" id="hcp-rows">${rows.map((r) => { const sg = C.suggestHcp(r.p.id, sid); return `<div class="admin-row" data-pid="${r.p.id}">${av(r.p)}<span class="t"><b>${esc(C.name(r.p))}</b><span>Avg gross ${C.fmtNum(r.avgGross)} · ${r.hist.length} change${r.hist.length === 1 ? "" : "s"}${sg ? ` · <button type="button" class="gold" style="background:none;border:0;font-weight:800;padding:0" data-sugg="${sg.value}">Suggested ${C.fmtHcp(sg.value)} (use)</button>` : ""}</span></span><input type="number" step="0.1" inputmode="decimal" style="width:86px" value="${esc(r.cur ?? "")}" data-hcp></div>`; }).join("")}</div>
      <div class="field mt"><label>Note for this update</label><input type="text" id="hcp-note" placeholder="e.g. After Week 2 handicap setting"></div>
      <div class="row wrap-row">${h.method !== "manual" ? `<button class="btn" data-a="use-all-sugg">Use all suggested</button>` : ""}<button class="btn gold" data-a="save-hcps">Save handicaps</button></div>
      <p class="small faint">Each change is logged to the player's handicap history. Scores already posted keep the handicap that was used that week.</p>` : `<div class="empty">Add players to teams first.</div>`}`;
  }

  /* ---------------- POTW ---------------- */
  function potw(season) {
    const sid = season.id, s = S.settings();
    const ws = C.weeks(sid).filter((w) => w.phase !== "hcp" && C.weekScores(sid, w.number).length);
    return `<div class="card mb"><div class="field" style="margin:0"><label>Tiebreaker when net scores tie</label><select id="tb">${[["admin", "Admin decides"], ["gross", "Lowest gross score"], ["backnine", "Lowest back-9 net (needs hole scores)"], ["handicap", "Lower handicap"]].map(([v, l]) => opt(v, l, s.potwTiebreak === v)).join("")}</select></div></div>
      ${ws.length ? `<div class="card pad0">${ws.map((w) => { const x = C.potw(sid, w.number); const ds = C.weekScores(sid, w.number); return `<div class="admin-row"><span class="wk-num" style="min-width:52px"><span>Wk</span><b style="font-size:24px">${w.number}</b></span><span class="t"><b>${x && x.winner ? `★ ${esc(C.name(x.winner.player))} (${x.winner.net})` : `Tie: ${x.tied.map((d) => esc(C.short(d.player))).join(", ")}`}</b><span>${x.method === "admin" ? "Chosen by admin" : x.method === "tiebreak" ? "Won on tiebreaker" : x.method === "pending" ? "Pick a winner →" : "Lowest net"}</span></span><select style="width:140px" data-potw="${w.id}">${opt("", "Automatic")}${ds.map((d) => opt(d.playerId, `${C.short(d.player)} (${d.net})`, w.potwPlayerId === d.playerId)).join("")}</select></div>`; }).join("")}</div>
      <button class="btn mt" data-a="draft-potw">${icon("news")}Draft announcement for latest winner</button>` : `<div class="empty">Player of the Week is awarded automatically once league-week scores are entered.</div>`}`;
  }

  /* ---------------- NEWS ---------------- */
  function news() {
    const ps = C.posts();
    return `<button class="btn gold block mb" data-a="add-post">${icon("plus")}New announcement</button>
      ${ps.length ? `<div class="card pad0">${ps.map((p) => `<div class="admin-row"><span class="tag">${esc(p.category || "Update")}</span><span class="t"><b>${p.pinned ? "★ " : ""}${esc(p.title)}</b><span>${esc(p.date || "")}</span></span><span class="row" style="gap:6px"><button class="icon-btn" data-a="edit-post" data-id="${p.id}" aria-label="Edit">${icon("edit")}</button><button class="icon-btn" data-a="del-post" data-id="${p.id}" aria-label="Delete">${icon("x")}</button></span></div>`).join("")}</div>` : `<div class="empty">No announcements yet.</div>`}`;
  }
  function postForm(p = {}) {
    modal(p.id ? "Edit announcement" : "New announcement", `
      <div class="field"><label>Title</label><input name="title" type="text" required value="${esc(p.title || "")}"></div>
      <div class="f2"><div class="field"><label>Category</label><select name="category">${CATS.map((c) => opt(c, c, (p.category || "Weekly Update") === c)).join("")}</select></div><div class="field"><label>Date</label><input name="date" type="date" value="${esc(p.date || today())}"></div></div>
      <div class="field"><label>Message</label><textarea name="body" style="min-height:160px">${esc(p.body || "")}</textarea></div>
      ${photoField("photo", p.photo, "Photo (optional)", 1400)}
      <label class="check"><input type="checkbox" name="pinned" ${p.pinned ? "checked" : ""}> Pin to top</label>`,
      async (form) => {
        const v = fd(form);
        if (!v.title.trim()) throw new Error("Title is required.");
        await S.save("post", { ...p, title: v.title.trim(), category: v.category, date: v.date, body: v.body, photo: v.photo, pinned: !!form.pinned.checked, seasonId: (C.season() || {}).id || null });
        toast("Announcement published");
      }, p.id ? "Save" : "Publish");
  }

  /* ---------------- PHOTOS ---------------- */
  function photos() {
    const ph = S.settings().photos;
    return `<form id="photo-form" class="card mb"><h3 class="mb">Site photos</h3>
      <p class="small muted">Leave a slot empty to use the league artwork that ships with the site.</p>
      ${photoField("hero", ph.hero, "Homepage background photo (wide, landscape)", 2000)}
      ${photoField("banner", ph.banner, "Homepage title banner", 1600)}
      ${photoField("logo", ph.logo, "League logo / mascot", 800)}
      ${photoField("mark", ph.mark, "Small round icon (top bar) — square image", 300)}
      <button class="btn gold" type="submit">Save site photos</button></form>
      <div class="card"><h3>Photo gallery</h3><p class="small muted">Golf course & simulator shots. Used automatically as course images and the hero until you pick specific ones.</p>
      <label class="photo-drop mb">${icon("camera")}<span>Add photos (you can pick several)</span><input type="file" accept="image/*" multiple id="gallery-add"></label>
      <div class="thumbs">${(ph.gallery || []).map((u, i) => `<div class="th"><img src="${esc(u)}" alt=""><button type="button" data-a="del-gallery" data-i="${i}" aria-label="Remove">×</button></div>`).join("")}</div></div>
      <p class="small faint mt">Player photos are added under Players, course photos under Courses, team photos under Teams.</p>`;
  }

  /* ---------------- SEASON & SETTINGS ---------------- */
  function seasonSetupCard(first) {
    const s = C.season();
    return `<form class="card" id="season-form"><h3>${first ? "Set up your first season" : "Start a new season"}</h3><p class="small muted">Creates all 14 weeks: Weeks 1–2 Handicap Setting, 3–8 Net Stroke Play, 9–14 Net Best Ball. You can edit any date later.</p>
      <div class="field"><label>Season name</label><input name="name" type="text" required value="${esc(new Date().getFullYear() + (new Date().getMonth() > 7 ? 1 : 0))} Season"></div>
      <div class="f2"><div class="field"><label>Week 1 date</label><input name="start" type="date" required></div><div class="field"><label>Start time</label><input name="time" type="time" value="19:00"></div></div>
      ${s ? `<label class="check"><input type="checkbox" name="copyTeams" checked> Copy teams from ${esc(s.name)}</label>` : ""}
      <button class="btn gold block mt" type="submit">${first ? "Create season" : "Create new season"}</button></form>`;
  }
  function seasonTab(season) {
    const s = S.settings();
    return `<form class="card mb" id="settings-form"><h3 class="mb">League settings</h3>
      <div class="field"><label>League name</label><input name="leagueName" type="text" value="${esc(s.leagueName)}"></div>
      <div class="field"><label>Tagline</label><input name="tagline" type="text" value="${esc(s.tagline)}"></div>
      <div class="field"><label>Venue / simulator location</label><input name="venue" type="text" value="${esc(s.venue || "")}" placeholder="Shown in calendar invites"></div>
      <h3 class="mt2 mb">Google Calendar</h3>
      <div class="field"><label>League Calendar ID</label><input name="calendarId" type="text" value="${esc(s.calendarId || "")}" placeholder="something@group.calendar.google.com"><span class="hint">Google Calendar → Settings → your league calendar → "Integrate calendar" → Calendar ID. The calendar must be public (README, Step 3).</span></div>
      <div class="field"><label>Google API key (optional)</label><input name="calendarApiKey" type="text" value="${esc(s.calendarApiKey || "")}"><span class="hint">Adds an "Upcoming Events" list under the calendar.</span></div>
      <div class="field"><label>Time zone</label><input name="timezone" type="text" value="${esc(s.timezone)}"></div>
      <h3 class="mt2 mb">Scoring rules</h3>
      <div class="field"><label>Rank standings by</label><select name="rankBy">${opt("total", "Cumulative net score (lowest wins)", s.rankBy === "total")}${opt("avg", "Average net score (fair if players miss weeks)", s.rankBy === "avg")}</select></div>
      <div class="field"><label>A missed Stroke Play round counts as</label><select name="missedRound">${opt("avg", "The player's own average net (recommended)", (s.missedRound || "avg") === "avg")}${opt("worst", "That week's worst net score + 1", s.missedRound === "worst")}${opt("none", "Nothing (absent players get a lower total)", s.missedRound === "none")}</select><span class="hint">Keeps cumulative totals fair when someone misses a week.</span></div>
      <label class="check"><input type="checkbox" name="roundPlayingHcp" ${s.roundPlayingHcp ? "checked" : ""}> Round handicap to whole strokes for net scores</label>
      <label class="check"><input type="checkbox" name="statsIncludeHcpWeeks" ${s.statsIncludeHcpWeeks ? "checked" : ""}> Include handicap-setting weeks in player statistics</label>
      <button class="btn gold block mt" type="submit">Save settings</button></form>
      <div class="card mb"><h3 class="mb">Seasons</h3>${C.seasons().map((x) => `<div class="admin-row"><span class="phase-dot" style="background:${season && x.id === season.id ? "var(--gold)" : "var(--faint)"}"></span><span class="t"><b>${esc(x.name)}</b><span>Starts ${esc(x.startDate || "")}${season && x.id === season.id ? " · active" : ""}</span></span><span class="row" style="gap:6px">${season && x.id === season.id ? "" : `<button class="btn sm" data-a="activate-season" data-id="${x.id}">Make active</button>`}<button class="icon-btn" data-a="rename-season" data-id="${x.id}" aria-label="Rename">${icon("edit")}</button></span></div>`).join("")}</div>
      ${seasonSetupCard(false)}`;
  }
  async function createSeason(v) {
    const prev = C.season();
    const season = await S.save("season", { name: v.name.trim(), startDate: v.start, active: true });
    const [y, m, d] = v.start.split("-").map(Number);
    const items = [];
    for (let i = 0; i < 14; i++) {
      const dt = new Date(y, m - 1, d + i * 7);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      items.push({ kind: "week", data: { seasonId: season.id, number: i + 1, phase: C.phaseOf(i + 1), date: iso, time: v.time || "19:00", status: "upcoming", courseId: null, matchups: [] } });
    }
    if (v.copyTeams && prev) C.teams(prev.id).forEach((t) => items.push({ kind: "team", data: { seasonId: season.id, name: t.name, player1Id: t.player1Id, player2Id: t.player2Id, motto: t.motto, photo: t.photo } }));
    await S.saveMany(items);
    await S.saveSettings({ activeSeasonId: season.id });
    toast(`${season.name} created with 14 weeks`);
  }

  /* ---------------- DATA / BACKUP ---------------- */
  function data() {
    const hasDemo = Object.values(S.rawRecords()).some((r) => r.data && r.data.demo);
    return `<div class="card mb"><h3>Backup</h3><p class="small muted">Copy a full backup of every player, score and setting. Keep it somewhere safe at the end of each season.</p>
      <div class="row wrap-row"><button class="btn" data-a="export">Copy backup to clipboard</button><button class="btn ghost" data-a="export-dl">Download backup file</button></div></div>
      <div class="card mb"><h3>Restore</h3><p class="small muted">Paste a backup to restore it (adds/overwrites records).</p><textarea id="import-box" placeholder='{"records": …}'></textarea><button class="btn mt" data-a="import">Restore backup</button></div>
      <div class="card"><h3>Demo data</h3><p class="small muted">Try the site with clearly-labelled fake players and scores. Remove it before your real season starts.</p>
      <div class="row wrap-row">${hasDemo ? `<button class="btn danger" data-a="clear-demo">Remove demo data</button>` : `<button class="btn" data-a="load-demo">Load demo data</button>`}</div></div>`;
  }

  /* =====================================================================
     EVENTS
     ===================================================================== */
  function after() {
    const main = $("#main");
    const lf = $("#login-form");
    if (lf) lf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = fd(lf);
      await guard(async () => { await S.login(v.email || "", v.password); }, "Welcome back");
    });
    const sf = $("#season-form");
    if (sf) sf.addEventListener("submit", (e) => { e.preventDefault(); const v = fd(sf); v.copyTeams = sf.copyTeams ? sf.copyTeams.checked : false; if (!v.start) return toast("Pick the Week 1 date", true); guard(() => createSeason(v)); });
    const stf = $("#settings-form");
    if (stf) stf.addEventListener("submit", (e) => { e.preventDefault(); const v = fd(stf); guard(() => S.saveSettings({ leagueName: v.leagueName, tagline: v.tagline, venue: v.venue, calendarId: v.calendarId.trim(), calendarApiKey: v.calendarApiKey.trim(), timezone: v.timezone || "America/New_York", rankBy: v.rankBy, missedRound: v.missedRound, roundPlayingHcp: stf.roundPlayingHcp.checked, statsIncludeHcpWeeks: stf.statsIncludeHcpWeeks.checked }), "Settings saved"); });
    const hf = $("#hcp-form");
    if (hf) hf.addEventListener("submit", (e) => { e.preventDefault(); const v = fd(hf); guard(() => S.saveSettings({ hcp: { method: v.method, rounds: num(v.rounds) || 4, best: num(v.best) || 4, pct: num(v.pct) || 100, max: num(v.max), source: v.source, rounding: +v.rounding } }), "Formula saved"); });
    const tf = $("#tee-form");
    if (tf) tf.addEventListener("submit", (e) => { e.preventDefault(); const v = fd(tf); guard(async () => { await S.tee.setConfig(v.pin.trim(), num(v.days) || 14, +v.len, +v.step); await window.Tee.load(true); }, "Booking settings saved"); });
    const pf = $("#photo-form");
    if (pf) { bindPhotos(pf); pf.addEventListener("submit", (e) => { e.preventDefault(); const v = fd(pf); const ph = S.settings().photos; guard(() => S.saveSettings({ photos: { ...ph, hero: v.hero, banner: v.banner, logo: v.logo, mark: v.mark } }), "Photos saved"); }); }
    const ga = $("#gallery-add");
    if (ga) ga.addEventListener("change", () => guard(async () => {
      const urls = [];
      for (const f of ga.files) urls.push(await S.uploadImage(f, 1800));
      const ph = S.settings().photos;
      await S.saveSettings({ photos: { ...ph, gallery: (ph.gallery || []).concat(urls) } });
    }, "Photos added"));
    const sfm = $("#score-form");
    if (sfm) sfm.addEventListener("input", (e) => { const row = e.target.closest(".score-entry"); if (row) liveNet(row); });
    $$("[data-weekcourse]", main).forEach((s) => s.addEventListener("change", () => guard(() => S.save("week", { ...S.get("week", s.dataset.weekcourse), courseId: s.value || null }), "Course updated")));
    $$("[data-weekstatus]", main).forEach((s) => s.addEventListener("change", () => guard(() => S.save("week", { ...S.get("week", s.dataset.weekstatus), status: s.value }), "Status updated")));
    $$("[data-potw]", main).forEach((s) => s.addEventListener("change", () => guard(() => S.save("week", { ...S.get("week", s.dataset.potw), potwPlayerId: s.value || null }), "Player of the Week updated")));
    const tb = $("#tb");
    if (tb) tb.addEventListener("change", () => guard(() => S.saveSettings({ potwTiebreak: tb.value }), "Tiebreaker saved"));
    $$("[data-sugg]", main).forEach((b) => b.addEventListener("click", () => { b.closest(".admin-row").querySelector("[data-hcp]").value = b.dataset.sugg; }));
  }

  document.addEventListener("click", async (e) => {
    if (!location.hash.startsWith("#admin")) return;
    const t = e.target.closest("[data-tab],[data-week],[data-a]");
    if (!t || t.closest(".modal")) return;
    if (t.dataset.tab) { st.tab = t.dataset.tab; if (t.dataset.week) st.week = +t.dataset.week; window.App.render(); return; }
    if (t.dataset.week && !t.dataset.a) { st.week = +t.dataset.week; window.App.render(true); return; }
    const a = t.dataset.a, id = t.dataset.id;
    const season = C.season();
    switch (a) {
      case "logout": return guard(() => S.logout());
      case "showall": st.showAll = t.checked; return window.App.render(true);
      case "toggle-holes": st.holesOpen[t.dataset.pid] = !st.holesOpen[t.dataset.pid]; return window.App.render(true);
      case "save-scores": return guard(saveScores);
      case "del-score": if (await confirmBox("Delete this score? Standings will recalculate.")) guard(() => S.remove("score", id), "Score deleted"); return;
      case "save-bb": return guard(async () => {
        const w = C.week(season.id, st.week);
        for (const inp of $$("[data-bb]")) {
          const v = num(inp.value);
          if (v === null && inp.dataset.bbid) await S.remove("teamscore", inp.dataset.bbid);
          else if (v !== null) await S.save("teamscore", { ...(inp.dataset.bbid ? S.get("teamscore", inp.dataset.bbid) : {}), seasonId: season.id, week: w.number, teamId: inp.dataset.bb, net: v });
        }
      }, "Best ball scores saved");
      case "complete-week": return guard(() => S.save("week", { ...C.week(season.id, +t.dataset.n), status: "completed" }), `Week ${t.dataset.n} marked complete`);
      case "add-player": return playerForm();
      case "edit-player": return playerForm(C.player(id));
      case "del-player": {
        const n = S.all("score").filter((s) => s.playerId === id).length;
        if (await confirmBox(`Remove ${C.name(C.player(id))}? ${n ? `Their ${n} posted score${n > 1 ? "s" : ""} will also be deleted. To keep history, edit them and untick "Active" instead.` : ""}`, "Remove player")) {
          guard(async () => {
            for (const tm of S.all("team").filter((x) => x.player1Id === id || x.player2Id === id)) await S.save("team", { ...tm, player1Id: tm.player1Id === id ? null : tm.player1Id, player2Id: tm.player2Id === id ? null : tm.player2Id });
            await S.removeMany(S.all("score").filter((s) => s.playerId === id).map((s) => s.id).concat(S.all("hcphist").filter((s) => s.playerId === id).map((s) => s.id)));
            await S.remove("player", id);
          }, "Player removed");
        }
        return;
      }
      case "add-team": return teamForm();
      case "edit-team": return teamForm(C.team(id));
      case "del-team": if (await confirmBox(`Delete team "${C.team(id).name}"? Players stay on the roster.`)) guard(() => S.removeMany([id, ...S.all("teamscore").filter((x) => x.teamId === id).map((x) => x.id)]), "Team deleted"); return;
      case "edit-week": return weekForm(S.get("week", id));
      case "roundrobin": {
        const ts = C.teams(season.id);
        if (ts.length < 2) return toast("Create at least two teams first", true);
        if (!(await confirmBox("Replace matchups for all 12 league weeks with an automatic round robin?", "Fill matchups"))) return;
        const comp = C.weeks(season.id).filter((w) => w.phase !== "hcp");
        const rr = roundRobin(ts.map((x) => x.id), comp.length);
        return guard(() => S.saveMany(comp.map((w, i) => ({ kind: "week", data: { ...w, matchups: rr[i % rr.length] } }))), "Matchups filled in");
      }
      case "shift-dates": {
        modal("Shift dates", `<p class="small muted">Move every week that isn't completed by a number of days (e.g. 7 to push the season back a week after a rain-out).</p><div class="field"><label>Days</label><input type="number" name="days" value="7"></div>`, async (form) => {
          const days = num(fd(form).days) || 0;
          const ws = C.weeks(season.id).filter((w) => w.status !== "completed" && w.date);
          await S.saveMany(ws.map((w) => { const [y, m, d] = w.date.split("-").map(Number); const dt = new Date(y, m - 1, d + days); return { kind: "week", data: { ...w, date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}` } }; }));
          toast(`Moved ${ws.length} weeks`);
        }, "Shift");
        return;
      }
      case "tee-del": if (await confirmBox("Remove this reservation? The sim opens back up for that time.", "Remove")) guard(async () => { await S.tee.adminDelete(id); await window.Tee.load(true); }, "Reservation removed"); return;
      case "add-course": return courseForm();
      case "edit-course": return courseForm(C.course(id));
      case "del-course": if (await confirmBox(`Delete ${C.course(id).name}? Weeks using it will show "Course TBD".`)) guard(() => S.remove("course", id), "Course deleted"); return;
      case "use-all-sugg": $$("[data-sugg]").forEach((b) => { b.closest(".admin-row").querySelector("[data-hcp]").value = b.dataset.sugg; }); return toast("Suggested values filled in — review, then Save");
      case "save-hcps": return guard(async () => {
        const note = ($("#hcp-note") || {}).value || "";
        let n = 0;
        for (const row of $$("#hcp-rows .admin-row")) {
          const p = C.player(row.dataset.pid), v = num($("[data-hcp]", row).value);
          if (v === num(p.handicap)) continue;
          await S.save("player", { ...p, handicap: v });
          if (v !== null) await S.save("hcphist", { playerId: p.id, seasonId: season.id, value: v, prev: num(p.handicap), date: new Date().toISOString(), note: note || "Updated", week: (C.currentWeek(season.id) || {}).number });
          n++;
        }
        toast(n ? `Updated ${n} handicap${n > 1 ? "s" : ""}` : "No changes");
      });
      case "draft-potw": {
        const x = C.latestPotw(season.id);
        if (!x) return toast("No winner yet", true);
        const d = x.winner, tm = C.teamOf(d.playerId, season.id);
        return postForm({ title: `Player of the Week: ${C.name(d.player)}`, category: "Player of the Week", date: today(), body: `Congratulations to ${C.name(d.player)}${tm ? ` of ${tm.name}` : ""}! A ${d.gross} gross off a ${C.fmtHcp(d.hcp)} handicap for a net ${d.net}${d.course ? ` at ${d.course.name}` : ""} — the low net score of Week ${x.week.number}.${d.birdies ? ` ${d.birdies} birdie${d.birdies > 1 ? "s" : ""} on the card.` : ""}${d.eagles ? ` And ${d.eagles} eagle${d.eagles > 1 ? "s" : ""}!` : ""}`, photo: d.player.photo || "" });
      }
      case "add-post": return postForm();
      case "edit-post": return postForm(S.get("post", id));
      case "del-post": if (await confirmBox("Delete this announcement?")) guard(() => S.remove("post", id), "Deleted"); return;
      case "del-gallery": { const ph = S.settings().photos; const g = (ph.gallery || []).slice(); g.splice(+t.dataset.i, 1); return guard(() => S.saveSettings({ photos: { ...ph, gallery: g } }), "Photo removed"); }
      case "activate-season": return guard(() => S.saveSettings({ activeSeasonId: id }), "Active season changed");
      case "rename-season": { const s = S.get("season", id); modal("Rename season", `<div class="field"><label>Name</label><input name="name" type="text" value="${esc(s.name)}"></div><div class="field"><label>Start date</label><input name="startDate" type="date" value="${esc(s.startDate || "")}"></div>`, async (form) => { const v = fd(form); await S.save("season", { ...s, name: v.name, startDate: v.startDate }); }); return; }
      case "export": try { await navigator.clipboard.writeText(S.exportJSON()); toast("Backup copied — paste it into a note or email to yourself"); } catch (err) { toast("Couldn't copy — use Download instead", true); } return;
      case "export-dl": { const b = new Blob([S.exportJSON()], { type: "application/json" }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `drunken-eagle-backup-${today()}.json`; document.body.appendChild(l); l.click(); l.remove(); return; }
      case "import": { const txt = $("#import-box").value.trim(); if (!txt) return toast("Paste a backup first", true); if (await confirmBox("Restore this backup? Existing records with the same IDs are overwritten.", "Restore")) guard(() => S.importJSON(txt), "Backup restored"); return; }
      case "load-demo": return guard(() => window.Demo.load(), "Demo data loaded — remove it before the real season");
      case "clear-demo": if (await confirmBox("Remove all demo players, teams, courses, scores and the demo season?", "Remove demo data")) guard(() => window.Demo.clear(), "Demo data removed"); return;
    }
  });

  window.Admin = {
    view, after,
    busy() {
      if (st.modalOpen) return true;
      const a = document.activeElement;
      return !!(a && location.hash.startsWith("#admin") && a.closest && a.closest("#main") && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "checkbox");
    }
  };
})();
