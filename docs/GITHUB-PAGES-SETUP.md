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
3. Close and reopen the dashboard helper so it receives the new environment variables. For the hidden scheduled task, check `outputs/haver_labor_dashboard.log` for a `Published dashboard snapshot to GitHub` entry after refresh completes.
4. The helper publishes `docs/data/snapshot.json` after every successful hourly Haver check, including when indicator values are unchanged, so the public refresh timestamp stays current. Leave the PC awake, online, and the helper running for hourly checks and publication.

## Notes

- GitHub Pages deployment can take a few minutes after each hourly snapshot commit. The page reloads the public JSON every minute.
- The **Check updates** button reloads the latest published snapshot; it does not force a Haver refresh.
- The local and GitHub Pages dashboards show the same headline indicators. The local page continues to use its Python API; GitHub Pages reads the published JSON snapshot.
- The National Accounts (GDP) theme contains six quarterly series: real GDP, personal consumption expenditure, real private fixed investment, exports, imports, and real government consumption and investment. Each card shows the current and previous quarter's annualized growth and the year-over-year change.
- The remaining themes are listed as empty categories until their indicators are specified; the five headline tiles remain available independently of theme membership.
- Never put the token in the repository, the batch file, or a screenshot. Anyone with access to the token could write to the repository.