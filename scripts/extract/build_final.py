import json, re
from normalize import norm
import dump_decisions as DD
CH = {1:'1장 테스팅의 기초',2:'2장 SDLC와 테스팅',3:'3장 정적 테스팅',4:'4장 테스트 분석과 설계',5:'5장 테스트 활동 관리',6:'6장 테스트 도구'}
out = []
# official samples
for q in json.load(open('samples_raw.json')):
    ch = int(q['lo'][3]) if q['lo'] else None
    num = q['num']
    src = f"샘플 {q['sample']}" + (" 추가" if num.startswith('A') else '')
    ans = sorted('abcde'.index(a) for a in q['answer'])
    assert q['stem'].count('{{IMG}}') == len(q['imgs'])
    out.append(dict(id=f"S{q['sample']}-{num}", source=src, num=num, chapter=CH[ch], lo=q['lo'],
        question=q['stem'], options=q['options'], answer=ans, images=q['imgs'], explanation=q['explanation']))
# dump
raw = {q['num']: q for q in json.load(open('dump_raw.json'))}
missing = [n for n in raw if n not in DD.DROP and n not in DD.E]
assert not missing, missing
for n, q in raw.items():
    if n in DD.DROP: continue
    ch, exp, override = DD.E[n]
    fx = DD.FIX.get(n, {})
    stem = fx.get('stem') or norm(q['stem'])
    opts = [norm(o) for o in q['options']]
    for i, t in sorted(fx.get('opts', {}).items()):
        if i >= len(opts): opts = opts[:i] + [''] * (i - len(opts) + 1) if len(opts) < i else opts + ['']
        opts[i] = t
    if not fx.get('stem') and q['imgs'] and '{{IMG}}' not in stem: stem += '\n{{IMG}}'
    stem = re.sub(r'(아래 그림 참고|전시 참조)\s*', '', stem).strip()
    letters = override.split(',') if override else q['answer']
    ans = sorted('ABCDEFG'.index(a.strip()) for a in letters)
    assert all(a < len(opts) for a in ans), n
    assert stem.count('{{IMG}}') == len(q['imgs']), (n, stem.count('{{IMG}}'), len(q['imgs']))
    assert len(opts) >= 4, n
    exp = re.sub(r'덤프 정답\(([A-E])\)', lambda m: f"덤프 정답({m.group(1).lower()})", exp)
    exp = re.sub(r'([A-E])로 수정', lambda m: f"{m.group(1).lower()}로 수정", exp)
    if len(ans) > 1 and '선택' not in stem and '고르' not in stem: stem += f' ({len(ans)}개 선택)'
    out.append(dict(id=f"D-{n}", source='덤프', num=str(n), chapter=CH[ch], lo=None, question=stem, options=opts,
        answer=ans, images=q['imgs'], explanation=exp))
json.dump(out, open('questions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print(len(out), collections.Counter(o['source'] for o in out))
print(collections.Counter(o['chapter'] for o in out))
print('multi', sum(len(o['answer'])>1 for o in out), 'imgs', sum(len(o['images']) for o in out))
import os; print('bytes', os.path.getsize('questions.json'))
