# Preserved design references

This directory keeps unused original Figma artwork and the earlier scaffold
stylesheet outside the frontend's source and public output. The October 4, 2026
cleanup archived 41 unreferenced SVG/PNG files and `src/styles.css`; it did not
delete them or change the active styles, artwork, data, or workflows.

`manifest.json` records original/current paths, byte counts, SHA-256 hashes, and
the references found for all 104 original public assets and the old stylesheet.
All 105 files were checked against their hashes after relocation. References were
searched in frontend source, tests, configuration, and existing local review
scripts. License/notice files remain in `public/assets` alongside active assets.
SVG dependencies were inspected; their URL references are internal fragment IDs.

Vite copies `public`, so these archived files no longer appear in production
output. To reuse artwork, copy the needed file from `assets` to `public/assets`
and reference that path from the app. The old `styles.css` is a historical
reference; current style imports are listed in `src/main.tsx`.
