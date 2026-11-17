# Pretendard 글꼴을 게임에서 쓰는 글자만 남긴 woff2로 줄인다(7단계).
# 원본: assets-src/fonts/pretendard-variable.woff2 (가변 굵기, 배포하지 않음)
# 결과: public/assets/fonts/pretendard-subset.woff2, docs/specs/font-subset.json(담긴 글자 목록)
# 남기는 글자: 영문·숫자·기본 기호, 라틴-1, KS X 1001 한글 2,350자, 한글 자모,
#   그리고 src/·index.html에 실제로 쓰인 모든 글자. 글을 새로 쓰고 tests/docs 글꼴 검사가 실패하면 다시 실행한다.
# 실행: pip install fonttools brotli && python3 tools/subset-font.py
import json, pathlib, re
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets-src/fonts/pretendard-variable.woff2'
OUT = ROOT / 'public/assets/fonts/pretendard-subset.woff2'
LIST = ROOT / 'docs/specs/font-subset.json'

chars = set(chr(c) for c in range(0x20, 0x7F)) | set(chr(c) for c in range(0xA0, 0x100))
chars |= set(chr(c) for c in range(0x3131, 0x3164))  # 한글 호환 자모
for c in range(0xAC00, 0xD7A4):  # KS X 1001(완성형) 2,350자
    try:
        # 파이썬 euc-kr은 완성형 밖 글자를 8바이트 조합으로 바꾸므로 2바이트인 것만 센다
        if len(chr(c).encode('euc-kr')) == 2:
            chars.add(chr(c))
    except UnicodeEncodeError:
        pass
for path in [ROOT / 'index.html', *(ROOT / 'src').rglob('*')]:
    if path.is_file() and path.suffix in {'.ts', '.tsx', '.js', '.css', '.html', '.json'}:
        chars |= set(path.read_text(encoding='utf-8'))

font = TTFont(SOURCE)
cmap = font.getBestCmap()
covered = sorted(c for c in chars if ord(c) in cmap)
# 원본 글꼴에도 없는 글자(이모지 등)는 시스템 글꼴로 보인다
fallback = sorted(c for c in chars if ord(c) not in cmap and c.isprintable() and not c.isspace())
options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
sub = subset.Subsetter(options)
sub.populate(unicodes=[ord(c) for c in covered])
sub.subset(font)
font.flavor = 'woff2'
font.save(OUT)
LIST.write_text(
    json.dumps(
        {'source': 'Pretendard Variable 1.309', 'chars': ''.join(covered), 'fallback': ''.join(fallback)},
        ensure_ascii=False,
    ) + '\n',
    encoding='utf-8',
)
print(f'{len(covered)}자, {OUT.stat().st_size // 1024}KB → {OUT.relative_to(ROOT)}')
