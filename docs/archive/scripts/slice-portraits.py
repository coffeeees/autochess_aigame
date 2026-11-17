"""Mechanically split the approved atlas; retain every panel's pixel proportions."""
from pathlib import Path
from PIL import Image

root = Path(__file__).parent
source = root / '../../outputs/starlight-character-lineup-v4-preview.png'
atlas = Image.open(source)
names = ['oak', 'fern', 'moss', 'ember', 'flare', 'sun', 'tide', 'dew', 'moon', 'comet']
output = root / 'dist/portraits-v4'
output.mkdir(exist_ok=True)
for index, name in enumerate(names):
    col, row = index % 5, index // 5
    box = (round(col * atlas.width / 5), round(row * atlas.height / 2),
           round((col + 1) * atlas.width / 5), round((row + 1) * atlas.height / 2))
    portrait = atlas.crop(box)
    portrait.save(output / f'{name}.webp', quality=95)
    print(f'{name}: {portrait.width}x{portrait.height}')
