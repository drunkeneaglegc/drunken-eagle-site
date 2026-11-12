/* =====================================================================
   PUBLIC SITE — routing + all member-facing pages
   ===================================================================== */
(function () {
  const S = window.Store, C = window.C;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = window.DEGL_ASSETS || {};
  const icon = (n, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  const NAV = [
    { id: "home", label: "Home", icon: "home" },
    { id: "standings", label: "Standings", icon: "trophy" },
    { id: "handicaps", label: "Handicaps", icon: "gauge" },
    { id: "schedule", label: "Schedule", icon: "cal" },
    { id: "courses", label: "Courses", icon: "flag" },
    { id: "players", label: "Players", icon: "user" },
    { id: "teams", label: "Teams", icon: "users" },
    { id: "stats", label: "Statistics", icon: "chart" },
    { id: "calendar", label: "Tee Times", icon: "clock" },
    { id: "news", label: "League News", icon: "news" }
  ];
  const BOTTOM = ["home", "standings", "calendar", "schedule"];
  const MORE = [
    { id: "handicaps", label: "Handicaps", icon: "gauge" },
    { id: "teams", label: "Teams", icon: "users" },
    { id: "stats", label: "Statistics", icon: "chart" },
    { id: "courses", label: "Courses", icon: "flag" },
    { id: "players", label: "Players", icon: "user" },
    { id: "news", label: "League News", icon: "news" },
    { id: "potw", label: "Player of the Week", icon: "star" },
    { id: "admin", label: "Admin", icon: "lock" }
  ];

  const ui = { standTab: null, standWeek: null, statsSort: "avgNet", newsCat: "All", playerQ: "" };
  let timers = [];

  /* ---------- shared bits ---------- */
  function av(p, cls = "") {
    if (!p) return `<span class="av ${cls}">?</span>`;
    return p.photo ? `<span class="av ${cls}"><img src="${esc(p.photo)}" alt="" loading="lazy"></span>` : `<span class="av ${cls}">${esc(C.initials(p))}</span>`;
  }
  function teamAv(t) {
    const ps = C.teamPlayers(t);
    if (t && t.photo) return `<span class="av-pair"><span class="av"><img src="${esc(t.photo)}" alt="" loading="lazy"></span></span>`;
    return `<span class="av-pair">${ps.map((p) => av(p)).join("") || av(null)}</span>`;
  }
  const pLink = (p) => (p ? `#player-${p.id}` : "#players");
  const tLink = (t) => (t ? `#team-${t.id}` : "#teams");
  const tName = (t) => (t ? esc(t.name) : "Free agent");
  function moveHtml(m) {
    if (m === null || m === undefined) return "";
    if (m > 0) return `<span class="move up">${icon("up")}<span class="sr">up</span>${m}</span>`;
    if (m < 0) return `<span class="move down">${icon("down")}<span class="sr">down</span>${-m}</span>`;
    return `<span class="move same">–</span>`;
  }
  const toPar = (v) => `<span class="${C.toParClass(v)}">${C.fmtToPar(v)}</span>`;
  const pcls = (r) => (r.pos && r.pos <= 3 ? "p" + r.pos : "");
  const stars = (n) => { n = Math.max(0, Math.min(5, +n || 0)); return `<span class="stars" aria-label="${n} of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`; };
  function empty(ic, title, msg, cta = "") { return `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${esc(msg)}${cta}</div>`; }
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /* Course / hero fallbacks when no photo is uploaded yet */
  function fairwayArt(seed = 0, label = "") {
    const hue = 140 + (seed % 25);
    return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,16%)"/><stop offset="1" stop-color="hsl(${hue},40%,8%)"/></linearGradient>
      <linearGradient id="fw${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,30%)"/><stop offset="1" stop-color="hsl(${hue},50%,14%)"/></linearGradient></defs>
      <rect width="800" height="500" fill="url(#sky${seed})"/>
      <path d="M0 260 Q200 ${200 + (seed % 40)} 420 240 T800 230 V500 H0Z" fill="hsl(${hue},35%,12%)"/>
      <path d="M330 500 Q380 360 420 290 Q450 250 500 245 Q560 250 540 300 Q500 380 620 500Z" fill="url(#fw${seed})"/>
      <ellipse cx="505" cy="252" rx="46" ry="12" fill="hsl(${hue},55%,38%)"/>
      <line x1="510" y1="252" x2="510" y2="196" stroke="#e9e4d2" stroke-width="2.5"/><path d="M510 196 L536 205 L510 214Z" fill="#c9a24a"/>
      <path d="M150 500 Q260 300 505 250" fill="none" stroke="#e8cc7a" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round" opacity=".55"/>
    </svg>`;
  }
  function simulatorArt() {
    return `<svg viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hg" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#1f5a3c"/><stop offset=".55" stop-color="#0b2618"/><stop offset="1" stop-color="#050d09"/></radialGradient>
        <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7d5a"/><stop offset=".55" stop-color="#2a6a47"/><stop offset="1" stop-color="#174a31"/></linearGradient>
        <linearGradient id="skyS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e8fa3"/><stop offset="1" stop-color="#a8c6c4"/></linearGradient>
      </defs>
      <rect width="900" height="900" fill="url(#hg)"/>
      <g opacity=".9">
        <path d="M170 120 H730 L760 560 H140Z" fill="#0a1a12" stroke="#c9a24a" stroke-opacity=".35"/>
        <path d="M182 132 H718 L744 545 H156Z" fill="url(#skyS)"/>
        <path d="M156 380 Q350 330 520 350 T744 360 V545 H156Z" fill="#245c3d"/>
        <path d="M156 430 Q330 400 460 410 T744 420 V545 H156Z" fill="url(#scr)"/>
        <path d="M390 545 Q430 450 450 400 Q458 380 470 378 Q486 380 484 398 Q480 450 520 545Z" fill="#4c9a6c"/>
        <line x1="468" y1="378" x2="468" y2="350" stroke="#fff" stroke-width="2"/><path d="M468 350 l14 5 -14 5z" fill="#c9a24a"/>
        <path d="M450 760 Q440 520 468 380" fill="none" stroke="#e8cc7a" stroke-width="3" stroke-dasharray="3 10" stroke-linecap="round"/>
      </g>
      <path d="M0 700 L140 560 H760 L900 700 V900 H0Z" fill="#0c2016"/>
      <path d="M300 900 L380 640 H520 L600 900Z" fill="#163a27" opacity=".8"/>
      <circle cx="450" cy="760" r="9" fill="#f2efe6"/>
    </svg>`;
  }
  const heroPhoto = () => S.settings().photos.hero || "";
  const logoSrc = () => S.settings().photos.logo || A.logo || "";
  const markSrc = () => S.settings().photos.mark || A.mark || "";
  function courseImg(c, i = 0) {
    if (c && c.photo) return `<img src="${esc(c.photo)}" alt="${esc(c.name)}" loading="lazy">`;
    const g = S.settings().photos.gallery || [];
    if (g.length) return `<img src="${esc(g[(hash(c ? c.id : i) % g.length)])}" alt="" loading="lazy">`;
    return fairwayArt(hash(c ? c.id : i) % 97);
  }

  /* ---------- standings rows (mobile rows + desktop table) ---------- */
  function playerRows(rows, opts = {}) {
    if (!rows.some((r) => r.rounds)) return empty("trophy", "No scores yet", "The leaderboard fills in automatically once the first round is posted.");
    const lim = opts.limit ? rows.filter((r) => r.rounds).slice(0, opts.limit) : rows;
    const mob = lim.map((r) => `
      <a class="lb-row ${pcls(r)}" href="${pLink(r.player)}">
        <div class="pos">${C.posLabel(r)}${opts.limit ? "" : `<small>${moveHtml(r.move)}</small>`}</div>
        <div class="who">${av(r.player)}<div class="who-txt"><b>${esc(C.name(r.player))}</b><span>${tName(r.team)} · HCP ${C.fmtHcp(r.hcp)}</span></div></div>
        <div class="score-col"><b>${C.fmtNum(r.net)}</b><span>${r.rounds ? toPar(r.toPar) + " · " + r.rounds + " rd" + (r.rounds > 1 ? "s" : "") : "—"}</span></div>
        ${opts.limit ? "" : `<div class="mini-stats"><span>Gross <b>${C.fmtNum(r.gross)}</b></span><span>Avg net <b>${C.fmtNum(r.avgNet)}</b></span><span>Wk wins <b>${r.wins}</b></span>${r.missed ? `<span class="faint">${r.missed} missed rd incl.</span>` : ""}</div>`}
      </a>`).join("");
    if (opts.limit) return `<div class="lb-rows">${mob}</div>`;
    const tbl = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pos</th><th></th><th>Player</th><th>Team</th><th class="n">HCP</th><th class="n">Gross</th><th class="n">Net</th><th class="n">To Par</th><th class="n">Rds</th><th class="n">Avg Net</th><th class="n">Wk Wins</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${pcls(r)}" data-href="${pLink(r.player)}"><td class="big">${C.posLabel(r)}</td><td>${moveHtml(r.move)}</td><td><a class="row" href="${pLink(r.player)}">${av(r.player)}<b>${esc(C.name(r.player))}</b></a></td><td><a href="${tLink(r.team)}">${tName(r.team)}</a></td><td class="n">${C.fmtHcp(r.hcp)}</td><td class="n">${C.fmtNum(r.gross)}</td><td class="n big">${C.fmtNum(r.net)}</td><td class="n">${toPar(r.toPar)}</td><td class="n">${r.rounds}</td><td class="n">${C.fmtNum(r.avgNet)}</td><td class="n">${r.wins}</td></tr>`).join("")}
    </tbody></table></div>`;
    return `<div class="lb-rows has-table">${mob}</div>${tbl}`;
  }
  function teamRows(rows, opts = {}) {
    if (!rows.some((r) => r.rounds)) return empty("users", "No team scores yet", opts.bb ? "Best ball scores appear here from League Week 7 (season week 9)." : "Team totals appear once rounds are posted.");
    const lim = opts.limit ? rows.filter((r) => r.rounds).slice(0, opts.limit) : rows;
    const label = opts.bb ? "wk" : "wk";
    const mob = lim.map((r) => `
      <a class="lb-row ${pcls(r)}" href="${tLink(r.team)}">
        <div class="pos">${C.posLabel(r)}${opts.limit ? "" : `<small>${moveHtml(r.move)}</small>`}</div>
        <div class="who">${teamAv(r.team)}<div class="who-txt"><b>${esc(r.team.name)}</b><span>${r.players.map((p) => esc(C.short(p))).join(" & ") || "Players TBD"}</span></div></div>
        <div class="score-col"><b>${C.fmtNum(r.net)}</b><span>${opts.bb ? toPar(r.toPar) + " · " : ""}${opts.bb ? r.rounds : r.weeks} ${label}${(opts.bb ? r.rounds : r.weeks) === 1 ? "" : "s"}</span></div>
        ${opts.limit || !r.weekly.length ? "" : `<div class="mini-stats">${r.weekly.map((w) => `<span>W${w.week} <b>${w.net}</b></span>`).join("")}</div>`}
      </a>`).join("");
    if (opts.limit) return `<div class="lb-rows">${mob}</div>`;
    const wks = [...new Set(rows.flatMap((r) => r.weekly.map((w) => w.week)))].sort((a, b) => a - b);
    const tbl = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pos</th><th></th><th>Team</th><th>Players</th>${wks.map((w) => `<th class="n">Wk ${w}</th>`).join("")}<th class="n">${opts.bb ? "Matches" : "Weeks"}</th>${opts.bb ? `<th class="n">To Par</th>` : ""}<th class="n">Total</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${pcls(r)}" data-href="${tLink(r.team)}"><td class="big">${C.posLabel(r)}</td><td>${moveHtml(r.move)}</td><td><a href="${tLink(r.team)}"><b>${esc(r.team.name)}</b></a></td><td>${r.players.map((p) => `<a href="${pLink(p)}">${esc(C.name(p))}</a>`).join(" & ")}</td>${wks.map((w) => { const x = r.weekly.find((y) => y.week === w); return `<td class="n">${x ? x.net : "—"}</td>`; }).join("")}<td class="n">${opts.bb ? r.rounds : r.weeks}</td>${opts.bb ? `<td class="n">${toPar(r.toPar)}</td>` : ""}<td class="n big">${C.fmtNum(r.net)}</td></tr>`).join("")}
    </tbody></table></div>`;
    return `<div class="lb-rows has-table">${mob}</div>${tbl}`;
  }

  function progressBar(sid) {
    const ws = C.weeks(sid);
    if (!ws.length) return "";
    const cur = C.currentWeek(sid);
    return `<div class="progress" role="img" aria-label="Season progress">${ws.map((w) => {
      const col = C.PHASES[w.phase].color;
      const done = w.status === "completed";
      const cls = done ? "done" : w.status === "postponed" ? "pp" : cur && w.id === cur.id ? "cur" : "";
      return `<a href="#schedule" class="seg-w ${cls}" style="${done ? `background:${col}` : `box-shadow: inset 0 -3px 0 ${col}`}" title="Week ${w.number}: ${C.PHASES[w.phase].label}">${w.number}</a>`;
    }).join("")}</div>
    <div class="progress-legend">${Object.values(C.PHASES).map((p) => `<span><i class="phase-dot" style="background:${p.color}"></i>${p.short} <span class="faint">${p.weeks}</span></span>`).join("")}</div>`;
  }

  function potwCard(x, big = true) {
    if (!x || !x.winner) return "";
    const d = x.winner, p = d.player, t = C.teamOf(p.id, d.seasonId);
    return `<a class="card gold-card potw card-link" href="${pLink(p)}">
      <div class="potw-media">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(C.name(p))}" loading="lazy">` : (A.bust ? `<img class="potw-mascot" src="${esc(A.bust)}" alt=""><div class="initials">${esc(C.initials(p))}</div>` : `<div class="initials">${esc(C.initials(p))}</div>`)}
        <div class="potw-badge">${icon("star")} Player of the Week</div>
        <div class="potw-name"><h3>${esc(C.name(p))}</h3><p>${tName(t)}</p></div>
      </div>
      <div class="potw-stats"><div><b>${d.net}</b><span>Net</span></div><div><b>${d.gross}</b><span>Gross</span></div><div><b>${C.fmtHcp(d.hcp)}</b><span>HCP</span></div></div>
      <div class="potw-foot"><span>Week ${x.week.number} · League Wk ${C.leagueWeek(x.week.number)}</span><span>${d.course ? esc(d.course.name) : "Course TBD"}</span></div>
    </a>`;
  }

  function gcalLink(w, sid) {
    const d = C.weekDate(w);
    if (!d) return "";
    const end = new Date(d.getTime() + 3 * 3600e3);
    const f = (x) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const c = C.course(w.courseId);
    const st = S.settings();
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: `Drunken Eagle League Night — Week ${w.number}`,
      dates: `${f(d)}/${f(end)}`,
      details: `${C.PHASES[w.phase].label}${c ? " · Course: " + c.name : ""}`,
      location: st.venue || ""
    });
    return `https://calendar.google.com/calendar/render?${q}`;
  }

  /* =====================================================================
     PAGES
     ===================================================================== */
  const V = {};

  /* ---------------- HOME ---------------- */
  V.home = () => {
    const st = S.settings(), season = C.season();
    const hp = heroPhoto();
    const sp = st.photos;
    const banner = sp.banner || A.banner;
    let h = `<section class="hero">
      <div class="hero-media">${hp ? `<img src="${esc(hp)}" alt="" fetchpriority="high">` : A.hero ? `<picture><source media="(max-width: 720px)" srcset="${esc(A.heroM || A.hero)}"><img src="${esc(A.hero)}" alt="" fetchpriority="high"></picture>` : simulatorArt()}</div>
      <div class="hero-inner">
        <div class="hero-main">
          <h1 class="sr">${esc(st.leagueName)} — The Inaugural Season</h1>
          ${banner ? `<picture class="hero-banner">${!sp.banner && A.bannerM ? `<source media="(max-width: 720px)" srcset="${esc(A.bannerM)}">` : ""}<img src="${esc(banner)}" alt="The Drunken Eagle Golf League — The Inaugural Season"></picture>` : `<h1 class="hero-title">The Drunken<span>Eagle</span>Golf League</h1>`}
          <div class="hero-bottom">
            <p class="tagline">${esc(st.tagline)}</p>
            <div class="season-line">${season ? esc(season.name) : "Season setup underway"}</div>
            <div class="hero-ctas">
              <a class="btn gold" href="#standings">${icon("trophy")}Standings</a>
              <a class="btn" href="#schedule">${icon("cal")}Schedule</a>
              <a class="btn" href="#stats">${icon("chart")}Player Stats</a>
            </div>
          </div>
        </div>
        ${logoSrc() ? `<img class="hero-mascot" src="${esc(logoSrc())}" alt="Drunken Eagle mascot">` : ""}
      </div></section><div class="wrap">`;

    if (!season) {
      h += `<div class="section center">${logoSrc() ? `<img src="${esc(logoSrc())}" alt="" style="max-width:260px;margin:0 auto 18px;border-radius:18px">` : ""}${empty("flag", "The first season is being set up", "Check back soon for the schedule, teams and standings.", S.isAdmin() ? `<div class="mt"><a class="btn gold" href="#admin">Set up the season</a></div>` : "")}</div>`;
      if (window.Tee) h += Tee.homeCard();
      return h + `${newsBlock(3)}</div>`;
    }
    const sid = season.id;
    const cur = C.currentWeek(sid), next = C.nextNight(sid);
    const ph = cur ? C.PHASES[cur.phase] : null;
    const course = next ? C.course(next.courseId) : cur ? C.course(cur.courseId) : null;
    const done = C.seasonDone(sid);

    h += `<div class="section"><div class="card status-card reveal">
      <div class="status-top">
        <span class="phase-pill" style="color:${ph ? ph.color : "var(--gold)"}"><i class="phase-dot" style="background:${ph ? ph.color : "var(--gold)"}"></i>${done ? "Season Complete" : ph ? ph.label : "Pre-season"}</span>
        ${cur && cur.phase === "hcp" && !done ? `<span class="tag live" style="color:var(--ph-hcp)">Handicaps being set</span>` : ""}
      </div>
      <div class="row between wrap-row">
        <div class="bigweek">Week ${cur ? cur.number : "—"}<small>of 14</small></div>
        <div class="muted small" style="text-align:right">${cur && C.leagueWeek(cur.number) ? `League Week <b class="gold">${C.leagueWeek(cur.number)}</b> of 12` : "Doesn't count toward the 12-week league"}</div>
      </div>
      ${next ? `<div><div class="label">Next league night</div>
        <div style="font-weight:800;font-size:18px;margin-top:2px">${C.fmtDate(C.weekDate(next), { weekday: "long", month: "long", day: "numeric" })} · ${C.fmtTime(next)}</div>
        ${course ? `<div class="muted small">Playing <a class="gold" style="font-weight:800" href="#course-${course.id}">${esc(course.name)}</a></div>` : ""}</div>
        <div class="countdown" data-countdown="${C.weekDate(next).toISOString()}"><div><b>--</b><span>Days</span></div><div><b>--</b><span>Hrs</span></div><div><b>--</b><span>Min</span></div><div><b>--</b><span>Sec</span></div></div>
        <div class="row wrap-row"><a class="btn sm" href="${gcalLink(next, sid)}" target="_blank" rel="noopener">${icon("plus")}Add to my Google Calendar</a><a class="btn sm ghost" href="#calendar">${icon("clock")}Tee times</a></div>`
        : `<div class="muted">${done ? "That's a wrap — final standings are in." : "Next league night date coming soon."}</div>`}
    </div></div>`;

    if (window.Tee) h += Tee.homeCard();
    h += `<div class="section reveal"><div class="sec-head"><h2>Season Progress</h2><a class="more" href="#schedule">Full schedule →</a></div><div class="card">${progressBar(sid)}</div></div>`;

    const potw = C.latestPotw(sid);
    const stInd = C.strokeIndividual(sid), stTeam = C.strokeTeam(sid), bb = C.bestBallTeams(sid);
    const bbPhase = cur && cur.phase === "bestball";
    h += `<div class="grid g-home">`;
    h += `<div class="grid">`;
    if (bbPhase || bb.some((r) => r.rounds)) {
      h += `<div class="reveal"><div class="sec-head"><h2>Best Ball Standings</h2><a class="more" href="#standings">All →</a></div><div class="lb"><div class="lb-head"><h3>Team Net Best Ball</h3><span class="small">League Wks 7–12</span></div>${teamRows(bb, { bb: true, limit: 5 })}</div></div>`;
    } else {
      h += `<div class="reveal"><div class="sec-head"><h2>Team Standings</h2><a class="more" href="#standings">All →</a></div><div class="lb"><div class="lb-head"><h3>Net Stroke Play · Teams</h3><span class="small">League Wks 1–6</span></div>${teamRows(stTeam, { limit: 5 })}</div></div>`;
    }
    h += `<div class="reveal"><div class="sec-head"><h2>Top Players</h2><a class="more" href="#standings">Leaderboard →</a></div><div class="lb"><div class="lb-head"><h3>Net Stroke Play · Individual</h3><span class="small">Lowest net wins</span></div>${playerRows(stInd, { limit: 5 })}</div></div>`;
    h += `</div><div class="grid">`;
    h += potw ? `<div class="reveal"><div class="sec-head"><h2>Player of the Week</h2><a class="more" href="#potw">Archive →</a></div>${potwCard(potw)}</div>`
      : `<div class="reveal"><div class="sec-head"><h2>Player of the Week</h2></div>${empty("star", "Award starts League Week 1", "Lowest individual net score of the week takes it.")}</div>`;
    if (course) {
      h += `<div class="reveal"><div class="sec-head"><h2>Course of the Week</h2><a class="more" href="#courses">Courses →</a></div>
        <a class="card pad0 card-link" href="#course-${course.id}"><div class="course-media">${courseImg(course)}<div class="overlay"><h3>${esc(course.name)}</h3><p>${icon("pin", "")} ${esc(course.location || "")}</p></div></div>
        <div style="padding:14px 16px" class="row between wrap-row"><span>${stars(course.difficulty)}</span><span class="small muted">Par ${C.coursePar(course)} · ${course.yardage ? esc(course.yardage) + " yds" : ""} ${course.slope ? "· Slope " + esc(course.slope) : ""}</span></div></a></div>`;
    }
    const L = C.statLeaders(sid);
    if (L.birdies.length || L.eagles.length) {
      h += `<div class="reveal"><div class="sec-head"><h2>Birdie Watch</h2><a class="more" href="#stats">Stats →</a></div><div class="kv">
        ${L.birdies[0] ? `<a href="${pLink(L.birdies[0].p)}"><div class="k">Most birdies</div><div class="v">${L.birdies[0].v} <small>${esc(C.short(L.birdies[0].p))}</small></div></a>` : ""}
        ${L.eagles[0] ? `<a href="${pLink(L.eagles[0].p)}"><div class="k">Most eagles</div><div class="v">${L.eagles[0].v} <small>${esc(C.short(L.eagles[0].p))}</small></div></a>` : `<div><div class="k">Eagles</div><div class="v">0 <small>Still waiting…</small></div></div>`}
      </div></div>`;
    }
    h += `</div></div>`;
    h += newsBlock(3);
    h += `<div class="section reveal"><a class="card card-link row" href="#calendar"><span class="av md">${markSrc() ? `<img src="${esc(markSrc())}" alt="">` : icon("cal")}</span><div><b style="font-size:17px">Book the Sim</b><div class="muted small">Reserve a 2-hour tee time and see who's playing when.</div></div></a></div>`;
    return h + `</div>`;
  };

  function newsBlock(n) {
    const posts = C.posts().slice(0, n);
    return `<div class="section reveal"><div class="sec-head"><h2>League News</h2><a class="more" href="#news">All news →</a></div>
      ${posts.length ? `<div class="grid g3">${posts.map((p) => postCard(p, true)).join("")}</div>` : empty("news", "No announcements yet", "League updates will show up here.")}</div>`;
  }
  function postCard(p, clamp) {
    return `<article class="card post">${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : ""}
      <div class="row between"><span class="cat">${p.pinned ? `<span class="pin">★ Pinned · </span>` : ""}${esc(p.category || "League Update")}</span><span class="small faint">${p.date ? C.fmtDate(new Date(p.date + "T12:00"), { month: "short", day: "numeric", year: "numeric" }) : ""}</span></div>
      <h3>${esc(p.title)}</h3><div class="body ${clamp ? "clamp" : ""}">${esc(p.body)}</div>${clamp ? `<a class="small gold" href="#news" style="font-weight:800">Read more →</a>` : ""}</article>`;
  }

  /* ---------------- STANDINGS ---------------- */
  V.standings = () => {
    const season = C.season();
    if (!season) return page("Standings", "Leaderboards", empty("trophy", "No season yet", "Standings will appear once the season is set up."));
    const sid = season.id, cur = C.currentWeek(sid);
    if (!ui.standTab) ui.standTab = cur && cur.phase === "bestball" ? "bb" : "ind";
    const tabs = [["ind", "Stroke Play<br>Players"], ["team", "Stroke Play<br>Teams"], ["bb", "Best Ball<br>Teams"], ["week", "By<br>Week"]];
    let body = `<div class="seg mb" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-stand="${k}" class="${ui.standTab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const rb = S.settings().rankBy === "avg" ? "average net score" : "cumulative net score";
    if (ui.standTab === "ind") {
      body += `<div class="lb"><div class="lb-head"><h3>Net Stroke Play · Individual</h3><span class="small">League Wks 1–6</span></div>${playerRows(C.strokeIndividual(sid))}</div>
        <p class="small faint mt">Ranked by lowest ${rb}. Season weeks 3–8.${{ avg: " A missed round counts as the player's average net.", worst: " A missed round counts as that week's worst net + 1.", none: "" }[S.settings().missedRound || "avg"]} ▲▼ shows movement since the previous week.</p>`;
    } else if (ui.standTab === "team") {
      body += `<div class="lb"><div class="lb-head"><h3>Net Stroke Play · Teams</h3><span class="small">Combined individual nets</span></div>${teamRows(C.strokeTeam(sid))}</div>
        <p class="small faint mt">Each team's score = both players' individual net scores added together.</p>`;
    } else if (ui.standTab === "bb") {
      body += `<div class="lb"><div class="lb-head"><h3>Net Best Ball · Teams</h3><span class="small">League Wks 7–12</span></div>${teamRows(C.bestBallTeams(sid), { bb: true })}</div>
        <p class="small faint mt">Each player plays their own ball; the team's lowest net score on each hole counts.</p>
        <div class="section"><div class="sec-head"><h2>Individual Player Stats</h2><a class="more" href="#stats">All stats →</a></div>${indivStatsTable(sid)}</div>`;
    } else {
      const ws = C.weeks(sid);
      const scored = C.scoredWeeks(sid);
      if (!ui.standWeek || !ws.find((w) => w.number === ui.standWeek)) ui.standWeek = scored[scored.length - 1] || (cur ? cur.number : 1);
      body += `<div class="chips mb">${ws.map((w) => `<button class="chip ${ui.standWeek === w.number ? "on" : ""}" data-sweek="${w.number}">Wk ${w.number}</button>`).join("")}</div>`;
      body += weekResults(sid, ui.standWeek);
    }
    return page("Standings", season.name, body);
  };

  function indivStatsTable(sid) {
    const rows = C.seasonPlayers(sid).map((p) => ({ p, t: C.teamOf(p.id, sid), s: C.playerStats(p.id, sid) })).filter((r) => r.s.rounds).sort((a, b) => a.s.avgNet - b.s.avgNet);
    if (!rows.length) return empty("chart", "No stats yet", "Player stats build as rounds are posted.");
    return `<div class="lb">${rows.map((r, i) => `<a class="lb-row" href="${pLink(r.p)}"><div class="pos">${i + 1}</div><div class="who">${av(r.p)}<div class="who-txt"><b>${esc(C.name(r.p))}</b><span>${tName(r.t)}</span></div></div><div class="score-col"><b>${r.s.avgNet}</b><span>avg net</span></div><div class="mini-stats"><span>Birdies <b>${r.s.birdies}</b></span><span>Eagles <b>${r.s.eagles}</b></span><span>Pars <b>${r.s.pars}</b></span><span>Best net <b>${r.s.bestNet ? r.s.bestNet.net : "—"}</b></span></div></a>`).join("")}</div>`;
  }

  function weekResults(sid, n) {
    const w = C.week(sid, n);
    if (!w) return empty("cal", "Week not found", "");
    const ds = C.weekScores(sid, n), course = C.course(w.courseId), potw = C.potw(sid, n);
    let h = `<div class="card mb"><div class="row between wrap-row"><div><div class="label">Week ${n}${C.leagueWeek(n) ? ` · League Week ${C.leagueWeek(n)}` : ""}</div><h3 style="margin-top:4px">${C.PHASES[w.phase].label}</h3></div><span class="tag ${w.status}">${w.status}</span></div>
      <div class="muted small mt">${C.fmtDate(C.weekDate(w))} · ${course ? `<a class="gold" href="#course-${course.id}">${esc(course.name)}</a>` : "Course TBD"}${w.phase === "hcp" ? " · Handicap-setting round (not counted in standings)" : ""}</div></div>`;
    if (!ds.length) return h + empty("golf", "No scores posted for this week", w.status === "upcoming" ? "Results will appear after league night." : "");
    if (w.phase === "bestball") {
      const teams = C.teams(sid).map((t) => ({ t, b: C.bestBall(sid, n, t.id) })).filter((x) => x.b && x.b.net !== null).sort((a, b) => a.b.net - b.b.net);
      if (teams.length) h += `<div class="lb mb"><div class="lb-head"><h3>Team Best Ball · Week ${n}</h3></div>${teams.map((x, i) => `<a class="lb-row ${i < 3 ? "p" + (i + 1) : ""}" href="${tLink(x.t)}"><div class="pos">${i + 1}</div><div class="who">${teamAv(x.t)}<div class="who-txt"><b>${esc(x.t.name)}</b><span>${C.teamPlayers(x.t).map((p) => esc(C.short(p))).join(" & ")}</span></div></div><div class="score-col"><b>${x.b.net}</b><span>${course ? toPar(C.round1(x.b.net - C.coursePar(course))) : ""}</span></div></a>`).join("")}</div>`;
    }
    h += `<div class="lb"><div class="lb-head"><h3>Individual · Week ${n}</h3><span class="small">Net</span></div>${ds.map((d, i) => {
      const isP = potw && potw.winner && potw.winner.playerId === d.playerId;
      return `<a class="lb-row ${i < 3 ? "p" + (i + 1) : ""}" href="${pLink(d.player)}"><div class="pos">${i > 0 && ds[i - 1].net === d.net ? "T" : ""}${ds.findIndex((x) => x.net === d.net) + 1}</div><div class="who">${av(d.player)}<div class="who-txt"><b>${esc(C.name(d.player))}${isP ? ` <span class="gold">★</span>` : ""}</b><span>Gross ${d.gross} · HCP ${C.fmtHcp(d.hcp)}</span></div></div><div class="score-col"><b>${d.net}</b><span>${toPar(d.toPar)}</span></div><div class="mini-stats"><span>Birdies <b>${d.birdies}</b></span><span>Eagles <b>${d.eagles}</b></span><span>Pars <b>${d.pars}</b></span></div></a>`;
    }).join("")}</div>`;
    if (potw && !potw.winner && potw.tied.length) h += `<p class="small muted mt">Player of the Week: tie between ${potw.tied.map((d) => esc(C.name(d.player))).join(", ")} — awaiting league decision.</p>`;
    return h;
  }

  /* ---------------- HANDICAPS ---------------- */
  V.handicaps = () => {
    const season = C.season();
    if (!season) return page("Handicap Center", "Handicaps", empty("gauge", "No season yet", ""));
    const sid = season.id, cur = C.currentWeek(sid), st = S.settings();
    const rows = C.handicapRows(sid).sort((a, b) => (a.cur ?? 99) - (b.cur ?? 99));
    const methods = { manual: "Set by the league administrator", avgOverPar: `Average of last ${st.hcp.rounds} rounds over par × ${st.hcp.pct}%`, differential: `Best ${st.hcp.best} of last ${st.hcp.rounds} differentials (rating/slope) × ${st.hcp.pct}%` };
    let h = "";
    if (cur && cur.phase === "hcp") h += `<div class="notice mb"><b>Handicap Setting Period — Week ${cur.number} of 2.</b> Rounds this week establish starting handicaps and don't count toward the 12-week league standings.</div>`;
    h += `<div class="card mb row"><span class="av md" style="color:var(--gold)">${icon("gauge")}</span><div><div class="label">League handicap formula</div><b>${esc(methods[st.hcp.method] || methods.manual)}</b>${st.hcp.max ? `<div class="small muted">Max handicap ${st.hcp.max}</div>` : ""}</div></div>`;
    if (!rows.length) return page("Handicap Center", season.name, h + empty("users", "Roster coming soon", "Handicaps appear once players are added to teams."));
    h += `<div class="lb"><div class="lb-head"><h3>Player Handicaps</h3><span class="small">Lowest first</span></div>
      <div class="lb-rows has-table">${rows.map((r) => `<a class="lb-row" href="${pLink(r.p)}"><div class="pos" style="color:var(--gold-2)">${C.fmtHcp(r.cur)}<small class="faint">HCP</small></div><div class="who">${av(r.p)}<div class="who-txt"><b>${esc(C.name(r.p))}</b><span>${tName(r.team)}</span></div></div><div class="score-col">${chg(r.change)}<span>was ${C.fmtHcp(r.prev)}</span></div><div class="mini-stats"><span>Avg gross <b>${C.fmtNum(r.avgGross)}</b></span><span>Avg net <b>${C.fmtNum(r.avgNet)}</b></span><span>Recent <b>${r.recent.map((d) => d.gross).join(", ") || "—"}</b></span></div></a>`).join("")}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Player</th><th>Team</th><th class="n">Current</th><th class="n">Previous</th><th class="n">Change</th><th class="n">Avg Gross</th><th class="n">Avg Net</th><th>Recent Rounds (gross)</th></tr></thead><tbody>
      ${rows.map((r) => `<tr data-href="${pLink(r.p)}"><td><a class="row" href="${pLink(r.p)}">${av(r.p)}<b>${esc(C.name(r.p))}</b></a></td><td>${tName(r.team)}</td><td class="n big gold">${C.fmtHcp(r.cur)}</td><td class="n">${C.fmtHcp(r.prev)}</td><td class="n">${chg(r.change)}</td><td class="n">${C.fmtNum(r.avgGross)}</td><td class="n">${C.fmtNum(r.avgNet)}</td><td>${r.recent.map((d) => `<span class="tag" title="Week ${d.week}">W${d.week}: ${d.gross}</span>`).join(" ") || "—"}</td></tr>`).join("")}
      </tbody></table></div></div>`;
    return page("Handicap Center", season.name, h);
  };
  function chg(v) {
    if (v === null || v === undefined) return `<b class="faint">—</b>`;
    if (v === 0) return `<b>0</b>`;
    return `<b class="${v < 0 ? "under" : ""}">${v > 0 ? "+" : "−"}${Math.abs(v)}</b>`;
  }

  /* ---------------- SCHEDULE ---------------- */
  V.schedule = () => {
    const season = C.season();
    if (!season) return page("Schedule", "14-Week Season", empty("cal", "Schedule coming soon", ""));
    const sid = season.id, ws = C.weeks(sid), next = C.nextNight(sid) || C.currentWeek(sid);
    let h = `<div class="card mb">${progressBar(sid)}</div>`;
    ["hcp", "stroke", "bestball"].forEach((ph) => {
      const P = C.PHASES[ph], list = ws.filter((w) => w.phase === ph);
      h += `<div class="phase-block reveal"><div class="phase-title"><i class="phase-dot" style="background:${P.color}"></i><h2>${P.label}</h2><span class="tag">${P.weeks}</span></div>
        <p class="small muted" style="margin:-4px 0 10px">${ph === "hcp" ? "Establishes each player's handicap. Not counted in the 12-week league." : ph === "stroke" ? "League Weeks 1–6 · Individual net stroke play. Lowest cumulative net wins." : "League Weeks 7–12 · Two-man team net best ball. Lowest net per hole counts."}</p>
        <div class="card pad0">${list.map((w) => weekEntry(sid, w, next && next.id === w.id)).join("")}</div></div>`;
    });
    return page("Schedule", season.name, h);
  };
  function weekEntry(sid, w, isNext) {
    const c = C.course(w.courseId), d = C.weekDate(w);
    const status = isNext && w.status === "upcoming" ? `<span class="tag next">Next up</span>` : `<span class="tag ${w.status}">${w.status}</span>`;
    const mus = (w.matchups || []).filter((m) => m.a || m.b);
    return `<div class="wk ${isNext ? "is-next" : ""}" id="week-${w.number}">
      <div class="wk-num"><span>Week</span><b>${w.number}</b>${C.leagueWeek(w.number) ? `<span>LW ${C.leagueWeek(w.number)}</span>` : ""}</div>
      <div>
        <div class="row between wrap-row" style="gap:6px"><h4>${C.fmtDate(d, { weekday: "short", month: "short", day: "numeric" })}</h4>${status}</div>
        <div class="meta"><span>${icon("clock")}${C.fmtTime(w)}</span><span>${icon("golf")}${C.PHASES[w.phase].label}</span><span>${icon("flag")}${c ? `<a class="gold" href="#course-${c.id}">${esc(c.name)}</a>` : "Course TBD"}</span></div>
        ${w.notes ? `<div class="small mt" style="margin-top:6px;color:#ffd7b0">${esc(w.notes)}</div>` : ""}
        ${mus.length ? `<div class="matchups">${mus.map((m) => matchupHtml(sid, w, m)).join("")}</div>` : ""}
        ${w.status === "completed" ? `<div class="row mt" style="margin-top:10px"><button class="btn sm" data-goweek="${w.number}">Results ${icon("arrow")}</button>${(() => { const p = C.potw(sid, w.number); return p && p.winner ? `<span class="small"><span class="gold">★ POTW:</span> <a href="${pLink(p.winner.player)}"><b>${esc(C.name(p.winner.player))}</b></a> (${p.winner.net})</span>` : ""; })()}</div>` : ""}
        ${w.status === "upcoming" && d ? `<a class="small gold" style="font-weight:800;display:inline-block;margin-top:8px" href="${gcalLink(w, sid)}" target="_blank" rel="noopener">+ Add to Google Calendar</a>` : ""}
      </div></div>`;
  }
  function matchupHtml(sid, w, m) {
    const a = C.team(m.a), b = C.team(m.b), r = C.matchResult(sid, w, m);
    return `<div class="mu"><a class="${r && r.winner === m.a ? "win" : ""}" href="${tLink(a)}">${a ? esc(a.name) : "TBD"}${r ? `<span class="sc">${r.a}</span>` : ""}</a><span class="vs">${r && r.winner === "halved" ? "HALVED" : "VS"}</span><a class="b ${r && r.winner === m.b ? "win" : ""}" href="${tLink(b)}">${r ? `<span class="sc">${r.b}</span> ` : ""}${b ? esc(b.name) : "TBD"}</a></div>`;
  }

  /* ---------------- COURSES ---------------- */
  V.courses = () => {
    const season = C.season(), sid = season && season.id;
    const cur = sid && (C.nextNight(sid) || C.currentWeek(sid));
    const cotw = cur && C.course(cur.courseId);
    let h = "";
    if (cotw) {
      h += `<div class="sec-head"><h2>Course of the Week</h2><span class="tag next">Week ${cur.number}</span></div>${courseFeature(cotw)}`;
    } else h += empty("flag", "Course of the Week TBA", "The league will announce this week's course soon.");
    if (sid) {
      const played = C.weeks(sid).filter((w) => w.courseId && w.status === "completed");
      h += `<div class="section"><div class="sec-head"><h2>Season Course Archive</h2></div>${played.length ? `<div class="card pad0">${played.slice().reverse().map((w) => { const c = C.course(w.courseId); const p = C.potw(sid, w.number); return `<a class="admin-row" href="#course-${c.id}"><span class="wk-num" style="min-width:52px"><span>Wk</span><b style="font-size:24px">${w.number}</b></span><span class="t"><b>${esc(c.name)}</b><span>${C.fmtDate(C.weekDate(w))} · ${C.PHASES[w.phase].short}${p && p.winner ? ` · ★ ${esc(C.short(p.winner.player))} (${p.winner.net})` : ""}</span></span>${icon("arrow")}</a>`; }).join("")}</div>` : `<p class="muted">Courses appear here as each week is completed.</p>`}</div>`;
    }
    const all = C.courses();
    h += `<div class="section"><div class="sec-head"><h2>Course Library</h2></div>${all.length ? `<div class="grid g3">${all.map((c, i) => `<a class="card pad0 card-link reveal" href="#course-${c.id}"><div class="course-media">${courseImg(c, i)}<div class="overlay"><h3>${esc(c.name)}</h3><p>${esc(c.location || "")}</p></div></div><div style="padding:12px 16px" class="row between">${stars(c.difficulty)}<span class="small muted">Par ${C.coursePar(c)}${c.slope ? " · Slope " + esc(c.slope) : ""}</span></div></a>`).join("")}</div>` : empty("flag", "No courses added yet", "")}</div>`;
    return page("Courses", "Where we play", h);
  };
  function courseFeature(c) {
    return `<div class="card pad0 reveal"><div class="course-media" style="aspect-ratio:16/11">${courseImg(c)}<div class="overlay"><h3>${esc(c.name)}</h3><p>${icon("pin", "")} ${esc(c.location || "")}</p></div></div>
      <div style="padding:16px">
        <div class="kv">
          <div><div class="k">Difficulty</div><div class="v" style="font-size:22px">${stars(c.difficulty)}</div></div>
          <div><div class="k">Par</div><div class="v">${C.coursePar(c)}</div></div>
          <div><div class="k">Course rating</div><div class="v">${C.fmtNum(c.rating || null)}</div></div>
          <div><div class="k">Slope</div><div class="v">${C.fmtNum(c.slope || null)}</div></div>
          <div style="grid-column:1/-1"><div class="k">Total yardage</div><div class="v">${c.yardage ? Number(c.yardage).toLocaleString() : "—"} <small>yds</small></div></div>
        </div>
        ${c.description ? `<p style="color:#d5ddd8">${esc(c.description)}</p>` : ""}
        ${(c.facts || []).filter(Boolean).length ? `<div class="label mt mb">Did you know</div><ul class="facts">${c.facts.filter(Boolean).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        <a class="btn block mt" href="#course-${c.id}">Course details & scorecard ${icon("arrow")}</a>
      </div></div>`;
  }
  V.course = (id) => {
    const c = C.course(id);
    if (!c) return page("Course", "", empty("flag", "Course not found", ""));
    const season = C.season(), sid = season && season.id;
    let h = back("#courses", "Courses") + courseFeature(c).replace(/<a class="btn block mt"[\s\S]*?<\/a>/, "");
    if (C.hasHolePars(c)) {
      const half = (a, b) => `<table class="scorecard"><thead><tr><th>Hole</th>${c.holes.slice(a, b).map((_, i) => `<th>${a + i + 1}</th>`).join("")}<th>${a ? "In" : "Out"}</th></tr></thead><tbody>
        <tr><td>Par</td>${c.holes.slice(a, b).map((x) => `<td>${x.par}</td>`).join("")}<td><b>${c.holes.slice(a, b).reduce((s, x) => s + +x.par, 0)}</b></td></tr>
        ${c.holes.some((x) => x.yds) ? `<tr><td>Yds</td>${c.holes.slice(a, b).map((x) => `<td>${x.yds || ""}</td>`).join("")}<td>${c.holes.slice(a, b).reduce((s, x) => s + (+x.yds || 0), 0) || ""}</td></tr>` : ""}
        <tr><td>HCP</td>${c.holes.slice(a, b).map((x) => `<td class="faint">${x.si || ""}</td>`).join("")}<td></td></tr></tbody></table>`;
      h += `<div class="section"><div class="sec-head"><h2>Scorecard</h2></div><div class="card">${half(0, 9)}<div class="mt"></div>${half(9, 18)}</div></div>`;
    }
    if (sid) {
      const wks = C.weeks(sid).filter((w) => w.courseId === c.id);
      if (wks.length) {
        const ds = wks.flatMap((w) => C.weekScores(sid, w.number)).sort((a, b) => a.net - b.net).slice(0, 5);
        h += `<div class="section"><div class="sec-head"><h2>This Season</h2></div><p class="muted">Played ${wks.map((w) => `<a class="gold" href="#schedule">Week ${w.number}</a>`).join(", ")}</p>
          ${ds.length ? `<div class="lb"><div class="lb-head"><h3>Best net rounds here</h3></div>${ds.map((d, i) => `<a class="lb-row" href="${pLink(d.player)}"><div class="pos">${i + 1}</div><div class="who">${av(d.player)}<div class="who-txt"><b>${esc(C.name(d.player))}</b><span>Week ${d.week} · Gross ${d.gross}</span></div></div><div class="score-col"><b>${d.net}</b><span>${toPar(d.toPar)}</span></div></a>`).join("")}</div>` : ""}</div>`;
      }
    }
    return `<div class="wrap" style="padding-top:16px">${h}</div>`;
  };

  /* ---------------- PLAYERS ---------------- */
  V.players = () => {
    const season = C.season(), sid = season && season.id;
    const ps = (sid ? C.seasonPlayers(sid) : []).concat(C.players().filter((p) => p.active !== false && !(sid && C.seasonPlayers(sid).some((x) => x.id === p.id))));
    const q = ui.playerQ.toLowerCase();
    const list = ps.filter((p) => !q || C.name(p).toLowerCase().includes(q) || (p.nickname || "").toLowerCase().includes(q));
    let h = `<div class="field"><label for="pq" class="sr">Search players</label><input id="pq" type="text" placeholder="Search players…" value="${esc(ui.playerQ)}" autocomplete="off"></div>`;
    h += list.length ? `<div class="pgrid">${list.map((p) => { const t = sid && C.teamOf(p.id, sid); return `<a class="card pcard card-link" href="${pLink(p)}">${av(p)}<b>${esc(C.name(p))}</b><span>${p.nickname ? `"${esc(p.nickname)}"` : tName(t)}</span>${p.nickname ? `<span>${tName(t)}</span>` : ""}<span class="hc"><small>HCP</small>${C.fmtHcp(p.handicap)}</span></a>`; }).join("")}</div>`
      : empty("user", ps.length ? "No match" : "Roster coming soon", ps.length ? "Try a different name." : "Players will be listed once the roster is set.");
    return page("Players", `${ps.length} golfer${ps.length === 1 ? "" : "s"}`, h);
  };
  V.player = (id) => {
    const p = C.player(id);
    if (!p) return page("Player", "", empty("user", "Player not found", ""));
    const season = C.season(), sid = season && season.id;
    const t = sid && C.teamOf(p.id, sid);
    const s = sid ? C.playerStats(p.id, sid) : null;
    const ind = sid ? C.strokeIndividual(sid).find((r) => r.id === p.id) : null;
    const hist = C.hcpHistory(p.id);
    let h = back("#players", "Players");
    h += `<div class="profile-hero">${av(p, "lg")}<h1>${esc(C.name(p))}</h1>
      <div class="sub">${p.nickname ? `"${esc(p.nickname)}" · ` : ""}${t ? `<a href="${tLink(t)}">${esc(t.name)}</a>` : "No team assigned"}</div>
      <div class="headline-stats"><div><b class="gold">${C.fmtHcp(p.handicap)}</b><span>Handicap</span></div><div><b>${ind && ind.pos ? C.posLabel(ind) : "—"}</b><span>Rank</span></div><div><b>${s ? s.potw : 0}</b><span>POTW</span></div></div>
      ${s && (s.potw || s.eagles) ? `<div class="trophies">${s.potw ? `<span class="trophy">${icon("star")}${s.potw}× Player of the Week</span>` : ""}${s.eagles ? `<span class="trophy">${icon("golf")}${s.eagles} Eagle${s.eagles > 1 ? "s" : ""}</span>` : ""}</div>` : ""}
    </div>`;
    if (p.bio) h += `<div class="card mb"><p style="margin:0;color:#d5ddd8">${esc(p.bio)}</p></div>`;
    if (!s || !s.allRounds.length) return `<div class="wrap" style="padding-top:16px">${h}${empty("golf", "No rounds posted yet", "Stats will appear after the first league night.")}</div>`;
    h += `<div class="section"><div class="sec-head"><h2>Season Stats</h2></div><div class="kv">
      <div><div class="k">Avg gross</div><div class="v">${C.fmtNum(s.avgGross)}</div></div>
      <div><div class="k">Avg net</div><div class="v">${C.fmtNum(s.avgNet)}</div></div>
      <div><div class="k">Best gross</div><div class="v">${s.bestGross ? s.bestGross.gross : "—"} <small>${s.bestGross ? "Wk " + s.bestGross.week : ""}</small></div></div>
      <div><div class="k">Best net</div><div class="v">${s.bestNet ? s.bestNet.net : "—"} <small>${s.bestNet ? "Wk " + s.bestNet.week : ""}</small></div></div>
      <div><div class="k">Birdies</div><div class="v under">${s.birdies}</div></div>
      <div><div class="k">Eagles</div><div class="v gold">${s.eagles}</div></div>
      <div><div class="k">Pars</div><div class="v">${s.pars}</div></div>
      <div><div class="k">Rounds</div><div class="v">${s.rounds}</div></div>
    </div>${S.settings().statsIncludeHcpWeeks ? "" : `<p class="small faint">League weeks only. Handicap-setting rounds are listed below.</p>`}</div>`;
    if (s.weekly.length > 1) h += `<div class="section"><div class="sec-head"><h2>Net Score by Week</h2></div><div class="card">${Charts.html({ points: s.weekly.map((d) => ({ label: "W" + d.week, y: d.net, tip: `Week ${d.week} · gross ${d.gross}` })), unit: "Net", label: "Net score by week" })}<p class="small faint" style="margin:6px 0 0">Lower is better.</p></div></div>`;
    h += `<div class="section"><div class="sec-head"><h2>Weekly Results</h2></div><div class="card pad0 round-list">${s.allRounds.slice().reverse().map((d) => { const pw = C.potw(sid, d.week); return `<div class="round"><div class="w">Week<b>${d.week}</b></div><div><b>${d.course ? esc(d.course.name) : "—"}</b><div class="small muted">${C.PHASES[C.phaseOf(d.week)].short} · HCP ${C.fmtHcp(d.hcp)} · ${d.birdies} bird · ${d.eagles} eag · ${d.pars} par${pw && pw.winner && pw.winner.playerId === p.id ? ` · <span class="gold">★ POTW</span>` : ""}</div></div><div class="nums"><b>${d.net}</b><div class="small muted">gross ${d.gross} · ${toPar(d.toPar)}</div></div></div>`; }).join("")}</div></div>`;
    if (hist.length) h += `<div class="section"><div class="sec-head"><h2>Handicap History</h2></div><div class="card pad0">${hist.slice().reverse().map((x) => `<div class="admin-row"><span class="pos gold" style="font-size:22px">${C.fmtHcp(x.value)}</span><span class="t"><b>${x.prev !== null && x.prev !== undefined ? `from ${C.fmtHcp(x.prev)}` : "Initial handicap"}</b><span>${x.date ? C.fmtDate(new Date(x.date), { month: "short", day: "numeric", year: "numeric" }) : ""}${x.note ? " · " + esc(x.note) : ""}</span></span><span></span></div>`).join("")}</div></div>`;
    return `<div class="wrap" style="padding-top:16px">${h}</div>`;
  };

  /* ---------------- TEAMS ---------------- */
  V.teams = () => {
    const season = C.season();
    if (!season) return page("Teams", "", empty("users", "No season yet", ""));
    const sid = season.id, ts = C.teams(sid);
    const st = C.strokeTeam(sid), bb = C.bestBallTeams(sid);
    const h = ts.length ? `<div class="grid g2">${ts.map((t) => { const a = st.find((r) => r.id === t.id), b = bb.find((r) => r.id === t.id); return `<a class="card tcard card-link reveal" href="${tLink(t)}">${teamAv(t)}<div style="min-width:0"><h3>${esc(t.name)}</h3><div class="small muted">${C.teamPlayers(t).map((p) => esc(C.name(p))).join(" & ") || "Players TBD"}</div></div><div class="center"><div class="label">Best Ball</div><div class="pos" style="font-size:28px">${b && b.pos ? C.posLabel(b) : a && a.pos ? C.posLabel(a) : "—"}</div><div class="small faint">${b && b.pos ? "BB rank" : a && a.pos ? "SP rank" : ""}</div></div></a>`; }).join("")}</div>`
      : empty("users", "Teams coming soon", "Two-man teams will be posted once the roster is final.");
    return page("Teams", `${ts.length} two-man team${ts.length === 1 ? "" : "s"}`, h);
  };
  V.team = (id) => {
    const t = C.team(id);
    if (!t) return page("Team", "", empty("users", "Team not found", ""));
    const sid = t.seasonId, ps = C.teamPlayers(t);
    const a = C.strokeTeam(sid).find((r) => r.id === t.id), b = C.bestBallTeams(sid).find((r) => r.id === t.id);
    const stats = ps.map((p) => C.playerStats(p.id, sid));
    let h = back("#teams", "Teams");
    h += `<div class="profile-hero">${t.photo ? `<img src="${esc(t.photo)}" alt="" style="border-radius:16px;max-height:260px;width:100%;object-fit:cover;margin-bottom:14px">` : `<div class="av-pair" style="justify-content:center;margin-bottom:12px">${ps.map((p) => av(p, "lg")).join("")}</div>`}
      <h1>${esc(t.name)}</h1>${t.motto ? `<div class="sub">“${esc(t.motto)}”</div>` : ""}
      <div class="headline-stats"><div><b class="gold">${b && b.pos ? C.posLabel(b) : "—"}</b><span>Best Ball</span></div><div><b>${a && a.pos ? C.posLabel(a) : "—"}</b><span>Stroke Play</span></div><div><b>${b && b.net !== null ? b.net : a && a.net !== null ? a.net : "—"}</b><span>${b && b.net !== null ? "BB Total" : "SP Total"}</span></div></div></div>`;
    h += `<div class="section"><div class="sec-head"><h2>The Pairing</h2></div><div class="grid g2">${ps.map((p, i) => `<a class="card card-link row" href="${pLink(p)}">${av(p, "md")}<div style="flex:1;min-width:0"><b style="font-size:17px">${esc(C.name(p))}</b><div class="small muted">HCP ${C.fmtHcp(p.handicap)} · Avg net ${C.fmtNum(stats[i].avgNet)}</div></div>${icon("arrow")}</a>`).join("") || empty("user", "Players TBD", "")}</div></div>`;
    h += `<div class="section"><div class="sec-head"><h2>Combined Stats</h2></div><div class="kv">
      <div><div class="k">Birdies</div><div class="v under">${stats.reduce((x, s) => x + s.birdies, 0)}</div></div>
      <div><div class="k">Eagles</div><div class="v gold">${stats.reduce((x, s) => x + s.eagles, 0)}</div></div>
      <div><div class="k">Pars</div><div class="v">${stats.reduce((x, s) => x + s.pars, 0)}</div></div>
      <div><div class="k">POTW awards</div><div class="v">${stats.reduce((x, s) => x + s.potw, 0)}</div></div></div></div>`;
    if (b && b.weekly.length > 1) h += `<div class="section"><div class="sec-head"><h2>Best Ball by Week</h2></div><div class="card">${Charts.html({ points: b.weekly.map((w) => ({ label: "W" + w.week, y: w.net, tip: `Week ${w.week}` })), unit: "Team net", label: "Team best ball by week" })}</div></div>`;
    const ws = C.weeks(sid).filter((w) => w.phase !== "hcp");
    const rowsH = ws.map((w) => {
      let val = null, detail = "";
      if (w.phase === "bestball") { const x = C.bestBall(sid, w.number, t.id); if (x && x.net !== null) { val = x.net; detail = "Team best ball"; } }
      else { const x = a && a.weekly.find((y) => y.week === w.number); if (x) { val = x.net; detail = "Combined net"; } }
      if (val === null) return "";
      const m = (w.matchups || []).find((mm) => mm.a === t.id || mm.b === t.id);
      const r = m && C.matchResult(sid, w, m);
      const opp = m && C.team(m.a === t.id ? m.b : m.a);
      const res = r ? (r.winner === "halved" ? "Halved" : r.winner === t.id ? "Won" : "Lost") : "";
      return `<div class="round"><div class="w">Week<b>${w.number}</b></div><div><b>${C.PHASES[w.phase].short}</b><div class="small muted">${detail}${opp ? ` · vs ${esc(opp.name)}` : ""}${res ? ` · <span class="${res === "Won" ? "gold" : ""}">${res}</span>` : ""}</div></div><div class="nums"><b>${val}</b></div></div>`;
    }).join("");
    h += `<div class="section"><div class="sec-head"><h2>Weekly Results</h2></div>${rowsH ? `<div class="card pad0 round-list">${rowsH}</div>` : empty("golf", "No team results yet", "")}</div>`;
    return `<div class="wrap" style="padding-top:16px">${h}</div>`;
  };

  /* ---------------- STATISTICS ---------------- */
  V.stats = () => {
    const season = C.season();
    if (!season) return page("Statistics", "", empty("chart", "No season yet", ""));
    const sid = season.id, L = C.statLeaders(sid);
    const card = (title, list, fmt = (v) => v, ic = "golf") => `<div class="card leader-card reveal">
      <div class="label">${title}</div>
      ${list.length ? `<a class="top" href="${pLink(list[0].p)}" style="margin-top:10px">${av(list[0].p, "md")}<div><b style="font-size:17px">${esc(C.name(list[0].p))}</b><div class="small muted">${tName(list[0].team)}</div></div><span class="v">${fmt(list[0].v)}</span></a>
      <ol>${list.slice(1, 5).map((r, i) => `<li><a href="${pLink(r.p)}"><span class="n">${i + 2}</span><span>${esc(C.name(r.p))}</span><span class="v">${fmt(r.v)}</span></a></li>`).join("")}</ol>` : `<p class="muted small" style="margin:10px 0 0">No one yet. Be the first.</p>`}</div>`;
    let h = `<div class="grid g3">${card("Most Birdies", L.birdies)}${card("Most Eagles", L.eagles)}${card("Most Pars", L.pars)}${card("Best Avg Net Score", L.avgNet)}${card("Lowest Net Round", L.lowNet)}${card("Player of the Week Awards", L.potw, (v) => v + "★")}</div>`;
    const rows = C.seasonPlayers(sid).map((p) => ({ p, t: C.teamOf(p.id, sid), s: C.playerStats(p.id, sid) })).filter((r) => r.s.rounds);
    const sorts = { avgNet: ["Avg Net", (r) => r.s.avgNet, 1], birdies: ["Birdies", (r) => r.s.birdies, -1], eagles: ["Eagles", (r) => r.s.eagles, -1], pars: ["Pars", (r) => r.s.pars, -1], avgGross: ["Avg Gross", (r) => r.s.avgGross, 1] };
    const [, fn, dir] = sorts[ui.statsSort];
    rows.sort((a, b) => dir * (fn(a) - fn(b)));
    h += `<div class="section"><div class="sec-head"><h2>All Players</h2></div><div class="chips mb">${Object.entries(sorts).map(([k, [l]]) => `<button class="chip ${ui.statsSort === k ? "on" : ""}" data-ssort="${k}">${l}</button>`).join("")}</div>
      ${rows.length ? `<div class="lb"><div class="lb-rows has-table">${rows.map((r, i) => `<a class="lb-row" href="${pLink(r.p)}"><div class="pos">${i + 1}</div><div class="who">${av(r.p)}<div class="who-txt"><b>${esc(C.name(r.p))}</b><span>${tName(r.t)} · ${r.s.rounds} rds</span></div></div><div class="score-col"><b>${C.fmtNum(fn(r))}</b><span>${sorts[ui.statsSort][0]}</span></div><div class="mini-stats"><span>Avg gross <b>${r.s.avgGross}</b></span><span>Avg net <b>${r.s.avgNet}</b></span><span>Bird <b>${r.s.birdies}</b></span><span>Eag <b>${r.s.eagles}</b></span><span>Par <b>${r.s.pars}</b></span></div></a>`).join("")}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Team</th><th class="n">Rds</th><th class="n">Avg Gross</th><th class="n">Avg Net</th><th class="n">Best Gross</th><th class="n">Best Net</th><th class="n">Birdies</th><th class="n">Eagles</th><th class="n">Pars</th><th class="n">POTW</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr data-href="${pLink(r.p)}"><td>${i + 1}</td><td><a class="row" href="${pLink(r.p)}">${av(r.p)}<b>${esc(C.name(r.p))}</b></a></td><td>${tName(r.t)}</td><td class="n">${r.s.rounds}</td><td class="n">${r.s.avgGross}</td><td class="n">${r.s.avgNet}</td><td class="n">${r.s.bestGross ? r.s.bestGross.gross : "—"}</td><td class="n">${r.s.bestNet ? r.s.bestNet.net : "—"}</td><td class="n under">${r.s.birdies}</td><td class="n gold">${r.s.eagles}</td><td class="n">${r.s.pars}</td><td class="n">${r.s.potw}</td></tr>`).join("")}</tbody></table></div></div>` : empty("chart", "No stats yet", "Stats build automatically as scores are posted.")}</div>`;
    const wk = C.scoredWeeks(sid).filter((n) => S.settings().statsIncludeHcpWeeks || C.phaseOf(n) !== "hcp");
    if (wk.length > 1) {
      const pts = wk.map((n) => ({ label: "W" + n, y: C.weekScores(sid, n).reduce((x, d) => x + d.birdies + d.eagles, 0), tip: `Week ${n}: birdies + eagles` }));
      h += `<div class="section"><div class="sec-head"><h2>League Birdies & Eagles by Week</h2></div><div class="card">${Charts.html({ type: "bar", points: pts, unit: "Total", label: "Birdies and eagles by week" })}</div></div>`;
    }
    return page("Statistics", season.name, h);
  };

  /* ---------------- PLAYER OF THE WEEK ---------------- */
  V.potw = () => {
    const season = C.season();
    if (!season) return page("Player of the Week", "", empty("star", "No season yet", ""));
    const arc = C.potwArchive(season.id);
    const latest = arc.find((x) => x.winner);
    let h = latest ? potwCard(latest) : empty("star", "No winner yet", "Awarded each league week to the lowest individual net score.");
    h += `<div class="section"><div class="sec-head"><h2>Season Archive</h2></div>${arc.length ? `<div class="card pad0">${arc.map((x) => x.winner ? `<a class="admin-row" href="${pLink(x.winner.player)}">${av(x.winner.player)}<span class="t"><b>${esc(C.name(x.winner.player))}</b><span>Week ${x.week.number} · ${x.winner.course ? esc(x.winner.course.name) : ""} · Gross ${x.winner.gross} · HCP ${C.fmtHcp(x.winner.hcp)}</span></span><span class="pos gold" style="font-size:26px">${x.winner.net}</span></a>` : `<div class="admin-row"><span class="av">?</span><span class="t"><b>Week ${x.week.number} — tie</b><span>${x.tied.map((d) => esc(C.name(d.player))).join(", ")} at ${x.tied[0].net} · awaiting decision</span></span><span></span></div>`).join("")}</div>` : `<p class="muted">Winners will be listed here every week.</p>`}</div>`;
    return page("Player of the Week", "Lowest net score of the week", h);
  };

  /* ---------------- TEE TIMES + LEAGUE CALENDAR ---------------- */
  function leagueCalendarHtml() {
    const st = S.settings(), season = C.season();
    const id = (st.calendarId || "").trim();
    let h = "";
    if (id) {
      const mobile = window.innerWidth < 720;
      const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(id)}&ctz=${encodeURIComponent(st.timezone || "America/New_York")}&mode=${mobile ? "AGENDA" : "MONTH"}&showTitle=0&showPrint=0&showTabs=1&showCalendars=0&bgcolor=%23ffffff`;
      h += `<div class="row wrap-row mb"><a class="btn gold" href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(id)}" target="_blank" rel="noopener">${icon("plus")}Add league calendar to my Google Calendar</a></div>
        <iframe class="cal-frame ${mobile ? "mobile" : ""}" src="${src}" title="League Google Calendar" loading="lazy"></iframe>
        <p class="small faint mt">Synced live with the league's Google Calendar — postponements and special events show up here automatically. On iPhone, tap the button above while signed in to Google, or use the per-week links below.</p>`;
      if (st.calendarApiKey) h += `<div class="section"><div class="sec-head"><h2>Upcoming Events</h2></div><div id="gcal-events" class="card pad0"><div class="admin-row"><span></span><span class="muted">Loading…</span><span></span></div></div></div>`;
    } else {
      h += empty("cal", "League calendar coming soon", "The league's Google Calendar will appear here once it's connected.", S.isAdmin() ? `<div class="mt"><a class="btn gold" href="#admin">Connect Google Calendar</a></div>` : "");
    }
    if (season) {
      const up = C.weeks(season.id).filter((w) => w.status === "upcoming" && C.weekDate(w) && C.weekDate(w) > new Date()).slice(0, 6);
      if (up.length) h += `<div class="section"><div class="sec-head"><h2>Add League Nights</h2></div><div class="card pad0">${up.map((w) => `<a class="admin-row" href="${gcalLink(w, season.id)}" target="_blank" rel="noopener"><span class="wk-num" style="min-width:52px"><span>Wk</span><b style="font-size:24px">${w.number}</b></span><span class="t"><b>${C.fmtDate(C.weekDate(w), { weekday: "long", month: "short", day: "numeric" })}</b><span>${C.fmtTime(w)} · ${C.PHASES[w.phase].label}</span></span><span class="tag">+ Add</span></a>`).join("")}</div></div>`;
    }
    return h;
  }
  V.calendar = () => {
    if (!ui.calTab) ui.calTab = "tee";
    let h = `<div class="seg mb" role="tablist"><button role="tab" data-caltab="tee" class="${ui.calTab === "tee" ? "on" : ""}">Book the Sim</button><button role="tab" data-caltab="league" class="${ui.calTab === "league" ? "on" : ""}">League Calendar</button></div>`;
    h += ui.calTab === "tee" ? (window.Tee ? Tee.page() : "") : leagueCalendarHtml();
    return page("Tee Times", "Simulator reservations", h);
  };
  async function loadGcalEvents() {
    const el = $("#gcal-events");
    if (!el) return;
    const st = S.settings();
    try {
      const u = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(st.calendarId)}/events?key=${encodeURIComponent(st.calendarApiKey)}&singleEvents=true&orderBy=startTime&maxResults=8&timeMin=${encodeURIComponent(new Date().toISOString())}`;
      const r = await fetch(u);
      if (!r.ok) throw new Error();
      const j = await r.json();
      el.innerHTML = (j.items || []).map((e) => { const d = new Date(e.start.dateTime || e.start.date + "T12:00"); return `<a class="admin-row" href="${esc(e.htmlLink)}" target="_blank" rel="noopener"><span class="wk-num" style="min-width:52px"><span>${d.toLocaleDateString(undefined, { month: "short" })}</span><b style="font-size:24px">${d.getDate()}</b></span><span class="t"><b>${esc(e.summary || "Event")}</b><span>${e.start.dateTime ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "All day"}${e.location ? " · " + esc(e.location) : ""}</span></span>${icon("arrow")}</a>`; }).join("") || `<div class="admin-row"><span></span><span class="muted">No upcoming events.</span><span></span></div>`;
    } catch (e) { el.innerHTML = `<div class="admin-row"><span></span><span class="muted">Couldn't load events — the calendar above is still live.</span><span></span></div>`; }
  }

  /* ---------------- NEWS ---------------- */
  V.news = () => {
    const posts = C.posts();
    const cats = ["All", ...new Set(posts.map((p) => p.category || "League Update"))];
    const list = posts.filter((p) => ui.newsCat === "All" || (p.category || "League Update") === ui.newsCat);
    let h = cats.length > 2 ? `<div class="chips mb">${cats.map((c) => `<button class="chip ${ui.newsCat === c ? "on" : ""}" data-ncat="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : "";
    h += list.length ? `<div class="grid">${list.map((p) => postCard(p, false)).join("")}</div>` : empty("news", "No announcements yet", "League updates will show up here.");
    return page("League News", "Announcements", h);
  };

  /* ---------- helpers ---------- */
  function page(title, eyebrow, body) {
    return `<div class="wrap"><div class="page-head"><div class="eyebrow">${esc(eyebrow || "Drunken Eagle")}</div><h1>${esc(title)}</h1></div><div class="section" style="padding-top:14px">${body}</div></div>`;
  }
  function back(href, label) { return `<a class="btn sm ghost" href="${href}" style="margin-bottom:4px">${icon("back")}${esc(label)}</a>`; }

  /* =====================================================================
     ROUTER + SHELL
     ===================================================================== */
  function route() {
    const h = (location.hash || "#home").slice(1);
    const m = h.match(/^(player|team|course)-(.+)$/);
    if (m) return { name: m[1], id: m[2], nav: m[1] === "course" ? "courses" : m[1] + "s" };
    const known = ["home", "standings", "handicaps", "schedule", "courses", "players", "teams", "stats", "calendar", "news", "potw", "admin"];
    return { name: known.includes(h) ? h : "home", nav: known.includes(h) ? h : "home" };
  }

  function renderShell(nav) {
    $("#topnav").innerHTML = NAV.map((n) => `<a href="#${n.id}" class="${nav === n.id ? "on" : ""}">${n.label}</a>`).join("");
    const moreOn = !BOTTOM.includes(nav);
    $("#bottomnav").innerHTML = BOTTOM.map((id) => { const n = NAV.find((x) => x.id === id); return `<a href="#${id}" class="${nav === id ? "on" : ""}">${icon(n.icon)}<span>${n.label}</span></a>`; }).join("") + `<button id="more-btn" class="${moreOn ? "on" : ""}" aria-haspopup="dialog">${icon("more")}<span>More</span></button>`;
    $("#sheet-grid").innerHTML = MORE.map((n) => `<a href="#${n.id}" class="${nav === n.id ? "on" : ""}">${icon(n.icon)}${n.label}</a>`).join("");
    const mk = markSrc(), el = $("#brand-logo");
    if (mk && el.getAttribute("src") !== mk) el.setAttribute("src", mk);
  }

  function footer() {
    const st = S.settings();
    return `<footer><div class="wrap"><div class="row"><div class="row"><img src="${esc(markSrc())}" alt="" style="width:34px;height:34px;border-radius:50%"><b style="font-family:var(--display);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)">${esc(st.leagueName)}</b></div><div class="row" style="gap:16px">${S.LIVE ? "" : `<span class="mode-flag">● Preview mode — data saved in this browser only</span>`}<a href="#admin">${S.isAdmin() ? "Admin dashboard" : "Admin login"}</a></div></div>
      <div class="small mt">${C.seasons().length > 1 ? `Season: <select id="season-pick" style="min-height:36px;width:auto;padding:4px 8px;font-size:13px">${C.seasons().map((s) => `<option value="${s.id}" ${C.season() && C.season().id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>` : ""}</div></div></footer>`;
  }

  let currentRoute = null;
  function render(keepScroll) {
    timers.forEach(clearInterval); timers = [];
    const r = route();
    const routeChanged = !currentRoute || currentRoute.name !== r.name || currentRoute.id !== r.id;
    currentRoute = r;
    renderShell(r.nav);
    closeSheet();
    let html;
    try {
      if (S.error) html = `<div class="wrap section">${empty("shield", "Connection problem", S.error)}</div>`;
      else if (r.name === "admin") html = window.Admin ? Admin.view() : "";
      else html = (r.id ? V[r.name](r.id) : V[r.name]());
    } catch (e) {
      console.error(e);
      html = `<div class="wrap section">${empty("shield", "Something went wrong", "Try refreshing the page.")}</div>`;
    }
    $("#main").innerHTML = html + (r.name === "admin" ? "" : footer());
    if (routeChanged && !keepScroll) window.scrollTo(0, 0);
    after(r);
  }
  function after(r) {
    Charts.mount($("#main"));
    const cd = $("[data-countdown]");
    if (cd) {
      const target = new Date(cd.dataset.countdown).getTime();
      const tick = () => {
        let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
        const parts = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
        cd.querySelectorAll("b").forEach((b, i) => { b.textContent = String(parts[i]).padStart(2, "0"); });
      };
      tick(); timers.push(setInterval(tick, 1000));
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -40px 0px" });
      $$(".reveal").forEach((el) => io.observe(el));
    } else $$(".reveal").forEach((el) => el.classList.add("in"));
    if (r.name === "calendar" && ui.calTab === "league") loadGcalEvents();
    if (window.Tee) Tee.after(r.name);
    if (r.name === "admin" && window.Admin) Admin.after();
    const pq = $("#pq");
    if (pq) pq.addEventListener("input", () => { ui.playerQ = pq.value; const pos = pq.selectionStart; render(true); const n = $("#pq"); n.focus(); n.setSelectionRange(pos, pos); });
    const sp = $("#season-pick");
    if (sp) sp.addEventListener("change", async () => { await S.saveSettings({ activeSeasonId: sp.value }); });
  }

  /* sheet */
  function openSheet() { $("#sheet").classList.add("open"); $("#sheet-bg").classList.add("open"); }
  function closeSheet() { $("#sheet").classList.remove("open"); $("#sheet-bg").classList.remove("open"); }

  /* global delegated clicks for public pages */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-stand],[data-sweek],[data-ssort],[data-ncat],[data-goweek],[data-caltab],#more-btn,#sheet-bg,tr[data-href]");
    if (!t) return;
    if (t.id === "more-btn") return openSheet();
    if (t.id === "sheet-bg") return closeSheet();
    if (t.dataset.caltab) { ui.calTab = t.dataset.caltab; return render(true); }
    if (t.dataset.stand) { ui.standTab = t.dataset.stand; return render(true); }
    if (t.dataset.sweek) { ui.standWeek = +t.dataset.sweek; return render(true); }
    if (t.dataset.ssort) { ui.statsSort = t.dataset.ssort; return render(true); }
    if (t.dataset.ncat) { ui.newsCat = t.dataset.ncat; return render(true); }
    if (t.dataset.goweek) { ui.standTab = "week"; ui.standWeek = +t.dataset.goweek; location.hash = "standings"; return; }
    if (t.matches("tr[data-href]") && !e.target.closest("a")) { location.hash = t.dataset.href; }
  });

  /* toast + modal used by admin */
  function toast(msg, err) {
    const el = document.createElement("div");
    el.className = "toast" + (err ? " err" : "");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  window.App = {
    esc, icon, av, toast, render, ui,
    timer(fn, ms) { timers.push(setInterval(fn, ms)); },
    async start() {
      $("#main").innerHTML = `<div class="wrap section center muted" style="padding-top:80px"><img src="${A.mark || ""}" alt="" style="width:84px;height:84px;border-radius:50%;margin:0 auto 12px;display:block;border:2px solid var(--gold)">Loading the leaderboard…</div>`;
      await S.init();
      if (window.DEGL_CONFIG.AUTO_LOAD_DEMO && !S.all("season").length && window.Demo) await Demo.load();
      let pending = false;
      S.onChange(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; if (!(window.Admin && Admin.busy()) && !(window.Tee && Tee.busy())) render(true); }); });
      window.addEventListener("hashchange", () => render());
      if (S.LIVE) {
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !S.isAdmin()) S.reload().catch(() => {}); });
      }
      let lastW = window.innerWidth;
      window.addEventListener("resize", () => { if ((lastW < 720) !== (window.innerWidth < 720) && route().name === "calendar") render(true); lastW = window.innerWidth; });
      render();
    }
  };
})();
