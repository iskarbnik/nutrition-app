# Nutrition & Weight PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing steps 1-3 prototype into the full Hebrew RTL nutrition & weight PWA described in the spec: Plate-style UI, calorie/macro targets, meal logging (list, free text, photo via Claude), water/coffee/steps, weekly summary, reminders, IndexedDB storage with Google Drive sync/backup/restore, offline app shell, deployed on GitHub Pages.

**Architecture:** Vanilla JS, no build step. Each logic module is a plain script that attaches one global (`window.X`) and also exports via `module.exports` when `module` exists, so the same file runs in the browser and under `node --test`. Pure logic (targets, day totals, foods search, AI parsing, sync decisions, reminders, week stats) lives in testable modules; DOM code lives in `js/ui/*.js`, one file per screen. State is one in-memory object, persisted to IndexedDB and mirrored to Drive.

**Tech Stack:** HTML/CSS/JS (ES2020), IndexedDB, Service Worker, Google Identity Services + Drive REST v3, Claude Messages API (`claude-sonnet-5-5`), Node 24 built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-24-nutrition-pwa-design.md`

## Global Constraints

- UI language Hebrew, `dir="rtl"`, phone-first (360-430px wide); charts stay `dir="ltr"`.
- No personal defaults in code. Profile `sex` starts `null`; any user-addressing string goes through `g(male, female, neutral)`.
- Day keys are the **local** date `YYYY-MM-DD`, never `toISOString()` of a local Date.
- Daily target = TDEE − 500, floor 1200 kcal (female) / 1500 kcal (male); budget does not grow with activity; overruns shown in red, no carry-over.
- BMR: Mifflin-St Jeor; Katch-McArdle when body-fat % is known.
- Trend: linear regression over last 28 days; warn when weekly loss > 1% of body weight.
- Drive: scope `https://www.googleapis.com/auth/drive.file` only; visible folder `תזונה ומשקל`; `data.json` + `backups/YYYY-MM-DD.json`, keep last 30; backup before restore.
- API key stored only on the device (IndexedDB `secrets` store), never in `data.json`.
- Claude calls direct from browser with header `anthropic-dangerous-direct-browser-access: true`, model `claude-sonnet-5-5`.
- Palette: ink `#1F3B33`, background `#F5F7F4`, protein `#7A8B3A`, carbs `#D9B46A`, fat `#B8324A`; font Rubik (fallback `system-ui`); dark mode via `prefers-color-scheme`.
- Tests: `node --test tests/` from the project root must pass before every commit.

## Review Focus

1. **Local-date boundaries** — logging at 00:30 Israel time (UTC+3) must land on the new local day, not yesterday. Test in Task 1 (`localDateKey`).
2. **Brand-new user** — no profile, no measurements: every screen renders and `computeTargets` returns `null` instead of throwing. Tests in Task 2 and Task 3.
3. **Malformed AI output** — prose around JSON, numbers as strings, negative or missing values: parser keeps valid items, coerces numeric strings, drops the rest, never throws. Test in Task 6.
4. **Bad restore file** — wrong shape or older version: validation fails, current data untouched. Test in Task 3 (`validateState`) and Task 12.
5. **Offline edit then app closed** — the `dirty` flag is persisted so the next launch syncs. Test in Task 12.

---

### Task 1: Module pattern, test runner, dates

Move existing scripts into `js/`, adopt the dual browser/Node pattern, add tests for the existing trend logic.

**Files:**
- Move: `store.js`, `app.js`, `charts.js`, `calc.js` → `js/`
- Create: `js/dates.js`, `tests/dates.test.js`, `tests/trend.test.js`, `package.json`
- Modify: `index.html` (script paths), `js/charts.js` (use `Dates`), `js/calc.js` (export pattern)

**Interfaces:**
- Produces: `Dates.localDateKey(d: Date) -> 'YYYY-MM-DD'`, `Dates.toDay(iso) -> int` (days since epoch, UTC-based on the key), `Dates.fromDay(int) -> iso`, `Dates.addDays(iso, n) -> iso`, `Dates.formatHe(iso) -> 'D.M.YYYY'`; `Calc.trend(data, goal)` (unchanged contract).

