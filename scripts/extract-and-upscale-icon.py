#!/usr/bin/env python3
"""
从 Jxqy.exe 中提取图标并使用 Real-ESRGAN 清晰放大。

用法: python scripts/extract-and-upscale-icon.py [--scale 4] [--exe Jxqy.exe]

输出目录: scripts/icons/
  - original/   原始提取图标
  - upscaled/   放大后的图标
"""

import argparse
import sys
import types
from pathlib import Path

# ── 修复 basicsr / torchvision 兼容性 ──────────────────────────────
# 新版 torchvision 移除了 functional_tensor 子模块，basicsr 仍引用旧路径
# 在导入 realesrgan 前做 monkey-patch
import torchvision.transforms.functional as _F

_fake_module = types.ModuleType("torchvision.transforms.functional_tensor")
_fake_module.rgb_to_grayscale = _F.rgb_to_grayscale  # type: ignore
sys.modules["torchvision.transforms.functional_tensor"] = _fake_module

import io
import struct

import numpy as np
import pefile
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from PIL import Image
from realesrgan import RealESRGANer


# ── 从 PE 文件提取 ICO ──────────────────────────────────────────────
def extract_icons_from_pe(exe_path: str) -> list[Image.Image]:
    """从 PE 可执行文件中提取所有图标，返回 PIL Image 列表。"""
    pe = pefile.PE(exe_path)
    images: list[Image.Image] = []

    # 查找 RT_GROUP_ICON (14) 和 RT_ICON (3) 资源
    rt_icon_data: dict[int, bytes] = {}  # id -> data
    rt_group_icon_entries: list[bytes] = []

    for entry in pe.DIRECTORY_ENTRY_RESOURCE.entries:
        res_type = entry.id or (
            entry.struct.Id if hasattr(entry.struct, "Id") else None
        )

        if res_type == pefile.RESOURCE_TYPE["RT_ICON"]:
            for sub in entry.directory.entries:
                icon_id = sub.id
                for lang in sub.directory.entries:
                    data_rva = lang.data.struct.OffsetToData
                    size = lang.data.struct.Size
                    raw = pe.get_data(data_rva, size)
                    rt_icon_data[icon_id] = raw

        elif res_type == pefile.RESOURCE_TYPE["RT_GROUP_ICON"]:
            for sub in entry.directory.entries:
                for lang in sub.directory.entries:
                    data_rva = lang.data.struct.OffsetToData
                    size = lang.data.struct.Size
                    raw = pe.get_data(data_rva, size)
                    rt_group_icon_entries.append(raw)

    # 解析 GROUP_ICON 目录，重建 ICO 文件
    for group_data in rt_group_icon_entries:
        # GRPICONDIR header: reserved(2) + type(2) + count(2)
        reserved, ico_type, count = struct.unpack_from("<HHH", group_data, 0)

        ico_buf = io.BytesIO()
        # 写 ICO 文件头
        ico_buf.write(struct.pack("<HHH", reserved, ico_type, count))

        # 收集图标数据
        icon_entries: list[tuple[bytes, bytes]] = []
        offset = 6 + count * 14  # header + entries 之后的数据偏移

        for i in range(count):
            # GRPICONDIRENTRY: 每项 14 字节
            entry_offset = 6 + i * 14
            entry_data = group_data[entry_offset : entry_offset + 14]

            # 前 12 字节 = width, height, colors, reserved, planes, bitcount, size
            # 最后 2 字节 = icon ID (而非文件偏移)
            width = entry_data[0]
            height = entry_data[1]
            colors = entry_data[2]
            reserved_byte = entry_data[3]
            planes, bitcount, img_size = struct.unpack_from(
                "<HHI", entry_data, 4
            )
            icon_id = struct.unpack_from("<H", entry_data, 12)[0]

            raw_icon = rt_icon_data.get(icon_id, b"")
            actual_size = len(raw_icon)

            # 写 ICONDIRENTRY (14 字节)：和 group entry 一样但最后 4 字节是文件偏移
            ico_entry = struct.pack(
                "<BBBBHHIH",
                width,
                height,
                colors,
                reserved_byte,
                planes,
                bitcount,
                actual_size,
                0,  # placeholder for offset
            )
            icon_entries.append((ico_entry, raw_icon))

        # 计算真实偏移并写入
        data_start = 6 + count * 16  # ICO header(6) + entries(count * 16)
        current_offset = data_start
        for ico_entry, raw_icon in icon_entries:
            # 重写 entry 的最后 4 字节（偏移）
            patched = ico_entry[:12] + struct.pack("<I", current_offset)
            ico_buf.write(patched)
            current_offset += len(raw_icon)

        # 写入图标像素数据
        for _, raw_icon in icon_entries:
            ico_buf.write(raw_icon)

        ico_buf.seek(0)
        try:
            ico_img = Image.open(ico_buf)
            # ICO 文件可能有多个尺寸，提取所有尺寸
            for size_idx in range(getattr(ico_img, "n_frames", 1)):
                try:
                    ico_img.seek(size_idx)
                    frame = ico_img.copy().convert("RGBA")
                    images.append(frame)
                except EOFError:
                    break
        except Exception:
            # 如果整个 ICO 解析失败，尝试逐个图标数据
            pass

    # 如果 group icon 解析没拿到，直接从 RT_ICON 逐个解析
    if not images:
        for icon_id, raw in sorted(rt_icon_data.items()):
            try:
                img = Image.open(io.BytesIO(raw)).convert("RGBA")
                images.append(img)
            except Exception:
                # 可能是 BMP DIB 格式，尝试手动解析
                try:
                    img = _parse_dib_icon(raw)
                    if img:
                        images.append(img)
                except Exception:
                    pass

    pe.close()
    return images


