# Certificates in the desk drawer

`certs.json` lists what the drawer shows (up to 6, in this order). For each entry add a `"file": "name.jpg"` line and put the real image in this folder
with that name (JPG or PNG, landscape works best, about 1400 px wide). Until an entry has a `file`, the drawer shows a
paper card with the title and issuer instead. Change `title`, `issuer` and `date` freely; add `"date": "2025"` to show a date.
Bump the `?v=` in `desk-props.js` (certs.json and the image URLs) after changing files.
