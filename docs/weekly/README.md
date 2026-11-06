# Weekly Updates

The dashboard embeds this folder's `index.html`. The public page reads only approved issues from `issues.json`; unpublished drafts are never included in the repository. The on-screen PDF uses sharp vector page previews on white, preserving original document colors and geometry. **Download PDF** returns the unchanged original document. Latest-issue metadata shows the date, without indicator tags or introductory copy. Charts have one caption each; **Download PNG** returns a separate original-color plot crop without the figure caption or source footer. The expandable Archive lists clickable issue titles/dates alongside covered indicators.

## Weekly workflow

The displayed top-left Deloitte raster wordmark uses white lettering on transparency, preserving the original green dot. Its neutral pixels are remapped with alpha antialiasing; only the current document template's wide header logo is targeted. Original PDF assets and other raster illustrations are unchanged.

The chart strip heading is **Charts in this issue**, using sentence case and the existing heading style without an additional subtitle.

The **Data Release Calendar** button and **Upcoming Data Releases** heading use title case. The selected schedule excludes factory orders, wholesale trade, real earnings, import/export price indexes, business inventories, GDP second estimate, new home sales, advance economic indicators and construction spending. Productivity and costs remain excluded except for the explicitly requested **Labor Productivity** entry on November 5, 2026 at 08:30 US Eastern, from the BLS preliminary third-quarter Productivity and Costs release. This November 6 request supersedes the earlier exclusion for that entry only; the BLS release schedule was checked on November 6. CPI and Corporate Profits remain standalone entries. Preserve this selection when refreshing schedule dates; the current snapshot has 21 events. User-requested additions include Weekly Jobless Claims on November 5, 19, 25 and December 3; Existing Home Sales on November 12; Industrial Production on November 17; University of Michigan Consumer Sentiment Index on November 20; and The Conference Board Consumer Confidence Index on November 24. November 25 claims use the DOL Thanksgiving exception. Do not silently add other claims dates the user has not selected.

Additional publisher links are restricted to DOL's Office of Unemployment Insurance, NAR, the University of Michigan Surveys of Consumers and The Conference Board. The Michigan date was requested by the user and corroborated by secondary calendars; its publisher page was inaccessible during verification. Other added dates/times were checked against publisher schedules.

The right-hand **Data release calendar** button sits above **Download PDF**. Release dates are hidden until clicked, opening a scrollable dialog with Close/Escape controls and focus returned to the button on dismissal. It lists selected national releases from BLS, BEA and Census, with source links and US Eastern times. Groups use **This week**, **Next week**, and later relative labels. The window includes the current Monday-start week (including earlier releases) through one calendar month from today's US Eastern date; month-end dates are clamped. It follows today's date even when viewing an archived PDF.

`calendar.json` is a verified schedule snapshot, **not an automated live feed**. Initial verification is November 5, 2026, with selected releases through December 5, 2026. Update the events, `verified`, and `through` together from the official source schedules before that coverage expires. The UI refreshes this file and relative week labels every 15 minutes; this does not fetch new dates from agencies. At the user's November 6 request, the standalone "Verified schedule available only through ... Later dates need updating." line is removed. Per-week unverified notices, expired schedules, malformed data and fetch failures remain visible. Do not infer unscheduled releases from an empty week or invent dates to fill it.

The latest-issue heading includes a short description of the previous week's US economic releases. Displayed PDF vectors are recolored in the browser: near-white backgrounds match the dark microsite, typography is white, and chart series hues remain intact. Vector geometry is unchanged; raster logos/images retain their original appearance. Original vector files, PDF downloads, chart PNG downloads and enlarged original-color charts remain unchanged. This supersedes the earlier muted-paper styling.

Document pages are centered with a maximum preview width of 900px, shrinking to fit smaller screens without an outer padded frame. Chart-strip and enlarged-chart widths are independent and unchanged. Click a chart thumbnail (or focus it and press Enter) to open a large dialog preview. Close it with the Close button or Escape; the separate plot-only PNG download remains available both in the strip and the dialog.

The **View chart** control uses a normal pointer, not a magnifying cursor. Enlarged charts use original-color SVG crops with their original aspect ratios, keeping text and lines sharp without raster stretching or dark recoloring. Existing issues without vector previews fall back to their original plot PNG. Original PDF web/email links remain clickable in the page preview through proportionally positioned overlays; web links open a separate tab. Only HTTP, HTTPS and mailto destinations are supported.

1. Save the finished PDF in the folder configured by `WEEKLY_UPDATES_SOURCE`.
2. Keep the existing Windows dashboard helper running. It checks the folder every minute.
3. Open the **local** dashboard's Weekly Updates tab. Refresh it to see newly prepared drafts.
4. Expand the issue. Verify the PDF, publication date, suggested indicator tags, and extracted chart previews. Edit tags or deselect bad crops as needed.
5. Select **Approve and publish** and confirm public publication. The PDF, selected PNGs, vector previews, link positions, and updated archive manifest are committed together.
6. Wait for GitHub Pages deployment, then check the shared site. Previous approved issues remain in the archive and can be filtered by indicator.

Intake and extraction are automatic; approval is deliberately manual. Merely saving a PDF does not publish it. You do not need to upload PDFs to chat or provide separate chart images. Only publicly approved documents may be used.

## Local configuration

- `WEEKLY_UPDATES_SOURCE`: full local or network folder path; required.
- `WEEKLY_UPDATES_STATE`: optional local staging folder; default `outputs/weekly-state`.
- Existing `GITHUB_PAGES_REPOSITORY`, `GITHUB_PAGES_TOKEN`, and optional `GITHUB_PAGES_BRANCH` configure approved publication. Do not share or commit the token.
- Install the extraction dependency with the dashboard interpreter: `python -m pip install -r outputs/requirements-weekly.txt`.
- Restart the helper after changing configuration or Python code.

The intake reads PDF publication dates from the document, not file modification dates. Matching is designed for the current "US Economic Update: Month D, YYYY" header and numbered Figure captions. Plot downloads exclude the figure caption/source footer but retain axes, legends, and units. Full PDF previews preserve all document content, including attribution; the original PDF bytes are not changed. PDF page previews retain original colors and white backgrounds; chart thumbnails alone use dark-themed colors. Tags are suggestions from the first-page narrative, not every indicator in the repeated dashboard table. Unrecognized dates or unreadable PDFs are shown as errors rather than assigned invented dates. Layout changes may require extraction adjustments; review all chart previews.

The helper must be running, with folder access, for intake and approval to work.  If a PDF changes, its new content becomes a new draft requiring approval. Approving a replacement for the same publication date replaces that archive entry.

## Files and validation

- `outputs/weekly_updates.py`: local intake, extraction, staging, and atomic GitHub publication.
- `outputs/test_weekly_updates.py`: isolated tests with faked files, PDF renderer, and GitHub.
- `outputs/test_chart_tools.py`: local routing and approval-origin/token checks.
- `outputs/test_weekly_updates.js`: browser presentation regression tests.
- `calendar.js` / `calendar.json`: relative-week calendar rendering and verified release schedule.
- `outputs/test_release_calendar.js`: deterministic month/week/timezone, validation and error-state tests using fixed dates and mocked fetch.

Run Python tests from `outputs`: `python -m unittest test_weekly_updates test_chart_tools`.
Do not overwrite the remote `issues.json` or `weekly/files/` with stale local copies during ordinary dashboard UI publication. Forecast files are unrelated and must be preserved.
