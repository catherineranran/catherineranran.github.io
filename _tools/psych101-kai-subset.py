"""Make the small Kai (楷体) font files used by /psych101/ (Chinese headings and titles).

The pages use 霞鹜文楷 LXGW WenKai (SIL OFL 1.1, https://github.com/lxgw/LxgwWenKai), cut down to only
the Chinese characters that appear on the two pages, and renamed "Psych101 Kai" because the licence
reserves the names "LXGW", "霞鹜" etc. for unmodified copies. The licence text sits next to the fonts
(psych101/fonts/OFL.txt).

Run it again after changing any Chinese text on psych101/index.html or psych101/en/index.html,
otherwise new characters show in the fallback serif:
    curl -sSLO https://github.com/lxgw/LxgwWenKai/releases/latest/download/LXGWWenKai-Regular.ttf
    curl -sSLO https://github.com/lxgw/LxgwWenKai/releases/latest/download/LXGWWenKai-Medium.ttf
    python3 _tools/psych101-kai-subset.py <folder with the two .ttf files>
Then bump ?v= on /psych101/styles.css in both pages.
"""
import pathlib, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent
PAGES = [REPO / 'psych101/index.html', REPO / 'psych101/en/index.html']
OUT = REPO / 'psych101/fonts'
CJK = re.compile('[　-〿㐀-䶿一-鿿＀-￯]')

def main(src):
    chars = sorted({c for page in PAGES for c in CJK.findall(page.read_text(encoding='utf-8'))})
    OUT.mkdir(exist_ok=True)
    for weight, style in ((400, 'Regular'), (500, 'Medium')):
        options = subset.Options()
        options.flavor = 'woff2'
        options.hinting = False
        options.desubroutinize = True
        options.layout_features = ['*']
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        font = subset.load_font(str(pathlib.Path(src) / f'LXGWWenKai-{style}.ttf'), options)
        sub = subset.Subsetter(options)
        sub.populate(unicodes=[ord(c) for c in chars])
        sub.subset(font)
        name = font['name']   # rename: the licence reserves "LXGW" for unmodified fonts
        for nid, text in ((1, 'Psych101 Kai'), (2, style), (3, f'Psych101Kai-{style}'),
                          (4, f'Psych101 Kai {style}'), (6, f'Psych101Kai-{style}')):
            name.setName(text, nid, 3, 1, 0x409)
            name.setName(text, nid, 1, 0, 0)
        name.names = [r for r in name.names if r.nameID not in (16, 17) and
                      (r.nameID in (0, 13, 14) or 'LXGW' not in r.toUnicode() and '霞鹜' not in r.toUnicode())]
        target = OUT / f'psych101-kai-{style.lower()}.woff2'
        subset.save_font(font, str(target), options)
        print(f'{target.relative_to(REPO)}: {len(chars)} characters, {target.stat().st_size // 1024} KB')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
