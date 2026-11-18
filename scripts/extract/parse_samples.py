import pdfplumber, re, json, base64, io, sys

PDF = '/mnt/user-data/uploads/3dd1c790-ISTQB_CTFL______________.pdf'
pdf = pdfplumber.open(PDF)

SAMPLES = {  # question pages, answer pages
    'A': ((3, 33), (34, 70)),
    'B': ((73, 90), (93, 124)),
    'C': ((127, 144), (147, 182)),
    'D': ((185, 204), (207, 240)),
}
FOOT = re.compile(r'(Qualifications Board|kstqb\.org|^문제 Questions$|^부록: 추가 문제|^Additional Questions$|^\d+ of \d+$)')
ENDINGS = set('다.,)은는이가을를에의로고며서및와과도만게지면여해한할된될인적등중수것때후전요며니며:;?!·')
HANGUL = re.compile(r'[가-힣]')


CORPUS = open('/home/claude/dump/corpus.txt').read()


def need_space(a, b):
    """a: text so far, b: next line. Decide by corpus counts of a[-2:]+' '+b[:2] vs a[-2:]+b[:2]."""
    ta, tb = a.split(' ')[-1], b.split(' ')[0]
    for k in (3, 2, 1):
        x, y = ta[-k:], tb[:k]
        if len(x) < k or len(y) < k:
            continue
        sp = CORPUS.count(x + ' ' + y)
        ns = CORPUS.count(x + y)
        if sp + ns >= 2:
            return sp > ns
    return None


def join_lines(lines):
    """lines: list of (text, full) where full=line reaches right margin. Korean char-wrap aware join."""
    out = ''
    for i, (t, full) in enumerate(lines):
        t = t.strip()
        if not out:
            out = t
            continue
        prev_full = lines[i - 1][1]
        last = out[-1]
        if HANGUL.match(last) and t and HANGUL.match(t[0]):
            ns = need_space(out, t)
            if ns is None:
                ns = not (prev_full and last not in ENDINGS)
            out += (' ' + t) if ns else t
        else:
            out += ' ' + t
    return out


def fig_png(page, bbox, scale=2.5):
    im = page.crop(bbox).to_image(resolution=72 * scale).original.convert('RGB')
    # downscale very wide figures to ~ 720px
    if im.width > 760:
        r = 760 / im.width
        im = im.resize((760, int(im.height * r)))
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def question_lines(a, b):
    items = []  # dicts: kind=line/fig, text, x0, x1, page
    for pn in range(a, b + 1):
        p = pdf.pages[pn - 1]
        boxes = [t.bbox for t in p.find_tables()]
        for im in p.images:
            if im['width'] > 100 and im['top'] > 60 and im['bottom'] < p.height - 60:
                boxes.append((im['x0'], im['top'], im['x1'], im['bottom']))
        boxes = [(max(0, x0 - 4), max(0, t - 4), min(p.width, x1 + 4), min(p.height, bt + 4)) for x0, t, x1, bt in boxes]

        def inside(o):
            cx = (o['x0'] + o['x1']) / 2
            cy = (o['top'] + o['bottom']) / 2
            return any(x0 <= cx <= x1 and t <= cy <= bt for x0, t, x1, bt in boxes)

        fp = p.filter(lambda o: not inside(o) if o.get('object_type') == 'char' else True)
        rows = []
        for l in fp.extract_text_lines():
            if FOOT.search(l['text'].strip()) or l['top'] < 50:
                continue
            rows.append(dict(kind='line', text=l['text'], x0=l['x0'], x1=l['x1'], top=l['top'], page=pn))
        for bx in boxes:
            rows.append(dict(kind='fig', img=fig_png(p, bx), top=bx[1], page=pn, x0=bx[0]))
        rows.sort(key=lambda r: r['top'])
        items += rows
    return items


QSTART = re.compile(r'^(A?\d+)\.\s*(.*)')
OSTART = re.compile(r'^([a-e])\.\s*(.*)')


