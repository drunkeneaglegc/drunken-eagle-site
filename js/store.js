/* =====================================================================
   DATA STORE
   One simple record store used by the whole site.
   - Preview mode: browser storage (this device only)
   - Live mode:    Supabase (shared database, secure admin login, photo storage)
   ===================================================================== */
(function () {
  const CFG = window.DEGL_CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const LS_KEY = "degl-data-v1";
  const LS_AUTH = "degl-admin-session";

  const DEFAULT_SETTINGS = {
    id: "settings",
    leagueName: "The Drunken Eagle Golf League",
    tagline: "Good Swings. Bad Decisions. Great Competition.",
    activeSeasonId: null,
    calendarId: "",
    calendarApiKey: "",
    timezone: "America/New_York",
    venue: "",
    rankBy: "total",            // "total" (cumulative net, per league rules) | "avg"
    missedRound: "avg",         // missed stroke-play round counts as: "avg" player's avg net | "worst" week's worst+1 | "none"
    roundPlayingHcp: true,      // net = gross - rounded handicap
    statsIncludeHcpWeeks: false,
    potwTiebreak: "admin",      // admin | gross | backnine | handicap
    hcp: { method: "manual", rounds: 4, best: 4, pct: 100, max: 36, source: "all", rounding: 0 },
    photos: { hero: "", logo: "", gallery: [] }
  };

  const mem = { records: {} };  // id -> {kind, data}
  let sb = null;
  let session = null;
  const listeners = [];

  const uid = () =>
    Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function persistLocal() {
    const ok = lsSet(LS_KEY, JSON.stringify(mem.records));
    if (!ok) console.warn("Browser storage full or unavailable; changes kept for this visit only.");
    return ok;
  }

  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  async function sha256(s) {
    try {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { return "plain:" + s; }
  }

  /* ---------- image resizing (fast on mobile data) ---------- */
  function resizeImage(file, maxW = 1400, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((blob) => resolve({ blob, dataUrl: c.toDataURL("image/jpeg", quality) }), "image/jpeg", quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const Store = {
    LIVE,
    uid,
    ready: false,
    error: null,

    onChange(fn) { listeners.push(fn); },

    async init() {
      if (LIVE) {
        try {
          sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
          const { data } = await sb.auth.getSession();
          session = data.session;
          sb.auth.onAuthStateChange((_e, s) => { session = s; emit(); });
          await Store.reload();
        } catch (e) {
          console.error(e);
          Store.error = "Couldn't reach the league database. Check your connection and refresh.";
        }
      } else {
        const raw = lsGet(LS_KEY);
        if (raw) { try { mem.records = JSON.parse(raw) || {}; } catch (e) { mem.records = {}; } }
      }
      Store.ready = true;
    },

    async reload() {
      if (!LIVE) return;
      const out = {};
      let from = 0;
      for (;;) {
        const { data, error } = await sb.from("records").select("id,kind,data").range(from, from + 999);
        if (error) throw error;
        data.forEach((r) => { out[r.id] = { kind: r.kind, data: r.data }; });
        if (data.length < 1000) break;
        from += 1000;
      }
      mem.records = out;
      emit();
    },

    all(kind) {
      const out = [];
      for (const id in mem.records) if (mem.records[id].kind === kind) out.push(mem.records[id].data);
      return out;
    },
    get(kind, id) {
      const r = mem.records[id];
      return r && r.kind === kind ? r.data : null;
    },
    settings() {
      const s = (mem.records.settings && mem.records.settings.data) || {};
      return {
        ...DEFAULT_SETTINGS, ...s,
        hcp: { ...DEFAULT_SETTINGS.hcp, ...(s.hcp || {}) },
        photos: { ...DEFAULT_SETTINGS.photos, ...(s.photos || {}) }
      };
    },

    async save(kind, obj) {
      const data = { ...obj };
      if (!data.id) data.id = kind === "settings" ? "settings" : kind.slice(0, 2) + uid();
      data.updatedAt = new Date().toISOString();
      if (LIVE) {
        const { error } = await sb.from("records").upsert({ id: data.id, kind, data, updated_at: data.updatedAt });
        if (error) throw new Error(error.message);
      }
      mem.records[data.id] = { kind, data };
      if (!LIVE) persistLocal();
      emit();
      return data;
    },

    async saveMany(items) { // [{kind, data}]
      const rows = items.map(({ kind, data }) => {
        const d = { ...data };
        if (!d.id) d.id = kind.slice(0, 2) + uid();
        d.updatedAt = new Date().toISOString();
        return { id: d.id, kind, data: d, updated_at: d.updatedAt };
      });
      if (LIVE) {
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await sb.from("records").upsert(rows.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
      }
      rows.forEach((r) => { mem.records[r.id] = { kind: r.kind, data: r.data }; });
      if (!LIVE) persistLocal();
      emit();
    },

    async saveSettings(patch) {
      const cur = (mem.records.settings && mem.records.settings.data) || {};
      return Store.save("settings", { ...cur, ...patch, id: "settings" });
    },

    async remove(kind, id) {
      if (LIVE) {
        const { error } = await sb.from("records").delete().eq("id", id);
        if (error) throw new Error(error.message);
      }
      delete mem.records[id];
      if (!LIVE) persistLocal();
      emit();
    },

    async removeMany(ids) {
      if (!ids.length) return;
      if (LIVE) {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await sb.from("records").delete().in("id", ids.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
      }
      ids.forEach((id) => delete mem.records[id]);
      if (!LIVE) persistLocal();
      emit();
    },

    /* ---------- photos ---------- */
    async uploadImage(file, maxW = 1400) {
      const { blob, dataUrl } = await resizeImage(file, maxW);
      if (!LIVE) return dataUrl;
      const path = `${new Date().getFullYear()}/${uid()}.jpg`;
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    },

    /* ---------- admin auth ---------- */
    isAdmin() {
      if (LIVE) return !!session;
      return lsGet(LS_AUTH) === "1" || Store._memAdmin === true;
    },
    adminEmail() { return LIVE && session ? session.user.email : "Preview admin"; },
    async login(email, password) {
      if (LIVE) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        session = data.session;
      } else {
        const want = await sha256(CFG.PREVIEW_ADMIN_PASSWORD || "eagle");
        if ((await sha256(password)) !== want) throw new Error("Incorrect password.");
        Store._memAdmin = true;
        lsSet(LS_AUTH, "1");
      }
      emit();
    },
    async logout() {
      if (LIVE) await sb.auth.signOut();
      Store._memAdmin = false;
      lsDel(LS_AUTH);
      session = null;
      emit();
    },

    /* ---------- backup ---------- */
    exportJSON() {
      return JSON.stringify({ exportedAt: new Date().toISOString(), records: mem.records }, null, 1);
    },
    async importJSON(text) {
      const obj = JSON.parse(text);
      const recs = obj.records || {};
      const items = Object.keys(recs).map((id) => ({ kind: recs[id].kind, data: { ...recs[id].data, id } }));
      await Store.saveMany(items);
    },
    async wipe(predicate) {
      const ids = Object.keys(mem.records).filter((id) => predicate(mem.records[id]));
      await Store.removeMany(ids);
    },
    rawRecords() { return mem.records; },

    /* ---------- tee time bookings ---------- */
    tee: {
      _rules: null,
      async rules() {
        if (LIVE) {
          const { data, error } = await sb.rpc("booking_rules");
          if (error) throw new Error(error.message);
          Store.tee._rules = data;
        } else {
          const cfg = JSON.parse(lsGet("degl-tee-cfg") || "{}");
          Store.tee._rules = { days_ahead: cfg.days_ahead || 14, length_min: cfg.length_min || 120, step_min: cfg.step_min || 30, pin_set: true };
        }
        return Store.tee._rules;
      },
      async list(fromISO, toISO) {
        if (LIVE) {
          const { data, error } = await sb.from("bookings").select("*").lt("slot_start", toISO).gt("slot_end", fromISO).order("slot_start");
          if (error) throw new Error(error.message);
          return data;
        }
        return JSON.parse(lsGet("degl-tee") || "[]").filter((b) => b.slot_start < toISO && b.slot_end > fromISO).sort((a, b) => a.slot_start.localeCompare(b.slot_start));
      },
      async book(startISO, playerId, name, pin, note) {
        if (LIVE) {
          const { data, error } = await sb.rpc("book_tee_time", { p_start: startISO, p_player_id: playerId || "", p_player_name: name, p_pin: pin, p_note: note || null });
          if (error) throw new Error(error.message);
          return data;
        }
        const cfg = JSON.parse(lsGet("degl-tee-cfg") || "{}");
        if (pin !== (cfg.pin || CFG.PREVIEW_TEE_PIN || "1234")) throw new Error("Incorrect league PIN.");
        const r = Store.tee._rules || (await Store.tee.rules());
        const s = new Date(startISO), e = new Date(s.getTime() + r.length_min * 60000);
        const all = JSON.parse(lsGet("degl-tee") || "[]");
        if (all.some((b) => new Date(b.slot_start) < e && new Date(b.slot_end) > s)) throw new Error("Sorry — someone already has the sim during that time.");
        all.push({ id: uid(), slot_start: s.toISOString(), slot_end: e.toISOString(), player_id: playerId, player_name: name, note: note || null });
        lsSet("degl-tee", JSON.stringify(all));
      },
      async cancel(id, name, pin) {
        if (LIVE) {
          const { error } = await sb.rpc("cancel_tee_time", { p_id: id, p_player_name: name, p_pin: pin });
          if (error) throw new Error(error.message);
          return;
        }
        const cfg = JSON.parse(lsGet("degl-tee-cfg") || "{}");
        if (pin !== (cfg.pin || CFG.PREVIEW_TEE_PIN || "1234")) throw new Error("Incorrect league PIN.");
        const all = JSON.parse(lsGet("degl-tee") || "[]");
        const b = all.find((x) => x.id === id);
        if (!b || b.player_name.trim().toLowerCase() !== String(name).trim().toLowerCase()) throw new Error("That reservation is under a different name.");
        lsSet("degl-tee", JSON.stringify(all.filter((x) => x.id !== id)));
      },
      async adminDelete(id) {
        if (LIVE) {
          const { error } = await sb.from("bookings").delete().eq("id", id);
          if (error) throw new Error(error.message);
          return;
        }
        lsSet("degl-tee", JSON.stringify(JSON.parse(lsGet("degl-tee") || "[]").filter((x) => x.id !== id)));
      },
      async setConfig(pin, daysAhead, lengthMin, stepMin) {
        if (LIVE) {
          const { error } = await sb.rpc("set_booking_config", { p_pin: pin || null, p_days_ahead: daysAhead, p_length_min: lengthMin, p_step_min: stepMin });
          if (error) throw new Error(error.message);
          return;
        }
        const cfg = JSON.parse(lsGet("degl-tee-cfg") || "{}");
        lsSet("degl-tee-cfg", JSON.stringify({ ...cfg, ...(pin ? { pin } : {}), days_ahead: daysAhead, length_min: lengthMin, step_min: stepMin }));
      }
    }
  };

  window.Store = Store;
})();
