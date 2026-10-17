"""Optional asset tool: pip install qrcode==8.2 Pillow zxing-cpp==2.3.0.
Run from the project root. No packages are needed by the running PWA.
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / '.cache' / 'qr-tools'))
import qrcode
import qrcode.image.svg
from PIL import Image, ImageDraw, ImageFont
import zxingcpp

url = 'https://exeterwasabi.github.io/taiwan-market-walk/'
out = root / 'public'
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=4)
qr.add_data(url)
qr.make(fit=True)
qr.make_image(fill_color='black', back_color='white').save(out / 'install-qr.png')
qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(out / 'install-qr.svg')
result = zxingcpp.read_barcode(Image.open(out / 'install-qr.png'))
assert result and result.text == url, 'QR decode did not match production URL'

# A printable share card; use a Traditional Chinese font supplied on the host.
font_candidates = [Path('C:/Windows/Fonts/msjh.ttc'), Path('/System/Library/Fonts/PingFang.ttc')]
font_path = next((p for p in font_candidates if p.exists()), None)
if font_path:
    card = Image.new('RGB', (1200, 1600), 'white')
    draw = ImageDraw.Draw(card)
    def text(y, value, size, color='#174c66'):
        font = ImageFont.truetype(str(font_path), size)
        draw.text((80, y), value, font=font, fill=color)
    draw.rectangle((0, 0, 1200, 22), fill='#174c66')
    text(65, '市集散步', 76)
    text(170, '掃碼開啟，加入手機主畫面', 38)
    code = Image.open(out / 'install-qr.png').convert('RGB')
    card.paste(code, ((1200-code.width)//2, 250))
    text(1010, 'iPhone', 38)
    text(1070, '用 Safari 開啟 → 分享 → 加入主畫面', 32, '#203d49')
    text(1150, 'Android', 38)
    text(1210, '用 Chrome 開啟 → 選單 → 安裝應用程式', 32, '#203d49')
    text(1310, '掃碼不會自動安裝，請在手機上確認加入。', 29, '#526a75')
    text(1390, 'exeterwasabi.github.io/taiwan-market-walk/', 30)
    text(1470, '每天約 06:20 更新活動資料（台灣時間）', 28, '#526a75')
    card.save(out / 'install-card.png')
    decoded = zxingcpp.read_barcode(card)
    assert decoded and decoded.text == url, 'Share card QR decode failed'
print('QR verified:', result.text)
