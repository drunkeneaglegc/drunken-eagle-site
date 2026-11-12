/* =====================================================================
   THE DRUNKEN EAGLE GOLF LEAGUE — SITE CONFIGURATION
   This is the only file you need to edit to go live.
   See README.md for step-by-step setup.
   ===================================================================== */
window.DEGL_CONFIG = {
  /* ---- DATABASE -------------------------------------------------------
     Leave both blank to run in "Preview mode": data is saved only in the
     browser you're using (good for trying the site out).
     Fill both in to use your free Supabase database, so every member
     sees the same live standings. (README.md, Step 1)                  */
  SUPABASE_URL: "https://uzmryrndwvnionabifwj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2h2OzTylWRuhq0_Ff-WbtA_jFTk1i6D",

  /* ---- PREVIEW-MODE ADMIN PASSWORD -----------------------------------
     Only used in Preview mode. Once Supabase is connected, admins log in
     with the email + password you create in Supabase instead.          */
  PREVIEW_ADMIN_PASSWORD: "eagle",

  /* ---- PREVIEW ONLY: load clearly-labelled demo data on first visit --
     Keep false for the real league site.                                */
  AUTO_LOAD_DEMO: false
};
