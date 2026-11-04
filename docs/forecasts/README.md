# Economic Forecasts workspace

The Forecasts tab embeds `index.html` from this folder. This is the collaborator-owned area for forecast UI and supporting files.

## Collaboration boundaries

- Make forecast changes only inside `docs/forecasts/`.
- Do not edit the dashboard shell (`docs/index.html`), the local mirror (`outputs/haver_dashboard.html`), or the Haver publisher.
- Keep forecast styles, scripts, and assets in this folder and use relative paths from `index.html`.
- Do not add credentials or private data; everything under `docs/` is public on GitHub Pages.
- Work on the `forecast-work` branch and submit a pull request into `main`. Review and merge before expecting the public site to update.

The parent dashboard and local helper serve files in this folder from `/forecasts/`. The public GitHub Pages site serves the same files beneath the repository path.
