# 관리자 내보내기 ZIP(autochess-admin-export, v1·v2·v3)을 게임 파일(반영본)에 넣는다. 나눠 받은 ZIP은 한 번에 여러 개 넣는다(v0.26.1).
# v3(v0.26.0): 캐릭터별 카드 프레임·이름표(frame·nameplate, 무손실 WebP). null이면 개별 그림을 지워 공통 기본으로.
# v4(v0.26.4): profile(종족·직업·특성·성별) → src/core/data/unit-profile-overrides.generated.js(원본과 다른 항목만).
#   python3 tools/import-admin-export.py <내보내기.zip> [--dry-run]
# - 검사: 형식·버전, 캐릭터 ID(data/units.js 명단), 그림 매직 바이트·sha256·10MB·디코드.
# - 그림: 원본은 assets-src/images/cards/<id>/<slot>.<확장자>, 배포본은 public/assets/cards/<id>/<slot>.webp
#   (캐릭터·인게임 썸네일은 투명도 유지 품질 90, 배경은 품질 88). 반영본과 같은 그림(sha256)이면 다시 만들지 않는다.
# - 결과: src/ui/art/card-art.generated.ts(이름·그림 경로·크기·해시), v2부터 기본 능력치는
#   src/core/data/unit-stat-overrides.generated.js(원본과 다른 키만, 검사는 src/core/unit-stats.ts와 같은 규칙).
#   ZIP에 든 캐릭터만 바꾸고 나머지는 그대로. v1(썸네일·능력치 항목 없음)은 그 둘을 바꾸지 않는다. 모르는 항목은 무시하고 알린다.
# - 인게임 썸네일 줄인 사본(v0.26.8): 영입·대기석 칸은 100px 안팎이라 1000px 그림을 브라우저가 한 번에 줄이면 윤곽선이 자글자글하다.
#   그래서 thumbnail-128·192·288·432.webp를 Lanczos(투명도 미리 곱함)로 미리 만들고 반영본 thumbnail.variants에 너비를 적는다.
#   화면(CharacterImage)은 srcset으로 칸 크기·화면 배율에 맞는 사본을 고른다. 이미 반영된 썸네일만 다시 만들려면
#   python3 tools/import-admin-export.py --thumbnails
# 실행: pip install pillow (Prettier는 npx로 결과 파일만 정리)
import hashlib, io, json, pathlib, re, subprocess, sys, zipfile
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
GENERATED = ROOT / 'src/ui/art/card-art.generated.ts'
STATS_GENERATED = ROOT / 'src/core/data/unit-stat-overrides.generated.js'
PROFILE_GENERATED = ROOT / 'src/core/data/unit-profile-overrides.generated.js'
PROFILE_HEADER = """// 캐릭터 설정(종족·직업·특성·성별) 반영본(관리자 내보내기 → tools/import-admin-export.py가 만든다). 손으로 고치지 않는다.
// 캐릭터 ID → 원본과 다른 항목만. 없는 캐릭터·항목은 원본 그대로. data/units.js가 명단을 만들 때 합친다.
export default """
STATS_HEADER = """// 캐릭터 기본 능력치 반영본(관리자 내보내기 → tools/import-admin-export.py가 만든다). 손으로 고치지 않는다.
// 캐릭터 ID → 원본(units.js·higher-cost-drafts.js)과 다른 능력치 키만. 없는 캐릭터·키는 원본 값 그대로.
// data/units.js가 명단을 만들 때 합친다(전투·미리보기·상점 정보 모두 같은 값). 적군(E01~E08)은 원본 값을 쓴다.
export default """
KNOWN_CARD_KEYS = {'characterId', 'originalName', 'displayNameOverride', 'backgroundImage', 'characterImage',
                   'thumbnailImage', 'frameImage', 'nameplateImage', 'profile', 'stats', 'imageTransform',
                   'updatedAt'}
SRC_DIR = ROOT / 'assets-src/images/cards'
OUT_DIR = ROOT / 'public/assets/cards'
MAX_BYTES = 10 * 1024 * 1024
THUMB_WIDTHS = (128, 192, 288, 432)  # src/ui/art/cards.ts thumbnailWidths와 같아야 한다
NAME_MAX = 12
HEADER = """// 게임에 반영된 카드 꾸미기(관리자 내보내기 → tools/import-admin-export.py가 만든다). 손으로 고치지 않는다.
// 캐릭터마다 표시 이름·배경·인물 그림(배포 경로)·원본/배포본 해시. 비어 있으면 모든 카드가 원래 이름·플레이스홀더.
import type { BakedCardArt } from './cards.ts';

export const bakedCardArt: Readonly<Record<string, BakedCardArt>> = """