def _parse_dib_icon(data: bytes) -> Image.Image | None:
    """尝试从 DIB (device-independent bitmap) 数据解析图标。"""
    if len(data) < 40:
        return None

    # BITMAPINFOHEADER
    header_size, width, height = struct.unpack_from("<IiI", data, 0)
    # height 是实际高度的两倍（XOR mask + AND mask）
    height = height // 2
    planes, bitcount = struct.unpack_from("<HH", data, 12)

    if bitcount == 32:
        pixel_offset = header_size
        expected = width * height * 4
        if len(data) < pixel_offset + expected:
            return None
        pixels = data[pixel_offset : pixel_offset + expected]
        img = Image.frombytes("RGBA", (width, height), pixels, "raw", "BGRA")
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
        return img

    return None


# ── Real-ESRGAN 放大 ────────────────────────────────────────────────
def create_upscaler(scale: int = 4, gpu_id: int | None = 0) -> RealESRGANer:
    """
    创建 Real-ESRGAN 放大器。
    对图标这类小图使用 RealESRGAN_x4plus 模型（通用高质量放大）。
    """
    # 检测 GPU
    if gpu_id is not None and not torch.cuda.is_available():
        print("⚠ CUDA 不可用，回退到 CPU（速度较慢）")
        gpu_id = None

    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=4,
    )

    model_name = "RealESRGAN_x4plus"
    model_url = f"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/{model_name}.pth"

    upscaler = RealESRGANer(
        scale=4,
        model_path=model_url,  # 自动下载到 weights/
        model=model,
        tile=0,  # 图标很小，不需要分块
        tile_pad=10,
        pre_pad=0,
        half=gpu_id is not None,  # GPU 用 fp16 加速
        gpu_id=gpu_id,
    )

    return upscaler


