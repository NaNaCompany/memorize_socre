"""Build an original 1200x630 social card. Requires Pillow and Korean system fonts.

No user-uploaded score, external image, font file or personal data is embedded.
Set --font-dir when the default Windows font directory is unavailable.
"""
from pathlib import Path
import argparse,hashlib,json,math
from PIL import Image,ImageDraw,ImageFont,ImageFilter

ROOT=Path(__file__).resolve().parents[1]
SLUG=ROOT.name
parser=argparse.ArgumentParser();parser.add_argument('--font-dir',default='C:/Windows/Fonts');args=parser.parse_args()
FONTS=Path(args.font_dir);S=3;W,H=1200,630
MEM=SLUG=='memorize_socre'
assert SLUG in {'memorize_socre','score_reading'}
TITLE='악보 암기' if MEM else '초견 도우미'
ACCENT='#ee9964' if MEM else '#bdabf4'
BG='#17201e';WHITE='#fffdf9';INK='#302923'
image=Image.new('RGB',(W*S,H*S),BG);draw=ImageDraw.Draw(image)
def font(size,bold=False,latin=False):
    return ImageFont.truetype(str(FONTS/('arialbd.ttf' if bold and latin else 'arial.ttf' if latin else 'malgunbd.ttf' if bold else 'malgun.ttf')),round(size*S))
def box(bounds,fill,radius=0,outline=None,width=1):
    bounds=tuple(round(v*S) for v in bounds)
    if radius:draw.rounded_rectangle(bounds,round(radius*S),fill=fill,outline=outline,width=round(width*S))
    else:draw.rectangle(bounds,fill=fill,outline=outline,width=round(width*S))
def line(points,fill,width=1):draw.line([(round(x*S),round(y*S)) for x,y in points],fill=fill,width=round(width*S))
def text(x,y,value,size=22,fill=INK,bold=False,latin=False):draw.text((x*S,y*S),value,font=font(size,bold,latin),fill=fill,anchor='lt')
def chip(x,y,label,fill='#28342f',color='#dfdcd5'):
    f=font(17,True);length=draw.textlength(label,font=f)/S;box((x,y,x+length+30,y+41),fill,20,outline='#3d4942');text(x+15,y+11,label,17,color,True);return x+length+40
