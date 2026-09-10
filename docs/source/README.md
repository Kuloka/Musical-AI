# Website effects

Antigravity is the React Bits component supplied for this project, with window-relative pointer input, capped pixel density and background-tab pausing. BorderGlow uses the supplied CSS and its edge-proximity/angle calculation adapted to the existing HTML elements, preserving native links, buttons, details and tab listeners. Both use a monochrome palette and respect reduced motion.

Source: https://github.com/DavidHDev/react-bits — copyright David Haz. See REACT-BITS-LICENSE.md. Components are integrated into the Musical AI website.

Build from the repository root:

```
npm ci --prefix docs/source
npm run build --prefix docs/source
```

Commit generated docs/effects.js, docs/effects.css and docs/effects.js.LEGAL.txt alongside source changes. GitHub Pages serves the static output without a build step or external CDN. These dependencies are isolated from the desktop application.