def fail(msg):
    sys.exit('가져오기 실패: ' + msg)


def node_json(code, data=None):
    out = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True,
                         input=json.dumps(data) if data is not None else None, check=True)
    return json.loads(out.stdout)


def check_stats(cid, stats):
    """게임과 같은 규칙(src/core/unit-stats.ts)으로 검사하고 원본과 다른 키만 돌려준다"""
    r = node_json("""import U from './src/core/unit-stats.ts';
let t='';process.stdin.on('data',d=>t+=d).on('end',()=>{const {id,stats}=JSON.parse(t);
console.log(JSON.stringify({errors:U.checkStats(stats),diff:U.diffFromSource(id,stats)}))});""", {'id': cid, 'stats': stats})
    if r['errors']:
        fail(f"{cid} 기본 능력치 오류: {r['errors']}")
    return r['diff']


def check_profile(cid, profile):
    """게임과 같은 규칙(src/core/unit-profile.ts)으로 검사하고 원본과 다른 항목만 돌려준다"""
    r = node_json("""import P from './src/core/unit-profile.ts';
let t='';process.stdin.on('data',d=>t+=d).on('end',()=>{const {id,profile}=JSON.parse(t);
console.log(JSON.stringify({errors:P.checkProfile(profile),diff:P.profileDiff(id,profile)}))});""", {'id': cid, 'profile': profile})
    if r['errors']:
        fail(f"{cid} 캐릭터 설정 오류: {r['errors']}")
    return r['diff']


def read_profile_overrides():
    return node_json("import m from './src/core/data/unit-profile-overrides.generated.js';console.log(JSON.stringify(m))")


def read_stat_overrides():
    return node_json("import m from './src/core/data/unit-stat-overrides.generated.js';console.log(JSON.stringify(m))")


def roster():
    out = subprocess.run(
        ['node', '-e', "import('./src/core/data/units.js').then(m=>console.log(JSON.stringify(m.default.roster.map(u=>[u.id,u.name]))))"],
        cwd=ROOT, capture_output=True, text=True, check=True)
    return dict(json.loads(out.stdout))


