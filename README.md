# Vigor

A health-and-wellness-only social app: Strong-style workout logging where the log is the post, automatic PR detection, and a profile PR wall that links every lift to its proof video. This is the private trial build.

It is a plain installable web app (no build step) backed by Supabase. Testers open the link on their phone and add it to their home screen; every push to `main` updates everyone's app.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | The app |
| `config.js` | Supabase project URL and publishable key |
| `supabase/schema.sql` | Tables, access rules, invite codes, off-topic screen, photo/video storage |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install-to-home-screen support |
| `vendor/supabase-2.117.2.js` | Supabase JS client (MIT), vendored so the app has no CDN dependency |
| `native/` | iPhone and Android app: the same web app in a native shell, plus Apple Health and Health Connect import |

## One-time setup

1. **Database.** In Supabase, open SQL Editor > New query, paste all of `supabase/schema.sql`, and run it. It is safe to run again after updates.
2. **Sign-up emails.** Supabase's built-in email only sends a few messages per hour, so for the trial turn off Authentication > Sign In / Providers > Email > "Confirm email". (Turn it back on once a custom SMTP sender is set up.)
3. **Hosting.** In GitHub, open the repository's Settings > Pages, set Source to "Deploy from a branch", branch `main`, folder `/ (root)`, and save. The app appears at `https://<github-user>.github.io/<repo>/` a minute later.
4. **Auth redirect.** In Supabase, Authentication > URL Configuration: set Site URL to that GitHub Pages address and add it under Redirect URLs. Password-reset links need this.
5. **First account.** Open the app, create an account, and leave the invite code blank. The first profile becomes the admin.
6. **Invite testers.** Profile > ⋯ > Admin shows the invite code and a ready-to-send invite message.

## Updating the database

When a release changes `supabase/schema.sql`, re-run the whole file in SQL Editor (it keeps existing data). The app checks the database version at sign-in; if the file hasn't been re-run, admins see a "Database update needed" notice and the new features stay off until it is.

| Schema version | Adds |
| --- | --- |
| 1 | Accounts, posts, workouts, reactions, comments, reports, feedback, invites |
| 2 (app 0.1.2) | Likes, warm-up and drop sets, member-created exercises |
| 3 (app 0.1.3) | Profile photos, comment replies, thumbs up and down on comments |
| 4 (app 0.1.4) | Cardio in Log (`activities` table), cardio PRs, the Cardio post category, Health import dedupe |
| 5 (app 0.1.5) | Failed sets (F), barbell or dumbbell style per set (`sets.equip`); Dumbbell bench press, Incline DB press and Dumbbell curl merge into the dumbbell style of Bench press, Incline bench press and Biceps curl |

## Member-created exercises

Anyone can add an exercise from the Add exercise sheet. The database screens each name (`add_exercise` in schema.sql): links, ads and offensive words are refused; names that describe a movement or equipment (press, curl, cable, dumbbell and so on) join the shared list for everyone at once; anything else is usable by its creator and waits in Admin > New exercises to review. Admins can also remove any member-added exercise from the list; posts that used it keep its name.

## Set types and barbell or dumbbell

Tapping a set number in Log marks it as a warm-up (W), drop set (D) or failed rep (F). Warm-ups never count toward PRs, history or volume. A failed set records the reps finished before the missed one and counts like a working set; posts and the Previous column show its F.

Exercises listed in `EQUIP` in app.js (bench, incline, OHP, rows, curls, lunges and so on) show a Barbell / Dumbbell switch. Each style keeps its own history and PRs, so weights fill in from the last session in that style and the wall shows "Barbell bench press" and "Dumbbell bench press" as separate plates. A new block starts in the style used last time; typing "db" or "barbell" in the search picks one. Dumbbell weights are per hand ("lb each"). Rows saved before schema v5 have no `equip` and count as the exercise's first style.

## Cardio

Log > "Log a run, walk, hike, ride or swim" (or "+ Add cardio" inside a workout) adds a cardio block: distance, time, elevation gain, average heart rate and how it felt. Activities are stored in meters and seconds in `activities` and shown in miles and feet (yards for swims, meters for rows). PRs work like lifts, so the first effort of a kind sets the baseline: fastest mile, 5K, 10K and half marathon (a longer run counts at its average pace), longest run, longest hike and biggest elevation day. They appear on the PR wall next to the lift plates.

## Phone app and Health import

`native/` is an Expo (SDK 57) app that opens the live web app in a WebView, so web releases reach phone users at once. It adds `window.VigorNative`, which the web app checks with `NATIVE()`:

| Call | Returns |
| --- | --- |
| `VigorNative.call('health.workouts', {days})` | `{ workouts: [{ id, kind, activityName, title, start, end, duration_s, distance_m, elevation_m, avg_hr, calories, sourceName }], hint }` |
| `VigorNative.call('health.settings')` | Opens the phone's health permissions |

iPhone reads Apple Health (HealthKit, read only). Android reads Health Connect (read only). Imported activities keep `source` and `external_id`, and a unique index stops the same workout from being imported twice. The web app also exposes `window.__vigorBack()` for the Android back button.

Build it with `cd native && npm ci && npx expo prebuild`. Android: `cd android && ./gradlew assembleRelease`. iPhone needs a Mac with Xcode or a cloud build, plus an Apple Developer account. The Android release build is signed with React Native's shared debug key, which is fine for a sideloaded trial; switch to Play App Signing before a Play Store release.

GitHub builds the Android app automatically (`.github/workflows/android.yml`) whenever `native/` changes, or from Actions > Android app > Run workflow. Each run attaches `vigor-android-N.apk` (zipped) to its page under Artifacts for 30 days; download it while signed in to GitHub and send it to testers, who allow installs from unknown apps once.

## Feedback loop

Every screen has a Feedback button. Feedback lands in the `feedback` table with the screen, app version and device. Admins read it under Profile > Admin and can copy all of it at once to paste into a chat with Claude.

## Trial limits

- Weights are in pounds.
- Photos are resized to 1600px; videos up to 60 seconds and 50 MB.
- Uploaded media is public to anyone with the file's link (the bucket is public so images load fast). Don't upload anything private.
- Templates copied from other people's posts are saved on that phone only.
