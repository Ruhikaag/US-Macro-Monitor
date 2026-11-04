# Weekly Updates

The dashboard embeds this folder's `index.html`. The public page reads only approved issues from `issues.json`; unpublished drafts are never included in the repository. The on-screen PDF uses sharp vector page previews on white, preserving original document colors and geometry. **Download PDF** returns the unchanged original document. Latest-issue metadata shows the date, without indicator tags or introductory copy. Charts have one caption each; **Download PNG** returns a separate original-color plot crop without the figure caption or source footer. The expandable Archive lists clickable issue titles/dates alongside covered indicators.

## Weekly workflow

The latest-issue heading includes a short description of the previous week's US economic releases. A display-only muted paper treatment reduces glare against the dark microsite; original vector assets, PDF downloads, and chart PNG downloads are not recolored or modified by this treatment.

Document pages fill the preview width without an outer padded frame. Click a chart thumbnail (or focus it and press Enter) to open a large dialog preview. Close it with the Close button or Escape; the separate plot-only PNG download remains available both in the strip and the dialog.

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

Run Python tests from `outputs`: `python -m unittest test_weekly_updates test_chart_tools`.
Do not overwrite the remote `issues.json` or `weekly/files/` with stale local copies during ordinary dashboard UI publication. Forecast files are unrelated and must be preserved.
