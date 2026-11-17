# 큰 그림을 WebP로 바꾼다. 원본 PNG는 assets-src/images/에 두고(배포하지 않음), 결과는 public/assets/에 쓴다.
# 보드 그림은 칸 위치를 잰 그림이라 무손실로 바꾸고, 픽셀이 원본과 같은지 확인한다.
# 결과 목록(원본 해시·방식)은 docs/specs/images.json에 남긴다.
# 실행: pip install pillow && python3 tools/convert-images.py
import hashlib, json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src/images'
OUT = ROOT / 'public/assets'
# (원본, 결과, 방식): lossless=무손실, 숫자=손실 압축 품질
JOBS = [
    ('board-7x8.png', 'board-7x8.webp', 'lossless'),
    ('battlefield-bg.png', 'battlefield-bg.webp', 85),
    ('characters/c01-nox.png', 'characters/c01-nox.webp', 88),
    ('characters/c01-nox-thumbnail.png', 'characters/c01-nox-thumbnail.webp', 88),
]

report = {}
for source, target, mode in JOBS:
    src, out = SRC / source, OUT / target
    out.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(src)
    if mode == 'lossless':
        image.save(out, 'WEBP', lossless=True, quality=100, method=6, exact=True)
        back = Image.open(out).convert(image.mode)
        assert back.tobytes() == image.tobytes(), source + ': 무손실 변환 뒤 픽셀이 다름'
    else:
        image.save(out, 'WEBP', quality=mode, method=6, alpha_quality=100)
    report[target] = {
        'source': 'assets-src/images/' + source,
        'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(),
        'size': list(image.size),
        'mode': mode,
    }
    print(f'{target}: {src.stat().st_size // 1024}KB → {out.stat().st_size // 1024}KB ({mode})')
(ROOT / 'docs/specs/images.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
