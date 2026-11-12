/* =====================================================================
   LEAGUE ENGINE — standings, handicaps, best ball, Player of the Week.
   Everything here is calculated live from the scores the admin enters,
   so leaderboards update automatically.
   ===================================================================== */
(function () {
  const S = window.Store;

  const PHASES = {
    hcp: { key: "hcp", label: "Handicap Setting", short: "Handicap Setting", weeks: "Weeks 1–2", color: "var(--ph-hcp)" },
    stroke: { key: "stroke", label: "Net Stroke Play", short: "Stroke Play", weeks: "Weeks 3–8", color: "var(--ph-stroke)" },
    bestball: { key: "bestball", label: "Net Best Ball", short: "Best Ball", weeks: "Weeks 9–14", color: "var(--ph-bb)" }
  };
  const phaseOf = (n) => (n <= 2 ? "hcp" : n <= 8 ? "stroke" : "bestball");
  const leagueWeek = (n) => (n <= 2 ? null : n - 2);

  const num = (v) => (v === "" || v === null || v === undefined || isNaN(+v) ? null : +v);
  const round1 = (v) => Math.round(v * 10) / 10;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const avg = (a) => (a.length ? sum(a) / a.length : null);
  const defaultSI = (i) => (i < 9 ? 2 * i + 1 : 2 * (i - 9) + 2);

  const C = { PHASES, phaseOf, leagueWeek, num, avg, round1 };

  /* ---------- lookups ---------- */
  C.settings = () => S.settings();
  C.seasons = () => S.all("season").sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  C.season = () => {
    const st = S.settings();
    return (st.activeSeasonId && S.get("season", st.activeSeasonId)) || C.seasons()[0] || null;
  };
  C.weeks = (sid) => S.all("week").filter((w) => w.seasonId === sid).sort((a, b) => a.number - b.number);
  C.week = (sid, n) => C.weeks(sid).find((w) => w.number === +n) || null;
  C.teams = (sid) => S.all("team").filter((t) => t.seasonId === sid).sort((a, b) => a.name.localeCompare(b.name));
  C.team = (id) => S.get("team", id);
  C.players = () => S.all("player").sort((a, b) => (a.last || "").localeCompare(b.last || "") || (a.first || "").localeCompare(b.first || ""));
  C.player = (id) => S.get("player", id);
  C.courses = () => S.all("course").sort((a, b) => a.name.localeCompare(b.name));
  C.course = (id) => (id ? S.get("course", id) : null);
  C.posts = () => S.all("post").sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.date || "").localeCompare(a.date || ""));
  C.name = (p) => (p ? `${p.first || ""} ${p.last || ""}`.trim() : "—");
  C.short = (p) => (p ? `${(p.first || "")[0] || ""}. ${p.last || ""}`.trim() : "—");
  C.initials = (p) => (p ? ((p.first || "")[0] || "") + ((p.last || "")[0] || "") : "?").toUpperCase();
  C.teamOf = (pid, sid) => C.teams(sid).find((t) => t.player1Id === pid || t.player2Id === pid) || null;
  C.teamPlayers = (t) => (t ? [C.player(t.player1Id), C.player(t.player2Id)].filter(Boolean) : []);
  C.seasonPlayers = (sid) => {
    const ids = new Set();
    C.teams(sid).forEach((t) => { if (t.player1Id) ids.add(t.player1Id); if (t.player2Id) ids.add(t.player2Id); });
    S.all("score").forEach((s) => { if (s.seasonId === sid) ids.add(s.playerId); });
    return C.players().filter((p) => ids.has(p.id));
  };
  C.weekCourse = (sid, n) => { const w = C.week(sid, n); return w ? C.course(w.courseId) : null; };

  /* ---------- dates ---------- */
  C.weekDate = (w) => {
    if (!w || !w.date) return null;
    const [y, m, d] = w.date.split("-").map(Number);
    const [hh, mm] = (w.time || "19:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  };
  C.fmtDate = (d, opts) => (d ? d.toLocaleDateString(undefined, opts || { weekday: "short", month: "short", day: "numeric" }) : "TBD");
  C.fmtTime = (w) => {
    const d = C.weekDate(w);
    return d && w.time ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "TBD";
  };

  /* Current week = first week not completed or postponed. */
  C.currentWeek = (sid) => {
    const ws = C.weeks(sid);
    if (!ws.length) return null;
    return ws.find((w) => w.status !== "completed" && w.status !== "postponed") || ws[ws.length - 1];
  };
  C.seasonDone = (sid) => { const ws = C.weeks(sid); return ws.length > 0 && ws.every((w) => w.status === "completed"); };
  C.nextNight = (sid) => {
    const now = new Date();
    return C.weeks(sid).filter((w) => w.status === "upcoming" && C.weekDate(w) && C.weekDate(w) > now)
      .sort((a, b) => C.weekDate(a) - C.weekDate(b))[0] || null;
  };

  /* ---------- handicap strokes ---------- */
  C.playingHcp = (h) => {
    if (h === null || h === undefined || h === "") return 0;
    return S.settings().roundPlayingHcp ? Math.round(+h) : +h;
  };
  C.holeStrokes = (h, si) => {
    const hc = Math.round(+h || 0);
    if (hc >= 0) return Math.floor(hc / 18) + (si <= hc % 18 ? 1 : 0);
    return si > 18 + Math.max(hc, -18) ? -1 : 0;
  };
  C.coursePar = (c) => (c && c.holes && c.holes.length === 18 ? sum(c.holes.map((h) => +h.par || 0)) : (c && +c.par) || 72);
  C.hasHolePars = (c) => !!(c && c.holes && c.holes.length === 18 && c.holes.every((h) => +h.par > 0));

  /* Full detail for one score row. */
  C.detail = (s) => {
    if (!s) return null;
    const course = C.weekCourse(s.seasonId, s.week);
    const hcp = num(s.hcp) ?? 0;
    const holes = Array.isArray(s.holes) && s.holes.length === 18 && s.holes.every((x) => num(x) !== null) ? s.holes.map(Number) : null;
    let gross = num(s.gross);
    let birdies = num(s.birdies) ?? 0, eagles = num(s.eagles) ?? 0, pars = num(s.pars) ?? 0;
    let netHoles = null;
    if (holes) {
      gross = sum(holes);
      if (C.hasHolePars(course)) {
        birdies = eagles = pars = 0;
        holes.forEach((g, i) => {
          const d = g - +course.holes[i].par;
          if (d <= -2) eagles++; else if (d === -1) birdies++; else if (d === 0) pars++;
        });
      }
      netHoles = holes.map((g, i) => {
        const si = (course && course.holes && course.holes[i] && +course.holes[i].si) || defaultSI(i);
        return g - C.holeStrokes(hcp, si);
      });
    }
    if (gross === null) return null;
    const net = num(s.netOverride) ?? round1(gross - C.playingHcp(hcp));
    const par = C.coursePar(course);
    return { ...s, gross, net, hcp, holes, netHoles, birdies, eagles, pars, course, par, toPar: round1(net - par), player: C.player(s.playerId) };
  };

  C.scores = (sid) => S.all("score").filter((s) => s.seasonId === sid);
  C.weekScores = (sid, n) => C.scores(sid).filter((s) => s.week === +n).map(C.detail).filter(Boolean).sort((a, b) => a.net - b.net);
  C.scoredWeeks = (sid, phase) => [...new Set(C.scores(sid).filter((s) => !phase || phaseOf(s.week) === phase).map((s) => s.week))].sort((a, b) => a - b);

  /* ---------- ranking helper (ties share a position) ---------- */
  function rank(rows, key) {
    const played = rows.filter((r) => r[key] !== null && r.rounds > 0).sort((a, b) => a[key] - b[key] || (a.tb ?? 0) - (b.tb ?? 0));
    const rest = rows.filter((r) => !(r[key] !== null && r.rounds > 0));
    played.forEach((r, i) => {
      r.pos = i > 0 && played[i - 1][key] === r[key] ? played[i - 1].pos : i + 1;
    });
    played.forEach((r) => { r.tied = played.filter((x) => x.pos === r.pos).length > 1; });
    rest.forEach((r) => { r.pos = null; });
    return played.concat(rest);
  }
  C.posLabel = (r) => (r.pos ? (r.tied ? "T" : "") + r.pos : "—");

  function withMovement(build, sid, phase) {
    const wks = C.scoredWeeks(sid, phase);
    const cur = build(sid, Infinity);
    if (wks.length < 2) return cur;
    const prev = build(sid, wks[wks.length - 2]);
    const pm = {};
    prev.forEach((r) => { if (r.pos) pm[r.id] = r.pos; });
    cur.forEach((r) => { r.move = r.pos && pm[r.id] ? pm[r.id] - r.pos : null; });
    return cur;
  }

  /* Missed stroke-play rounds: fill so cumulative totals stay comparable.
     policy "avg" = player's own average net, "worst" = that week's worst net + 1, "none" = nothing added. */
  function missedFill(pid, week, ds, policy) {
    if (policy === "none") return null;
    if (policy === "worst") { const wk = ds.filter((d) => d.week === week); return wk.length ? Math.max(...wk.map((d) => d.net)) + 1 : null; }
    const mine = ds.filter((d) => d.playerId === pid);
    return mine.length ? round1(avg(mine.map((d) => d.net))) : null;
  }
  C.missedFill = missedFill;

  /* ---------- Net Stroke Play: individual ---------- */
  function strokeIndividual(sid, upto) {
    const st = S.settings();
    const policy = st.missedRound || "avg";
    const ds = C.scores(sid).filter((s) => phaseOf(s.week) === "stroke" && s.week <= upto).map(C.detail).filter(Boolean);
    const wks = [...new Set(ds.map((d) => d.week))];
    const byWeek = {};
    ds.forEach((d) => { (byWeek[d.week] = byWeek[d.week] || []).push(d); });
    const winners = {};
    Object.values(byWeek).forEach((arr) => {
      const m = Math.min(...arr.map((d) => d.net));
      arr.filter((d) => d.net === m).forEach((d) => { winners[d.playerId] = (winners[d.playerId] || 0) + 1; });
    });
    const rows = C.seasonPlayers(sid).map((p) => {
      const mine = ds.filter((d) => d.playerId === p.id);
      const team = C.teamOf(p.id, sid);
      const missedWeeks = mine.length ? wks.filter((w) => !mine.some((d) => d.week === w)) : [];
      const fills = missedWeeks.map((w) => missedFill(p.id, w, ds, policy)).filter((v) => v !== null);
      const actualNet = mine.length ? round1(sum(mine.map((d) => d.net))) : null;
      const totalNet = mine.length ? round1(actualNet + sum(fills)) : null;
      const avgNet = mine.length ? round1(actualNet / mine.length) : null;
      return {
        id: p.id, player: p, team,
        hcp: p.handicap,
        gross: mine.length ? sum(mine.map((d) => d.gross)) : null,
        net: totalNet, avgNet,
        toPar: mine.length ? round1(sum(mine.map((d) => d.toPar)) + sum(fills.map((f, i) => f - (C.weekCourse(sid, missedWeeks[i]) ? C.coursePar(C.weekCourse(sid, missedWeeks[i])) : 72)))) : null,
        rounds: mine.length, missed: fills.length,
        wins: winners[p.id] || 0,
        weekly: mine.sort((a, b) => a.week - b.week),
        sortKey: st.rankBy === "avg" ? avgNet : totalNet
      };
    });
    return rank(rows, "sortKey");
  }
  C.strokeIndividual = (sid) => withMovement(strokeIndividual, sid, "stroke");

  /* ---------- Net Stroke Play: team (combined individual nets) ---------- */
  function strokeTeam(sid, upto) {
    const ds = C.scores(sid).filter((s) => phaseOf(s.week) === "stroke" && s.week <= upto).map(C.detail).filter(Boolean);
    const rows = C.teams(sid).map((t) => {
      const ids = [t.player1Id, t.player2Id];
      const policy = S.settings().missedRound || "avg";
      const mine = ds.filter((d) => ids.includes(d.playerId));
      const weeks = [...new Set(mine.map((d) => d.week))].sort((a, b) => a - b);
      const weekly = weeks.map((w) => {
        let net = sum(mine.filter((d) => d.week === w).map((d) => d.net));
        ids.filter(Boolean).forEach((pid) => {
          if (!mine.some((d) => d.week === w && d.playerId === pid)) { const f = missedFill(pid, w, ds, policy); if (f !== null) net += f; }
        });
        return { week: w, net: round1(net), n: mine.filter((d) => d.week === w).length };
      });
      const total = weekly.length ? round1(sum(weekly.map((w) => w.net))) : null;
      return { id: t.id, team: t, players: C.teamPlayers(t), net: total, gross: mine.length ? sum(mine.map((d) => d.gross)) : null, rounds: mine.length, weeks: weeks.length, weekly, avg: weeks.length ? round1(total / weeks.length) : null, sortKey: S.settings().rankBy === "avg" && weeks.length ? round1(total / weeks.length) : total };
    });
    return rank(rows, "sortKey");
  }
  C.strokeTeam = (sid) => withMovement(strokeTeam, sid, "stroke");

  /* ---------- Net Best Ball ---------- */
  C.bestBall = (sid, n, teamId) => {
    const manual = S.all("teamscore").find((x) => x.seasonId === sid && x.week === +n && x.teamId === teamId);
    const t = C.team(teamId);
    if (!t) return null;
    const ds = [t.player1Id, t.player2Id].map((pid) => C.detail(C.scores(sid).find((s) => s.week === +n && s.playerId === pid))).filter(Boolean);
    if (manual && num(manual.net) !== null) return { net: +manual.net, source: "manual", players: ds };
    if (ds.length === 2 && ds[0].netHoles && ds[1].netHoles) {
      const holes = ds[0].netHoles.map((x, i) => Math.min(x, ds[1].netHoles[i]));
      const own = holes.map((x, i) => (x === ds[0].netHoles[i] ? 0 : 1));
      return { net: sum(holes), holes, own, source: "auto", players: ds };
    }
    if (ds.length === 1) return { net: ds[0].netHoles ? sum(ds[0].netHoles) : ds[0].net, source: "solo", players: ds };
    if (ds.length === 2) return { net: null, source: "needs-entry", players: ds };
    return null;
  };
  function bestBallTeams(sid, upto) {
    const wks = C.weeks(sid).filter((w) => w.phase === "bestball" && w.number <= upto).map((w) => w.number);
    const rows = C.teams(sid).map((t) => {
      const weekly = wks.map((n) => { const b = C.bestBall(sid, n, t.id); return b && b.net !== null ? { week: n, net: b.net, source: b.source, par: (C.weekCourse(sid, n) && C.coursePar(C.weekCourse(sid, n))) || 72 } : null; }).filter(Boolean);
      const total = weekly.length ? round1(sum(weekly.map((w) => w.net))) : null;
      const avgNet = weekly.length ? round1(total / weekly.length) : null;
      return { id: t.id, team: t, players: C.teamPlayers(t), net: total, avg: avgNet, rounds: weekly.length, weekly, toPar: weekly.length ? round1(sum(weekly.map((w) => w.net - w.par))) : null, sortKey: S.settings().rankBy === "avg" ? avgNet : total };
    });
    return rank(rows, "sortKey");
  }
  C.bestBallTeams = (sid) => withMovement(bestBallTeams, sid, "bestball");

  /* ---------- matchups ---------- */
  C.matchResult = (sid, w, m) => {
    const val = (tid) => {
      if (w.phase === "bestball") { const b = C.bestBall(sid, w.number, tid); return b ? b.net : null; }
      if (w.phase === "stroke") { const t = C.team(tid); if (!t) return null; const ds = C.weekScores(sid, w.number).filter((d) => d.playerId === t.player1Id || d.playerId === t.player2Id); return ds.length ? round1(sum(ds.map((d) => d.net))) : null; }
      return null;
    };
    const a = val(m.a), b = val(m.b);
    if (a === null || b === null) return null;
    return { a, b, winner: a < b ? m.a : b < a ? m.b : "halved" };
  };

  /* ---------- Player of the Week ---------- */
  C.potw = (sid, n) => {
    const w = C.week(sid, n);
    if (!w || w.phase === "hcp") return null;
    const ds = C.weekScores(sid, n);
    if (!ds.length) return null;
    if (w.potwPlayerId) { const d = ds.find((x) => x.playerId === w.potwPlayerId); if (d) return { winner: d, tied: [], week: w, method: "admin" }; }
    const min = ds[0].net;
    let tied = ds.filter((d) => d.net === min);
    if (tied.length === 1) return { winner: tied[0], tied: [], week: w, method: "net" };
    const tb = S.settings().potwTiebreak;
    const pick = (fn) => { const m = Math.min(...tied.map(fn)); const t2 = tied.filter((d) => fn(d) === m); return t2.length === 1 ? t2[0] : null; };
    let winner = null;
    if (tb === "gross") winner = pick((d) => d.gross);
    if (tb === "handicap") winner = pick((d) => +d.hcp);
    if (tb === "backnine") winner = pick((d) => (d.netHoles ? sum(d.netHoles.slice(9)) : 999));
    if (winner) return { winner, tied, week: w, method: "tiebreak" };
    return { winner: null, tied, week: w, method: "pending" };
  };
  C.potwArchive = (sid) => C.weeks(sid).map((w) => C.potw(sid, w.number)).filter(Boolean).reverse();
  C.latestPotw = (sid) => C.potwArchive(sid).find((x) => x.winner) || null;
  C.potwCount = (pid, sid) => C.potwArchive(sid).filter((x) => x.winner && x.winner.playerId === pid).length;

  /* ---------- player statistics ---------- */
  C.playerStats = (pid, sid) => {
    const inc = S.settings().statsIncludeHcpWeeks;
    const all = C.scores(sid).filter((s) => s.playerId === pid).map(C.detail).filter(Boolean).sort((a, b) => a.week - b.week);
    const ds = all.filter((d) => inc || phaseOf(d.week) !== "hcp");
    const best = (k) => ds.reduce((m, d) => (!m || d[k] < m[k] ? d : m), null);
    return {
      rounds: ds.length, allRounds: all,
      birdies: sum(ds.map((d) => d.birdies)), eagles: sum(ds.map((d) => d.eagles)), pars: sum(ds.map((d) => d.pars)),
      avgGross: ds.length ? round1(avg(ds.map((d) => d.gross))) : null,
      avgNet: ds.length ? round1(avg(ds.map((d) => d.net))) : null,
      bestGross: best("gross"), bestNet: best("net"),
      weekly: ds, potw: C.potwCount(pid, sid)
    };
  };
  C.statLeaders = (sid) => {
    const rows = C.seasonPlayers(sid).map((p) => ({ p, team: C.teamOf(p.id, sid), s: C.playerStats(p.id, sid) })).filter((r) => r.s.rounds > 0);
    const top = (fn, dir = -1) => rows.map((r) => ({ ...r, v: fn(r) })).filter((r) => r.v !== null && r.v !== undefined).sort((a, b) => dir * (a.v - b.v));
    return {
      birdies: top((r) => r.s.birdies).filter((r) => r.v > 0),
      eagles: top((r) => r.s.eagles).filter((r) => r.v > 0),
      pars: top((r) => r.s.pars).filter((r) => r.v > 0),
      avgNet: top((r) => r.s.avgNet, 1),
      lowNet: top((r) => (r.s.bestNet ? r.s.bestNet.net : null), 1),
      potw: top((r) => r.s.potw).filter((r) => r.v > 0)
    };
  };

  /* ---------- handicaps ---------- */
  C.hcpHistory = (pid) => S.all("hcphist").filter((h) => h.playerId === pid).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  C.handicapRows = (sid) => C.seasonPlayers(sid).map((p) => {
    const hist = C.hcpHistory(p.id);
    const last = hist[hist.length - 1];
    const prev = last ? num(last.prev) : null;
    const ds = C.scores(sid).filter((s) => s.playerId === p.id).map(C.detail).filter(Boolean).sort((a, b) => b.week - a.week);
    return {
      p, team: C.teamOf(p.id, sid), cur: num(p.handicap), prev,
      change: num(p.handicap) !== null && prev !== null ? round1(+p.handicap - prev) : null,
      avgGross: ds.length ? round1(avg(ds.map((d) => d.gross))) : null,
      avgNet: ds.length ? round1(avg(ds.map((d) => d.net))) : null,
      recent: ds.slice(0, 4), hist
    };
  });

  /* Suggested handicap from the league's configured formula (never USGA unless chosen). */
  C.suggestHcp = (pid, sid) => {
    const h = S.settings().hcp;
    if (h.method === "manual") return null;
    let ds = C.scores(sid).filter((s) => s.playerId === pid).map(C.detail).filter(Boolean);
    if (h.source === "hcp") ds = ds.filter((d) => phaseOf(d.week) === "hcp");
    ds.sort((a, b) => b.week - a.week);
    ds = ds.slice(0, Math.max(1, +h.rounds || 4));
    if (!ds.length) return null;
    let base;
    if (h.method === "avgOverPar") base = avg(ds.map((d) => d.gross - d.par));
    else if (h.method === "differential") {
      const diffs = ds.map((d) => {
        const rating = num(d.course && d.course.rating) ?? d.par;
        const slope = num(d.course && d.course.slope) ?? 113;
        return ((d.gross - rating) * 113) / slope;
      }).sort((a, b) => a - b).slice(0, Math.max(1, +h.best || ds.length));
      base = avg(diffs);
    } else return null;
    let v = (base * (+h.pct || 100)) / 100;
    if (num(h.max) !== null) v = Math.min(v, +h.max);
    const f = Math.pow(10, +h.rounding || 0);
    return { value: Math.round(v * f) / f, rounds: ds.length };
  };

  /* ---------- formatting ---------- */
  C.fmtHcp = (h) => { const v = num(h); if (v === null) return "—"; return v < 0 ? "+" + Math.abs(v) : String(v); };
  C.fmtToPar = (v) => (v === null || v === undefined ? "—" : v === 0 ? "E" : v > 0 ? "+" + v : String(v));
  C.toParClass = (v) => (v === null || v === undefined ? "" : v < 0 ? "under" : v === 0 ? "even" : "over");
  C.fmtNum = (v) => (v === null || v === undefined ? "—" : String(v));

  window.C = C;
})();
