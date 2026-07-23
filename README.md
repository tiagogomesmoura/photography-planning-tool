# Eclipse Scout

Static browser app for planning solar and lunar eclipse observations.

## Features

- Select upcoming solar or lunar eclipses.
- Move an observer pin on an interactive map.
- Scrub time around the event and inspect eclipse coverage and magnitude.
- View Sun and Moon azimuth and altitude for the selected location.
- See a simplified eclipse phase illustration that updates with the slider.

## Run

Open `index.html` in a browser for a quick preview.

For better browser compatibility, especially geolocation, serve the folder over `http://localhost` instead of opening the file directly.

Examples:

- If Python is installed: `python -m http.server 8000`
- Then open: `http://localhost:8000`

The app loads Leaflet and Astronomy Engine from public CDNs, so an internet connection is required unless you vendor those files locally.

## Deploy To Cloudflare Pages

This app is a static site, so it can be deployed directly on Cloudflare Pages without a build step.

### Recommended setup

- Repository provider: GitHub
- Framework preset: None
- Build command: leave empty
- Build output directory: `/`
- Root directory: leave empty unless you move the app into a subfolder

### Files to publish

Cloudflare Pages should publish the project root containing:

- `index.html`
- `styles.css`
- `app.js`

### Notes

- The app loads Leaflet, CesiumJS, and Astronomy Engine from public CDNs, so the deployed site still needs internet access.
- If you later add a custom domain, Cloudflare Pages can handle HTTPS automatically.
- If browser geolocation is used, deployment over HTTPS is preferred and Cloudflare Pages provides that by default.

## Notes

- Solar coverage is calculated from topocentric Sun and Moon disc overlap for the selected place and time.
- Lunar coverage uses the published eclipse timing and obscuration together with a simplified Earth-shadow visualization.
- The map direction rays are projected onto the ground from the observer's pin to show where in the horizon sky the Sun and Moon appear.