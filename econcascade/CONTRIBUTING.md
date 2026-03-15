# Contributing to EconCascade

Thanks for helping make EconCascade better. Here's how to contribute.

## Getting started

```bash
git clone https://github.com/the-one-sharma/econcascade.git
cd econcascade
open index.html   # or: python3 -m http.server 8080
```

No build step. Edit `assets/style.css` for styles, `assets/app.js` for logic.

## Ways to contribute

### Bug reports
Open an issue with:
- What you expected vs. what happened
- Browser + OS
- Steps to reproduce

### New shock events
Each shock is an entry in the `cascadeEvents` object in `app.js`:

```js
myNewShock: {
  label: 'Short description shown in the info bar.',
  cascade: [
    { id: 'fed', s: 'up', d: 0 },      // id=node, s=up|down|amb, d=delay ms
    { id: 'ms',  s: 'up', d: 250 },
    // ...
  ],
  edgeSeq: ['fed→ms', 'ms→ir', ...]    // edges to highlight in order
}
```

Then add a button in `index.html`:
```html
<button class="trigger-btn" data-ev="myNewShock">My new shock</button>
```

And add `nodeInfo` directional explanations if any new nodes are affected.

### New graph types
Each graph is a `draw*()` function in `app.js` following these rules:
1. **All equilibria solved algebraically** — no hardcoded intersection points
2. **Ghost curves** — draw the pre-shift curve as dashed gray when shifted
3. **Shading** — CS/PS/DWL regions where applicable
4. **eqPoint()** for the equilibrium dot with axis tick labels
5. **legend()** at top left listing all curves

Add it to:
- The `renderGraph()` switch statement
- The `GRAPHS` object (title, desc, shocks array)
- A `<button class="gtab">` in the graph tabs HTML
- The `graphDescriptions` object

### CSS / design
- Use CSS variables (`--green`, `--red`, `--border2`, etc.) — no raw hex in CSS
- All transitions use `var(--t)`
- Test in both wide and narrow viewport

## Code style
- Vanilla JS only — no frameworks, no npm
- Semicolons at end of statements
- Single quotes for strings in JS
- 2-space indentation in HTML/CSS
- Descriptive variable names in new functions

## Pull request checklist
- [ ] No new dependencies added
- [ ] Works in Chrome, Firefox, and Safari
- [ ] Mobile viewport tested (≥ 375px wide)
- [ ] `Esc` and `R` keyboard shortcuts still work
- [ ] All cascade buttons still have matching `cascadeEvents` entries
- [ ] No console errors

## Questions?
Open a GitHub Discussion or an issue labeled `question`.
