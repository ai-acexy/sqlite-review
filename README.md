# sqlite-review

I created this minimal SQLite online preview and editing project for loading, querying, modifying, and exporting SQLite databases in the browser.

## Environment Info

- Authoring agent: Codex
- Model used: GPT-5 (Codex coding agent runtime)
- App runtime: Codex desktop

## Online

- Live URL: [https://sqlite.acexy.cn](https://sqlite.acexy.cn)

## Features

- I implemented importing SQLite files through file selection and drag-and-drop
- I implemented creating a brand-new empty database in the browser
- I implemented running SQL statements directly in the editor
- I implemented table browsing and schema inspection from the left panel
- I moved table preview results into the main result area
- I added SQL syntax highlighting in the editor
- I added a draggable splitter to adjust the SQL and result area ratio
- I added database export to `.sqlite`
- I added a workspace clear action with confirmation for destructive changes
- I added confirmation prompts before replacing existing workspace data
- I added local storage persistence for theme and editor content
- I added a light/dark theme toggle
- I made the layout responsive for desktop and mobile
- I packaged `sql.js` locally and kept CDN-first loading with automatic fallback

## Quick Start

1. Open `index.html` directly in a browser.
2. Import a SQLite file or create a new empty database.
3. Enter SQL in the editor and press `Cmd/Ctrl + R` to run it.
4. View query results, schema details, and table previews in the right panel.

## Project Structure

- `index.html`: page skeleton and UI structure
- `bootstrap.js`: lightweight runtime bootstrapper
- `style.css`: layout and visual styles
- `app.js`: SQLite loading, query execution, preview rendering, and interactions
- `public/vendor/sql.js`: local `sql.js` runtime and WebAssembly fallback assets

## Notes

- I built this as a static frontend implementation.
- No build tool or install step is required to run it.
- It tries the CDN runtime first and falls back to the local vendor copy when needed.
