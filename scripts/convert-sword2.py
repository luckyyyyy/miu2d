#!/usr/bin/env python3
"""
convert-sword2.py — 将 resources-sword2 转换为 resources-xin 兼容格式

用法:
    python3 scripts/convert-sword2.py [--dry-run] [--steps STEP1,STEP2,...] [--src DIR] [--dst DIR]

步骤概览:
    1. copy        — 复制 resources-sword2 → resources-sword2-new
    2. lowercase   — 目录名统一小写 (Mpc/ → mpc/)
    3. encoding    — GBK → UTF-8 (.ini, .txt, .npc, .obj)
    4. npc_fields  — NPC INI 字段重命名 (Defend→Defend保留, Duck→Evade)
    5. portraits   — 生成 HeadFile.ini + 头像重命名映射
    6. talk        — talk.txt → TalkIndex.txt + 脚本 Talk("x") → Talk(start,end)
    7. npcres      — npcres 格式调整 (.mpc→.asf 引用, 移除 Shade)
    8. goods       — goods 格式调整 (.mpc→.asf 引用)
    9. magic       — magic 格式调整 (.mpc→.asf 引用)
   10. save        — 存档格式适配 (Game.ini [Option] → option.ini)
   11. misc        — 杂项 (MapName.ini 生成, 目录结构整理)

注意: 二进制格式转换 (ASF→MSF, MPC→MSF, MAP→MMF) 由 Rust 转换器处理，不在此脚本范围内。
      运行本脚本后，再运行 `cargo run --bin convert-all -- resources-sword2-new` 完成二进制转换。
"""

import argparse
import glob
import os
import re
import shutil
import sys
from collections import OrderedDict
from pathlib import Path

# ============================================================
# Config
# ============================================================

DEFAULT_SRC = "resources-sword2"
DEFAULT_DST = "resources-sword2-new"

ALL_STEPS = [
    "copy", "lowercase", "encoding", "npc_fields", "portraits",
    "talk", "npcres", "goods", "magic", "save", "misc",
]

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
        asf_name = f"fac{idx:03d}.asf"
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
            dst_name = info["asf"].replace(".asf", ".mpc")
            dst_path = os.path.join(portrait_dir, dst_name)
            if os.path.exists(src_path):
                if not DRY_RUN:
                    os.rename(src_path, dst_path)
                renamed += 1
        stats.files_renamed += renamed
        log(f"重命名 {renamed} 个头像 MPC 文件")

    # 4. Also move portrait dir from mpc/portrait to asf/portrait
    # for better compatibility with xin structure
    # Actually, let's create a symlink or just note it
    # The Rust converter will handle mpc→msf, and the engine rewrites .asf→.msf at runtime
    # So we need to put them where the engine expects: asf/portrait/facNNN.asf → .msf

    # Create asf/portrait/ directory and move renamed MPCs there
    # Actually, the converter processes mpc/ dir separately from asf/ dir.
    # Let's keep them in mpc/portrait/ for now — the converter will convert them to .msf
    # and HeadFile.ini references .asf which gets rewritten to .msf at runtime.

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

def step_npcres(root: str):
    log_step("npcres", "npcres 格式调整 (.mpc→.asf 引用路径)")

    npcres_dir = os.path.join(root, "ini", "npcres")
    if not os.path.isdir(npcres_dir):
        log("未找到 ini/npcres/ 目录，跳过")
        return

    converted = 0
    for fn in sorted(os.listdir(npcres_dir)):
        if not fn.lower().endswith(".ini"):
            continue

        filepath = os.path.join(npcres_dir, fn)
        text = read_gbk(filepath)
        original = text

        # Note: We do NOT remove Shade= lines — the engine already handles/ignores them.
        # We do NOT change .mpc to .asf in Image= — the engine auto-rewrites .mpc→.msf at runtime.
        # The Rust converter will convert the actual .mpc files to .msf.

        # However, we need to ensure the files are UTF-8 (already done in step 3)
        # Nothing extra to do here unless we want to normalize format

        if text != original:
            if not DRY_RUN:
                with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
            converted += 1

    log(f"npcres: {converted} 个文件需要调整（引擎运行时自动重写 .mpc→.msf）")


# ============================================================
# Step 8: Goods adjustments
# ============================================================

def step_goods(root: str):
    log_step("goods", "goods 格式调整")

    goods_dir = os.path.join(root, "ini", "goods")
    if not os.path.isdir(goods_dir):
        log("未找到 ini/goods/ 目录，跳过")
        return

    # Engine auto-rewrites .mpc→.msf at runtime, so no path changes needed.
    # Note: sword2 goods lack EffectType= and Part= fields that xin has.
    # The engine should be tolerant of missing optional fields.

    log("goods: 引擎运行时自动重写 .mpc→.msf，无需修改路径引用")


