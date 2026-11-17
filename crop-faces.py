"""Create head-and-shoulders crops without resizing or distorting the source."""
from pathlib import Path
from PIL import Image

root = Path(__file__).parent / 'dist'
output = root / 'faces-v5'
output.mkdir(exist_ok=True)
# Face center in each approved portrait; centers differ with character poses.
centers = {'oak': (.56, .17), 'fern': (.58, .24), 'moss': (.59, .20),
           'ember': (.54, .27), 'flare': (.49, .18), 'sun': (.56, .17),
           'tide': (.51, .20), 'dew': (.61, .22), 'moon': (.51, .20),
           'comet': (.56, .25)}
for name, (cx, cy) in centers.items():
    source = Image.open(root / 'portraits-v4' / f'{name}.webp')
    width = round(source.width * .56 / 4) * 4
    height = width * 5 // 4
    left = max(0, min(source.width - width, round(source.width * cx - width / 2)))
    top = max(0, min(source.height - height, round(source.height * cy - height * .4)))
    source.crop((left, top, left + width, top + height)).save(output / f'{name}.webp', quality=95)
    print(f'{name}: {width}x{height}')
