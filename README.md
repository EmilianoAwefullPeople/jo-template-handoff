# Journey Onward · Template Handoff

A static site listing every Journey Onward graphic template (postcards, stickers, trip recap slides) with the engineering spec to build it: the Figma design, the data it needs, where that data comes from in the Core Engine, and the rules for auto-generation.

It's a human view of `templates.json`, the single source of truth. If the site and the JSON ever disagree, the JSON is correct.

Live site: `https://emilianoawefullpeople.github.io/jo-template-handoff/`
Raw JSON: `https://emilianoawefullpeople.github.io/jo-template-handoff/templates.json`

Design tracker (Regina's progress tracker, a separate site): `https://emilianoawefullpeople.github.io/regina-design-tracker/`

## Files

```
jo-template-handoff/
├── index.html          # the site shell
├── styles.css          # visual style
├── app.js              # fetches templates.json and renders everything
├── templates.json       # SINGLE SOURCE OF TRUTH
├── assets/
│   └── previews/       # PNG/JPG exports of each Figma frame, named <templateId>-<size>.png
└── README.md
```

No build step, no framework. Vanilla HTML/CSS/JS.

## Previewing locally

`fetch()` can't read `templates.json` from a `file://` URL, so serve the folder:

```
cd jo-template-handoff
python3 -m http.server
```

Then open `http://localhost:8000`.

## Updating a template

1. Open `templates.json`.
2. Find the template by `id` (its tracker number, e.g. `"1"`, `"22"`, `"R3"`).
3. Edit the fields you need. Follow the schema used by templates `1` and `22` for a `ready-for-dev` entry (full `fields`, `autoGeneration`, `fallbackCases`, `rendering`, etc.), or the minimal shape used by the `design-done` stubs (just `name`, `type`, `trackerId`, `previews`, and an optional `summary`).
4. If you change a template's eligibility, data contract, or fallback rules, also check whether `rules` or `readyForDevChecklist` at the top of the file still apply as written.
5. Bump `version` (top of the file) and add a line to `changelog` describing what changed and why.
6. Validate the JSON before committing:
   ```
   python3 -m json.tool templates.json > /dev/null && echo OK
   ```
7. Update `updated` (top of the file) to today's date.

## Adding a new template

Copy the shape of an existing entry in `templates.json` (either a full `ready-for-dev` entry like `#1`/`#22`, or a `design-done` stub). Give it a new `id` matching its tracker number. Export its Figma frame(s) as PNG into `assets/previews/` (see below), and reference them in `previews`.

## Exporting Figma previews

Templates live in the Figma file `V8t4i8uY54selKjJbYsa0t` (JO Regina Templates), as **sections** on the handoff page (node `15:44`), because the file is on Figma's Starter plan (max 3 pages). Never build from page `67:2`, it's a backup taken before cleanup.

Using a Figma MCP connector in a Claude Code session:
1. Get the frame's node ID from the template's `outputSizes` in `templates.json`.
2. Export it as a PNG at the frame's native size (1080px long edge or higher).
3. Save it to `assets/previews/<templateId>-<size>.png` (e.g. `assets/previews/1-2x3.png`) and add the path to the template's `previews` array.

## Using this with Claude Code (for Adam and Mike)

Each template's detail panel on the site has a **"Copy spec for Claude Code"** button. It copies that template's full spec as Markdown: the foundational rules (section 1 of the build spec), the template's complete JSON block, and its Figma links. Paste that directly into a Claude Code session to write engineering tickets or start implementation.

If you'd rather point a session at the live data instead of pasting it, give it the raw JSON URL:
```
https://emilianoawefullpeople.github.io/jo-template-handoff/templates.json
```

Only templates with `"status": "ready-for-dev"` are spec-complete and ready to build. Everything else is shown for context and planning; check the `blockers` array before starting work on a `spec-ready` template.

## Deploying

This repo is published with GitHub Pages from the `main` branch root. Pushing to `main` updates the live site; no build or deploy step is needed.