- [ ] **Step 1:** `package.json` with `{"private":true,"scripts":{"test":"node --test tests/"}}`.
- [ ] **Step 2: Write failing tests**
  - `localDateKey` with `process.env.TZ='Asia/Jerusalem'` and `new Date('2026-10-23T21:30:00Z')` → `'2026-10-24'`.
  - `fromDay(toDay('2026-03-31')) === '2026-03-31'`; `addDays('2026-12-31', 1) === '2027-01-01'`.
  - `trend`: 5 points 7 days apart from 80 down 0.5/week, goal 75 → `perWeek ≈ -0.5`, `approaching true`, `etaDate` 70 days after last point; fewer than 3 points → `null`; goal already passed → `reached true`.
- [ ] **Step 3:** Run `npm test` → FAIL (modules missing).
- [ ] **Step 4:** Implement `js/dates.js`; wrap `calc.js`/`charts.js` in the pattern `(function (root) { const X = ...; if (typeof module !== 'undefined') module.exports = X; else root.X = X; })(this);`. `calc.js` requires `Dates` via `typeof require` fallback to `root.Dates`. Replace `today()`/`formatDate()` in `app.js` with `Dates`.
- [ ] **Step 5:** `npm test` → PASS. Open `index.html` in a phone-sized headless Edge screenshot; measurements screen still renders.
- [ ] **Step 6:** Commit `refactor: move scripts to js/, add node tests for dates and trend`.

### Task 2: Calorie & macro targets

**Files:** Create `js/targets.js`, `tests/targets.test.js`

**Interfaces:**
- Consumes: profile shape from spec §5; latest measurement `{weight, fat}`.
- Produces: `Targets.compute(profile, latest, onDate: iso) -> null | {bmr, tdee, kcal, protein, fat, carbs, fiber, floored: bool}`; all grams integers, kcal rounded to nearest 10. `profile.overrides` (`{kcal?, protein?, fat?, carbs?}`) replaces computed values; carbs recomputed from remaining kcal only when not overridden.

Rules: age = year of `onDate` − `birthYear`. Protein 1.6 g × current weight. Fat 27% of kcal ÷ 9. Carbs = (kcal − protein×4 − fat×9) ÷ 4. Fiber 25.

