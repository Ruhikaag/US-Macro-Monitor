# GitHub Pages Snapshot Setup

This publishes the Haver snapshot from the Windows helper to GitHub. GitHub Pages serves the dashboard and public snapshot; the page checks for a newly published snapshot every minute. The Windows helper fetches Haver once per hour while it is running. Indicator values change when Haver releases or revises observations, not continuously.

## Create the repository

1. Create a **public** GitHub repository for the dashboard. The site and its data will be visible to anyone with the link.
2. Upload the contents of this `docs` folder to the repository's `docs` folder on the `main` branch. Include `index.html`, `.nojekyll`, `GITHUB-PAGES-SETUP.md`, and `data/snapshot.json`.
3. In the repository, open **Settings > Pages**. Set the source to **Deploy from a branch**, select `main`, and select `/docs` as the folder. Save and wait for the Pages deployment to finish. The site URL is usually `https://OWNER.github.io/REPOSITORY/`.

## Allow the Windows helper to publish

1. Create a fine-grained personal access token in GitHub. Limit it to this repository and grant **Contents: Read and write**. The token can update repository files, so do not share it or commit it.
2. In Windows, open **Edit environment variables for your account** and add:
   - `GITHUB_PAGES_REPOSITORY` = `OWNER/REPOSITORY`
   - `GITHUB_PAGES_TOKEN` = the token value
   - `GITHUB_PAGES_BRANCH` = `main` (optional; this is the default)
3. Sign out and back in (or run `outputs/Open US Macro Monitor.bat`) so the hidden **US Macro Monitor** Windows scheduled task starts with your user environment variables. It runs `pythonw.exe` without a helper console and publishes when it starts, then hourly while you are signed in. The batch file opens the dashboard in a browser, but the scheduled task itself does not. Check `outputs/haver_labor_dashboard.log` for a `Published dashboard snapshot to GitHub` entry after a refresh.
4. The helper publishes `docs/data/snapshot.json` after every successful hourly Haver check, including when indicator values are unchanged, so the public data-update timestamp stays current. A failed Haver check is retried after five minutes. Leave the PC awake, online, signed in, and the helper running for hourly checks and publication. If the PC is shut down, asleep, offline, or not signed in, the shared site retains the last published data and labels updates older than three hours as overdue. If Haver fails before its first successful refresh after restart, the helper leaves the last public snapshot intact rather than publishing empty data.

## Notes

- GitHub Pages deployment can take a few minutes after each hourly snapshot commit. The page reloads the public JSON every minute. **Last data update** is the helper's latest successful Haver refresh and publication; **Checked** is when the viewer last retrieved the public snapshot, not a new data update.
- The **Check updates** button reloads the latest published snapshot; it does not force a Haver refresh.
- The local and GitHub Pages dashboards show the same headline indicators. The local page continues to use its Python API; GitHub Pages reads the published JSON snapshot.
- The National Accounts (GDP) theme contains six quarterly series: real GDP, personal consumption expenditure, real private fixed investment, exports, imports, and real government consumption and investment. Each card shows the current and previous quarter's annualized growth and the year-over-year change.
- The remaining themes are listed as empty categories until their indicators are specified; the five headline tiles remain available independently of theme membership.
- Every theme has a **The story behind the numbers** block. Summaries are supplied manually in `THEME_SUMMARIES` in `outputs/haver_labor_dashboard.py`; only National Accounts (GDP) has a supplied summary so far. Other themes say "Summary to be added." The helper does not generate or rewrite the summaries from Haver data or news.
- **Recent news:** shows at most five newest, distinct US headlines per selected theme, including the publisher, date and direct article link. The helper checks public CNBC RSS feeds and Deloitte's public weekly news page on its hourly refresh; only headlines dated within seven days appear, and the browser also hides links once they age out. When nothing qualifies it says **No recent relevant news**. Reuters refuses automated access (HTTP 401), the Financial Times article checked here displayed only a subscription prompt (HTTP 403 for the helper), and The Economic Times [RSS terms](https://economictimes.indiatimes.com/rss.cms) prohibit republishing or aggregating its feed on a public website, so those publishers are not used. A source with a verified, readable public preview could be added if its terms permit headline display; no paywall access is bypassed. Feed failures are flagged, and the hosted site needs the Windows helper online to receive new links or edited summaries.
- Chart histories begin in Q1 2018 (January 2018 for monthly and daily data) and extend through each indicator's latest observation.
- Never put the token in the repository, the batch file, or a screenshot. Anyone with access to the token could write to the repository.