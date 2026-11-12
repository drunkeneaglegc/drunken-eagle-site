# The Drunken Eagle Golf League — Website

A mobile-first league site with live standings, handicaps, schedule, Player of the Week, player and team profiles, stats, a Google Calendar page, and a password-protected admin dashboard.

You don't need to write any code. Setup takes about 30 minutes, and every service it uses has a free plan.

---

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | The website |
| `js/config.js` | **The only file you edit**: your database keys |
| `supabase/schema.sql` | Sets up the database (you paste it once) |
| `css/`, `js/` | Site design and logic; leave these alone |

---

## Try it first (Preview mode)

Open `index.html` in a browser. With no database connected, the site runs in **Preview mode**: everything works, but data is only saved in that one browser.

- Admin login: tap the 🔒 icon. The password is `eagle` (you can change it in `js/config.js`).
- To see the site filled in, go to **Admin → Backup → Load demo data**. Every demo record is labelled "Demo", and **Remove demo data** clears it all in one tap.

---

## Step 1: Create the free database (Supabase)

1. Go to **supabase.com** and sign up. Click **New project**, give it a name (e.g. `drunken-eagle`), set a database password, and pick the region closest to you.
2. When the project is ready, open **SQL Editor → New query**. Paste the whole contents of `supabase/schema.sql` and click **Run**.
3. Still in the SQL Editor, run this line with **your** email:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
   Repeat it for each co-administrator.
4. Go to **Authentication → Users → Add user → Create new user**. Enter the same email and a strong password, and tick **Auto Confirm User**. This is your admin login.
5. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Only the people you add can log in.
6. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public key**
7. Open `js/config.js` and paste them in:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
   The anon key is safe to publish. The database only lets the emails in your `admins` list make changes.

Once the keys are in, the "Preview mode" notice disappears and every member sees the same live data.

## Step 2: Put the site online (Netlify, free)

1. Go to **app.netlify.com** and sign up.
2. Choose **Add new site → Deploy manually**, then drag the whole `drunken-eagle` folder onto the page.
3. You'll get a link like `drunken-eagle-123.netlify.app`. You can rename it under **Site configuration → Change site name**, or connect your own domain.
4. To update the site later (for example, after editing `config.js`), drag the folder onto **Deploys** again.

Any static host works the same way, including GitHub Pages, Cloudflare Pages and Vercel.

**Tip for members:** on an iPhone, open the site in Safari, tap Share, then **Add to Home Screen**. On Android, open it in Chrome, tap ⋮, then **Add to Home screen**. The site then opens like an app.

## Step 3: Connect Google Calendar

1. In Google Calendar on a computer, create a calendar called "Drunken Eagle League" (**Other calendars → + → Create new calendar**).
2. Open its **Settings**, go to **Access permissions**, and tick **Make available to public** ("See all event details").
3. Under **Integrate calendar**, copy the **Calendar ID**.
4. On your site, go to **Admin → Season & Settings** and paste it into **League Calendar ID**. Save.

The Calendar page now shows your live Google Calendar. Add postponements and special events in Google Calendar and they appear on the site automatically. Members can subscribe with one tap.

*Optional:* to show an "Upcoming Events" list, create a Google API key with the Calendar API enabled (console.cloud.google.com) and paste it into **Google API key**.

---

## Running the league each week

1. **Admin → Scores**: pick the week. For each player, enter their **gross** score (or tap **Enter hole-by-hole**), then tap **Save**.
   - Net scores, standings, movement arrows, team totals and Player of the Week all update automatically.
   - Hole-by-hole entry, available once a course has hole pars, also calculates birdies, eagles and pars, and works out **net best ball** for each team automatically.
   - If you only enter totals during the Best Ball weeks, type each team's best-ball score in the **Team Net Best Ball** box.
2. Set the week's status to **Completed**.
3. **Admin → Player of Week**: if there's a tie, pick the winner (or set an automatic tiebreaker). Tap **Draft announcement** to post it to League News.

### Season setup checklist
- **Season & Settings**: create the season by entering the Week 1 date and start time. All 14 weeks are generated, and you can edit any date.
- **Courses**: add the simulator courses you'll play, with photos. Adding the hole-by-hole scorecard is recommended.
- **Players**: add each golfer with a photo. The roster can grow or shrink at any time.
- **Teams**: pair players into two-man teams.
- **Schedule**: set the course of the week and the matchups. **Auto-fill matchups** builds a round robin for you.
- **Photos**: add your hero photo, logo and course/simulator gallery.

### Handicaps
- During Weeks 1–2 (Handicap Setting), enter scores as usual.
- **Admin → Handicaps**: choose your league's formula. The options are:
  - **Manual**: you type every handicap.
  - **Average over par × %**
  - **Differential**: the slope/rating-based method.
  
  The site never assumes the USGA formula.
- Suggested handicaps are shown next to each player. Nothing changes until you tap **Save handicaps**.
- Every change is logged to the player's handicap history. Scores keep the handicap that was used that week.

### Rule settings (Admin → Season & Settings)
- **Rank standings by**: cumulative net (default, per league rules) or average net.
- **A missed Stroke Play round counts as**: by default, a missed round is filled with the player's own average net. This stops a player who misses a week from jumping to the top with a lower total. You can change it to "worst + 1" or "nothing".
- **Round handicap to whole strokes**: on by default.

### New season
**Season & Settings → Start a new season**. You can copy last season's teams. Old seasons stay saved and can be viewed from the season picker at the bottom of the site.

### Backups
**Admin → Backup → Download backup file** at the end of each season.
