# AGENTS.md

## Scope

- This repository is a static SQLite preview/editing app.
- Main files: `index.html`, `app.js`, `style.css`.

## Rules

- Make the smallest change that satisfies the request.
- Preserve existing UI style, behavior, and wording unless the user asks otherwise.
- Keep documentation in sync when behavior changes.
- Use ASCII by default.
- Avoid dependency changes, destructive git actions, and out-of-workspace edits unless explicitly requested.

## Product Notes

- The editor toolbar actions are: execute selected SQL, format SQL, copy SQL, and clear the editor.
- SQL execution is selection-based.
- Workspace state is persisted locally; refresh behavior should be preserved carefully.

