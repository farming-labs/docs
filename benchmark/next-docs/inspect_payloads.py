#!/usr/bin/env python3
"""Inspect retained build payloads and verify identical provider source content."""
import argparse
import hashlib
import json
import re
from pathlib import Path

MAPS = {
    'lastModifiedMap', 'readingTimeMap', 'structuredDataMap',
    'generatedTitleMap', 'descriptionMap',
}


def inspect_payload(app):
    html = (app / '.next/server/app/docs.html').read_text()
    stream = []
    for script in re.findall(r'<script[^>]*>(.*?)</script>', html, re.S):
        prefix = 'self.__next_f.push('
        if script.startswith(prefix):
            try:
                value = json.loads(script[len(prefix):-1])
                if value[0] == 1:
                    stream.append(value[1])
            except (ValueError, IndexError, TypeError):
                pass
    maps = []

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in MAPS and isinstance(child, dict):
                    maps.append({
                        'name': key, 'entries': len(child),
                        'jsonBytes': len(json.dumps(child, separators=(',', ':'), ensure_ascii=False).encode()),
                    })
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    for line in ''.join(stream).splitlines():
        try:
            visit(json.loads(line.split(':', 1)[1]))
        except (ValueError, IndexError):
            pass
    urls = sorted(set(re.findall(r'src="(/_next/static/[^"?]+\.js)', html)))
    assets = []
    for url in urls:
        path = app / '.next' / url.removeprefix('/_next/')
        assets.append({'url': url, 'bytes': path.stat().st_size})
    return {'metadataMaps': maps, 'scripts': sorted(assets, key=lambda item: -item['bytes'])}


def corpus_hash(app, provider, pages):
    digest = hashlib.sha256()
    for index in range(pages):
        slug = f'page-{index:04d}'
        if provider == 'farming':
            path = app / 'app/docs' / (slug if index else '') / 'page.mdx'
        else:
            path = app / 'content/docs' / (f'{slug}.mdx' if index else 'index.mdx')
        data = path.read_bytes()
        digest.update(len(data).to_bytes(8, 'big'))
        digest.update(data)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    raw = json.loads((args.run / 'results.json').read_text())
    fixtures = sorted({(row['pages'], row['provider']) for row in raw['results']})
    result = []
    hashes = {}
    for pages, provider in fixtures:
        app = args.run / 'apps' / f'{provider}-{pages}'
        digest = corpus_hash(app, provider, pages)
        if pages in hashes and hashes[pages] != digest:
            raise RuntimeError(f'Provider content differs at {pages} pages')
        hashes[pages] = digest
        result.append({'pages': pages, 'provider': provider, 'sourceSha256': digest, **inspect_payload(app)})
    output = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output)
    print(output, end='')


if __name__ == '__main__':
    main()
