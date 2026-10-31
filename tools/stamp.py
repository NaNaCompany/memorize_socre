"""index.html의 ?v= 값을 현재 시각으로 갱신한다. 배포(커밋) 직전에 실행한다.

사용법: python tools/stamp.py
"""
import pathlib
import re
import time

path = pathlib.Path(__file__).resolve().parent.parent / "index.html"
html = path.read_text(encoding="utf-8")
stamp = time.strftime("%Y%m%d%H%M%S")
html, n = re.subn(r"\?v=[0-9A-Za-z]+", f"?v={stamp}", html)
path.write_text(html, encoding="utf-8", newline="")
print(f"{n}곳을 v={stamp}로 갱신")
