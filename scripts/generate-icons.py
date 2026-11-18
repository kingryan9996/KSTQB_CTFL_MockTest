"""assets/icon-source.png(1:1 원본, 가장자리 여백 포함) → public/ 아이콘 생성
사용법: python3 scripts/generate-icons.py   (Pillow 필요: pip install pillow)"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / 'assets' / 'icon-source.png').convert('RGB')  # iOS는 투명도 미지원 → RGB
w, h = src.size
s = min(w, h)
src = src.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))  # 1:1 보정

for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32)]:
    src.resize((size, size), Image.LANCZOS).save(ROOT / 'public' / name, optimize=True)
    print('public/' + name, size)