def upscale_image(
    upscaler: RealESRGANer, img: Image.Image, outscale: int = 4
) -> Image.Image:
    """
    使用 Real-ESRGAN 放大 RGBA 图像。
    分离 alpha 通道单独处理以保留透明度。
    """
    # 转为 numpy (OpenCV BGR 格式)
    rgba = np.array(img)

    if rgba.shape[2] == 4:
        # 分离 RGB 和 Alpha
        rgb = rgba[:, :, :3]
        alpha = rgba[:, :, 3]

        # RGB: RGBA -> BGR for OpenCV
        bgr = rgb[:, :, ::-1]

        # 放大 RGB
        output_bgr, _ = upscaler.enhance(bgr, outscale=outscale)

        # 放大 Alpha（作为灰度图3通道处理）
        alpha_3ch = np.stack([alpha, alpha, alpha], axis=2)
        output_alpha_3ch, _ = upscaler.enhance(alpha_3ch, outscale=outscale)
        output_alpha = output_alpha_3ch[:, :, 0]

        # 合并
        output_rgb = output_bgr[:, :, ::-1]  # BGR -> RGB
        output_rgba = np.dstack([output_rgb, output_alpha])

        return Image.fromarray(output_rgba, "RGBA")
    else:
        bgr = rgba[:, :, ::-1]
        output_bgr, _ = upscaler.enhance(bgr, outscale=outscale)
        output_rgb = output_bgr[:, :, ::-1]
        return Image.fromarray(output_rgb, "RGB")


# ── 主流程 ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="从 Jxqy.exe 提取图标并用 Real-ESRGAN 清晰放大"
    )
    parser.add_argument(
        "--exe",
        default="Jxqy.exe",
        help="可执行文件路径 (默认: Jxqy.exe)",
    )
    parser.add_argument(
        "--scale",
        type=int,
        default=4,
        choices=[2, 4, 8],
        help="放大倍数 (默认: 4)",
    )
    parser.add_argument(
        "--output",
        default="scripts/icons",
        help="输出目录 (默认: scripts/icons)",
    )
    args = parser.parse_args()

    exe_path = Path(args.exe)
    if not exe_path.exists():
        print(f"❌ 找不到文件: {exe_path}")
        sys.exit(1)

    out_dir = Path(args.output)
    orig_dir = out_dir / "original"
    up_dir = out_dir / "upscaled"
    orig_dir.mkdir(parents=True, exist_ok=True)
    up_dir.mkdir(parents=True, exist_ok=True)

    # 1. 提取图标
    print(f"📦 从 {exe_path} 提取图标...")
    icons = extract_icons_from_pe(str(exe_path))

    if not icons:
        print("❌ 未找到任何图标")
        sys.exit(1)

    # 去重（按尺寸）并按大小排序
    seen_sizes: set[tuple[int, int]] = set()
    unique_icons: list[Image.Image] = []
    for icon in icons:
        sz = icon.size
        if sz not in seen_sizes:
            seen_sizes.add(sz)
            unique_icons.append(icon)
    unique_icons.sort(key=lambda im: im.size[0] * im.size[1], reverse=True)

    print(f"✅ 提取到 {len(unique_icons)} 个不同尺寸的图标:")
    for i, icon in enumerate(unique_icons):
        print(f"   [{i}] {icon.size[0]}x{icon.size[1]}")
        save_path = orig_dir / f"icon_{icon.size[0]}x{icon.size[1]}.png"
        icon.save(save_path)
        print(f"       → {save_path}")

    # 2. 放大
    print(f"\n🔍 使用 Real-ESRGAN (RealESRGAN_x4plus) 放大 {args.scale}x ...")
    upscaler = create_upscaler(scale=args.scale)

    for i, icon in enumerate(unique_icons):
        w, h = icon.size
        print(f"   处理 [{i}] {w}x{h} → {w * args.scale}x{h * args.scale} ...")

        upscaled = upscale_image(upscaler, icon, outscale=args.scale)
        save_path = (
            up_dir
            / f"icon_{w}x{h}_upscaled_{args.scale}x.png"
        )
        upscaled.save(save_path)
        print(f"       → {save_path}")

    print(f"\n🎉 完成！原始图标在 {orig_dir}，放大图标在 {up_dir}")


if __name__ == "__main__":
    main()