- [ ] **Step 1: Failing tests**
  - female, born 1996, 165 cm, 72 kg, activity 1.375, onDate `2026-10-24`, no fat% → `bmr ≈ 1440`, `kcal 1480`, `protein 115`, `fat 44`, `carbs 156`, `fiber 25`.
  - same with fat 31% → Katch-McArdle `bmr ≈ 1443`.
  - male, born 1950, 160 cm, 55 kg, activity 1.2 → `kcal 1500`, `floored true`.
  - `overrides: {kcal: 1600}` → `kcal 1600`, carbs recomputed.
  - missing sex / height / birthYear / weight → `null`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: calorie and macro targets`.

### Task 3: State shape, validation, IndexedDB store

Replace localStorage with IndexedDB and a single in-memory state.

**Files:** Create `js/state.js`, `js/db.js`, `tests/state.test.js`; Rewrite `js/store.js`

**Interfaces:**
- Produces:
  - `State.empty() -> state` (spec §5 shape, `version: 2`, `updatedAt: 0`, `profile.sex: null`, `profile.waterGoal: 2.5`, empty collections).
  - `State.migrate(raw) -> state` — accepts v1 (current localStorage shape) or v2; fills missing fields from `empty()`.
  - `State.validate(obj) -> {ok: bool, error?: string}` — rejects non-objects, missing `profile`, non-array `measurements`, `version > 2`.
  - `DB.get(store, key)`, `DB.put(store, key, value)` (stores `kv`, `secrets`).
  - `Store.init() -> Promise<state>` (loads IndexedDB, else migrates `localStorage['ori-nutrition']` then deletes it), `Store.get()`, `Store.mutate(fn)` (applies `fn(state)`, sets `updatedAt = Date.now()`, sets `meta.dirty = true`, writes to IndexedDB debounced 300 ms, emits `window` event `state-changed`), `Store.replace(state)` (used by refresh/restore), plus existing `updateProfile`, `upsertMeasurement`, `deleteMeasurement`, `measurementOn` reimplemented on `mutate`.
  - `meta` stored separately in `kv` under `meta`: `{dirty, lastSyncAt, lastBackupDate, driveFolderId, dataFileId}`.
- [ ] **Step 1: Failing tests** — `migrate` of a v1 object keeps measurements and profile, adds `days`, `savedMeals`, `coffeeTypes`; `validate({})` fails; `validate(State.empty())` ok; `validate({...empty, version: 3})` fails with message; `upsertMeasurement` logic (moved into pure `State.upsertMeasurement(state, m)`) replaces same date and updates `profile.height`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** `app.js` awaits `Store.init()` before first render. Verify in headless Edge: a profile saved before the change survives (seed localStorage first in the test page).
- [ ] **Step 4:** Commit `feat: IndexedDB store with migration and validation`.

### Task 4: Day log model (meals, water, coffee, steps)

**Files:** Create `js/days.js`, `tests/days.test.js`

**Interfaces:**
- Consumes: `State`, item shape spec §5, `MEALS = ['breakfast','lunch','dinner','snacks']`.
- Produces (all pure, take and mutate `state`):
  - `Days.get(state, date) -> day` (creates empty day lazily: `{meals:{breakfast:[],lunch:[],dinner:[],snacks:[]}, water:0, coffee:[], steps:null}`)
  - `Days.addItems(state, date, meal, items[])`, `Days.updateItem(state, date, meal, index, patch)`, `Days.removeItem(state, date, meal, index)`
  - `Days.addWater(state, date, liters)` (clamped ≥ 0), `Days.addCoffee(state, date, typeId)`, `Days.removeCoffee(state, date, index)`, `Days.setSteps(state, date, n)`
  - `Days.totals(state, date) -> {kcal, protein, fat, carbs, fiber, sugar, sodium, byMeal:{...kcal}}` — includes coffee types' nutrition.
  - `Days.remaining(targets, totals) -> {kcal, protein, fat, carbs, over: bool}`; `deficit = tdee − totals.kcal`.
  - `Days.saveMeal(state, name, items)`, `Days.pushRecent(state, items)` (dedupe by `name`, newest first, max 20).
- [ ] **Step 1: Failing tests** — totals across two meals + one coffee type; `remaining` negative sets `over: true`; `pushRecent` dedupe and cap 20; `addWater(-5)` never below 0; `totals` on a date with no data returns zeros.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat: day log model`.

### Task 5: Food list and search

**Files:** Create `js/foods.js`, `tests/foods.test.js`

**Interfaces:**
- Produces: `Foods.list` — ~150 common Israeli foods, per 100 g: `{name, kcal, protein, fat, carbs, fiber, sugar, sodium, unit?: {name, grams}}` (e.g. `ביצה` unit `{name:'יחידה', grams:55}`, `פרוסת לחם` 30 g). Values from the Israeli Ministry of Health "Tzameret" table or USDA equivalents; source noted in a header comment.
  - `Foods.search(query, extra = []) -> food[]` — normalizes Hebrew (strips niqqud U+0591-U+05C7, trims, collapses spaces); matches every query word as a substring; ranks prefix matches first; searches `extra` (recent + saved items) before the list; max 20.
  - `Foods.scale(food, grams) -> item` (rounded to 1 decimal; `source: 'list'`).
