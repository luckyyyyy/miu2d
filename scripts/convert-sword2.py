#!/usr/bin/env python3
"""
convert-sword2.py — 将 resources-sword2 转换为 resources-xin 兼容格式

用法:
    python3 scripts/convert-sword2.py [--dry-run] [--steps STEP1,STEP2,...] [--src DIR] [--dst DIR]
    python3 scripts/convert-sword2.py --no-rust         # 只运行 Python 步骤，跳过 Rust 转换器
    python3 scripts/convert-sword2.py --delete-originals  # 转换后删除原始二进制文件

步骤概览:
    1. copy        — 复制 resources-sword2 → resources-sword2-new
    2. lowercase   — 目录名统一小写 (Mpc/ → mpc/)
    3. encoding    — GBK → UTF-8 (.ini, .txt, .npc, .obj)  [Rust 转换器也会做，这里提前处理]
    4. npc_fields  — NPC INI 字段重命名 (Duck→Evade)
    5. portraits   — 生成 HeadFile.ini + 头像重命名映射
    6. talk        — talk.txt → TalkIndex.txt + 脚本 Talk("x") → Talk(start,end)
    7. npcres      — npcres 格式调整 (.mpc→.asf 引用, 移除 Shade)
    8. goods       — goods 格式调整 (.mpc→.asf 引用)
    9. magic       — magic 格式调整 (.mpc→.msf 引用);
                     注意: mpc/effect/ 的飞行/爆炸特效由 Rust 转换器以 palette-alpha
                     模式转换（支持半透明），mpc/magic/ 的图标保持二进制透明度
   10. save        — 存档格式适配 (Game.ini [Option] → option.ini)
   11. misc        — 杂项:
                     • MapName.ini / Rain.ini 生成
                     • font/ music/ sound/ video/ → Content/ 子目录 (对照 xin 结构)
                     • snap/ net/ 删除 (xin 格式不需要)
                     • asf/ 目录结构递归创建 (镜像 mpc/)
                     • map/bmp/ 目录创建
                     • ini/save/ ini/level/ 补全
                     • ini/ui/ ini/未找到的/ 中 .mpc → .msf 替换
                     • Content/ui/ui_settings.ini 从 ini/ui/ 真实文件动态生成 (全路径小写)
   12. map_tiles   — 为每张地图创建 msf/map/{mapName}/ 目录并复制对应 MSF tile (post-Rust)
   13. cleanup_mpc — 删除所有剩余 .mpc 原始文件 (最后一步)

完成后自动调用 Rust 转换器处理二进制格式:
    ASF → MSF v2  (精灵动画)
    MPC → MSF v2  (地图/UI 纹理)
    MAP → MMF     (地图数据)
    WMV → WebM    (过场动画, 需要 ffmpeg)
    WMA → OGG     (背景音乐, 需要 ffmpeg)
    GBK → UTF-8   (文本编码, Rust 二次确认)

使用 --no-rust 跳过 Rust 转换器。
"""

import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path

# ============================================================
# Config
# ============================================================

DEFAULT_SRC = "resources-sword2"
DEFAULT_DST = "resources-sword2-new"

# ============================================================
# UI Settings — 从 ini/ui/ 真实文件动态生成
# ============================================================


