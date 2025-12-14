<p align="center">
  <a href="https://github.com/SPACESODA/Kumaflow">
    <img src="https://webflow-ui-localization.pages.dev/src/images/icon-128.png" alt="Kumaflow - Webflow UI Localization" width="128">
  </a>
</p>

[powered-image]: https://img.shields.io/badge/Powered%20by-Extension.js-0971fe
[powered-url]: https://extension.js.org

# Kumaflow - Webflow UI Localization

**Kumaflow** is an open-source browser extension that lets you translate the [Webflow](https://try.webflow.com/s2) Dashboard pages and Designer UI into your language!

🐻 **ウオォォォー！** Kuma works hard behind the scenes, seamlessly showing translated text across these Webflow surfaces — all powered by our matching engine:

**Webflow pages**

- `https://webflow.com/dashboard*`
- `https://webflow.com/login*`
- `https://webflow.com/signup*`
- `https://webflow.com/forgot*`

**Webflow Designer pages**

- `https://preview.webflow.com*`
- `https://*.design.webflow.com*`

Open the extension's Options page to select your language. In the Webflow Designer, you can also switch languages instantly using the dropdown menu in the settings.

Click the toolbar icon to toggle translations at any time. This acts as a master switch — the badge will show OFF when translations are disabled.

The plan is to support Japanese, Traditional Chinese, Simplified Chinese, and Korean first, with MORE languages to be added over time.

## Contribute Translations

**Join to translate together on POEditor 🦜**

Right now, adding accurate **terms** is the most important part of the project — so feel free to jump in and help!  
POEditor project: https://poeditor.com/join/project/7drFUDh3dh

Latest locale JSON files via Cloudflare Pages / jsDelivr:

- [Cloudflare Pages](https://webflow-ui-localization.pages.dev/src/locales/)  
- [jsDelivr](https://www.jsdelivr.com/package/gh/SPACESODA/Kumaflow?tab=files&path=src%2Flocales)

## Installation

### Method 1: Extension Marketplace

Coming soon!

### Method 2: Download and load unpacked (Stable)

1. Download the [installation zip](https://webflow-ui-localization.pages.dev/public/Kumaflow-unpacked-install.zip) and unzip it.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable Developer Mode.
3. Click "Load unpacked" and select the unzipped folder (it should contain `manifest.json` at the root).

### Method 3: Build locally (Dev)

1. Install dependencies and build: `npm install && npm run build`
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable Developer Mode.
3. Click "Load unpacked" and select the `dist/chrome` folder in the repo.

<br />
<br />
<br />

Made with ♥ by [Anthony C](https://x.com/anthonycxc)

---
This extension provides unofficial translations that may not be accurate.

This extension is an independent project and is not affiliated with or endorsed by Webflow. Webflow is a trademark of Webflow, Inc.

This extension does not collect, store, or transmit any personal information or usage data.

<br />
<br />
<br />

---

<br />
<br />
<br />

## Commands

### dev

Run the extension in development mode.

```bash
npm run dev
```

### build

Build the extension for production.

```bash
npm run build
```

### preview

Preview the extension in the browser.

```bash
npm run preview
```

## Browser targets

Chromium is the default. You can explicitly target Chrome, Edge, or Firefox:

```bash
# Chromium (default)
npm run dev

# Chrome
npm run dev -- --browser=chrome

# Edge
npm run dev -- --browser=edge

# Firefox (not tested yet)
npm run dev -- --browser=firefox
```

<br />

[![Powered by Extension.js][powered-image]][powered-url]
