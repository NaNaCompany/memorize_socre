"""연습용 샘플 악보(작은 왈츠, 16마디)를 MusicXML로 만든다. 이 프로젝트용으로 새로 쓴 곡이다.

사용법: python tools/make_sample.py
"""
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "samples" / "little-waltz.musicxml"
DIV = 2  # 4분음표 = 2

TYPE = {1: "eighth", 2: "quarter", 3: "quarter", 4: "half", 6: "half"}


def note(pitch, dur, staff, voice, chord=False, rest=False, slur=None, art=None):
    x = ["<note>"]
    if chord:
        x.append("<chord/>")
    if rest:
        x.append("<rest/>")
    else:
        step, alter, octave = pitch
        x.append(f"<pitch><step>{step}</step>" + (f"<alter>{alter}</alter>" if alter else "") + f"<octave>{octave}</octave></pitch>")
    x.append(f"<duration>{dur}</duration><voice>{voice}</voice><type>{TYPE[dur]}</type>")
    if dur in (3, 6):
        x.append("<dot/>")
    x.append(f"<staff>{staff}</staff>")
    inner = ""
    if slur:
        inner += f'<slur type="{slur}" number="1"/>'
    if art:
        inner += f"<articulations><{art}/></articulations>"
    if inner:
        x.append(f"<notations>{inner}</notations>")
    x.append("</note>")
    return "".join(x)


def P(s):  # 'F#5' -> ('F', 1, 5)
    return (s[0], 1 if "#" in s else 0, int(s[-1]))


def direction(kind, value=None, staff=1, placement="below"):
    if kind == "dyn":
        body = f"<dynamics><{value}/></dynamics>"
    elif kind == "words":
        body = f"<words>{value}</words>"
    else:
        body = f'<wedge type="{value}" number="1"/>'
    return f'<direction placement="{placement}"><direction-type>{body}</direction-type><staff>{staff}</staff></direction>'


# 오른손: (음, 길이, 점) 목록과 마디별 표기. 길이 합은 항상 6.
RH = {
    1: [("B4", 2, "slur_start"), ("D5", 2, None), ("G5", 2, None)],
    2: [("F#5", 3, "accent"), ("E5", 1, None), ("D5", 2, "slur_stop")],
    3: [("C5", 2, "staccato"), ("E5", 2, "staccato"), ("A5", 2, None)],
    4: [("G5", 4, None), (None, 2, None)],
    5: [("D5", 1, "staccato slur_start"), ("E5", 1, "staccato"), ("F#5", 2, None), ("A5", 2, None)],
    6: [("G5", 2, None), ("F#5", 2, None), ("E5", 2, "slur_stop")],
    7: [("D5", 1, "staccato"), ("E5", 1, "staccato"), ("F#5", 2, None), ("G5", 2, None)],
    8: [("A5", 4, "tenuto"), (None, 2, None)],
    9: [("B4", 2, "slur_start"), ("D5", 2, None), ("G5", 2, None)],
    10: [("F#5", 3, "accent"), ("E5", 1, None), ("D5", 2, "slur_stop")],
    11: [("C5", 2, "staccato"), ("E5", 2, "staccato"), ("G5", 2, None)],
    12: [("G5", 6, "tenuto")],
    13: [("B5", 2, "accent slur_start"), ("A5", 2, None), ("G5", 2, None)],
    14: [("F#5", 2, None), ("E5", 2, None), ("D5", 2, "slur_stop")],
    15: [("C5", 2, None), ("B4", 2, None), ("A4", 2, None)],
    16: [("G4", 6, None)],
}

# 왼손: 첫 박 베이스 + 둘째·셋째 박 화음. (베이스, 화음 음들, 화음 길이 목록)
G = ["B3", "D4", "G4"]
D = ["A3", "D4", "F#4"]
C = ["G3", "C4", "E4"]
EM = ["G3", "B3", "E4"]
D7 = ["A3", "C4", "F#4"]
LH = {
    1: ("G2", G, [2, 2]), 2: ("D3", D, [2, 2]), 3: ("C3", C, [2, 2]), 4: ("G2", G, [4]),
    5: ("E2", EM, [2, 2]), 6: ("C3", C, [2, 2]), 7: ("D3", D, [2, 2]), 8: ("D3", D7, [4]),
    9: ("G2", G, [2, 2]), 10: ("D3", D, [2, 2]), 11: ("C3", C, [2, 2]), 12: ("G2", G, [4]),
    13: ("G2", G, [2, 2]), 14: ("D3", D, [2, 2]), 15: ("D3", D7, [2, 2]), 16: ("G2", G, [4]),
}

# 마디 앞에 붙는 악상 표기(오른손 오선 위 방향).
MARKS = {
    1: [("words", "Allegretto"), ("dyn", "mf")],
    5: [("dyn", "p"), ("words", "dolce")],
    9: [("dyn", "mf")],
    11: [("wedge", "crescendo")],
    13: [("wedge", "stop"), ("dyn", "f")],
    15: [("wedge", "diminuendo"), ("words", "rit.")],
    16: [("wedge", "stop"), ("dyn", "p")],
}


def rh_xml(m):
    out = []
    for pitch, dur, tag in RH[m]:
        tags = (tag or "").split()
        slur = "start" if "slur_start" in tags else "stop" if "slur_stop" in tags else None
        art = next((t for t in tags if t in ("staccato", "accent", "tenuto")), None)
        out.append(note(None, dur, 1, 1, rest=True) if pitch is None else note(P(pitch), dur, 1, 1, slur=slur, art=art))
    return "".join(out)


def lh_xml(m):
    bass, chord, durs = LH[m]
    out = [note(P(bass), 2, 2, 2)]
    for d in durs:
        out.append(note(P(chord[0]), d, 2, 2))
        out.extend(note(P(p), d, 2, 2, chord=True) for p in chord[1:])
    return "".join(out)


def measure(m):
    attrs = ""
    if m == 1:
        attrs = ("<attributes><divisions>2</divisions><key><fifths>1</fifths><mode>major</mode></key>"
                 "<time><beats>3</beats><beat-type>4</beat-type></time><staves>2</staves>"
                 '<clef number="1"><sign>G</sign><line>2</line></clef>'
                 '<clef number="2"><sign>F</sign><line>4</line></clef></attributes>')
    marks = "".join(
        direction(*(k, v), placement="above" if k == "words" else "below") for k, v in MARKS.get(m, []))
    if m == 1:
        marks += '<direction placement="above"><direction-type><words/></direction-type><sound tempo="108"/></direction>'
    return (f'<measure number="{m}">{attrs}{marks}{rh_xml(m)}'
            f"<backup><duration>6</duration></backup>{lh_xml(m)}</measure>")


def main():
    body = "".join(measure(m) for m in range(1, 17))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<score-partwise version="3.1">'
        "<movement-title>작은 왈츠 (연습용 샘플)</movement-title>"
        '<identification><creator type="composer">연습용 샘플</creator>'
        "<rights>이 프로젝트용으로 새로 쓴 곡입니다.</rights></identification>"
        '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>'
        f'<part id="P1">{body}</part></score-partwise>\n'
    )
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(xml, encoding="utf-8")
    print(f"{OUT} ({len(xml)} bytes, 16마디)")


if __name__ == "__main__":
    main()
