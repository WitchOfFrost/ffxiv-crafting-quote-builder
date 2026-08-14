#!/usr/bin/env python3
"""Inline the stylesheets into index.html at deploy time.

The CSS is split into css/shell.css and css/components.css for editing, but
the whole thing is under 3 KB gzipped — smaller than the overhead of fetching
it. So the published page carries it inline: no render-blocking request, and
no layout shift from styles arriving after first paint.

Source keeps ordinary <link ... data-inline> tags so opening index.html
directly still works. Run after minification.
"""

import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
html_path = root / "index.html"

html = html_path.read_text(encoding="utf-8")
link_re = re.compile(r'[ \t]*<link[^>]*\bdata-inline\b[^>]*href="([^"]+)"[^>]*>[ \t]*\n?')

# href may sit before data-inline as well
alt_re = re.compile(r'[ \t]*<link[^>]*href="([^"]+)"[^>]*\bdata-inline\b[^>]*>[ \t]*\n?')

total = 0
for pattern in (link_re, alt_re):
    while True:
        m = pattern.search(html)
        if not m:
            break
        css_file = root / m.group(1)
        if not css_file.is_file():
            sys.exit(f"error: {m.group(1)} referenced by index.html does not exist")
        css = css_file.read_text(encoding="utf-8").strip()
        total += len(css)
        html = html[: m.start()] + f"    <style>{css}</style>\n" + html[m.end() :]

if not total:
    sys.exit("error: no <link data-inline> tags found in index.html")

html_path.write_text(html, encoding="utf-8")
print(f"inlined {total} bytes of CSS")
