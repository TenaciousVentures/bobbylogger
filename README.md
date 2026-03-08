# BobbyLogger

A GPS-enabled daily activity journal designed for cognitive wellness. Track meals, shopping, gas fill-ups, errands, health visits, and more — all with location data and custom log types.

## Features

- **6 built-in log types** — Journal, Meal, Shopping, Gas Fill-Up, Errand, Health
- **Gas fill-up tracker** — Auto-calculates MPG, miles since last fill, and cost per mile from odometer readings
- **Custom log types** — Create your own activity types with custom form fields (text, number, dropdown, long text)
- **GPS on every entry** — Captures coordinates with Google Maps links
- **Stats dashboard** — Entry breakdowns, day streaks, spending summaries, gas stats
- **Search & filter** — Find any entry across your full history
- **Accessibility modes** — Large Text and High Contrast for easier reading
- **Offline-first PWA** — Works without internet, installs on any phone like a native app
- **Privacy-first** — All data stored on-device via IndexedDB. Nothing leaves your phone.
- **Export/Import** — JSON backup and restore

## Why This Exists

Daily structured journaling has been shown to reduce dementia risk by up to 53% (Cache County Memory Study) and support cognitive rehabilitation in mild cognitive impairment and dementia (Frontiers in Neurology, 2025). BobbyLogger combines activity logging, GPS tracking, and routine monitoring to support cognitive wellness through daily reflection.

## Deploy for Free

### GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings > Pages**
3. Set source to **Deploy from a branch** > **main** > **/ (root)**
4. Your app will be live at https://yourusername.github.io/bobbylogger/

### Netlify
1. Drag the project folder into Netlify Drop (https://app.netlify.com/drop)
2. Done - you will get a live URL immediately

## Install on Phone
1. Visit the deployed URL on your phone browser
2. Tap "Add to Home Screen" (or the install prompt)
3. The app icon appears on your home screen and works offline

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no build step, no dependencies)
- IndexedDB for persistent on-device storage
- Service Worker for offline caching
- Web Geolocation API for GPS
- Fully responsive, mobile-first design

## License

MIT