def parse_questions(a, b):
    items = question_lines(a, b)
    qs = []
    cur = None
    expect_main, expect_add = 1, 1
    for it in items:
        if it['kind'] == 'fig':
            if cur is not None:
                (cur['opts'][-1][1] if cur['opts'] else cur['stem']).append(('{{IMG}}', False))
                cur['imgs'].append(it['img'])
            continue
        t = it['text'].strip()
        m = QSTART.match(t)
        if m and it['x0'] < 88:
            num = m.group(1)
            ok = (num == str(expect_main)) or (num == f'A{expect_add}')
            if ok:
                if num.startswith('A'):
                    expect_add += 1
                else:
                    expect_main += 1
                cur = dict(num=num, stem=[], opts=[], imgs=[])
                qs.append(cur)
                cur['stem'].append((m.group(2), it['x1'] > 500))
                continue
        if cur is None:
            continue
        mo = OSTART.match(t)
        nexpect = 'abcde'[len(cur['opts'])] if len(cur['opts']) < 5 else None
        if mo and mo.group(1) == nexpect and 85 <= it['x0'] <= 100:
            cur['opts'].append([mo.group(1), [(mo.group(2), it['x1'] > 500)]])
            continue
        (cur['opts'][-1][1] if cur['opts'] else cur['stem']).append((t, it['x1'] > 500))
    out = []
    for q in qs:
        def render(lines):
            # split by IMG markers to keep them as separate lines
            parts, buf = [], []
            for t, f in lines:
                if t == '{{IMG}}':
                    if buf: parts.append(join_lines(buf)); buf = []
                    parts.append('{{IMG}}')
                else:
                    # list items (i., ii., 1., •) start new lines
                    if buf and re.match(r'^([ivx]+\.|ⅰ|ⅱ|ⅲ|ⅳ|ⅴ|\d+\.|•|-|[A-Z]\.|\(\d\)|TC\d+\s*:|AC\d+\s*:|다음 중|아래|위의)', t.strip()):
                        parts.append(join_lines(buf)); buf = []
                    buf.append((t, f))
            if buf: parts.append(join_lines(buf))
            return '\n'.join(parts)
        out.append(dict(num=q['num'], stem=render(q['stem']), options=[render(o[1]) for o in q['opts']], imgs=q['imgs']))
    return out


def parse_answers(a, b):
    rows = []
    cur = None
    for pn in range(a, b + 1):
        p = pdf.pages[pn - 1]
        words = p.extract_words(keep_blank_chars=False, use_text_flow=False)
        words = [w for w in words if 150 < w['top'] < p.height - 60 or (w['top'] > 60 and w['text'] not in ('정답',))]
        # header row words
        for w in words:
            w['col'] = 'num' if w['x0'] < 125 else 'ans' if w['x0'] < 172 else 'exp' if w['x0'] < 627 else 'lo' if w['x0'] < 685 else 'k' if w['x0'] < 730 else 'pt'
        # skip header area per page: words above first data row
        hdr_bottom = max([w['bottom'] for w in words if w['text'] in ('(#)', '(LO)', '배점')] + [0])
        words = [w for w in words if w['top'] > hdr_bottom + 2 and not FOOT.search(w['text'])]
        words = [w for w in words if w['top'] < p.height - 70]
        starts = sorted([w for w in words if w['col'] == 'num' and re.fullmatch(r'A?\d+', w['text'])], key=lambda w: w['top'])
        page_rows = []
        for w in words: w['pg'] = pn
        for w in starts:
            r = dict(num=w['text'], ans=[], exp=[], lo=[], page=pn, top=w['top'])
            page_rows.append(r)
        for w in words:
            if w in starts:
                continue
            target = None
            for r in page_rows:
                if r['top'] <= w['top'] + 8:
                    target = r
            if target is None:
                target = cur  # continuation of row from previous page
            if target is None:
                continue
            target[{'num': 'exp', 'ans': 'ans', 'exp': 'exp', 'lo': 'lo', 'k': 'lo', 'pt': 'lo'}[w['col']]].append(w)
        rows += page_rows
        if page_rows:
            cur = page_rows[-1]
    out = {}
    for r in rows:
        ans = re.findall(r'[a-e]', ' '.join(w['text'] for w in r['ans']))
        # explanation: group by line
        ws_sorted = sorted(r['exp'], key=lambda w: (w['pg'], w['top']))
        clusters = []
        for w in ws_sorted:
            if clusters and abs(clusters[-1][0]['top'] - w['top']) < 4.5 and clusters[-1][0].get('pg') == w.get('pg'):
                clusters[-1].append(w)
            else:
                clusters.append([w])
        ls = []
        for ws in clusters:
            ws = sorted(ws, key=lambda w: w['x0'])
            ls.append((' '.join(w['text'] for w in ws), ws[-1]['x1'] > 585, ws[0]['x0']))
        # paragraph splits at a) b) ... or list markers
        parts, buf = [], []
        for t, full, x0 in ls:
            if buf and re.match(r'^([a-e]\)|[ivx]+\.|\d+\.|•|[A-D]\.|TC\d|테스트 \(\d)', t):
                parts.append(join_lines(buf)); buf = []
            buf.append((t, full))
        if buf: parts.append(join_lines(buf))
        lo = re.search(r'FL-(\d)\.\d+\.\d+', ' '.join(w['text'] for w in r['lo']))
        out[r['num']] = dict(answer=ans, explanation='\n'.join(parts), lo=lo.group(0) if lo else None)
    return out


if __name__ == '__main__':
    allq = []
    for s, (qr, ar) in SAMPLES.items():
        qs = parse_questions(*qr)
        ans = parse_answers(*ar)
        print(s, 'questions', len(qs), 'answers', len(ans), file=sys.stderr)
        for q in qs:
            a = ans.get(q['num'])
            if not a:
                print('  NO ANSWER', s, q['num'], file=sys.stderr)
                continue
            allq.append(dict(sample=s, **q, **a))
    json.dump(allq, open('samples_raw.json', 'w'), ensure_ascii=False, indent=1)
