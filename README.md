<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Wasteland

A 3D zombie survival game — playable in your browser as an installable PWA.

[![Deploy to GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-blue?logo=github)](https://github.com/CptNope/Wasteland/actions)

</div>

---

## Table of Contents

- [Play Now](#play-now)
- [Features](#features)
- [Run Locally](#run-locally)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Install as a PWA](#install-as-a-pwa)
- [Regenerate Icons](#regenerate-icons)
- [Project Structure](#project-structure)

---

## Play Now

Visit the live deployment:

> **https://CptNope.github.io/Wasteland/**

No download required — works on desktop, Android, and iOS.

---

## Features

- **3D zombie survival** powered by Babylon.js
- **Installable PWA** — add to your home screen on any device
- **Offline support** via service worker caching
- **Cross-platform** — tested on Chrome, Safari (iOS), Edge, and Firefox

---

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) v20+

```bash
# 1. Clone the repository
git clone https://github.com/CptNope/Wasteland.git
cd Wasteland

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
# Then edit .env.local and set GEMINI_API_KEY=<your-key>

# 4. Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Deploy to GitHub Pages

### Option A — GitHub Actions (recommended)

1. **Push your code** to the `main` branch of your GitHub repo.

2. **Create the workflow file** `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [main]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: true

   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm

         - run: npm ci
         - run: npm run build

         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist

         - id: deployment
           uses: actions/deploy-pages@v4
   ```

3. **Enable GitHub Pages** in your repo settings:
   - Go to **Settings → Pages**
   - Under **Source**, select **GitHub Actions**

4. Push a commit or manually trigger the workflow. Your site will be live at:
   ```
   https://<USERNAME>.github.io/Wasteland/
   ```

### Option B — Manual deploy

```bash
# Build the production bundle
npm run build

# The output is in the dist/ folder.
# Push its contents to a gh-pages branch, or upload via the GitHub UI.
npx gh-pages -d dist
```

> **Note:** If you use `gh-pages`, install it first: `npm install -D gh-pages`

---

## Install as a PWA

Once the app is deployed and accessible via HTTPS (GitHub Pages provides this automatically), users can install it:

### Android (Chrome / Edge)
1. Open the site in Chrome or Edge.
2. Tap the **⋮ menu** → **"Install app"** or **"Add to Home screen"**.
3. The app will appear on your home screen and launch in standalone mode.

### iPhone / iPad (Safari)
1. Open the site in **Safari** (required — other browsers on iOS cannot install PWAs).
2. Tap the **Share button** (box with arrow).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top-right corner.
5. The app will appear on your home screen with the Wasteland icon.

### Desktop (Chrome / Edge)
1. Open the site in Chrome or Edge.
2. Click the **install icon** (⊕) in the address bar, or go to **⋮ menu → "Install Wasteland"**.
3. The app opens in its own window without browser chrome.

### Desktop (Firefox)
Firefox does not support PWA installation natively. The site still works as a normal web app.

---

## Regenerate Icons

If you modify the master SVG icons, regenerate all PNG variants:

```bash
npm run generate-icons
```

This reads `public/icons/icon-master.svg` and `public/icons/icon-maskable.svg` and outputs PNGs at all required sizes (48–512px), plus favicons and `apple-touch-icon.png`.

**Requirements:** The `sharp` dev dependency must be installed (`npm install`).

---

## Project Structure

```
Wasteland/
├── public/
│   ├── apple-touch-icon.png      # 180×180 PNG for iOS
│   ├── favicon.png               # 32×32 default favicon
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   └── icons/
│       ├── icon-master.svg       # Source SVG icon
│       ├── icon-maskable.svg     # Maskable variant (extra padding)
│       ├── icon-48x48.png        # Standard icon sizes ↓
│       ├── icon-72x72.png
│       ├── icon-96x96.png
│       ├── icon-128x128.png
│       ├── icon-144x144.png
│       ├── icon-152x152.png
│       ├── icon-167x167.png
│       ├── icon-180x180.png
│       ├── icon-192x192.png
│       ├── icon-384x384.png
│       ├── icon-512x512.png
│       ├── icon-maskable-192x192.png
│       └── icon-maskable-512x512.png
├── scripts/
│   └── generate-icons.mjs        # SVG → PNG conversion script
├── src/                          # Application source code
├── index.html                    # Entry HTML with PWA meta tags
├── vite.config.ts                # Vite + PWA plugin config
└── package.json
```

---

## License

See [LICENSE](LICENSE) for details.