def sniff(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if b[:3] == b'\xff\xd8\xff':
        return 'jpeg'
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        return 'webp'
    return None


def read_generated():
    out = subprocess.run(
        ['node', '-e', "import('./src/ui/art/card-art.generated.ts').then(m=>console.log(JSON.stringify(m.bakedCardArt)))"],
        cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def normalize_name(name, original):
    if not isinstance(name, str):
        return None
    name = re.sub(r'\s+', ' ', name.strip())[:NAME_MAX]
    return None if not name or name == original else name


def thumb_variants(cid, entry, dry, force=False):
    """인게임 썸네일의 줄인 사본을 만들고 entry['variants']에 너비를 적는다(파일이 다 있으면 그대로)"""
    folder = cid.lower()
    widths = [w for w in THUMB_WIDTHS if w < entry['width']]
    files = [OUT_DIR / folder / f'thumbnail-{w}.webp' for w in widths]
    stale = [f for f in (OUT_DIR / folder).glob('thumbnail-*.webp') if f not in files]
    if not force and entry.get('variants') == widths and all(f.exists() for f in files) and not stale:
        return False
    entry['variants'] = widths
    if dry:
        return True
    for f in stale:
        f.unlink()
    srcs = sorted((SRC_DIR / folder).glob('thumbnail.*')) or [OUT_DIR / folder / 'thumbnail.webp']
    im = Image.open(srcs[0])
    im.load()
    im = im.convert('RGBA').convert('RGBa')  # 투명 가장자리가 어둡게 번지지 않게 미리 곱한 알파로 줄인다
    for w, f in zip(widths, files):
        h = max(1, round(im.height * w / im.width))
        small = im.resize((w, h), Image.LANCZOS, reducing_gap=3.0).convert('RGBA')
        small.save(f, 'WEBP', quality=92, alpha_quality=100, method=6)
    return True


def refresh_thumbnails(baked, dry, force=False):
    done = [cid for cid, e in sorted(baked.items()) if e.get('thumbnail') and thumb_variants(cid, e['thumbnail'], dry, force)]
    return done


def write_generated(baked):
    ordered = {k: baked[k] for k in sorted(baked)}
    GENERATED.write_text(HEADER + json.dumps(ordered, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    subprocess.run(['npx', 'prettier', '--write', str(GENERATED)], cwd=ROOT, check=True, capture_output=True)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if '--thumbnails' in sys.argv and not args:
        baked = read_generated()
        done = refresh_thumbnails(baked, dry, force='--force' in sys.argv)
        if done and not dry:
            write_generated(baked)
        print(f"{'(dry-run) ' if dry else ''}썸네일 줄인 사본 {len(done)}명: {', '.join(done) or '없음(모두 최신)'}")
        return
    if not args:
        fail('사용법: python3 tools/import-admin-export.py <내보내기.zip> [더 많은 ZIP …] [--dry-run]')
    names = roster()
    baked = read_generated()
    stat_overrides = read_stat_overrides()
    profile_overrides = read_profile_overrides()
    report = []
    total_cards = 0
    for path in args:
        z = zipfile.ZipFile(path)
        try:
            manifest = json.loads(z.read('manifest.json'))
        except KeyError:
            fail('manifest.json이 없습니다(관리자 내보내기 ZIP이 아님).')
        if manifest.get('format') != 'autochess-admin-export' or manifest.get('version') not in (1, 2, 3, 4):
            fail(f"지원하지 않는 형식: {manifest.get('format')} v{manifest.get('version')}")
        version = manifest['version']
        cards = manifest.get('modules', {}).get('characters', {}).get('cards', [])
        total_cards += len(cards)
        report.append(f"[{pathlib.Path(path).name}] 내보낸 시각 {manifest.get('exportedAt')} · 게임 {manifest.get('gameVersion')}"
                  + (f" · 나눠 받은 파일 {manifest['part']['index']}/{manifest['part']['total']}" if manifest.get('part') else '')
                  + f" · 캐릭터 {len(cards)}명")
        for card in cards:
            cid = card.get('characterId')
            if cid not in names:
                fail(f'없는 캐릭터 ID: {cid}')
            prev = baked.get(cid, {})
            entry = {}
            unknown = set(card) - KNOWN_CARD_KEYS
            if unknown:
                print(f'   (알림) {cid}: 모르는 항목 무시 {sorted(unknown)}')
            name = normalize_name(card.get('displayNameOverride'), names[cid])
            if name:
                entry['displayName'] = name
            lines = [f"{cid} {names[cid]}: 이름 {name or '(원래 이름)'}"]
            slots = ['background', 'character']
            if version >= 2:
                slots.append('thumbnail')
            if version >= 3:
                slots += ['frame', 'nameplate']
            for keep in ('thumbnail', 'frame', 'nameplate'):
                if keep not in slots and prev.get(keep):
                    entry[keep] = prev[keep]  # 예전 형식 파일은 그 항목을 바꾸지 않는다
            for slot in slots:
                img = card.get(slot + 'Image')
                folder = cid.lower()
                if not img:
                    lines.append(f'{slot} 없음')
                    if not dry:
                        for f in list((SRC_DIR / folder).glob(slot + '.*')) + list((OUT_DIR / folder).glob(slot + '.*')):
                            f.unlink()
                    continue
                data = z.read(img['file'])
                fmt = sniff(data)
                if not fmt or fmt != img.get('format'):
                    fail(f"{cid} {slot}: PNG·JPG·WebP가 아니거나 형식이 다름")
                if len(data) > MAX_BYTES:
                    fail(f'{cid} {slot}: 10MB 초과')
                sha = hashlib.sha256(data).hexdigest()
                if sha != img.get('sha256'):
                    fail(f'{cid} {slot}: 파일이 손상됨(sha256 불일치)')
                old = prev.get(slot)
                src_sha = img.get('sourceSha256')  # 내보낼 때 줄여 담았으면 브라우저 원본 해시(v0.26.1)
                if old and (sha in old.get('sha256', []) or (src_sha and src_sha in old.get('sha256', []))):
                    entry[slot] = old
                    lines.append(f'{slot} 그대로(반영본과 같음)')
                    continue
                im = Image.open(io.BytesIO(data))
                im.load()
                ext = {'png': 'png', 'jpeg': 'jpg', 'webp': 'webp'}[fmt]
                src = SRC_DIR / folder / f'{slot}.{ext}'
                out = OUT_DIR / folder / f'{slot}.webp'
                if not dry:
                    src.parent.mkdir(parents=True, exist_ok=True)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    for f in (SRC_DIR / folder).glob(slot + '.*'):
                        f.unlink()
                    src.write_bytes(data)
                    if slot in ('frame', 'nameplate'):
                        # 공통 프레임·이름표처럼 원본 픽셀 그대로(무손실)
                        im.convert('RGBA').save(out, 'WEBP', lossless=True, quality=100, method=6, exact=True)
                    elif slot in ('character', 'thumbnail'):
                        im.convert('RGBA').save(out, 'WEBP', quality=90, alpha_quality=100, method=6)
                    else:
                        im.convert('RGB').save(out, 'WEBP', quality=88, method=6)
                    webp_sha = hashlib.sha256(out.read_bytes()).hexdigest()
                else:
                    webp_sha = '(dry-run)'
                entry[slot] = {
                    'src': f'assets/cards/{folder}/{slot}.webp',
                    'format': 'webp',
                    'width': im.width,
                    'height': im.height,
                    # 같은 그림 판정용: [브라우저 원본, 보낸 파일, 배포본] (중복 제거)
                'sha256': list(dict.fromkeys([h for h in (src_sha, sha, webp_sha) if h])),
                }
                lines.append(f"{slot} 새 그림 {im.width}×{im.height} {len(data)//1024}KB → {out.relative_to(ROOT)}" + (f' {out.stat().st_size//1024}KB' if not dry else ''))
            if card.get('imageTransform'):
                entry['imageTransform'] = card['imageTransform']
            if version >= 2 and card.get('stats') is not None:
                diff = check_stats(cid, card['stats'])
                if diff:
                    stat_overrides[cid] = diff
                else:
                    stat_overrides.pop(cid, None)
                lines.append('능력치 ' + (', '.join(f'{k} {v}' for k, v in diff.items()) if diff else '원본 그대로'))
            elif version >= 2:
                lines.append('능력치 바꾸지 않음')
            if version >= 4 and card.get('profile') is not None:
                pdiff = check_profile(cid, card['profile'])
                if pdiff:
                    profile_overrides[cid] = pdiff
                else:
                    profile_overrides.pop(cid, None)
                lines.append('설정 ' + (', '.join(f'{k} {v}' for k, v in pdiff.items()) if pdiff else '원본 그대로'))
            elif version >= 4:
                lines.append('설정 바꾸지 않음')
            if entry:
                baked[cid] = entry
            else:
                baked.pop(cid, None)
            report.append(' · '.join(lines))
    thumbs = refresh_thumbnails(baked, dry)
    if thumbs:
        report.append(f"썸네일 줄인 사본 {', '.join(str(w) for w in THUMB_WIDTHS)}px: {', '.join(thumbs)}")
    ordered = {k: baked[k] for k in sorted(baked)}
    if not dry:
        GENERATED.write_text(HEADER + json.dumps(ordered, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
        stats_ordered = {k: stat_overrides[k] for k in sorted(stat_overrides)}
        STATS_GENERATED.write_text(STATS_HEADER + json.dumps(stats_ordered, ensure_ascii=False, indent=2) + ';\n',
                                   encoding='utf-8')
        profile_ordered = {k: profile_overrides[k] for k in sorted(profile_overrides)}
        PROFILE_GENERATED.write_text(PROFILE_HEADER + json.dumps(profile_ordered, ensure_ascii=False, indent=2) + ';\n',
                                     encoding='utf-8')
        subprocess.run(['npx', 'prettier', '--write', str(GENERATED), str(STATS_GENERATED), str(PROFILE_GENERATED)],
                       cwd=ROOT, check=True, capture_output=True)
    print(f"{'(dry-run) ' if dry else ''}ZIP {len(args)}개 · 캐릭터 {total_cards}명")
    for r in report:
        print((' ' if r.startswith('[') else ' - ') + r)


main()