def circle(cx,cy,r,fill):draw.ellipse(((cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S),fill=fill)
def staff(x,y,width,spacing=13,color='#d6d1c7'):
    for i in range(5):line([(x,y+i*spacing),(x+width,y+i*spacing)],color,1)
    line([(x,y),(x,y+4*spacing)],color,1);line([(x+width,y),(x+width,y+4*spacing)],color,1)
def note(x,y,color=INK,stem=35):
    head=Image.new('RGBA',(36*S,28*S));hd=ImageDraw.Draw(head);hd.ellipse((7*S,9*S,29*S,23*S),fill=color)
    head=head.rotate(20,resample=Image.Resampling.BICUBIC);image.paste(head,(round((x-18)*S),round((y-16)*S)),head)
    line([(x+9,y),(x+9,y-stem)],color,2)

# Subtle staff pattern and a warm/purple glow behind the paper illustration.
glow=Image.new('RGB',(W*S,H*S),BG);gd=ImageDraw.Draw(glow)
gd.ellipse((650*S,55*S,1290*S,650*S),fill='#55422f' if MEM else '#3f3b55')
glow=glow.filter(ImageFilter.GaussianBlur(95*S));image=Image.blend(image,glow,.43);draw=ImageDraw.Draw(image)
for row in range(5):line([(0,52+row*13),(1200,52+row*13)],'#22302a',1)
for x,y,r in [(535,105,3),(573,511,3),(108,503,2),(1163,586,3)]:circle(x,y,r,'#435146')
box((64,125,110,129),ACCENT,2)
text(64,83,'SCORE MEMORIZATION' if MEM else 'SIGHT-READING TOOLS',15,ACCENT,True,True)
text(60,172,TITLE,82,WHITE,True)
text(65,294,'마디 순서 · 음표 빈칸 · 악상 퀴즈' if MEM else '변화표 · 셈여림 · 표현 기호',23,'#d3d9d0')
text(65,333,'내 악보로 연습하고 진도 저장' if MEM else '색상 표시 · 악보 재생 · PDF 저장',23,'#d3d9d0')
x=64
for label in (['MusicXML','마디 퍼즐','진도 저장'] if MEM else ['MusicXML','색상 설정','PDF 출력']):x=chip(x,409,label)
text(65,550,'nanalab.kr',20,'#b3beb3',False,True)
line([(65,525),(486,525)],'#3a473e',1)

# Original vector-style paper components, drawn here rather than copied from a score.
shadow=Image.new('RGBA',(W*S,H*S));sd=ImageDraw.Draw(shadow)
sd.rounded_rectangle((655*S,85*S,1142*S,562*S),30*S,fill=(0,0,0,110));shadow=shadow.filter(ImageFilter.GaussianBlur(20*S));image.paste(shadow,(0,0),shadow);draw=ImageDraw.Draw(image)
box((650,72,1138,548),'#e4dfd3',28)
box((638,62,1126,538),WHITE,25,outline='#e5dfd5')
text(666,88,'마디 퍼즐' if MEM else '악보 색상 표시',21,INK,True)
box((1013,86,1100,116),'#f2eee6',15);text(1028,94,'MusicXML',11,'#766d62',True,True)
line([(660,133),(1105,133)],'#e9e3d9',1)
if MEM:
    for idx,(x,y) in enumerate([(662,155),(889,155),(662,303),(889,303)]):
        active=idx==1
        box((x,y,x+211,y+132),'#fff4e9' if active else '#fff',14,outline='#e1935c' if active else '#e5dfd6',width=2 if active else 1)
        text(x+14,y+11,f'{idx+1:02}',12,'#b16c3f' if active else '#a39b8e',True,True)
        staff(x+17,y+54,176,9)
        for j,offset in enumerate(([18,9,27,18] if idx%2==0 else [27,18,36,9])):note(x+42+j*38,y+54+offset,'#b56436' if active else INK,29)
    text(666,460,'순서 맞추기',15,'#776e64',True)
    text(1048,462,'2 / 4',14,'#a15b32',True,True)
    box((666,493,1098,503),'#ece5db',5);box((666,493,882,503),'#dd8d55',5)
else:
    text(667,153,'Allegretto',16,'#a3549b',True,True)
    staff(668,215,427,17)
    staff(668,355,427,17)
    for i,(offset,color) in enumerate([(17,'#00a1bb'),(34,INK),(51,INK),(25,'#b43b9f'),(42,INK),(8,'#00a1bb')]):
        note(702+i*68,215+offset,color,43)
    for i,offset in enumerate([34,17,51,34,8,25]):note(702+i*68,355+offset,INK,43)
    # Draw accidentals as paths: system Korean fonts do not always cover music glyphs.
    for x in (679,687):line([(x,217),(x,247)],'#00a1bb',2)
    line([(675,229),(692,224)],'#00a1bb',3);line([(675,240),(692,235)],'#00a1bb',3)
    line([(1020,208),(1020,234)],'#00a1bb',2);line([(1029,215),(1029,241)],'#00a1bb',2)
    line([(1020,221),(1029,216)],'#00a1bb',3);line([(1020,233),(1029,228)],'#00a1bb',3)
    text(684,308,'p',25,'#b43b9f',True,True);text(944,308,'f',25,'#b43b9f',True,True)
    line([(780,323),(886,314)],'#b43b9f',2);line([(780,323),(886,332)],'#b43b9f',2)
    for x,color,label in [(674,'#00a1bb','변화표'),(822,'#b43b9f','셈여림'),(966,'#9e7ce4','표현 기호')]:
        circle(x,482,5,color);text(x+13,473,label,15,'#776e64',True)

output=image.resize((W,H),Image.Resampling.LANCZOS)
temp=ROOT/'assets/og-card.png';output.save(temp,optimize=True)
digest=hashlib.sha256(temp.read_bytes()).hexdigest();target=temp.with_name('og-'+digest[:12]+'.png')
temp.replace(target)
manifest={'file':'assets/'+target.name,'width':W,'height':H,'type':'image/png','sha256':digest,'title':TITLE,'alt':TITLE+' — '+('마디 퍼즐과 암기 연습을 나타낸 악보 카드' if MEM else '변화표·셈여림·표현 기호를 색상으로 표시한 악보 카드'),'source':'Original procedural illustration; no uploaded score or external image used','generator':'tools/build_og.py','font_note':'Rendered with installed system fonts; no font files redistributed'}
(ROOT/'assets/og.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'image':manifest['file'],'width':W,'height':H,'bytes':target.stat().st_size},ensure_ascii=False))
