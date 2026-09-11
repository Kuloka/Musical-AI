# Website effects

Antigravity is the React Bits component supplied for this project, with window-relative pointer input, capped pixel density and background-tab pausing. BorderGlow uses the supplied CSS and its edge-proximity/angle calculation adapted to the existing HTML elements, preserving native links, buttons, details and tab listeners. Both use a monochrome palette and respect reduced motion.

Source: https://github.com/DavidHDev/react-bits — copyright David Haz. See REACT-BITS-LICENSE.md. Components are integrated into the MultiMind website.

Build from the repository root:

```
npm ci --prefix docs/source
npm run build --prefix docs/source
```

The build also generates the static English docs/index.html from docs/render.js and the three docs/locales*.js files. Those same translations and markup drive the language picker in the browser. English is the default; a visitor's explicit selection is stored locally. All ten language packs match the desktop language list and include feature demos, downloads, metadata and accessibility text.

Commit generated docs/index.html, docs/effects.js, docs/effects.css and docs/effects.js.LEGAL.txt alongside source changes. GitHub Pages and Cloudflare Pages serve the static docs directory without a build step or external CDN. These dependencies are isolated from the desktop application. Run npm test and the Electron tests/site-smoke.cjs harness (also with --motion) after changes.