# ============================================================
# Step 9: Magic adjustments
# ============================================================

def step_magic(root: str):
    log_step("magic", "magic 格式调整")

    magic_dir = os.path.join(root, "ini", "magic")
    if not os.path.isdir(magic_dir):
        log("未找到 ini/magic/ 目录，跳过")
        return

    # Engine auto-rewrites .mpc→.msf, so magic Image=/Icon= .mpc refs are fine.
    log("magic: 引擎运行时自动重写 .mpc→.msf，无需修改路径引用")


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
        map_names = sorted(os.listdir(script_map_dir))
        mapname_lines = ["[MapName]"]
        # Find corresponding .map files
        map_dir = os.path.join(root, "map")
        if os.path.isdir(map_dir):
            map_files = [f for f in os.listdir(map_dir)
                        if f.lower().endswith((".map", ".mmf"))]
            for mf in sorted(map_files):
                base = os.path.splitext(mf)[0]
                # Use the map filename as display name (sword2 maps use Chinese names)
                mapname_lines.append(f"{base}={base}")

        ini_map_dir = os.path.join(root, "ini", "map")
        os.makedirs(ini_map_dir, exist_ok=True) if not DRY_RUN else None
        mapname_path = os.path.join(ini_map_dir, "MapName.ini")
        if not os.path.exists(mapname_path):
            write_file(mapname_path, "\n".join(mapname_lines) + "\n")
            stats.files_created += 1
            log(f"生成 MapName.ini ({len(map_files) if os.path.isdir(map_dir) else 0} 个地图)")

    # 2. Create empty Rain.ini if not present
    rain_path = os.path.join(root, "ini", "map", "Rain.ini")
    if not os.path.exists(rain_path):
        write_file(rain_path, "[Rain]\n")
        stats.files_created += 1
        log("生成空 Rain.ini")

    # 3. Create asf/ directory structure mirroring mpc/ for the converter output
    mpc_dir = os.path.join(root, "mpc")
    asf_dir = os.path.join(root, "asf")
    if os.path.isdir(mpc_dir) and not DRY_RUN:
        for subdir in os.listdir(mpc_dir):
            src_sub = os.path.join(mpc_dir, subdir)
            if os.path.isdir(src_sub):
                dst_sub = os.path.join(asf_dir, subdir)
                os.makedirs(dst_sub, exist_ok=True)
        log(f"创建 asf/ 目录结构")

    # 4. Create ini/save/ directory for default save templates if missing
    ini_save_dir = os.path.join(root, "ini", "save")
    if not os.path.isdir(ini_save_dir) and not DRY_RUN:
        os.makedirs(ini_save_dir, exist_ok=True)
        log("创建 ini/save/ 目录")

    # 5. Create Content/ directory if not present (for TalkIndex.txt etc.)
    content_dir = os.path.join(root, "Content")
    if not os.path.isdir(content_dir) and not DRY_RUN:
        os.makedirs(content_dir, exist_ok=True)
        log("创建 Content/ 目录")

    # 6. Ensure ini/level/ has placeholders for missing files
    level_dir = os.path.join(root, "ini", "level")
    if os.path.isdir(level_dir):
        # Check for level-npc.ini (xin has this, sword2 doesn't)
        npc_level_path = os.path.join(level_dir, "level-npc.ini")
        if not os.path.exists(npc_level_path):
            # Generate a basic NPC level table (60 levels matching sword2)
            lines = ["; NPC 等级经验表 (auto-generated for sword2 compatibility)"]
            lines.append("[INIT]")
            lines.append("Count=60")
            for i in range(1, 61):
                lines.append(f"[{i}]")
                exp = i * i * 100  # Simple quadratic curve
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

    for step in steps:
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

    stats.summary()

    if DRY_RUN:
        print("\n⚠️  这是 DRY-RUN 模式，没有实际修改任何文件。")
        print("    去掉 --dry-run 参数以执行实际转换。")

    print(f"\n后续步骤:")
    print(f"  1. 运行 Rust 转换器处理二进制文件:")
    print(f"     cargo run --release --bin convert-all -- {dst}")
    print(f"  2. 检查 {dst}/Content/TalkIndex.txt 中的对话数据")
    print(f"  3. 检查 {dst}/Content/talk-section-mapping.txt 中的段落映射")
    print(f"  4. 检查 {dst}/ini/ui/dialog/HeadFile.ini 中的头像映射")
    print(f"  5. 检查 {dst}/ini/ui/dialog/portrait-mapping.txt 中的头像对照表")


if __name__ == "__main__":
    main()