def build_sword2_ui_settings(root: str) -> str:
    """读取 root/ini/ui/{section}/*.ini，生成合并格式的 ui_settings.ini。

    所有路径输出全部小写，MPC 路径转为 asf/…/xxx.msf。
    Section 名称严格匹配 engine ui-settings.ts 中的解析器。
    """
    ui_base = os.path.join(root, "ini", "ui")

    def _rini(section: str, filename: str) -> dict:
        """解析 [Init] section，返回 key→value dict（key 全小写）。
        额外支持 [Items] section，存入 result["_items"]。
        """
        sec_dir = os.path.join(ui_base, section)
        if not os.path.isdir(sec_dir):
            sec_dir = os.path.join(ui_base, section.lower())
        path = ""
        # 大小写不敏感查找文件
        if os.path.isdir(sec_dir):
            for f in os.listdir(sec_dir):
                if f.lower() == filename.lower():
                    path = os.path.join(sec_dir, f)
                    break
        if not path or not os.path.exists(path):
            return {}
        try:
            content = open(path, encoding="utf-8").read()
        except Exception:
            try:
                content = open(path, encoding="gbk", errors="replace").read()
            except Exception:
                return {}
        result: dict = {}
        in_section = ""
        items: dict = {}
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("//") or stripped.startswith(";"):
                continue
            if stripped.startswith("["):
                in_section = stripped[1:].rstrip("]").lower()
            elif "=" in stripped:
                k, _, v = stripped.partition("=")
                k, v = k.strip(), v.strip()
                if in_section == "init":
                    result[k.lower()] = v
                elif in_section == "items":
                    items[k.strip()] = v.strip()
        if items:
            result["_items"] = items
        return result

    def _img(raw: str) -> str:
        """\\mpc\\ui\\title\\InitBtn.mpc  →  asf/ui/title/initbtn.msf (全小写)

        所有路径输出全小写。Rust 转换器保留原始文件名大小写，
        运行 step lowercase_asf 会将 asf/ 下所有文件名转为小写以匹配。
        """
        if not raw:
            return ""
        p = raw.replace("\\", "/").lstrip("/")
        if p.lower().startswith("mpc/"):
            p = "asf/" + p[4:]
        base, ext = os.path.splitext(p)
        if ext.lower() in (".mpc", ".asf"):
            p = base + ".msf"
        return p.lower()

    def _snd(raw: str) -> str:
        """\\sound\\界-主菜单.wav  →  界-主菜单.wav"""
        return os.path.basename(raw.replace("\\", "/")) if raw else ""

    lines: list[str] = []
    w = lines.append

    def _kv(k: str, v: str) -> None:
        if v:
            lines.append(f"{k}={v}")

    # ── GoodsInit ────────────────────────────────────────────
    w("[GoodsInit]")
    w("GoodsListType=0")
    w("StoreIndexBegin=1")
    w("StoreIndexEnd=198")
    w("EquipIndexBegin=201")
    w("EquipIndexEnd=207")
    w("BottomIndexBegin=221")
    w("BottomIndexEnd=223")
    w("")

    # ── MagicInit ────────────────────────────────────────────
    w("[MagicInit]")
    w("StoreIndexBegin=1")
    w("StoreIndexEnd=36")
    w("BottomIndexBegin=40")
    w("BottomIndexEnd=44")
    w("XiuLianIndex=49")
    w("HideStartIndex=1000")
    w("")

    # ── Title ────────────────────────────────────────────────
    # engine parseTitleGuiConfig: BackgroundImage 为空则返回 null
    # sword2 title 背景是 Window.ini 本身没有 Image，但有 mpc/ui/title/ 下的资源
    # 使用 title 背景图 (sword2 没有独立背景png，用 title window 的 panel 图)
    tw = _rini("title", "Window.ini")
    title_bg = _img(tw.get("image", ""))
    # 如果 Window.ini 没有背景图，检查 asf/ 和 mpc/ 下是否有 title 图片
    if not title_bg:
        for base_dir in ["asf", "mpc"]:
            for candidate in ["title.bmp", "title.png", "title.jpg", "title.asf", "title.mpc"]:
                cpath = os.path.join(root, base_dir, "ui", "title", candidate)
                if os.path.exists(cpath):
                    _, ext = os.path.splitext(candidate)
                    if ext.lower() in (".bmp", ".png", ".jpg"):
                        # 图片文件保持原始格式和路径
                        title_bg = f"{base_dir}/ui/title/{candidate}"
                    else:
                        title_bg = _img(f"\\{base_dir}\\ui\\title\\{candidate}")
                    break
            if title_bg:
                break
    w("[Title]")
    _kv("BackgroundImage", title_bg if title_bg else "asf/ui/title/title.msf")
    w("")

    for btn_file, section_key in [
        ("InitBtn.ini", "Title_Btn_Begin"),
        ("LoadBtn.ini", "Title_Btn_Load"),
        ("TeamBtn.ini", "Title_Btn_Team"),
        ("ExitBtn.ini", "Title_Btn_Exit"),
    ]:
        d = _rini("title", btn_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        _kv("Image", _img(d.get("image", "")))
        _kv("Sound", _snd(d.get("sound", "")))
        w("")

    # ── SaveLoad ─────────────────────────────────────────────
    sw = _rini("saveload", "Window.ini")
    w("[SaveLoad]")
    _kv("Image", _img(sw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    snap = _rini("saveload", "SnapBmp.ini")
    w("[Save_Snapshot]")
    _kv("Left", snap.get("left", ""))
    _kv("Top", snap.get("top", ""))
    _kv("Width", snap.get("width", ""))
    _kv("Height", snap.get("height", ""))
    w("")

    lb = _rini("saveload", "ListBox.ini")
    items_d = lb.get("_items", {})
    items_text = "/".join(v for k, v in sorted(items_d.items()) if k.isdigit())
    w("[SaveLoad_Text_List]")
    _kv("Text", items_text)
    _kv("Left", lb.get("left", ""))
    _kv("Top", lb.get("top", ""))
    _kv("Width", lb.get("width", ""))
    _kv("Height", lb.get("height", ""))
    w("CharSpace=2")
    w("LineSpace=0")
    _kv("ItemHeight", lb.get("itemheight", ""))
    _kv("Color", lb.get("color", ""))
    _kv("SelectedColor", lb.get("selcolor", ""))
    _kv("Sound", _snd(lb.get("sound", "")))
    w("")

    for btn_file, section_key in [
        ("LoadBtn.ini", "SaveLoad_Load_Btn"),
        ("SaveBtn.ini", "SaveLoad_Save_Btn"),
        ("ExitBtn.ini", "SaveLoad_Exit_Btn"),
    ]:
        d = _rini("saveload", btn_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        _kv("Image", _img(d.get("image", "")))
        _kv("Sound", _snd(d.get("sound", "")))
        w("")

    # SaveLoad_Save_Time_Text / SaveLoad_Message_Line_Text — sword2 无对应文件，保留默认
    w("[SaveLoad_Save_Time_Text]")
    w("Left=272")
    w("Top=124")
    w("Width=350")
    w("Height=30")
    w("CharSpace=1")
    w("LineSpace=0")
    w("Color=136,12,2,178")
    w("")
    w("[SaveLoad_Message_Line_Text]")
    w("Left=0")
    w("Top=440")
    w("Width=640")
    w("Height=40")
    w("Align=1")
    w("Color=255,215,0,204")
    w("")

    # ── System ───────────────────────────────────────────────
    sysw = _rini("system", "Window.ini")
    w("[System]")
    _kv("Image", _img(sysw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    for btn_file, section_key in [
        ("SaveLoad.ini", "System_SaveLoad_Btn"),
        ("Option.ini", "System_Option_Btn"),
        ("Quit.ini", "System_Exit_Btn"),
        ("Return.ini", "System_Return_Btn"),
    ]:
        d = _rini("system", btn_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        _kv("Image", _img(d.get("image", "")))
        _kv("Sound", _snd(d.get("sound", "")))
        w("")

    # ── BottomState (column / status bars) ───────────────────
    cw = _rini("column", "Window.ini")
    w("[BottomState]")
    _kv("Image", _img(cw.get("image", "")))
    _kv("Width", cw.get("width", "640"))
    _kv("Height", cw.get("height", ""))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    for col_file, section_key in [
        ("ColLife.ini", "BottomState_Life"),
        ("ColThew.ini", "BottomState_Thew"),
        ("ColMana.ini", "BottomState_Mana"),
    ]:
        d = _rini("column", col_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        _kv("Image", _img(d.get("image", "")))
        w("")

    # ── Top (button bar — uses bottom window image) ───────────
    bw = _rini("bottom", "Window.ini")
    w("[Top]")
    _kv("Image", _img(bw.get("image", "")))
    w("LeftAdjust=-276")
    w("TopAdjust=0")
    w("Anchor=Bottom")
    w("")

    for btn_file, section_key in [
        ("BtnState.ini", "Top_State_Btn"),
        ("BtnEquip.ini", "Top_Equip_Btn"),
        ("BtnXiuLian.ini", "Top_XiuLian_Btn"),
        ("BtnGoods.ini", "Top_Goods_Btn"),
        ("BtnMagic.ini", "Top_Magic_Btn"),
        ("BtnNotes.ini", "Top_Memo_Btn"),
        ("BtnOption.ini", "Top_System_Btn"),
    ]:
        d = _rini("bottom", btn_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        _kv("Image", _img(d.get("image", "")))
        _kv("Sound", _snd(d.get("sound", "")))
        w("")

    # ── Bottom (quickbar items) ───────────────────────────────
    w("[Bottom]")
    _kv("Image", _img(bw.get("image", "")))
    w("LeftAdjust=-87")
    w("TopAdjust=0")
    w("")

    w("[Bottom_Items]")
    for i in range(1, 9):
        d = _rini("bottom", f"Item{i}.ini")
        if not d:
            continue
        w(f"Item_Left_{i}={d.get('left', '')}")
        w(f"Item_Top_{i}={d.get('top', '')}")
        w(f"Item_Width_{i}={d.get('width', '')}")
        w(f"Item_Height_{i}={d.get('height', '')}")
    w("")

    # ── Dialog ───────────────────────────────────────────────
    dw = _rini("dialog", "Window.ini")
    w("[Dialog]")
    _kv("Image", _img(dw.get("image", "")))
    w("LeftAdjust=-20")
    w("TopAdjust=-208")
    w("")

    # sword2 dialog 无独立 Txt/SelA/SelB ini 文件 — 使用 xin 默认值
    w("[Dialog_Txt]")
    w("Left=80")
    w("Top=15")
    w("Width=400")
    w("Height=60")
    w("CharSpace=-2")
    w("LineSpace=0")
    w("Color=255,255,255,204")
    w("")
    w("[Dialog_SelA]")
    w("Left=90")
    w("Top=30")
    w("Width=380")
    w("Height=20")
    w("CharSpace=1")
    w("LineSpace=0")
    w("Color=0,0,255,204")
    w("")
    w("[Dialog_SelB]")
    w("Left=90")
    w("Top=52")
    w("Width=380")
    w("Height=20")
    w("CharSpace=1")
    w("LineSpace=0")
    w("Color=0,0,255,204")
    w("")

    # engine parseDialogGuiConfig 需要 Dialog_Portrait
    dh = _rini("dialog", "Head1.ini")
    w("[Dialog_Portrait]")
    _kv("Left", dh.get("left", "0"))
    # Top 使用负值使头像显示在对话框上方（与 xin 行为一致）
    w("Top=-200")
    _kv("Width", dh.get("width", "500"))
    _kv("Height", dh.get("height", "200"))
    w("")

    # ── State panel ──────────────────────────────────────────
    si = _rini("state", "Image.ini")
    w("[State]")
    _kv("Image", _img(si.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    for ini_file, section_key in [
        ("Lab等级.ini", "State_Level"),
        ("lab经验.ini", "State_Exp"),
        ("lab升级.ini", "State_LevelUp"),
        ("Lab生命.ini", "State_Life"),
        ("lab体力.ini", "State_Thew"),
        ("Lab内力.ini", "State_Mana"),
        ("Lab攻击.ini", "State_Attack"),
        ("Lab防御.ini", "State_Defend"),
        ("Lab闪避.ini", "State_Evade"),
    ]:
        d = _rini("state", ini_file)
        if not d:
            continue
        w(f"[{section_key}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        w("CharSpace=0")
        w("LineSpace=0")
        _kv("Color", d.get("color", ""))
        w("")

    # ── Equip ────────────────────────────────────────────────
    # engine equipSlotsFrom 读取 ${prefix}_Head/Neck/Body/Back/Hand/Wrist/Foot
    ei = _rini("equip", "Image.ini")
    w("[Equip]")
    _kv("Image", _img(ei.get("image", "")))
    w("LeftAdjust=-150")
    w("TopAdjust=0")
    w("")

    equip_slot_names = [
        "Equip_Head", "Equip_Neck", "Equip_Wrist",
        "Equip_Body", "Equip_Hand", "Equip_Foot", "Equip_Back",
    ]
    equip_slot_data: list[dict] = []
    for i, slot_name in enumerate(equip_slot_names, 1):
        d = _rini("equip", f"Item{i}.ini")
        equip_slot_data.append(d)
        if not d:
            continue
        w(f"[{slot_name}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        w("")

    # ── NpcEquip ─────────────────────────────────────────────
    # engine parseNpcEquipGuiConfig 需要 [NpcEquip] + 7 个 slot
    # sword2 没有独立 npcequip 文件夹，复用 Equip 布局
    w("[NpcEquip]")
    _kv("Image", _img(ei.get("image", "")))
    w("LeftAdjust=-150")
    w("TopAdjust=0")
    w("")

    npc_equip_slot_names = [
        "NpcEquip_Head", "NpcEquip_Neck", "NpcEquip_Wrist",
        "NpcEquip_Body", "NpcEquip_Hand", "NpcEquip_Foot", "NpcEquip_Back",
    ]
    for slot_name, d in zip(npc_equip_slot_names, equip_slot_data):
        if not d:
            continue
        w(f"[{slot_name}]")
        _kv("Left", d.get("left", ""))
        _kv("Top", d.get("top", ""))
        _kv("Width", d.get("width", ""))
        _kv("Height", d.get("height", ""))
        w("")

    # ── XiuLian ──────────────────────────────────────────────
    # engine parseXiuLianGuiConfig 需要:
    #   [XiuLian] - panel
    #   [XiuLian_Magic_Image] - rectFrom (武功图标位置)
    #   [XiuLian_Level_Text] - textFrom
    #   [XiuLian_Exp_Text] - textFrom
    #   [XiuLian_Name_Text] - textFrom
    #   [XiuLian_Intro_Text] - textFrom
    xw = _rini("xiulian", "Window.ini")
    w("[XiuLian]")
    _kv("Image", _img(xw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    # [XiuLian_Magic_Image] — 从 Magic.ini 读取武功图标位置
    xm = _rini("xiulian", "Magic.ini")
    w("[XiuLian_Magic_Image]")
    _kv("Left", xm.get("left", "10"))
    _kv("Top", xm.get("top", "9"))
    _kv("Width", xm.get("width", "30"))
    _kv("Height", xm.get("height", "38"))
    w("")

    # [XiuLian_Level_Text] — 从 Level.ini 读取
    xl = _rini("xiulian", "Level.ini")
    w("[XiuLian_Level_Text]")
    _kv("Left", xl.get("left", "142"))
    _kv("Top", xl.get("top", "52"))
    _kv("Width", xl.get("width", "80"))
    _kv("Height", xl.get("height", "12"))
    w("CharSpace=0")
    w("LineSpace=0")
    _kv("Color", xl.get("color", "255,255,255"))
    w("")

    # [XiuLian_Exp_Text] — 从 Exp.ini 读取
    xe = _rini("xiulian", "Exp.ini")
    w("[XiuLian_Exp_Text]")
    _kv("Left", xe.get("left", "142"))
    _kv("Top", xe.get("top", "79"))
    _kv("Width", xe.get("width", "80"))
    _kv("Height", xe.get("height", "12"))
    w("CharSpace=0")
    w("LineSpace=0")
    _kv("Color", xe.get("color", "255,255,255"))
    w("")

    # [XiuLian_Name_Text] — 从 Name.ini 读取
    xn = _rini("xiulian", "Name.ini")
    w("[XiuLian_Name_Text]")
    _kv("Left", xn.get("left", "40"))
    _kv("Top", xn.get("top", "106"))
    _kv("Width", xn.get("width", "200"))
    _kv("Height", xn.get("height", "20"))
    w("CharSpace=0")
    w("LineSpace=0")
    _kv("Color", xn.get("color", "250,220,200"))
    w("")

    # [XiuLian_Intro_Text] — 从 Intro.ini 读取
    xi_intro = _rini("xiulian", "Intro.ini")
    w("[XiuLian_Intro_Text]")
    _kv("Left", xi_intro.get("left", "40"))
    _kv("Top", xi_intro.get("top", "133"))
    _kv("Width", xi_intro.get("width", "160"))
    _kv("Height", xi_intro.get("height", "120"))
    w("CharSpace=0")
    w("LineSpace=0")
    _kv("Color", xi_intro.get("color", "220,180,130"))
    w("")

    # ── Goods ────────────────────────────────────────────────
    # engine parseGoodsGuiConfig 需要:
    #   [Goods] — panel + scrollBarFrom (ScrollBarLeft/ScrollBarRight/ScrollBarWidth/ScrollBarHeight/ScrollBarButton)
    #   [Goods_List_Items] — 9 个物品格子
    #   [Goods_Money] — 金钱显示
    gw = _rini("goods", "Window.ini")
    gsb = _rini("goods", "ScrollBar.ini")
    gslide = _rini("goods", "SlideBtn.ini")
    w("[Goods]")
    _kv("Image", _img(gw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    # 滚动栏: engine scrollBarFrom 读取 ScrollBarLeft/ScrollBarRight(=top)/ScrollBarWidth/ScrollBarHeight/ScrollBarButton
    _kv("ScrollBarLeft", gsb.get("left", "178"))
    _kv("ScrollBarRight", gsb.get("top", "40"))
    _kv("ScrollBarWidth", gsb.get("width", "28"))
    _kv("ScrollBarHeight", gsb.get("height", "180"))
    _kv("ScrollBarButton", _img(gslide.get("image", "")) or "asf/ui/goods/slidebtn.msf")
    w("")

    # engine 需要 [Goods_List_Items]（注意 _List_Items 后缀）
    w("[Goods_List_Items]")
    for i in range(1, 10):
        d = _rini("goods", f"Item{i}.ini")
        if not d:
            continue
        w(f"Item_Left_{i}={d.get('left', '')}")
        w(f"Item_Top_{i}={d.get('top', '')}")
        w(f"Item_Width_{i}={d.get('width', '')}")
        w(f"Item_Height_{i}={d.get('height', '')}")
    w("")

    # [Goods_Money] — 金钱显示位置
    gm = _rini("goods", "money.ini")
    w("[Goods_Money]")
    _kv("Left", gm.get("left", "100"))
    _kv("Top", gm.get("top", "230"))
    _kv("Width", gm.get("width", "100"))
    _kv("Height", gm.get("height", "12"))
    _kv("Color", gm.get("color", "250,250,250"))
    w("")

    # ── Magics ───────────────────────────────────────────────
    # engine parseMagicsGuiConfig 需要:
    #   [Magics] — panel + scrollBarFrom
    #   [Magics_List_Items] — 9 个物品格子
    mw = _rini("magic", "Window.ini")
    msb = _rini("magic", "ScrollBar.ini")
    mslide = _rini("magic", "SlideBtn.ini")
    w("[Magics]")
    _kv("Image", _img(mw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    _kv("ScrollBarLeft", msb.get("left", "178"))
    _kv("ScrollBarRight", msb.get("top", "40"))
    _kv("ScrollBarWidth", msb.get("width", "28"))
    _kv("ScrollBarHeight", msb.get("height", "180"))
    _kv("ScrollBarButton", _img(mslide.get("image", "")) or "asf/ui/option/slidebtn.msf")
    w("")

    # engine 需要 [Magics_List_Items]（注意 _List_Items 后缀）
    w("[Magics_List_Items]")
    for i in range(1, 10):
        d = _rini("magic", f"Item{i}.ini")
        if not d:
            d = _rini("goods", f"Item{i}.ini")  # fallback: magic 和 goods grid 尺寸相同
        if not d:
            continue
        w(f"Item_Left_{i}={d.get('left', '')}")
        w(f"Item_Top_{i}={d.get('top', '')}")
        w(f"Item_Width_{i}={d.get('width', '')}")
        w(f"Item_Height_{i}={d.get('height', '')}")
    w("")

    # ── Memo (Notes) ─────────────────────────────────────────
    # engine parseMemoGuiConfig 需要:
    #   [Memo] — panel
    #   [Memo_Text] — textFrom
    #   [Memo_Slider] — rectFrom + Image_Btn
    memow = _rini("memo", "Window.ini")
    w("[Memo]")
    _kv("Image", _img(memow.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    # [Memo_Text] — 从 memo.ini 读取（memo/memo.ini 是文字区域）
    mt = _rini("memo", "memo.ini")
    w("[Memo_Text]")
    _kv("Left", mt.get("left", "12"))
    _kv("Top", mt.get("top", "18"))
    _kv("Width", mt.get("width", "132"))
    _kv("Height", mt.get("height", "160"))
    w("CharSpace=0")
    w("LineSpace=0")
    _kv("Color", mt.get("color", "250,200,150"))
    w("")

    # [Memo_Slider] — 从 ScrollBar.ini / SlideBtn.ini 读取
    memo_sb = _rini("memo", "ScrollBar.ini")
    memo_slide = _rini("memo", "SlideBtn.ini")
    w("[Memo_Slider]")
    _kv("Left", memo_sb.get("left", "158"))
    _kv("Top", memo_sb.get("top", "0"))
    _kv("Width", memo_slide.get("width", "18"))
    _kv("Height", memo_slide.get("height", "30"))
    _kv("Image_Btn", _img(memo_slide.get("image", "")) or "asf/ui/goods/slidebtn.msf")
    w("")

    # ── Message ──────────────────────────────────────────────
    # engine parseMessageGuiConfig 需要 [Message] + [Message_Text]
    msgw = _rini("message", "Window.ini")
    w("[Message]")
    _kv("Image", _img(msgw.get("image", "")))
    w("LeftAdjust=-40")
    w("TopAdjust=-110")
    w("")

    msgl = _rini("message", "Label.ini")
    w("[Message_Text]")
    _kv("Left", msgl.get("left", "30"))
    _kv("Top", msgl.get("top", "20"))
    _kv("Width", msgl.get("width", "220"))
    _kv("Height", msgl.get("height", "40"))
    _kv("Color", msgl.get("color", "241,241,241,204"))
    _kv("CharSpace", msgl.get("charspace", "0"))
    w("LineSpace=1")
    w("")

    # ── ToolTip ──────────────────────────────────────────────
    # engine 需要 [ToolTip_Use_Type] 和 [ToolTip_Type2]
    # sword2 使用 Type2 风格（类似新剑侠情缘）
    w("[ToolTip_Use_Type]")
    w("UseType=2")
    w("")

    # [ToolTip_Type2] — 颜色配置
    w("[ToolTip_Type2]")
    w("Width=288")
    w("TextHorizontalPadding=6")
    w("TextVerticalPadding=4")
    w("BackgroundColor=0,0,0,160")
    w("MagicNameColor=225,225,110,160")
    w("MagicLevelColor=255,255,255,160")
    w("MagicIntroColor=255,255,255,160")
    w("GoodNameColor=245,233,171,160")
    w("GoodPriceColor=255,255,255,160")
    w("GoodUserColor=255,255,255,160")
    w("GoodPropertyColor=255,255,255,160")
    w("GoodIntroColor=255,255,255,160")
    w("")

    # ── BuySell ──────────────────────────────────────────────
    # engine parseBuySellGuiConfig 需要:
    #   [BuySell] — panel + scrollBarFrom + CloseLeft/CloseTop/CloseImage/CloseSound
    #   [BuySell_List_Items] — 9 个物品格子
    bsw = _rini("buysell", "Window.ini")
    bssb = _rini("buysell", "ScrollBar.ini")
    bsslide = _rini("buysell", "SlideBtn.ini")
    bsclose = _rini("buysell", "CloseBtn.ini")
    w("[BuySell]")
    _kv("Image", _img(bsw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    _kv("ScrollBarLeft", bssb.get("left", "178"))
    _kv("ScrollBarRight", bssb.get("top", "40"))
    _kv("ScrollBarWidth", bssb.get("width", "28"))
    _kv("ScrollBarHeight", bssb.get("height", "180"))
    _kv("ScrollBarButton", _img(bsslide.get("image", "")) or "asf/ui/option/slidebtn.msf")
    _kv("CloseImage", _img(bsclose.get("image", "")))
    _kv("CloseSound", _snd(bsclose.get("sound", "")))
    _kv("CloseLeft", bsclose.get("left", "203"))
    _kv("CloseTop", bsclose.get("top", "225"))
    w("")

    # engine 需要 [BuySell_List_Items]（注意 _List_Items 后缀）
    w("[BuySell_List_Items]")
    for i in range(1, 10):
        d = _rini("buysell", f"Item{i}.ini")
        if not d:
            continue
        w(f"Item_Left_{i}={d.get('left', '')}")
        w(f"Item_Top_{i}={d.get('top', '')}")
        w(f"Item_Width_{i}={d.get('width', '')}")
        w(f"Item_Height_{i}={d.get('height', '')}")
    w("")

    # ── LittleMap ────────────────────────────────────────────
    # engine parseLittleMapGuiConfig — sword2 无小地图资源，
    # 不输出 [LittleMap] 等 section，engine 会使用内置默认值

    # ── YesNo ────────────────────────────────────────────────
    ynw = _rini("yesno", "Window.ini")
    w("[YesNo]")
    _kv("Image", _img(ynw.get("image", "")))
    w("LeftAdjust=0")
    w("TopAdjust=0")
    w("")

    yy = _rini("yesno", "BtnYes.ini")
    w("[YesNo_Yes_Btn]")
    _kv("Left", yy.get("left", ""))
    _kv("Top", yy.get("top", ""))
    _kv("Width", yy.get("width", ""))
    _kv("Height", yy.get("height", ""))
    _kv("Image", _img(yy.get("image", "")))
    w("")

    yn = _rini("yesno", "BtnNo.ini")
    w("[YesNo_No_Btn]")
    _kv("Left", yn.get("left", ""))
    _kv("Top", yn.get("top", ""))
    _kv("Width", yn.get("width", ""))
    _kv("Height", yn.get("height", ""))
    _kv("Image", _img(yn.get("image", "")))
    w("")

    # ── NpcInfoShow / Mouse ───────────────────────────────────
    w("[NpcInfoShow]")
    w("Width=300")
    w("Height=25")
    w("LeftAdjust=0")
    w("TopAdjust=50")
    w("")

    w("[Mouse]")
    mouse_common = _rini("common", "mouse.ini") if os.path.isdir(os.path.join(ui_base, "common")) else {}
    mouse_img = _img(mouse_common.get("image", "")) if mouse_common else "asf/ui/common/mouse.msf"
    w(f"Image={mouse_img if mouse_img else 'asf/ui/common/mouse.msf'}")
    w("")

    return "\n".join(lines)


ALL_STEPS = [
    "copy", "lowercase", "encoding", "npc_fields", "portraits",
    "talk", "npcres", "goods", "magic", "save", "misc", "convert_video",
    "move_sprites", "map_tiles", "cleanup_mpc", "lowercase_asf",
]

# MPC subdirectories that contain sprites (should become asf/) vs map tiles (stay in mpc/)
MPC_SPRITE_DIRS = ["character", "effect", "goods", "magic", "object", "portrait", "ui"]

# Portrait name → numeric ID mapping (auto-generated, can be overridden)
# We'll build this dynamically from Mpc/portrait/ contents


# ============================================================
# Utilities
# ============================================================

class Stats:
    def __init__(self):
        self.files_copied = 0
        self.files_renamed = 0
        self.files_converted = 0
        self.files_created = 0
        self.errors = []

    def summary(self):
        print(f"\n{'='*60}")
        print(f"转换统计:")
        print(f"  复制文件: {self.files_copied}")
        print(f"  重命名:   {self.files_renamed}")
        print(f"  转换:     {self.files_converted}")
        print(f"  新建:     {self.files_created}")
        if self.errors:
            print(f"  错误:     {len(self.errors)}")
            for e in self.errors[:20]:
                print(f"    - {e}")
            if len(self.errors) > 20:
                print(f"    ... 和 {len(self.errors) - 20} 个更多错误")
        print(f"{'='*60}")


stats = Stats()
DRY_RUN = False


def log(msg: str):
    print(f"  {msg}")


def log_step(step: str, desc: str):
    print(f"\n{'='*60}")
    print(f"Step: {step} — {desc}")
    print(f"{'='*60}")


def read_gbk(filepath: str) -> str:
    """读取 GBK 或 UTF-8 编码的文本文件"""
    with open(filepath, "rb") as f:
        data = f.read()

    # Try UTF-8 first
    try:
        text = data.decode("utf-8")
        # Check if it looks like valid Chinese UTF-8 (not GBK bytes accidentally valid)
        if has_cjk_chars(text) or data == data.decode("ascii", errors="ignore").encode("ascii", errors="ignore"):
            return text
    except UnicodeDecodeError:
        pass

    # Fall back to GBK
    try:
        return data.decode("gbk")
    except UnicodeDecodeError:
        return data.decode("gbk", errors="replace")


def has_cjk_chars(text: str) -> bool:
    """检查文本是否包含 CJK 字符"""
    for ch in text:
        cp = ord(ch)
        if (0x4E00 <= cp <= 0x9FFF or  # CJK Unified
            0x3400 <= cp <= 0x4DBF or  # CJK Extension A
            0x3000 <= cp <= 0x303F or  # CJK Punctuation
            0xFF00 <= cp <= 0xFFEF):   # Fullwidth
            return True
    return False


def looks_like_valid_chinese_utf8(data: bytes) -> bool:
    """判断二进制数据是否是有效的中文 UTF-8"""
    try:
        text = data.decode("utf-8")
        return has_cjk_chars(text)
    except UnicodeDecodeError:
        return False


def write_file(filepath: str, content: str, encoding: str = "utf-8"):
    """写入文件（支持 dry-run）"""
    if DRY_RUN:
        log(f"[DRY-RUN] 写入 {filepath} ({len(content)} chars)")
        return
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding=encoding, newline="\n") as f:
        f.write(content)


def parse_ini_sections(text: str) -> OrderedDict:
    """
    解析 INI 格式文件，返回 {section_name: OrderedDict(key=value)}
    保留注释行和空行作为特殊 key
    """
    sections = OrderedDict()
    current_section = None
    comment_idx = 0

    for line in text.split("\n"):
        stripped = line.strip()

        # Section header
        m = re.match(r"^\[(.+?)\]", stripped)
        if m:
            current_section = m.group(1)
            if current_section not in sections:
                sections[current_section] = OrderedDict()
            continue

        # Skip lines before first section
        if current_section is None:
            # Store pre-section content
            if "_HEADER_" not in sections:
                sections["_HEADER_"] = OrderedDict()
            sections["_HEADER_"][f"_comment_{comment_idx}"] = line.rstrip("\r")
            comment_idx += 1
            continue

        # Key=Value
        m = re.match(r"^([^=]+?)=(.*)", stripped)
        if m:
            key = m.group(1).strip()
            value = m.group(2).strip()
            sections[current_section][key] = value
        elif stripped.startswith(";") or stripped == "":
            sections[current_section][f"_comment_{comment_idx}"] = line.rstrip("\r")
            comment_idx += 1
        else:
            # Non-standard line, preserve as comment
            sections[current_section][f"_line_{comment_idx}"] = line.rstrip("\r")
            comment_idx += 1

    return sections


def serialize_ini(sections: OrderedDict) -> str:
    """将 sections dict 序列化为 INI 字符串"""
    lines = []

    for section_name, entries in sections.items():
        if section_name == "_HEADER_":
            for key, value in entries.items():
                if key.startswith("_comment_") or key.startswith("_line_"):
                    lines.append(value)
            continue

        lines.append(f"[{section_name}]")
        for key, value in entries.items():
            if key.startswith("_comment_") or key.startswith("_line_"):
                lines.append(value)
            else:
                lines.append(f"{key}={value}")

    return "\n".join(lines) + "\n"


# ============================================================
# Step 1: Copy
# ============================================================

def step_copy(src: str, dst: str):
    log_step("copy", f"复制 {src} → {dst}")

    if os.path.exists(dst):
        log(f"目标目录 {dst} 已存在，跳过复制")
        return

    if DRY_RUN:
        log(f"[DRY-RUN] shutil.copytree({src}, {dst})")
        return

    log(f"正在复制...")
    shutil.copytree(src, dst)
    total = sum(len(files) for _, _, files in os.walk(dst))
    stats.files_copied = total
    log(f"复制完成，共 {total} 个文件")


# ============================================================
# Step 2: Lowercase directory names
# ============================================================

def step_lowercase(root: str):
    log_step("lowercase", "目录名统一小写 (Mpc/ → mpc/)")

    # Only rename top-level directories that have uppercase
    for entry in sorted(os.listdir(root)):
        full_path = os.path.join(root, entry)
        if os.path.isdir(full_path) and entry != entry.lower():
            new_path = os.path.join(root, entry.lower())
            if os.path.exists(new_path):
                log(f"目标已存在，合并 {entry}/ → {entry.lower()}/")
                if not DRY_RUN:
                    # Merge: move all files from entry/ to entry.lower()/
                    for dirpath, dirnames, filenames in os.walk(full_path):
                        rel = os.path.relpath(dirpath, full_path)
                        target_dir = os.path.join(new_path, rel)
                        os.makedirs(target_dir, exist_ok=True)
                        for fn in filenames:
                            src_file = os.path.join(dirpath, fn)
                            dst_file = os.path.join(target_dir, fn)
                            if not os.path.exists(dst_file):
                                shutil.move(src_file, dst_file)
                    shutil.rmtree(full_path)
            else:
                log(f"重命名 {entry}/ → {entry.lower()}/")
                if not DRY_RUN:
                    os.rename(full_path, new_path)
                stats.files_renamed += 1

    # Also handle subdirectories in mpc/ that might need case fixes
    mpc_dir = os.path.join(root, "mpc")
    if os.path.isdir(mpc_dir):
        for entry in sorted(os.listdir(mpc_dir)):
            full_path = os.path.join(mpc_dir, entry)
            if os.path.isdir(full_path) and entry != entry.lower():
                new_path = os.path.join(mpc_dir, entry.lower())
                log(f"重命名 mpc/{entry}/ → mpc/{entry.lower()}/")
                if not DRY_RUN:
                    if os.path.exists(new_path):
                        for f in os.listdir(full_path):
                            shutil.move(os.path.join(full_path, f), os.path.join(new_path, f))
                        os.rmdir(full_path)
                    else:
                        os.rename(full_path, new_path)
                stats.files_renamed += 1

    # Lowercase all files in save/game/ (e.g. SMZZ.NPC → smzz.npc, SMzz.OBJ → smzz.obj)
    save_game_dir = os.path.join(root, "save", "game")
    if os.path.isdir(save_game_dir):
        renamed_count = 0
        for fn in sorted(os.listdir(save_game_dir)):
            if fn == fn.lower():
                continue
            src = os.path.join(save_game_dir, fn)
            dst = os.path.join(save_game_dir, fn.lower())
            if not os.path.isfile(src):
                continue
            if os.path.exists(dst):
                log(f"警告: save/game/{fn.lower()} 已存在，跳过 {fn}")
                continue
            log(f"重命名 save/game/{fn} → {fn.lower()}")
            if not DRY_RUN:
                os.rename(src, dst)
            renamed_count += 1
        stats.files_renamed += renamed_count
        log(f"save/game/ 文件小写化: {renamed_count} 个文件")

    # Lowercase filename arguments in LoadNpc/LoadObj/LoadMap calls in all .txt scripts
    script_dir = os.path.join(root, "script")
    if os.path.isdir(script_dir):
        load_pattern = re.compile(
            r'(Load(?:Npc|Obj|Map)\s*\(\s*")([^"]+?)(\s*"\s*\))',
            re.IGNORECASE,
        )
        total_replacements = 0
        files_modified = 0
        for dirpath, _, filenames in os.walk(script_dir):
            for fn in filenames:
                if not fn.lower().endswith(".txt"):
                    continue
                filepath = os.path.join(dirpath, fn)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                except Exception:
                    continue
                replacements_here = [0]

                def make_replacer(counter):
                    def replacer(m):
                        arg = m.group(2)
                        lowered = arg.lower()
                        if lowered != arg:
                            counter[0] += 1
                        return m.group(1) + lowered + m.group(3)
                    return replacer

                new_content = load_pattern.sub(make_replacer(replacements_here), content)
                if new_content != content:
                    files_modified += 1
                    total_replacements += replacements_here[0]
                    if not DRY_RUN:
                        with open(filepath, "w", encoding="utf-8") as f:
                            f.write(new_content)
        log(f"脚本 Load* 参数小写化: {total_replacements} 处替换 ({files_modified} 个文件)")


# ============================================================
# Step 3: Encoding (GBK → UTF-8)
# ============================================================

def step_encoding(root: str):
    log_step("encoding", "GBK → UTF-8 (.ini, .txt, .npc, .obj)")

    extensions = {".ini", ".txt", ".npc", ".obj"}
    converted = 0
    skipped = 0

    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext not in extensions:
                continue

            filepath = os.path.join(dirpath, fn)
            with open(filepath, "rb") as f:
                data = f.read()

            # Skip empty files
            if not data:
                continue

            # Check if already valid Chinese UTF-8
            if looks_like_valid_chinese_utf8(data):
                skipped += 1
                continue

            # Check if pure ASCII
            try:
                data.decode("ascii")
                skipped += 1
                continue
            except UnicodeDecodeError:
                pass

            # Convert GBK → UTF-8
            try:
                text = data.decode("gbk")
            except UnicodeDecodeError:
                text = data.decode("gbk", errors="replace")
                stats.errors.append(f"GBK 解码有损: {filepath}")

            if not DRY_RUN:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    # Normalize line endings to LF
                    f.write(text.replace("\r\n", "\n").replace("\r", "\n"))

            converted += 1

    stats.files_converted += converted
    log(f"转换 {converted} 个文件，跳过 {skipped} 个")


# ============================================================
# Step 4: NPC field renames
# ============================================================

def step_npc_fields(root: str):
    log_step("npc_fields", "NPC INI 字段重命名 (Duck→Evade)")

    npc_dir = os.path.join(root, "ini", "npc")
    if not os.path.isdir(npc_dir):
        log("未找到 ini/npc/ 目录，跳过")
        return

    converted = 0
    for fn in sorted(os.listdir(npc_dir)):
        if not fn.lower().endswith(".ini"):
            continue

        filepath = os.path.join(npc_dir, fn)
        text = read_gbk(filepath)
        original = text

        # Duck → Evade (engine doesn't recognize "Duck", only "Evade")
        text = re.sub(r"^Duck=", "Evade=", text, flags=re.MULTILINE)

        # Note: "Defend" is already recognized by the engine (it's the primary name,
        # "Defence" is just an alias). So we keep "Defend" as-is.

        if text != original:
            if not DRY_RUN:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
            converted += 1

    stats.files_converted += converted
    log(f"修改 {converted} 个 NPC INI 文件 (Duck→Evade)")


# ============================================================
# Step 5: Portrait system
# ============================================================

def build_portrait_mapping(root: str) -> dict:
    """
    构建头像映射: 中文名.mpc → fac{NNN}.asf + 数字 ID
    返回 { "南宫飞云.mpc": {"id": 1, "asf": "fac001.asf"}, ... }
    """
    portrait_dir = os.path.join(root, "mpc", "portrait")
    if not os.path.isdir(portrait_dir):
        portrait_dir = os.path.join(root, "Mpc", "portrait")
    if not os.path.isdir(portrait_dir):
        log("未找到 mpc/portrait/ 或 Mpc/portrait/ 目录")
        return {}

    files = sorted([f for f in os.listdir(portrait_dir)
                    if f.lower().endswith(".mpc")])

    mapping = {}
    for idx, fn in enumerate(files, start=1):
        asf_name = f"fac{idx:03d}.msf"
        mapping[fn] = {"id": idx, "asf": asf_name}

    return mapping


def step_portraits(root: str) -> dict:
    log_step("portraits", "生成 HeadFile.ini + 头像文件重命名")

    mapping = build_portrait_mapping(root)
    if not mapping:
        return {}

    # 1. Generate HeadFile.ini
    headfile_dir = os.path.join(root, "ini", "ui", "dialog")
    headfile_path = os.path.join(headfile_dir, "HeadFile.ini")

    lines = ["[PORTRAIT]"]
    for mpc_name, info in sorted(mapping.items(), key=lambda x: x[1]["id"]):
        lines.append(f"{info['id']}={info['asf']}")

    content = "\n".join(lines) + "\n"
    write_file(headfile_path, content)
    stats.files_created += 1
    log(f"生成 HeadFile.ini ({len(mapping)} 个头像映射)")

    # 2. Create portrait mapping reference file (for debugging)
    ref_path = os.path.join(headfile_dir, "portrait-mapping.txt")
    ref_lines = ["# Portrait Mapping: 原始文件名 → 新文件名 (ID)"]
    for mpc_name, info in sorted(mapping.items(), key=lambda x: x[1]["id"]):
        ref_lines.append(f"{mpc_name} → {info['asf']} (ID={info['id']})")
    write_file(ref_path, "\n".join(ref_lines) + "\n")
    stats.files_created += 1

    # 3. Rename portrait MPC files to facNNN.mpc (converter will convert .mpc→.msf)
    # We rename to .mpc with new name so the Rust converter can still process them
    portrait_dir = os.path.join(root, "mpc", "portrait")
    if not os.path.isdir(portrait_dir):
        portrait_dir = os.path.join(root, "Mpc", "portrait")

    if os.path.isdir(portrait_dir):
        renamed = 0
        for mpc_name, info in mapping.items():
            src_path = os.path.join(portrait_dir, mpc_name)
            # Keep .mpc extension for Rust converter, but rename the base
            dst_name = os.path.splitext(info["asf"])[0] + ".mpc"
            dst_path = os.path.join(portrait_dir, dst_name)
            if os.path.exists(src_path):
                if not DRY_RUN:
                    os.rename(src_path, dst_path)
                renamed += 1
        stats.files_renamed += renamed
        log(f"重命名 {renamed} 个头像 MPC 文件")

    # 4. Keep portraits in mpc/portrait/ with .mpc extension so Rust can convert them.
    # After Rust conversion, Rust writes fac001.msf to asf/portrait/ (via mpc_output_path).
    # HeadFile.ini references .msf directly (no runtime rewriting needed).

    return mapping


# ============================================================
# Step 6: Talk system conversion
# ============================================================

def step_talk(root: str, portrait_mapping: dict):
    log_step("talk", "talk.txt → TalkIndex.txt + 脚本 Talk() 改写")

    script_dir = os.path.join(root, "script", "map")
    if not os.path.isdir(script_dir):
        log("未找到 script/map/ 目录，跳过")
        return

    # Build reverse portrait mapping: "南宫飞云.mpc" → numeric ID
    portrait_id_map = {}
    for mpc_name, info in portrait_mapping.items():
        portrait_id_map[mpc_name] = info["id"]
        # Also map without .mpc extension
        base = mpc_name.rsplit(".", 1)[0]
        portrait_id_map[base] = info["id"]

    # Phase 1: Parse all talk.txt files and build TalkIndex entries
    # Each Talk section gets a block of sequential IDs
    talk_index_entries = []  # [(id, portraitId, text)]
    # Map: (map_folder, section_name) → (start_id, end_id)
    section_id_map = {}
    next_id = 10000  # Start sword2 talks at 10000 to avoid collision with xin IDs
    id_step = 10     # Gap between entries for future insertion

    map_folders = sorted([d for d in os.listdir(script_dir)
                         if os.path.isdir(os.path.join(script_dir, d))])

    total_sections = 0
    total_lines = 0

    for map_folder in map_folders:
        talk_path = os.path.join(script_dir, map_folder, "talk.txt")
        if not os.path.exists(talk_path):
            continue

        text = read_gbk(talk_path)
        sections = parse_talk_txt(text)

        for section_name, section_data in sections.items():
            if not section_data.get("lines"):
                continue

            start_id = next_id
            lines = section_data["lines"]
            portraits = section_data.get("heads", {})

            for i, (line_num, line_text) in enumerate(lines):
                entry_id = next_id

                # Determine portrait for this line
                # Check if there's a head assignment at or before this line
                portrait_id = 0
                # heads are like {1: "南宫飞云.mpc", 2: "独孤剑.mpc"}
                # Line numbers >= head_line_num use that head
                # We need to figure out which head speaks each line
                # Convention: odd speaker uses head1, even uses head2
                # But actually the text itself has "Name：" prefix
                # Let's extract speaker from text and match to heads

                # Try to find matching portrait
                speaker = extract_speaker(line_text)
                if speaker:
                    # Try to match speaker to a portrait
                    for head_key, head_file in portraits.items():
                        if isinstance(head_key, int):
                            # Look at which head file matches the speaker name
                            head_base = head_file.rsplit(".", 1)[0] if head_file else ""
                            # Check if speaker name is part of head file name
                            if speaker in head_base or head_base in speaker:
                                pid = portrait_id_map.get(head_file, 0)
                                if pid:
                                    portrait_id = pid
                                    break
                    # If no match found by name, look for dynamic head assignments
                    if portrait_id == 0:
                        # Check for headN= at specific line numbers
                        for hline, hfile in sorted(portraits.items()):
                            if isinstance(hline, str) and hline.startswith("head"):
                                pid = portrait_id_map.get(hfile, 0)
                                if pid:
                                    portrait_id = pid

                # Fallback: use head1 for all if no match
                if portrait_id == 0 and portraits:
                    # First numeric head
                    for hk in sorted(portraits.keys()):
                        if isinstance(hk, int) or (isinstance(hk, str) and hk.isdigit()):
                            pid = portrait_id_map.get(portraits[hk], 0)
                            if pid:
                                portrait_id = pid
                                break

                talk_index_entries.append((entry_id, portrait_id, line_text))
                next_id += id_step
                total_lines += 1

            end_id = next_id - id_step
            section_id_map[(map_folder, section_name)] = (start_id, end_id)
            total_sections += 1

    log(f"解析 {total_sections} 个对话段落，{total_lines} 行对话")

    # Phase 2: Generate TalkIndex.txt
    content_dir = os.path.join(root, "Content")
    os.makedirs(content_dir, exist_ok=True) if not DRY_RUN else None

    talkindex_path = os.path.join(content_dir, "TalkIndex.txt")
    talkindex_lines = []
    for entry_id, portrait_id, text in talk_index_entries:
        talkindex_lines.append(f"[{entry_id},{portrait_id}]{text}")

    write_file(talkindex_path, "\n".join(talkindex_lines) + "\n")
    stats.files_created += 1
    log(f"生成 TalkIndex.txt ({len(talkindex_lines)} 条)")

    # Build global section lookup: section_name → (start_id, end_id)
    # For same-name sections across maps, prefer same-map match
    global_section_map = {}  # section_name_lower → [(map_folder, start_id, end_id)]
    for (mf, sn), (sid, eid) in section_id_map.items():
        global_section_map.setdefault(sn.lower(), []).append((mf, sid, eid))

    def lookup_talk_ids(section_name: str, current_map: str | None) -> tuple[int, int] | None:
        """查找 Talk section 的 ID 范围，优先同地图匹配"""
        key_lower = section_name.lower()
        candidates = global_section_map.get(key_lower, [])
        if not candidates:
            return None
        # Prefer same-map match
        if current_map:
            for mf, sid, eid in candidates:
                if mf == current_map:
                    return (sid, eid)
        # Fallback: first match from any map
        return (candidates[0][1], candidates[0][2])

    # Phase 3: Rewrite scripts - Talk("SectionName") → Talk(startId, endId)
    # Scan ALL .txt files under script/ (including 未找到的/ and other subdirs)
    rewritten_scripts = 0
    rewritten_calls = 0

    script_base = os.path.join(root, "script")
    all_script_files = []
    for dirpath, _, filenames in os.walk(script_base):
        for fn in sorted(filenames):
            if not fn.lower().endswith(".txt"):
                continue
            if fn.lower() == "talk.txt":
                continue
            all_script_files.append(os.path.join(dirpath, fn))

    for filepath in all_script_files:
        # Determine current map folder for same-map priority
        rel = os.path.relpath(filepath, script_base)
        parts = rel.split(os.sep)
        current_map = parts[1] if len(parts) >= 3 and parts[0] == "map" else None

        text = read_gbk(filepath)
        original = text

        # Replace Talk("SectionName") with Talk(startId, endId)
        # Use [^"] to match ANY characters inside quotes (hyphens, dots, etc.)
        def replace_talk(m, _current_map=current_map, _filepath=filepath):
            nonlocal rewritten_calls
            section_name = m.group(1)

            result = lookup_talk_ids(section_name, _current_map)
            if result:
                start_id, end_id = result
                rewritten_calls += 1
                return f"Talk({start_id},{end_id})"
            else:
                rel_path = os.path.relpath(_filepath, root)
                stats.errors.append(f"未找到 Talk section: {rel_path} → Talk(\"{section_name}\")")
                return m.group(0)  # Keep original

        text = re.sub(r'Talk\("([^"]+)"\)', replace_talk, text)

        if text != original:
            if not DRY_RUN:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
            rewritten_scripts += 1

    stats.files_converted += rewritten_scripts
    log(f"改写 {rewritten_scripts} 个脚本文件，{rewritten_calls} 处 Talk() 调用")

    # Phase 4: Remove talk.txt files (no longer needed)
    removed = 0
    for map_folder in map_folders:
        talk_path = os.path.join(script_dir, map_folder, "talk.txt")
        if os.path.exists(talk_path):
            if not DRY_RUN:
                os.remove(talk_path)
            removed += 1
    log(f"删除 {removed} 个 talk.txt 文件")

    # Phase 5: Generate section mapping reference
    ref_path = os.path.join(content_dir, "talk-section-mapping.txt")
    ref_lines = ["# Talk Section Mapping: map/section → TalkIndex ID range"]
    for (map_folder, section_name), (start_id, end_id) in sorted(section_id_map.items()):
        ref_lines.append(f"{map_folder}/{section_name} → Talk({start_id},{end_id})")
    write_file(ref_path, "\n".join(ref_lines) + "\n")
    stats.files_created += 1


def parse_talk_txt(text: str) -> dict:
    """
    解析 sword2 的 talk.txt 格式

    格式:
        [SectionName]
        head1=南宫飞云.mpc
        head2=独孤剑.mpc
        1=飞云：对话内容
        2=独孤剑：对话内容

    返回: {section_name: {"heads": {1: "南宫飞云.mpc", ...}, "lines": [(line_num, text), ...]}}
    """
    sections = OrderedDict()
    current_section = None
    current_data = None

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue

        # Comments in parentheses (stage directions)
        if line.startswith("（") or line.startswith("("):
            continue

        # Section header
        m = re.match(r"^\[(.+?)\]", line)
        if m:
            current_section = m.group(1)
            current_data = {"heads": {}, "lines": []}
            sections[current_section] = current_data
            continue

        if current_data is None:
            continue

        # Head reference: headN=xxx.mpc or HeadN=xxx.mpc
        m = re.match(r"^[Hh]ead(\d+)=(.+)", line)
        if m:
            head_num = int(m.group(1))
            head_file = m.group(2).strip()
            if head_file:
                current_data["heads"][head_num] = head_file
            continue

        # Dialogue line: N=text (where N is a number)
        m = re.match(r"^(\d+)=(.*)", line)
        if m:
            line_num = int(m.group(1))
            line_text = m.group(2).strip()
            # Handle multi-line (lines ending without proper termination get joined)
            if line_text:
                current_data["lines"].append((line_num, line_text))
            continue

    return sections


def extract_speaker(text: str) -> str | None:
    """从对话文本中提取说话人名字 (格式: "名字：对话内容")"""
    # Remove color tags
    cleaned = re.sub(r"<color=[^>]+>", "", text)
    m = re.match(r"^(.+?)：", cleaned)
    if m:
        return m.group(1).strip()
    return None


# ============================================================
# Step 7: NPC Resource adjustments
# ============================================================

def replace_mpc_with_msf_in_ini_dir(dirpath: str, recursive: bool = False) -> int:
    """将目录下所有 INI 文件中的 .mpc / .asf 引用统一替换为 .msf。
    recursive=True 时递归处理子目录（如 ini/ui/）。
    """
    converted = 0
    if recursive:
        all_files = []
        for root_w, _, filenames in os.walk(dirpath):
            for fn in filenames:
                all_files.append(os.path.join(root_w, fn))
    else:
        all_files = [os.path.join(dirpath, fn) for fn in os.listdir(dirpath)]

    for filepath in sorted(all_files):
        if not filepath.lower().endswith(".ini"):
            continue
        try:
            text = read_gbk(filepath)
        except Exception:
            continue
        original = text
        # Replace .mpc → .msf and .asf → .msf (sprites/portraits are all .msf after conversion)
        # We DON'T touch map tile refs (map references live in .map/.mmf, not in ini)
        text = re.sub(r'(\.mpc)(?=[\s;,"\]\r\n]|$)', '.msf', text, flags=re.IGNORECASE | re.MULTILINE)
        text = re.sub(r'(\.asf)(?=[\s;,"\]\r\n]|$)', '.msf', text, flags=re.IGNORECASE | re.MULTILINE)
        if text != original:
            if not DRY_RUN:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
            converted += 1
    return converted


# Keep old name as alias for backward compat
replace_mpc_with_asf_in_ini_dir = replace_mpc_with_msf_in_ini_dir


def step_npcres(root: str):
    log_step("npcres", "npcres/objres 格式调整 (.mpc→.msf 引用路径)")

    converted = 0
    for subdir in ["npcres", "objres"]:
        d = os.path.join(root, "ini", subdir)
        if os.path.isdir(d):
            n = replace_mpc_with_msf_in_ini_dir(d)
            converted += n
            log(f"{subdir}: 更新 {n} 个文件 (.mpc→.msf)")
        else:
            log(f"未找到 ini/{subdir}/ 目录，跳过")

    log(f"npcres/objres 合计更新 {converted} 个文件")


# ============================================================
# Step 8: Goods adjustments
# ============================================================

def step_goods(root: str):
    log_step("goods", "goods 格式调整 (.mpc→.msf)")

    goods_dir = os.path.join(root, "ini", "goods")
    if not os.path.isdir(goods_dir):
        log("未找到 ini/goods/ 目录，跳过")
        return

    n = replace_mpc_with_msf_in_ini_dir(goods_dir)
    log(f"goods: 更新 {n} 个文件 (.mpc→.msf)")


# ============================================================
# Step 9: Magic adjustments
# ============================================================

def step_magic(root: str):
    """Magic INI 格式调整：将所有 .mpc / .asf 文件引用改为 .msf。

    字段说明（参考 C# Magic.cs 的 Utils.GetAsf 调用路径）：
      - Image / Icon         → asf/magic/   (主体精灵 + 图标)
      - FlyingImage          → asf/effect/  (飞行特效，含半透明 palette alpha)
      - VanishImage          → asf/effect/  (爆炸/消失特效，含半透明 palette alpha)
      - SuperModeImage       → asf/effect/
      - LeapImage            → asf/effect/
      - HitCountFlyingImage  → asf/effect/
      - HitCountVanishImage  → asf/effect/

    透明度说明：
      mpc/effect/ 目录的 MPC 文件（飞行/爆炸动画）在调色板第 4 字节中存储了
      丰富的半透明 alpha 值，配合 AlphaBlend=1 渲染模式产生光晕/渐变效果。
      Rust 转换器会对 mpc/effect/ 使用 use_palette_alpha=true，其余目录（包括
      mpc/magic/ 的图标文件）保持二进制透明度（0 or 255）。

      C# 原引擎因 MPC 类不支持 alpha 而完全忽略了此数据，但 TS 引擎可以利用。
    """
    log_step("magic", "magic 格式调整 (.mpc→.msf)")

    magic_dir = os.path.join(root, "ini", "magic")
    if not os.path.isdir(magic_dir):
        log("未找到 ini/magic/ 目录，跳过")
        return

    n = replace_mpc_with_msf_in_ini_dir(magic_dir)
    log(f"magic: 更新 {n} 个文件 (.mpc→.msf)")


# ============================================================
# Step 10: Save format adaptation
# ============================================================

def step_save(root: str):
    log_step("save", "存档格式适配")

    save_dir = os.path.join(root, "save")
    if not os.path.isdir(save_dir):
        log("未找到 save/ 目录，跳过")
        return

    # Process each save slot
    for slot in sorted(os.listdir(save_dir)):
        slot_dir = os.path.join(save_dir, slot)
        if not os.path.isdir(slot_dir):
            continue

        game_ini_path = os.path.join(slot_dir, "Game.ini")
        if not os.path.exists(game_ini_path):
            continue

        text = read_gbk(game_ini_path)

        # Parse Game.ini
        sections = parse_ini_sections(text)

        # Extract [Option] section if present and create option.ini
        if "Option" in sections:
            option_data = sections["Option"]
            option_lines = ["[Option]"]
            for key, value in option_data.items():
                if not key.startswith("_"):
                    option_lines.append(f"{key}={value}")

            option_path = os.path.join(slot_dir, "option.ini")
            write_file(option_path, "\n".join(option_lines) + "\n")
            stats.files_created += 1

            # Remove [Option] from Game.ini
            del sections["Option"]

        # Add missing fields to [State] for xin compatibility
        if "State" in sections:
            state = sections["State"]
            if "Chr" not in state:
                state["Chr"] = "0"
            if "Time" not in state:
                state["Time"] = ""

        # Write updated Game.ini
        new_content = serialize_ini(sections)
        if not DRY_RUN:
            with open(game_ini_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new_content)
        stats.files_converted += 1

        # Convert single-player save to multi-player format
        # Player.ini → player0.ini
        player_ini = os.path.join(slot_dir, "Player.ini")
        if os.path.exists(player_ini):
            player0_path = os.path.join(slot_dir, "player0.ini")
            if not os.path.exists(player0_path):
                if not DRY_RUN:
                    shutil.copy2(player_ini, player0_path)
                stats.files_created += 1
                log(f"  {slot}/Player.ini → player0.ini")

        # Magic.ini → magic0.ini
        magic_ini = os.path.join(slot_dir, "Magic.ini")
        if os.path.exists(magic_ini):
            magic0_path = os.path.join(slot_dir, "magic0.ini")
            if not os.path.exists(magic0_path):
                if not DRY_RUN:
                    shutil.copy2(magic_ini, magic0_path)
                stats.files_created += 1
                log(f"  {slot}/Magic.ini → magic0.ini")

        # Goods.ini → goods0.ini
        goods_ini = os.path.join(slot_dir, "Goods.ini")
        if os.path.exists(goods_ini):
            goods0_path = os.path.join(slot_dir, "goods0.ini")
            if not os.path.exists(goods0_path):
                if not DRY_RUN:
                    shutil.copy2(goods_ini, goods0_path)
                stats.files_created += 1
                log(f"  {slot}/Goods.ini → goods0.ini")

        # Create empty var.ini if not present
        var_path = os.path.join(slot_dir, "var.ini")
        if not os.path.exists(var_path):
            write_file(var_path, "")
            stats.files_created += 1

    log("存档格式适配完成")


# ============================================================
# Step 11: Miscellaneous
# ============================================================

def step_misc(root: str):
    log_step("misc", "杂项处理")

    # 1. Generate MapName.ini from script/map/ folder names
    script_map_dir = os.path.join(root, "script", "map")
    if os.path.isdir(script_map_dir):
        mapname_lines = ["[MapName]"]
        # Find corresponding .map files
        map_dir = os.path.join(root, "map")
        map_files = []
        if os.path.isdir(map_dir):
            map_files = [f for f in os.listdir(map_dir)
                        if f.lower().endswith((".map", ".mmf"))]
            for mf in sorted(map_files):
                base = os.path.splitext(mf)[0]
                mapname_lines.append(f"{base}={base}")

        ini_map_dir = os.path.join(root, "ini", "map")
        if not DRY_RUN:
            os.makedirs(ini_map_dir, exist_ok=True)
        mapname_path = os.path.join(ini_map_dir, "MapName.ini")
        if not os.path.exists(mapname_path):
            write_file(mapname_path, "\n".join(mapname_lines) + "\n")
            stats.files_created += 1
            log(f"生成 MapName.ini ({len(map_files)} 个地图)")

    # 2. Create empty Rain.ini if not present
    rain_path = os.path.join(root, "ini", "map", "Rain.ini")
    if not os.path.exists(rain_path):
        write_file(rain_path, "[Rain]\n")
        stats.files_created += 1
        log("生成空 Rain.ini")

    # 3. Create Content/ directory (for TalkIndex.txt, fonts, music, sound, video)
    content_dir = os.path.join(root, "Content")
    if not DRY_RUN:
        os.makedirs(content_dir, exist_ok=True)

    # 3b. Generate Content/ui/ui_settings.ini (always regenerate from ini/ui/ source)
    ui_dir = os.path.join(content_dir, "ui")
    if not DRY_RUN:
        os.makedirs(ui_dir, exist_ok=True)
    ui_settings_path = os.path.join(ui_dir, "ui_settings.ini")
    if not DRY_RUN:
        write_file(ui_settings_path, build_sword2_ui_settings(root))
    stats.files_created += 1
    log("生成 Content/ui/ui_settings.ini (从 ini/ui/ 真实文件读取)")

    # 4. Move font/, music/, sound/, video/ into Content/ (matches resources-xin structure)
    for dirname in ["font", "music", "sound", "video"]:
        src_dir = os.path.join(root, dirname)
        dst_dir = os.path.join(content_dir, dirname)
        if os.path.isdir(src_dir):
            if not os.path.exists(dst_dir):
                log(f"移动 {dirname}/ → Content/{dirname}/")
                if not DRY_RUN:
                    shutil.move(src_dir, dst_dir)
                stats.files_renamed += 1
            else:
                log(f"Content/{dirname}/ 已存在，合并 {dirname}/")
                if not DRY_RUN:
                    for dirpath, _, filenames in os.walk(src_dir):
                        rel = os.path.relpath(dirpath, src_dir)
                        dstd = os.path.join(dst_dir, rel)
                        os.makedirs(dstd, exist_ok=True)
                        for fn in filenames:
                            sf = os.path.join(dirpath, fn)
                            df = os.path.join(dstd, fn)
                            if not os.path.exists(df):
                                shutil.move(sf, df)
                    shutil.rmtree(src_dir, ignore_errors=True)

    # 5. Remove snap/ and net/ — not part of xin resource format
    for dirname in ["snap", "net"]:
        dir_path = os.path.join(root, dirname)
        if os.path.isdir(dir_path):
            log(f"删除 {dirname}/ (xin 格式不需要)")
            if not DRY_RUN:
                shutil.rmtree(dir_path)

    # 6. Create asf/ directory structure recursively mirroring mpc/
    mpc_dir = os.path.join(root, "mpc")
    asf_dir = os.path.join(root, "asf")
    if os.path.isdir(mpc_dir):
        created_asf = 0
        for dirpath, dirnames, _ in os.walk(mpc_dir):
            for d in dirnames:
                rel = os.path.relpath(os.path.join(dirpath, d), mpc_dir)
                dst_sub = os.path.join(asf_dir, rel)
                if not os.path.isdir(dst_sub):
                    if not DRY_RUN:
                        os.makedirs(dst_sub, exist_ok=True)
                    created_asf += 1
        log(f"创建 asf/ 目录结构（递归，新建 {created_asf} 个子目录）")

    # 7. Create map/bmp/ directory (matches resources-xin structure)
    map_bmp_dir = os.path.join(root, "map", "bmp")
    if not os.path.isdir(map_bmp_dir):
        if not DRY_RUN:
            os.makedirs(map_bmp_dir, exist_ok=True)
        log("创建 map/bmp/ 目录")

    # 8. Create ini/save/ directory for default save templates
    ini_save_dir = os.path.join(root, "ini", "save")
    if not os.path.isdir(ini_save_dir):
        if not DRY_RUN:
            os.makedirs(ini_save_dir, exist_ok=True)
        log("创建 ini/save/ 目录")

    # 9. Replace .mpc refs in ini/ui/ and ini/未找到的/ directories
    for subdir in ["ui", "未找到的"]:
        d = os.path.join(root, "ini", subdir)
        if os.path.isdir(d):
            # ui/ has subdirs (buysell/, dialog/, title/, etc.), so recurse
            use_recursive = (subdir == "ui")
            n = replace_mpc_with_msf_in_ini_dir(d, recursive=use_recursive)
            log(f"ini/{subdir}: 更新 {n} 个文件 (.mpc/.asf→.msf)")

    # 10. Ensure ini/level/ has placeholders for missing files
    level_dir = os.path.join(root, "ini", "level")
    if os.path.isdir(level_dir):
        # Check for level-npc.ini (xin has this, sword2 doesn't)
        npc_level_path = os.path.join(level_dir, "level-npc.ini")
        if not os.path.exists(npc_level_path):
            lines = ["; NPC 等级经验表 (auto-generated for sword2 compatibility)"]
            lines.append("[INIT]")
            lines.append("Count=60")
            for i in range(1, 61):
                lines.append(f"[{i}]")
                exp = i * i * 100
                lines.append(f"LevelUpExp={exp}")
            write_file(npc_level_path, "\n".join(lines) + "\n")
            stats.files_created += 1
            log("生成 level-npc.ini (NPC 等级表)")

        # Check for magicexp.ini
        magicexp_path = os.path.join(level_dir, "magicexp.ini")
        if not os.path.exists(magicexp_path):
            lines = ["; 武功经验表 (auto-generated for sword2 compatibility)"]
            lines.append("[Count]")
            lines.append("Count=60")
            for i in range(1, 61):
                lines.append(f"[{i}]")
                exp = i * i * 50
                lines.append(f"LevelUpExp={exp}")
                lines.append(f"XiuLian=50")
                lines.append(f"Use=50")
            write_file(magicexp_path, "\n".join(lines) + "\n")
            stats.files_created += 1
            log("生成 magicexp.ini (武功经验表)")

    log("杂项处理完成")


# ============================================================
# Step 12b: Convert AVI videos → WebM (requires ffmpeg)
# ============================================================

def step_convert_video(root: str):
    """
    将 Content/video/*.avi 转换为 .webm（VP9+Opus），供 Web 播放器使用。
    VideoPlayer.tsx 会自动把 .avi 扩展名替换为 .webm 再加载。
    需要系统已安装 ffmpeg。
    """
    import shutil as _shutil
    log_step("convert_video", "AVI → WebM 视频转换")

    # Check ffmpeg availability
    if not _shutil.which("ffmpeg"):
        log("⚠️  未找到 ffmpeg，跳过视频转换。安装后重跑: sudo apt install ffmpeg")
        return

    video_dir = os.path.join(root, "Content", "video")
    if not os.path.isdir(video_dir):
        log(f"Content/video/ 不存在，跳过")
        return

    avi_files = [f for f in os.listdir(video_dir) if f.lower().endswith(".avi")]
    if not avi_files:
        log("Content/video/ 中没有 .avi 文件，跳过")
        return

    import multiprocessing as _mp
    from concurrent.futures import ThreadPoolExecutor as _TPE

    # Each ffmpeg process is already a subprocess; using threads here lets N
    # files encode in parallel while also giving each ffmpeg all CPU threads.
    n_jobs = max(1, _mp.cpu_count() // 2)  # half CPU count per process
    n_parallel = 2                           # 2 files at a time

    to_convert = []
    skipped = 0
    for avi_name in sorted(avi_files):
        base = os.path.splitext(avi_name)[0]
        src_path = os.path.join(video_dir, avi_name)
        dst_path = os.path.join(video_dir, base + ".webm")
        if os.path.exists(dst_path):
            log(f"  跳过 {avi_name} (已有 {base}.webm)")
            skipped += 1
        else:
            to_convert.append((avi_name, src_path, dst_path))

    converted = 0
    errors = 0

    def _convert_one(args):
        avi_name, src_path, dst_path = args
        log(f"  转换 {avi_name} → {os.path.basename(dst_path)} ...")
        if DRY_RUN:
            return True
        cmd = [
            "ffmpeg", "-y", "-i", src_path,
            "-c:v", "libvpx-vp9",
            "-crf", "33", "-b:v", "0",
            "-row-mt", "1",             # VP9 行并行，大幅加速
            "-threads", str(n_jobs),    # 每个 ffmpeg 用 n_jobs 线程
            "-c:a", "libopus", "-b:a", "96k",
            "-deadline", "good", "-cpu-used", "4",  # 0=最优质/最慢, 8=最快
            dst_path,
        ]
        try:
            subprocess.run(cmd, check=True,
                           stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
            return True
        except subprocess.CalledProcessError:
            log(f"  ❌ 转换失败: {avi_name}")
            return False

    if to_convert and not DRY_RUN:
        with _TPE(max_workers=n_parallel) as pool:
            results = list(pool.map(_convert_one, to_convert))
        converted = sum(1 for r in results if r)
        errors = sum(1 for r in results if not r)
        stats.files_created += converted
    elif to_convert:
        converted = len(to_convert)

    log(f"  完成: {converted} 个转换, {skipped} 个已存在跳过" +
        (f", {errors} 个失败" if errors else ""))


# ============================================================
# Step 13: Create msf/map/{mapName}/ per-map tile directories
# ============================================================

def step_map_tiles(root: str):
    """
    引擎加载地图 tile 时从 msf/map/{mapName}/ 读取 (map-renderer.ts 第 153 行)。
    Sword2 的 tile 包名与地图名不同 (e.g., 临安城 → 长安 tile 包)，
    所以需要为每张地图建立独立目录，从对应 tile 包复制 .msf 文件。
    """
    log_step("map_tiles", "创建 msf/map/{mapName}/ per-map tile 目录")

    map_dir = os.path.join(root, "map")
    msf_map_root = os.path.join(root, "msf", "map")
    mpc_map_root = os.path.join(root, "mpc", "map")

    if not os.path.isdir(map_dir):
        log("未找到 map/ 目录，跳过")
        return
    if not os.path.isdir(mpc_map_root):
        log("未找到 mpc/map/ 目录（Rust 尚未运行？），跳过")
        return

    if not DRY_RUN:
        os.makedirs(msf_map_root, exist_ok=True)

    total_maps = 0
    total_tiles = 0
    warnings = []

    for fn in sorted(os.listdir(map_dir)):
        if not fn.lower().endswith(".map"):
            continue
        map_name = os.path.splitext(fn)[0]
        map_path = os.path.join(map_dir, fn)

        # Read tile pack folder name from offset 0x20 (32 bytes, GBK, null-terminated)
        try:
            with open(map_path, "rb") as f:
                f.seek(0x20)
                tile_bytes = f.read(32)
        except OSError as e:
            warnings.append(f"{map_name}: 读取 .map 失败 ({e})")
            continue

        null_pos = tile_bytes.find(b"\x00")
        if null_pos >= 0:
            tile_bytes = tile_bytes[:null_pos]

        dst_map_dir = os.path.join(msf_map_root, map_name)
        if not DRY_RUN:
            os.makedirs(dst_map_dir, exist_ok=True)

        if not tile_bytes:
            # Map has no tile pack (e.g., 沙漠之战, 龙门客栈-长安)
            log(f"  {map_name}: 无 tile 包 (空目录)")
            total_maps += 1
            continue

        try:
            tile_path_raw = tile_bytes.decode("gbk", errors="replace")
        except Exception:
            warnings.append(f"{map_name}: GBK 解码失败")
            continue

        # Extract last path component (e.g., "\\mpc\\map\\长安" or "\\mpc\\map\\狂沙镇\\" → "狂沙镇")
        pack_name = tile_path_raw.replace("\\\\", "/").replace("\\", "/").rstrip("/").split("/")[-1].strip()
        if not pack_name:
            log(f"  {map_name}: tile 包路径解析失败 (raw={tile_path_raw!r})")
            total_maps += 1
            continue

        src_pack_dir = os.path.join(mpc_map_root, pack_name)
        if not os.path.isdir(src_pack_dir):
            warnings.append(f"{map_name}: tile 包目录不存在 mpc/map/{pack_name}")
            total_maps += 1
            continue

        # Copy all .msf tiles from mpc/map/{packName}/ → msf/map/{mapName}/
        copied = 0
        for tile_fn in os.listdir(src_pack_dir):
            if not tile_fn.lower().endswith(".msf"):
                continue
            src_file = os.path.join(src_pack_dir, tile_fn)
            dst_file = os.path.join(dst_map_dir, tile_fn)
            if not DRY_RUN and not os.path.exists(dst_file):
                shutil.copy2(src_file, dst_file)
            copied += 1

        pack_note = "" if pack_name == map_name else f" ← mpc/map/{pack_name}"
        log(f"  {map_name}{pack_note}: {copied} MSF tiles")
        total_maps += 1
        total_tiles += copied

    for w in warnings:
        log(f"  ⚠ {w}")

    log(f"map_tiles 完成: {total_maps} 张地图, {total_tiles} 个 tile 文件")
    stats.files_copied += total_tiles


# ============================================================
# Step 14: Delete all residual .mpc files
# ============================================================

def step_cleanup_mpc(root: str):
    """
    删除转换目录下所有剩余的 .mpc / .shd 原始文件。
    .mpc 转换后均已变成 .msf。
    .shd 阴影数据已在 Rust 转换时合并进 .msf 的 RGBA 层，不再需要保留。
    """
    log_step("cleanup_mpc", "删除所有剩余 .mpc / .shd 原始文件")

    total_deleted = 0
    total_bytes = 0

    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if not (fn.lower().endswith(".mpc") or fn.lower().endswith(".shd")):
                continue
            fpath = os.path.join(dirpath, fn)
            try:
                fsize = os.path.getsize(fpath)
                if not DRY_RUN:
                    os.remove(fpath)
                total_deleted += 1
                total_bytes += fsize
            except OSError as e:
                stats.errors.append(f"删除失败 {fpath}: {e}")

    size_mb = total_bytes / (1024 * 1024)
    log(f"删除 {total_deleted} 个 .mpc/.shd 文件，释放 {size_mb:.1f} MB")
    stats.files_renamed += total_deleted  # reuse counter for removals


# ============================================================
# Step 12: Move sprite MPC files from mpc/ to asf/
# ============================================================

def step_move_sprites(root: str):
    log_step("move_sprites", f"移动剩余精灵文件 mpc/{{char,effect,...}} → asf/ (Rust 已输出 .msf)")

    mpc_root = os.path.join(root, "mpc")
    asf_root = os.path.join(root, "asf")

    if not os.path.isdir(mpc_root):
        log("未找到 mpc/ 目录，跳过")
        return

    total_moved = 0
    total_dirs_removed = 0

    for sprite_dir in MPC_SPRITE_DIRS:
        src_dir = os.path.join(mpc_root, sprite_dir)
        dst_dir = os.path.join(asf_root, sprite_dir)

        if not os.path.isdir(src_dir):
            continue

        moved = 0
        # Move ALL remaining files (.mpc, .shd — .msf is already in asf/ from Rust)
        for dirpath, dirnames, filenames in os.walk(src_dir):
            rel = os.path.relpath(dirpath, src_dir)
            dst_subdir = os.path.join(dst_dir, rel) if rel != "." else dst_dir
            if not DRY_RUN:
                os.makedirs(dst_subdir, exist_ok=True)

            for fn in filenames:
                src_file = os.path.join(dirpath, fn)
                dst_file = os.path.join(dst_subdir, fn)
                # .shd shadow files are now merged into MSF RGBA — skip them entirely
                if fn.lower().endswith(".shd"):
                    if not DRY_RUN:
                        os.remove(src_file)
                    moved += 1
                    continue
                # Don't overwrite .msf files that Rust already wrote
                if fn.lower().endswith(".msf") and os.path.exists(dst_file):
                    if not DRY_RUN:
                        os.remove(src_file)  # Remove the duplicate in mpc/
                    moved += 1
                    continue
                if not DRY_RUN:
                    if os.path.exists(dst_file):
                        os.remove(dst_file)
                    shutil.move(src_file, dst_file)
                moved += 1

        log(f"  mpc/{sprite_dir}/ → asf/{sprite_dir}/  ({moved} 个文件)")
        total_moved += moved

        # Remove now-empty source dir
        if not DRY_RUN and os.path.isdir(src_dir):
            shutil.rmtree(src_dir)
            total_dirs_removed += 1

    log(f"移动完成: {total_moved} 个文件, 删除 {total_dirs_removed} 个 mpc/ 子目录")
    stats.files_renamed += total_moved


def step_lowercase_asf(root: str):
    """递归将 asf/ 目录下所有文件名转为小写。

    Rust 转换器输出的 MSF 文件保留了原始 MPC 的 PascalCase 文件名
    (如 InitBtn.msf, BtnYes.msf)，但 ui_settings.ini 中引用的路径
    为小写。Linux 文件系统区分大小写，所以必须统一。

    可单独运行: python3 scripts/convert-sword2.py --steps lowercase_asf
    """
    log_step("lowercase_asf", "asf/ 目录下所有文件名转小写")

    asf_dir = os.path.join(root, "asf")
    if not os.path.isdir(asf_dir):
        log("asf/ 目录不存在，跳过")
        return

    renamed = 0
    for dirpath, _dirnames, filenames in os.walk(asf_dir):
        for fn in filenames:
            if fn != fn.lower():
                src = os.path.join(dirpath, fn)
                dst = os.path.join(dirpath, fn.lower())
                if os.path.exists(dst) and src != dst:
                    log(f"警告: {dst} 已存在，跳过 {fn}")
                    continue
                if not DRY_RUN:
                    os.rename(src, dst)
                renamed += 1

    log(f"重命名 {renamed} 个文件为小写")
    stats.files_renamed += renamed


# ============================================================
# Main
# ============================================================

def main():
    global DRY_RUN

    parser = argparse.ArgumentParser(
        description="将 resources-sword2 转换为 resources-xin 兼容格式",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--dry-run", action="store_true",
                       help="只显示将要执行的操作，不实际修改文件")
    parser.add_argument("--steps", type=str, default=None,
                       help=f"逗号分隔的步骤列表 (可选: {','.join(ALL_STEPS)})")
    parser.add_argument("--src", type=str, default=DEFAULT_SRC,
                       help=f"源目录 (默认: {DEFAULT_SRC})")
    parser.add_argument("--dst", type=str, default=DEFAULT_DST,
                       help=f"目标目录 (默认: {DEFAULT_DST})")
    parser.add_argument("--no-rust", action="store_true",
                       help="跳过 Rust 转换器 (仅执行 Python 步骤)")
    parser.add_argument("--delete-originals", action="store_true",
                       help="转换后删除原始 .asf/.mpc/.map/.wmv/.wma 文件 (传递给 Rust 转换器)")

    args = parser.parse_args()
    DRY_RUN = args.dry_run

    # Resolve paths relative to workspace root
    workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(workspace, args.src)
    dst = os.path.join(workspace, args.dst)

    if not os.path.isdir(src):
        print(f"错误: 源目录不存在: {src}")
        sys.exit(1)

    steps = args.steps.split(",") if args.steps else ALL_STEPS
    for s in steps:
        if s not in ALL_STEPS:
            print(f"错误: 未知步骤 '{s}' (可选: {', '.join(ALL_STEPS)})")
            sys.exit(1)

    print(f"{'='*60}")
    print(f"Sword2 → Xin 格式转换器")
    print(f"{'='*60}")
    print(f"源目录: {src}")
    print(f"目标目录: {dst}")
    print(f"步骤: {', '.join(steps)}")
    print(f"模式: {'DRY-RUN (不修改文件)' if DRY_RUN else '实际执行'}")

    # Portrait mapping used across steps
    portrait_mapping = {}

    # In dry-run mode, if dst doesn't exist yet, use src for reading
    work_dir = dst if os.path.isdir(dst) else src

    # move_sprites runs AFTER Rust (post-Rust step); skip it in the normal loop
    POST_RUST_STEPS = {"move_sprites", "map_tiles", "cleanup_mpc", "lowercase_asf"}
    pre_rust_steps = [s for s in steps if s not in POST_RUST_STEPS]

    for step in pre_rust_steps:
        if step == "copy":
            step_copy(src, dst)
            # After copy, work_dir should be dst if it now exists
            if os.path.isdir(dst):
                work_dir = dst
        elif step == "lowercase":
            step_lowercase(work_dir)
        elif step == "encoding":
            step_encoding(work_dir)
        elif step == "npc_fields":
            step_npc_fields(work_dir)
        elif step == "portraits":
            portrait_mapping = step_portraits(work_dir)
        elif step == "talk":
            if not portrait_mapping:
                # Build mapping even if portraits step was skipped
                portrait_mapping = build_portrait_mapping(work_dir)
            step_talk(work_dir, portrait_mapping)
        elif step == "npcres":
            step_npcres(work_dir)
        elif step == "goods":
            step_goods(work_dir)
        elif step == "magic":
            step_magic(work_dir)
        elif step == "save":
            step_save(work_dir)
        elif step == "misc":
            step_misc(work_dir)
        elif step == "convert_video":
            step_convert_video(work_dir)
        # move_sprites is handled post-Rust (see below)

    stats.summary()

    if DRY_RUN:
        print("\n⚠️  这是 DRY-RUN 模式，没有实际修改任何文件。")
        print("    去掉 --dry-run 参数以执行实际转换。")
        return

    # Run Rust converter for binary format conversion (ASF→MSF, MPC→MSF, MAP→MMF, WMV→WebM, WMA→OGG)
    if not args.no_rust:
        converter_dir = os.path.join(workspace, "packages", "converter")
        if not os.path.isdir(converter_dir):
            print(f"\n⚠️  未找到 Rust 转换器目录: {converter_dir}")
            print(f"   请手动运行: cd {converter_dir} && cargo run --release --bin convert-all -- {work_dir}")
        else:
            print(f"\n{'='*60}")
            print(f"运行 Rust 转换器 (二进制格式 + 编码转换)")
            print(f"{'='*60}")
            cmd = ["cargo", "run", "--release", "--bin", "convert-all", "--", work_dir]
            if args.delete_originals:
                cmd.append("--delete-originals")
            print(f"命令: {' '.join(cmd)}")
            print(f"目录: {converter_dir}")
            try:
                result = subprocess.run(cmd, cwd=converter_dir, check=True)
                print(f"\n✅ Rust 转换器运行成功")
            except subprocess.CalledProcessError as e:
                print(f"\n❌ Rust 转换器失败 (退出码 {e.returncode})")
                sys.exit(e.returncode)
            except FileNotFoundError:
                print(f"\n❌ 未找到 cargo 命令，请安装 Rust: https://rustup.rs")
                sys.exit(1)
    else:
        print(f"\n后续步骤 (--no-rust 已跳过 Rust 转换器):")
        print(f"  cd packages/converter && cargo run --release --bin convert-all -- {work_dir}")

    # Post-Rust steps (need .msf files to already exist)
    if not DRY_RUN:
        if "move_sprites" in steps:
            step_move_sprites(work_dir)
        if "map_tiles" in steps:
            step_map_tiles(work_dir)
        if "cleanup_mpc" in steps:
            step_cleanup_mpc(work_dir)
        if "lowercase_asf" in steps:
            step_lowercase_asf(work_dir)

    print(f"\n检查文件:")
    print(f"  {work_dir}/Content/TalkIndex.txt")
    print(f"  {work_dir}/Content/talk-section-mapping.txt")
    print(f"  {work_dir}/ini/ui/dialog/HeadFile.ini")
    print(f"  {work_dir}/msf/map/  (per-map tile dirs)")


if __name__ == "__main__":
    main()
