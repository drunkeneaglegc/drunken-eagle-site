/* =====================================================================
   DEMO DATA — clearly labelled sample league for previewing the site.
   Every record is tagged demo:true so it can be removed in one tap
   (Admin → Backup → Remove demo data). Never used as real results.
   ===================================================================== */
(function () {
  const S = window.Store, C = window.C;

  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  const COURSES = [
    { name: "Eagle Ridge National (Demo)", location: "Simulator Bay 1", difficulty: 4, rating: 73.4, slope: 138, description: "Sample course for the preview. Elevated tee shots, fast greens and a closing stretch that has ended more than one hot round.", facts: ["Sample data — replace with your real courses", "The 16th is a drivable par 4 if you dare", "Water in play on 7 holes"],
      pars: [4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4], si: [7, 3, 15, 1, 11, 17, 9, 5, 13, 8, 16, 4, 2, 12, 18, 10, 6, 14] },
    { name: "Whiskey Creek Links (Demo)", location: "Simulator Bay 2", difficulty: 3, rating: 71.2, slope: 128, description: "Sample links-style course: wide fairways, pot bunkers and wind that changes every hole.", facts: ["Sample data", "Longest par 5 plays 598 yards", "Only one water hazard — on 18, naturally"],
      pars: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5], si: [5, 9, 17, 1, 13, 3, 15, 11, 7, 6, 18, 2, 10, 14, 4, 16, 12, 8] },
    { name: "Pine Hollow Country Club (Demo)", location: "Simulator Bay 1", difficulty: 2, rating: 70.1, slope: 121, description: "Sample parkland course. Tree-lined and fair — a birdie-fest when the putter is warm.", facts: ["Sample data", "Three reachable par 5s", "Signature island green on 12"],
      pars: [4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4, 5], si: [9, 17, 3, 7, 1, 13, 15, 5, 11, 10, 2, 18, 6, 12, 16, 8, 14, 4] }
  ];
  const PLAYERS = [
    ["Demo", "Golfer A", 4, "Lefty"], ["Demo", "Golfer B", 14, ""], ["Demo", "Golfer C", 9, "Shanks"], ["Demo", "Golfer D", 18, ""],
    ["Demo", "Golfer E", 6, ""], ["Demo", "Golfer F", 21, "Mulligan"], ["Demo", "Golfer G", 11, ""], ["Demo", "Golfer H", 16, "Big Dog"]
  ];
  const TEAMS = ["Fore Play (Demo)", "Grip It & Sip It (Demo)", "Bogey Boys (Demo)", "Sand Trappers (Demo)"];

  window.Demo = {
    async load() {
      const r = rng(20261112);
      const normal = () => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
      const items = [];
      const add = (kind, data) => { const d = { ...data, demo: true, id: data.id || kind.slice(0, 2) + "demo" + S.uid() }; items.push({ kind, data: d }); return d; };

      // Season positioned so Week 11 is the next league night (best ball underway).
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((4 - now.getDay() + 7) % 7 || 7)); // next Thursday
      const start = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 70);
      const season = add("season", { name: "Demo Season (sample data)", startDate: iso(start) });

      const courses = COURSES.map((c) => add("course", { name: c.name, location: c.location, difficulty: c.difficulty, rating: c.rating, slope: c.slope, description: c.description, facts: c.facts, holes: c.pars.map((p, i) => ({ par: p, si: c.si[i], yds: p === 3 ? 150 + Math.round(r() * 60) : p === 4 ? 360 + Math.round(r() * 80) : 510 + Math.round(r() * 70) })), par: c.pars.reduce((a, b) => a + b, 0) }));
      courses.forEach((c) => { c.yardage = c.holes.reduce((a, h) => a + h.yds, 0); });

      const players = PLAYERS.map(([f, l, hc, nick]) => add("player", { first: f, last: l, nickname: nick, handicap: hc, skill: hc, bio: "Sample player for previewing the site.", active: true }));
      const teams = TEAMS.map((n, i) => add("team", { seasonId: season.id, name: n, player1Id: players[i * 2].id, player2Id: players[i * 2 + 1].id, motto: ["Grip it and rip it", "Hydrate responsibly", "Par is a suggestion", "Beach week, every week"][i] }));

      // round robin matchups
      const ids = teams.map((t) => t.id);
      const rr = [];
      const t = ids.slice();
      for (let k = 0; k < 3; k++) { rr.push([{ a: t[0], b: t[3] }, { a: t[1], b: t[2] }]); t.splice(1, 0, t.pop()); }

      const weeks = [];
      for (let n = 1; n <= 14; n++) {
        const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (n - 1) * 7);
        weeks.push(add("week", { seasonId: season.id, number: n, phase: C.phaseOf(n), date: iso(dt), time: "19:00", status: n <= 10 ? "completed" : "upcoming", courseId: courses[(n - 1) % 3].id, matchups: n <= 2 ? [] : rr[(n - 3) % 3], notes: n === 14 ? "Championship Night 🏆" : "" }));
      }

      // hole-by-hole scores for completed weeks
      weeks.filter((w) => w.status === "completed").forEach((w) => {
        const c = courses.find((x) => x.id === w.courseId);
        players.forEach((p, pi) => {
          if (w.number === 6 && pi === 5) return; // one missed week for realism
          const holes = c.holes.map((h) => {
            const d = Math.round(p.skill / 18 + normal() * 0.85 + 0.1);
            if (h.par === 5 && r() < 0.025) return h.par - 2;
            return Math.max(h.par - 1, Math.min(h.par + 4, h.par + d));
          });
          add("score", { seasonId: season.id, week: w.number, playerId: p.id, gross: holes.reduce((a, b) => a + b, 0), holes, hcp: p.handicap });
        });
      });

      players.forEach((p) => { add("hcphist", { playerId: p.id, seasonId: season.id, value: p.handicap, prev: null, date: new Date(start.getTime() + 14 * 864e5).toISOString(), note: "Set after handicap weeks" }); delete p.skill; });

      add("post", { title: "Best Ball is underway", category: "Standings Update", date: iso(new Date(now.getTime() - 2 * 864e5)), pinned: true, seasonId: season.id, body: "SAMPLE ANNOUNCEMENT. League Weeks 7–12 are two-man net best ball. Each player plays their own ball and the team takes the low net on every hole. Check the Best Ball tab under Standings." });
      add("post", { title: "Championship Night date set", category: "Championship", date: iso(new Date(now.getTime() - 6 * 864e5)), seasonId: season.id, body: "SAMPLE ANNOUNCEMENT. Week 14 is Championship Night. Trophy, bragging rights, and a round on the last-place team." });
      add("post", { title: "Welcome to the league site", category: "Important", date: iso(new Date(now.getTime() - 40 * 864e5)), seasonId: season.id, body: "SAMPLE ANNOUNCEMENT. Standings, handicaps, schedule and stats all update automatically after each league night." });

      await S.saveMany(items);
      await S.saveSettings({ activeSeasonId: season.id });
    },
    async clear() {
      const st = S.settings();
      const demoSeason = S.all("season").find((s) => s.demo);
      await S.wipe((r) => r.data && r.data.demo);
      if (demoSeason && st.activeSeasonId === demoSeason.id) {
        const other = S.all("season")[0];
        await S.saveSettings({ activeSeasonId: other ? other.id : null });
      }
    }
  };
})();
