#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Convert LingTP用户使用手册.md -> LingTP用户使用手册.pdf via reportlab Platypus.

Reliable CJK rendering: SimHei (single TrueType) registered directly, and every
paragraph/table style uses wordWrap='CJK' so Chinese lines wrap without spaces.
"""
import os, re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, Preformatted, ListFlowable, ListItem,
                                HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

SRC = os.path.join(os.path.dirname(__file__), "LingTP用户使用手册.md")
OUT = os.path.join(os.path.dirname(__file__), "LingTP用户使用手册.pdf")

pdfmetrics.registerFont(TTFont("SimHei", r"C:/Windows/Fonts/simhei.ttf"))
CJK = "SimHei"
MONO = "Courier"

NAVY = colors.HexColor("#1f4e79")
NAVY_D = colors.HexColor("#173a5e")
BLUE = colors.HexColor("#2e6da4")
GRID = colors.HexColor("#b9c7d6")
LITE = colors.HexColor("#f5f8fb")
QUOTE = colors.HexColor("#f1f6fb")
CODEBG = colors.HexColor("#f4f6f8")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", lambda m: '<font name="Courier">%s</font>' % m.group(1), s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)  # drop link anchors
    s = s.replace("![fiber]", "")
    return s


def mk(name, **kw):
    base = dict(fontName=CJK, wordWrap="CJK", leading=14, spaceAfter=4)
    base.update(kw)
    return ParagraphStyle(name, **base)


styles = {
    "h1": mk("h1", fontSize=18, textColor=NAVY_D, spaceBefore=10, spaceAfter=6, leading=22),
    "h2": mk("h2", fontSize=13, textColor=NAVY, spaceBefore=10, spaceAfter=4, leading=17, leftIndent=2),
    "h3": mk("h3", fontSize=11, textColor=BLUE, spaceBefore=6, spaceAfter=3, leading=14),
    "h4": mk("h4", fontSize=10, textColor=colors.HexColor("#444444"), spaceBefore=4, spaceAfter=2, leading=13),
    "body": mk("body", fontSize=9.5, leading=14, spaceAfter=4),
    "cell": mk("cell", fontSize=8, leading=11),
    "cellh": mk("cellh", fontSize=8, leading=11, textColor=colors.white),
    "quote": mk("quote", fontSize=9, leading=13, leftIndent=10, backColor=QUOTE,
                borderColor=NAVY, borderWidth=0, borderPadding=5, spaceAfter=5),
    "code": ParagraphStyle("code", fontName=MONO, fontSize=8, leading=11,
                           backColor=CODEBG, borderPadding=5, leftIndent=4,
                           textColor=colors.HexColor("#222222")),
}

H = {"#": "h1", "##": "h2", "###": "h3", "####": "h4", "#####": "h4", "######": "h4"}


def split_row(s):
    s = s.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def is_sep(s):
    return bool(re.match(r"^\s*\|?[\s:\-\|]+\|?\s*$", s)) and "-" in s


with open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

flow = []
i, n = 0, len(lines)
while i < n:
    line = lines[i]
    if line.strip() == "":
        i += 1
        continue
    # code fence
    if line.strip().startswith("```"):
        buf = []
        i += 1
        while i < n and not lines[i].strip().startswith("```"):
            buf.append(lines[i])
            i += 1
        i += 1
        flow.append(Preformatted("\n".join(buf), styles["code"]))
        flow.append(Spacer(1, 5))
        continue
    # heading
    m = re.match(r"^(#{1,6})\s+(.*)$", line)
    if m:
        flow.append(Paragraph(inline(m.group(2).strip()), styles[H[m.group(1)]]))
        i += 1
        continue
    # horizontal rule
    if re.match(r"^-{3,}$", line.strip()):
        flow.append(HRFlowable(width="100%", thickness=0.6,
                               color=colors.HexColor("#cccccc"),
                               spaceBefore=4, spaceAfter=4))
        i += 1
        continue
    # blockquote
    if line.lstrip().startswith(">"):
        buf = []
        while i < n and lines[i].lstrip().startswith(">"):
            buf.append(lines[i].lstrip()[1:].strip())
            i += 1
        flow.append(Paragraph(inline(" ".join(buf)), styles["quote"]))
        continue
    # table
    if "|" in line and i + 1 < n and is_sep(lines[i + 1]):
        header = split_row(line)
        i += 2
        rows = []
        while i < n and "|" in lines[i] and lines[i].strip() != "":
            rows.append(split_row(lines[i]))
            i += 1
        data = [[Paragraph(inline(c), styles["cellh"]) for c in header]]
        for r in rows:
            data.append([Paragraph(inline(c), styles["cell"]) for c in r])
        tbl = Table(data, repeatRows=1, hAlign="LEFT", colWidths=[None] * len(header))
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("GRID", (0, 0), (-1, -1), 0.5, GRID),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LITE]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        flow.append(tbl)
        flow.append(Spacer(1, 5))
        continue
    # list
    is_ord = bool(re.match(r"^\s*\d+\.\s+", line))
    if re.match(r"^\s*[-*]\s+", line) or is_ord:
        items = []
        while i < n and (re.match(r"^\s*[-*]\s+", lines[i]) or re.match(r"^\s*\d+\.\s+", lines[i])):
            l = re.sub(r"^\s*([-*]|\d+\.)\s+", "", lines[i])
            items.append(ListItem(Paragraph(inline(l), styles["body"]), leftIndent=10, value=None))
            i += 1
        flow.append(ListFlowable(items, bulletType="1" if is_ord else "bullet",
                                 start="•" if not is_ord else "1", leftIndent=14))
        flow.append(Spacer(1, 2))
        continue
    # paragraph
    buf = [line]
    i += 1
    while (i < n and lines[i].strip() != "" and not lines[i].lstrip().startswith("#")
           and not lines[i].lstrip().startswith(">") and not lines[i].strip().startswith("```")
           and not re.match(r"^\s*[-*]\s+", lines[i]) and not re.match(r"^\s*\d+\.\s+", lines[i])
           and not ("|" in lines[i] and i + 1 < n and is_sep(lines[i + 1]))):
        buf.append(lines[i])
        i += 1
    flow.append(Paragraph(inline(" ".join(buf)), styles["body"]))

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                        topMargin=18 * mm, bottomMargin=18 * mm,
                        title="LingTP 网络拓扑管理平台 · 用户使用手册")
doc.build(flow)
print("OK ->", OUT, os.path.getsize(OUT), "bytes")
