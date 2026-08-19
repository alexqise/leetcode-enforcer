# Privacy Policy — LeetCode Enforcer

Last updated: 19 August 2026

LeetCode Enforcer is a Chrome extension that blocks sites you choose until you finish a daily LeetCode quota, and schedules those problems for review. This policy describes what data the extension handles, including data stored only on your device.

Contact: alexqi321@gmail.com

## What we collect

### On your device (always)

The extension stores data in `chrome.storage.local`:

- Problem history: title, slug, URL, difficulty, topics, solve/review dates, confidence ratings, notes, spaced-repetition state
- Settings: quota, blocklist, reset hour, override options, optional LeetCode username
- Daily state: solves/reviews today, streak, override use
- Optional GitHub connection: access token, repo name, and related settings, if you connect GitHub

Uninstalling the extension deletes this local copy.

### If you sign in with Google

Sign-in is optional. It uses Google OAuth through Supabase (`bxlvcyhsoykfmiwxepby.supabase.co`). We receive your Google account id, email, and name, and store a session token on your device.

Your problems, settings, and daily state are then synced to Supabase tables owned by your account (row-level security: only you can read or write your rows).

### If you connect GitHub

GitHub is optional. If you connect it, the extension stores an access token on your device and can create commits in a repo you choose (code from an accepted submission plus a per-problem README). That data lives in your GitHub account, under GitHub’s policy.

### On leetcode.com

Content scripts run only on `https://leetcode.com/*`. They detect accepted submissions and read problem metadata (title, slug, difficulty, tags) so the overlay can record a rating. Optional history import uses LeetCode’s API with a username you provide.

### Site blocking

To enforce the blocklist, the extension reads the URL of the page you are opening and compares it to domains you configured. Matching main-frame navigations are redirected to the extension’s block page. We do not build or store a general browsing-history log. We do not sell, profile, or ad-target this data.

## How we use data

Only to provide the extension’s purpose:

- Enforce the blocklist until today’s quota is met
- Record solves and reviews, and schedule spaced repetition
- Sync across your browsers if you sign in
- Optionally commit solutions to your GitHub repo

## What we do not do

- No ads, analytics SDKs, or trackers
- No sale of user data
- No use of data for credit, lending, or personalized advertising
- No transfer of data to data brokers
- We do not read your data except as needed to operate, secure, or debug the product, or as required by law

## Third parties

| Party | Why |
|---|---|
| Google | Optional sign-in |
| Supabase | Optional account, session, and sync storage |
| GitHub | Optional solution backup, if you connect it |
| LeetCode | Problem metadata and submission detection on leetcode.com |

Each is governed by its own privacy policy. We do not control their practices.

**Limited Use.** The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Sharing

We do not sell or share your data except:

- With the third parties above, as needed to provide the feature you turned on
- If required by law, to investigate abuse, or as part of a merger or sale of the project, with prior notice where required

## Retention and deletion

- Local data: until you clear it in Settings or uninstall
- Signed-in sync data: until you delete it or request deletion
- GitHub data: until you delete it from that repo

To delete cloud data, sign out and email alexqi321@gmail.com from the same Google account. We will delete your Supabase rows.

## Children

The extension is not directed at children under 13. We do not knowingly collect their data.

## Changes

We will update this page and the date above if our practices change.

## Contact

Alex Qi — alexqi321@gmail.com  
https://github.com/alexqise/leetcode-enforcer
