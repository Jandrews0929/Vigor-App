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

## Member-created exercises

Anyone can add an exercise from the Add exercise sheet. The database screens each name (`add_exercise` in schema.sql): links, ads and offensive words are refused; names that describe a movement or equipment (press, curl, cable, dumbbell and so on) join the shared list for everyone at once; anything else is usable by its creator and waits in Admin > New exercises to review. Admins can also remove any member-added exercise from the list; posts that used it keep its name.

## Feedback loop

Every screen has a Feedback button. Feedback lands in the `feedback` table with the screen, app version and device. Admins read it under Profile > Admin and can copy all of it at once to paste into a chat with Claude.

## Trial limits

- Weights are in pounds.
- Photos are resized to 1600px; videos up to 60 seconds and 50 MB.
- Uploaded media is public to anyone with the file's link (the bucket is public so images load fast). Don't upload anything private.
- Templates copied from other people's posts are saved on that phone only.