- [ ] **Step 1: Failing tests** — `search('חביתה')` includes a name containing `חביתה`; query with niqqud matches the plain name; `search('')` → `[]`; `scale({kcal:155,...}, 50).kcal === 77.5`.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat: food list and search`.

### Task 6: Claude AI client

**Files:** Create `js/ai.js`, `tests/ai.test.js`

**Interfaces:**
- Produces:
  - `AI.mealRequest({text?, imageBase64?, mediaType?}) -> body` — Messages API body, `model: 'claude-sonnet-5-5'`, `max_tokens: 1024`, system prompt (Hebrew food, Israeli portions, reply ONLY JSON `{"items":[{name,grams,kcal,protein,fat,carbs,fiber,sugar,sodium}]}`), image as base64 content block when present.
  - `AI.parseMeal(text) -> {items: item[], error?: string}` — extracts the first `{...}` block, coerces numeric strings, drops items with missing name or negative/NaN kcal, sets `source:'ai'`.
  - `AI.weeklyTipRequest(stats, sexWord) -> body` and `AI.parseTip(text) -> string` (≤ 300 chars).
  - `AI.call(apiKey, body, fetchImpl = fetch) -> Promise<string>` — POST `https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`; maps 401 → `Error('bad-key')`, network failure → `Error('offline')`, other → `Error('ai-failed')`.
  - `AI.resizeImage(file, maxSide = 1024) -> Promise<{base64, mediaType}>` (browser only, canvas JPEG 0.8).
- [ ] **Step 1: Failing tests** — `parseMeal` on `'הנה: {"items":[{"name":"חביתה","grams":"120","kcal":"180"}]} בתיאבון'` → one item with numeric `grams 120`, `kcal 180`; item with `kcal: -3` dropped; garbage → `{items: [], error}`; `call` with a fake fetch returning 401 rejects `bad-key`; request includes the browser-access header.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat: Claude meal recognition client`.

### Task 7: Plate design system and app shell restructure

Split `app.js` into a router plus per-screen modules and restyle to the Plate direction (spec §7). Load `frontend-design` guidance before styling.

**Files:**
- Create: `js/ui/common.js` (`$`, `$$`, `g`, `showStatus`, `sheet.open(html)/close()`), `js/ui/home.js`, `js/ui/body.js` (moved measurements + chart code), `js/ui/settings.js`
- Modify: `js/app.js` (router only: `go(screen)`, calls `Screens[screen].render()`), `index.html`, `styles.css` (rewrite tokens and components)

**Interfaces:**
- Produces: `Screens.<name> = {render(), init()}` for `home, meals, body, activity, settings`; `UI.sheet.open(html) -> rootEl`, `UI.sheet.close()`; CSS tokens `--ink --bg --card --protein --carbs --fat --over --radius-lg (24px) --radius-md (18px)`.
- Home (`home.js`): SVG plate ring (r=16 viewBox 42, stroke 5) with three arcs proportional to grams eaten of protein/carbs/fat vs targets; center = remaining kcal (red + "חריגה של N" when over); macro row; tiles water / coffee / steps; weight card (latest, 7-day change, ETA from `Calc.trend`); sync badge placeholder (`#sync-badge`); "סיכום שבועי" entry. New user (targets `null`) → plate replaced by a card linking to settings.
- Settings (`settings.js`) adds: computed targets shown with "דריסה ידנית" fields writing `profile.overrides` (empty field = automatic); Claude API key field (password input, stored with `DB.put('secrets','apiKey')`, shows "נשמר" + clear button, never rendered back in plain text).
- `State.empty()` also gets `weekTips: {}` (used by Task 11).
- [ ] **Step 1:** Implement; keep behaviour of measurements screen identical.
- [ ] **Step 2:** Headless Edge screenshots at 390×844 of home (new user and seeded user), body, settings, light and dark (`--force-dark-mode`). Review against spec §7 and fix overlaps.
- [ ] **Step 3:** `npm test` → PASS. Commit `feat: plate design system and screen modules`.

### Task 8: Meals screen

**Files:** Create `js/ui/meals.js`; Modify `index.html`, `styles.css`

**Interfaces:**
- Consumes: `Days.*`, `Foods.search/scale`, `AI.*`, `UI.sheet`, `Targets.compute`.
- Behaviour:
  - Four meal cards with item rows (name, grams, kcal) and per-meal kcal; summary bar on top: eaten / remaining / deficit.
  - "+" FAB opens sheet: meal segmented control (default by hour: <11 breakfast, <16 lunch, <21 dinner, else snacks), three buttons: צילום (`<input type=file accept=image/* capture=environment>`), חיפוש ברשימה, תיאור חופשי; plus ⭐ שמורות and אחרונים lists.
  - Search: live results from `Foods.search(q, recent+saved)`, grams input (unit shortcut when defined), add.
  - Free text / photo: spinner "מחשב...", then a **review sheet** listing AI items with editable grams/kcal/macros (editing grams rescales the item proportionally); "הוספה" commits via `Days.addItems` + `Days.pushRecent`; "שמירה כארוחה" asks for a name.
  - Tap item → edit sheet (same fields) with delete (two-tap confirm, existing pattern).
  - Errors: `bad-key` → message + link to settings; `offline` → "אין חיבור. אפשר לחפש ברשימה."; empty AI result → text kept, suggest search.
- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Headless Edge: seeded test page drives search add, edit, delete; AI path with stubbed `AI.call` returning a fixed JSON. Screenshot sheet and review sheet.
- [ ] **Step 3:** Commit `feat: meals screen with search, AI text and photo`.

### Task 9: Water and coffee

**Files:** Modify `js/ui/home.js`, `js/ui/settings.js`

- Home water tile: tap +0.25 L, long-press opens sheet with −/+ and goal; coffee tile: tap opens list of `coffeeTypes` (add one cup) and today's cups with remove.
- Settings: water goal (L), coffee types CRUD (name + per-cup nutrition; or "חישוב עם AI" from a text like "הפוך עם חלב סויה" using `AI.mealRequest`).
- [ ] **Step 1:** Implement; coffee nutrition flows into `Days.totals` (already tested).
- [ ] **Step 2:** Screenshot check; commit `feat: water and coffee tracking`.

### Task 10: Activity screen

**Files:** Create `js/ui/activity.js`; Modify `js/charts.js`

**Interfaces:** `Charts.bars(container, {data:[{date, value}], goal?, unit})` — 7 bars, 4px rounded tops, tap tooltip.
- Steps input for today (and date picker for past days), 7-day bar chart, weekly average. Note under input: "הצעדים מוזנים ידנית (למשל מ-Google Fit)".
- [ ] Implement → screenshot → commit `feat: activity screen`.

### Task 11: Weekly summary

**Files:** Create `js/week.js`, `tests/week.test.js`, `js/ui/week.js`

**Interfaces:**
- `Week.stats(state, targetsFn, endDate) -> {from, to, avgKcal, avgProtein, daysLogged, daysInBudget, weightChange: number|null, avgWater, avgSteps}` over the 7 days ending `endDate`; days with no meals are excluded from averages and from `daysInBudget`.
- UI: sheet opened from home; numbers + "טיפ מ-AI" button (cached per week in `state.weekTips[from]`).
- [ ] **Step 1: Failing tests** — 7 seeded days, 2 empty → `daysLogged 5`; weight change uses first and last measurements inside the window, `null` if fewer than 2.
- [ ] **Step 2:** FAIL → implement → PASS → UI → commit `feat: weekly summary with AI tip`.

### Task 12: Google Drive sync, refresh, backup, restore

**Files:** Create `js/config.js` (`GOOGLE_CLIENT_ID`), `js/drive.js`, `js/sync.js`, `tests/sync.test.js`, `docs/google-setup.md`; Modify `js/ui/settings.js`, `js/ui/home.js`

**Interfaces:**
- `Drive` (browser, REST via `fetch`): `connect(interactive: bool) -> Promise<token>` (GIS `initTokenClient`, scope `drive.file`, token cached in memory with expiry), `ensureFolder() -> id`, `ensureSubfolder(parentId, 'backups') -> id`, `findFile(parentId, name) -> id|null`, `upload(parentId, name, json, fileId?) -> id` (multipart), `download(fileId) -> object`, `list(parentId) -> [{id, name}]`, `remove(fileId)`.
- `Sync` (pure core, Drive injected):
  - `Sync.backupsToPrune(names: string[], keep = 30) -> string[]` (oldest first by `YYYY-MM-DD.json` name).
  - `Sync.needsBackup(meta, today) -> bool` (`meta.lastBackupDate !== today`).
  - `Sync.run(drive, store, today) -> Promise<'synced'|'offline'|'auth'>` — if `meta.dirty`: upload `data.json`, if `needsBackup` upload `backups/<today>.json` and prune; clears `dirty`, sets `lastSyncAt`. Errors: network → `'offline'` (dirty kept), 401 → `'auth'`.
  - `Sync.refresh(drive, store)` — download `data.json`, `State.validate`, `Store.replace`.
  - `Sync.restore(drive, store, fileId, today)` — download, validate (abort on failure, data untouched), upload current state as `backups/<today>-before-restore.json`, then `Store.replace`.
