"""색상 표시가 들어간 MusicXML을 원본 악보 형태로 되돌린다.

색상 속성과 기본 notehead만 지운다. identification(인코딩 기록)은 건드리지 않는다.
사용법: python tools/clean_score.py <입력.musicxml> <출력.musicxml> "<곡 제목>" "<작곡가>"
"""
import re
import sys

src, dst, title, composer = sys.argv[1:5]
text = open(src, encoding="utf-8").read()
text = re.sub(r'\s+color="#[0-9a-fA-F]{6}"', "", text)
text = re.sub(r"<notehead>normal</notehead>", "", text)
header = (
    f"<movement-title>{title}</movement-title>\n"
    f'  <identification>\n    <creator type="composer">{composer}</creator>'
)
text = text.replace("<identification>", header, 1)
open(dst, "w", encoding="utf-8").write(text)
