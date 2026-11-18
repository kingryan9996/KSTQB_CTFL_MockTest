import re, json, sys
import parse_samples as P

P.FOOT = re.compile(r'(The safer , easier way|^\d+ / 141$|Siheom)')

QSTART = re.compile(r'^(\d+)\s*\.\s*(.*)')
# options: A.-G., plus machine-translated letter names
OPT = re.compile(r'^(A|B|C|D|E|F|G|에이|비|씨|디|이|이자형|에프|지)\s*[\.\)]\s*(.*)')
LETTER = {'에이': 'A', '비': 'B', '씨': 'C', '디': 'D', '이자형': 'E', '이': 'E', '에프': 'F', '지': 'G'}
ANS = re.compile(r'^Answer\s*:\s*([A-G](?:\s*,\s*[A-G])*)')

items = P.question_lines(272, 382)
qs = []
cur = None
expect = 66
mode = None  # stem/opt/exp
for it in items:
    if it['kind'] == 'fig':
        if cur is not None:
            cur['imgs'].append(it['img'])
            if mode == 'stem':
                cur['stem'].append(('{{IMG}}', False))
            else:
                cur['stem'].append(('{{IMG}}', False))  # figure belongs to question; show after stem
        continue
    t = it['text'].strip()
    if not t:
        continue
    m = QSTART.match(t)
    if m and int(m.group(1)) == expect and (cur is None or mode in ('ans', 'exp')):
        cur = dict(num=expect, stem=[], opts=[], answer=None, exp=[], imgs=[], blocks=[])
        qs.append(cur)
        expect += 1
        mode = 'stem'
        rest = m.group(2)
        rest = re.sub(r'^주제 \d+,\s*혼합 질문 세트 \w+\s*', '', rest)
        if rest:
            cur['stem'].append((rest, it['x1'] > 480))
        continue
    if cur is None:
        continue
    a = ANS.match(t)
    if a:
        cur['answer'] = [x.strip() for x in a.group(1).split(',')]
        mode = 'ans'
        continue
    if t.startswith('Explanation'):
        mode = 'exp'
        rest = t.split(':', 1)[1].strip() if ':' in t else ''
        if rest:
            cur['exp'].append((rest, it['x1'] > 480))
        continue
    if mode == 'exp':
        cur['exp'].append((t, it['x1'] > 480))
        continue
    if mode == 'ans':
        continue
    o = OPT.match(t)
    nexp = 'ABCDEFG'[len(cur['opts'])] if len(cur['opts']) < 7 else None
    if o:
        L = LETTER.get(o.group(1), o.group(1))
        if L == nexp and (L != 'E' or o.group(1) in ('E', '이자형') or len(cur['opts']) == 4):
            cur['opts'].append([L, [(o.group(2), it['x1'] > 480)]])
            mode = 'opt'
            continue
    if mode == 'opt':
        cur['opts'][-1][1].append((t, it['x1'] > 480))
    else:
        cur['stem'].append((t, it['x1'] > 480))
    # images positioned in stem


def render(lines):
    parts, buf = [], []
    for t, f in lines:
        if t == '{{IMG}}':
            if buf: parts.append(P.join_lines(buf)); buf = []
            parts.append('{{IMG}}')
            continue
        if buf and re.match(r'^([ivxIVX]+\.|Ⅰ|Ⅱ|Ⅲ|Ⅳ|ⅰ|ⅱ|ⅲ|ⅳ|ⅴ|\(?[ivx]+\)|\d+\s|\d+\)|\d+\.|•|-|다음 중|어느|무엇)', t):
            parts.append(P.join_lines(buf)); buf = []
        buf.append((t, f))
    if buf: parts.append(P.join_lines(buf))
    return '\n'.join(parts)


out = []
for q in qs:
    out.append(dict(num=q['num'], stem=render(q['stem']), options=[render(o[1]) for o in q['opts']],
                    answer=q['answer'], explanation=render(q['exp']), imgs=q['imgs']))
json.dump(out, open('dump_raw.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), file=sys.stderr)