- Trigger: `state-changed` → debounce 5 s → `Sync.run`; also on `online` event and app start. Badge text: מסונכרן / ממתין לאינטרנט / צריך להתחבר מחדש / לא מחובר לדרייב.
- Settings: "חיבור לגוגל דרייב", "רענון מהדרייב", "שחזור מגיבוי" (list sorted newest first, two-tap confirm).
- `docs/google-setup.md`: step-by-step Hebrew guide to create the Google Cloud project, enable Drive API, OAuth consent screen (External, Testing, add test users), Web client ID with authorized origin `https://<user>.github.io`, paste into `js/config.js`.
- [ ] **Step 1: Failing tests** with a fake drive object: `backupsToPrune` of 32 names keeps newest 30; `run` when fake throws network error → `'offline'` and `meta.dirty` still true; `run` twice same day uploads one backup; `restore` with invalid file → throws, store unchanged; `restore` valid → before-restore backup uploaded first.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit `feat: Google Drive sync, refresh, backup and restore`.

### Task 13: Reminders

**Files:** Create `js/reminders.js`, `tests/reminders.test.js`; Modify `js/ui/settings.js`, `js/app.js`

**Interfaces:**
- `settings.reminders = {weigh:{on, time:'07:30'}, water:{on, every:2}, meals:{on, times:['09:00','13:30','19:30']}}`.
- `Reminders.due(settings, lastShown: {key: isoDateTime}, now: Date, day) -> [{key, text}]` — weigh due once per day after its time if no weight measured today; water every N hours between 08:00-22:00 if below goal; meal reminders when that meal is empty 60 min after its time.
- Delivery: `Notification.requestPermission()` when a switch is turned on; while app is open check every 15 min via `setInterval`; on app open show missed ones as an in-app banner. Settings note the limitation from spec §9.
- [ ] **Step 1: Failing tests** — weigh reminder not due when today's measurement exists; water not due at 23:00; meal reminder not repeated after `lastShown` today.
- [ ] **Step 2:** FAIL → implement → PASS → commit `feat: reminders`.

### Task 14: PWA — manifest, icons, service worker, update banner

**Files:** Create `manifest.json`, `sw.js`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`; Modify `index.html`, `js/app.js`

- Manifest: `name 'תזונה ומשקל'`, `short_name 'תזונה'`, `lang 'he'`, `dir 'rtl'`, `display 'standalone'`, `start_url './'`, `scope './'`, `theme_color '#1F3B33'`, `background_color '#F5F7F4'`.
- Icons: plate motif SVG; PNGs rendered from it with headless Edge screenshots.
- `sw.js`: `CACHE = 'app-v<N>'` precache all app files; navigation + same-origin → cache-first; Google Fonts → stale-while-revalidate; never cache `api.anthropic.com` or `googleapis.com`. On new SW `waiting`, app shows banner "יש גרסה חדשה — רענון" which posts `SKIP_WAITING` and reloads.
- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Serve locally (`npx http-server -p 8080 -c-1`), headless Edge: SW registers, second load with network offline (`--offline` via DevTools not available → verify cache contents via `caches.keys()` in a test page).
- [ ] **Step 3:** Commit `feat: installable PWA with offline cache`.

### Task 15: Deploy and phone verification

- [ ] **Step 1:** Create GitHub repo (user confirms name and public/private; Pages needs public on free plan), push `main`, enable Pages from `main` root. Confirm the URL loads.
- [ ] **Step 2:** User follows `docs/google-setup.md`; put client ID in `js/config.js`, bump SW cache version, push.
- [ ] **Step 3:** On the Android phone (user): install from Chrome; fill profile; add measurement; add meal by search, text and photo; go offline and add water; back online → badge "מסונכרן", files visible in Drive; delete app data, reinstall, "רענון מהדרייב" restores everything; restore an older backup.
- [ ] **Step 4:** Fix findings, commit, tag `v1.0`.
