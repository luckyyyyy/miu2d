# Python 脚本管理（uv）

Miu2D 项目根目录使用 [uv](https://docs.astral.sh/uv/) 统一管理 `scripts/` 下的所有 Python 脚本依赖。

---

## 快速开始

```bash
# 安装 uv（已安装可跳过）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 进入项目根目录
cd /path/to/miu2d

# 创建虚拟环境（Python 3.12）
uv venv

# 激活虚拟环境
source .venv/bin/activate

# 安装基础依赖（check-alpha.py / export-training-data.py 所需）
uv pip install "Pillow>=10.4" "numpy>=2.0" "zstandard>=0.22"
```

---

## 脚本依赖分组

| 分组 | 脚本 | 依赖 |
|------|------|------|
| **stdlib-only** | `analyze_mpc_file.py`<br>`check_msf_alpha.py`<br>`convert-sword2.py` | 无（Python 标准库） |
| **base** | `check-alpha.py`<br>`export-training-data.py` | `Pillow` `numpy` `zstandard` |
| **ai** | `extract-and-upscale-icon.py` | base + `torch+CUDA` `torchvision` `basicsr` `realesrgan` `pefile` |
| **lora** | `train-lora-magic.py` | ai + `diffusers` `peft` `transformers` `accelerate` `bitsandbytes` |

---

## 按需安装各依赖组

### base — 轻量图像处理（推荐日常安装）

```bash
uv pip install "Pillow>=10.4" "numpy>=2.0" "zstandard>=0.22"
```

### ai — GPU 图像放大（Real-ESRGAN）

> 需要 NVIDIA GPU + CUDA 12.8

```bash
# 先安装 base
uv pip install "Pillow>=10.4" "numpy>=2.0" "zstandard>=0.22"

# 安装 torch（CUDA 12.8 版本）
uv pip install torch torchvision \
  --index-url https://download.pytorch.org/whl/cu128

# 安装 Real-ESRGAN 相关
uv pip install basicsr realesrgan pefile
```

### lora — LoRA 微调/推理（SDXL）

> 需要 NVIDIA GPU（RTX 4080+ 推荐，显存 ≥ 16 GB）

```bash
# 先完成 ai 组安装，再追加：
uv pip install \
  "diffusers>=0.36" \
  "peft>=0.18" \
  "transformers>=5.0" \
  "accelerate>=1.0" \
  "bitsandbytes>=0.49"
```

---

## 脚本说明

### `analyze_mpc_file.py`

分析 MPC 文件调色板和帧 RLE 编码。

```bash
python3 scripts/analyze_mpc_file.py resources-sword2/Mpc/magic/白虹贯日.mpc
```

**依赖**：无（stdlib only）

---

### `check_msf_alpha.py`

检查 MSF 文件的透明度通道信息。

```bash
python3 scripts/check_msf_alpha.py resources-sword2-new/asf/magic/白虹贯日.msf
```

**依赖**：无（stdlib only）

---

### `check-alpha.py`

批量检查 `magic/` 目录下各武功魔法素材的透明度质量。

```bash
# 在项目根目录执行
python3 scripts/check-alpha.py
```

**依赖**：`base`（Pillow + numpy）

---

### `convert-sword2.py`

将 `resources-sword2/` 批量转换为 `resources-sword2-new/`（UTF-8 编码、INI 字段重命名、格式适配等）。

```bash
# 预览（不实际修改）
python3 scripts/convert-sword2.py --dry-run

# 完整转换
python3 scripts/convert-sword2.py

# 只运行指定步骤
python3 scripts/convert-sword2.py --steps encoding,npc_fields,magic

# 跳过 Rust 转换器（只做 Python 处理）
python3 scripts/convert-sword2.py --no-rust
```

**依赖**：无（stdlib only，Rust 转换器为可选）

---

### `export-training-data.py`

解码 MSF 文件帧，导出为带 caption 的 PNG，用于 LoRA 训练数据集。

```bash
python3 scripts/export-training-data.py
# 输出目录：magic/_training_data/
```

**依赖**：`base`（Pillow + numpy + zstandard）

---

### `extract-and-upscale-icon.py`

从 `Jxqy.exe` 提取图标资源，并用 Real-ESRGAN 超分辨率放大（2×/4×/8×）。

```bash
python3 scripts/extract-and-upscale-icon.py --exe Jxqy.exe --scale 4
# 输出：scripts/icons/original/ 和 scripts/icons/upscaled/
```

**依赖**：`ai`（torch CUDA + basicsr + realesrgan + pefile）

---

### `train-lora-magic.py`

用游戏武功素材微调 SDXL LoRA，并用训练好的模型生成新武功效果图。

```bash
# Step 1：准备训练数据（需先运行 export-training-data.py）
# Step 2：训练 LoRA（约 30-60 分钟，RTX 4080）
python3 scripts/train-lora-magic.py train

# Step 3：生成新武功图
python3 scripts/train-lora-magic.py generate

# Step 4：生成全套魔法图集
python3 scripts/train-lora-magic.py generate-all
```

**依赖**：`lora`（torch CUDA + diffusers + peft + transformers + accelerate + bitsandbytes）

---

## 项目配置文件

| 文件 | 说明 |
|------|------|
| `pyproject.toml` | 依赖分组定义（`[dependency-groups]`），默认安装 `base` 组 |
| `.python-version` | 固定 Python 版本为 `3.12` |
| `.venv/` | uv 创建的虚拟环境，已加入 `.gitignore` 不提交 |
| `uv.lock` | uv 锁文件（建议提交，保证环境可复现） |

---

## 常用 uv 命令速查

```bash
# 查看当前已安装的包
uv pip list

# 查看当前 Python 版本
uv python --version

# 重建虚拟环境
uv venv --python 3.12

# 导出当前环境依赖（生成 requirements 文件）
uv pip freeze > requirements-current.txt

# 从 requirements 文件安装
uv pip install -r requirements-current.txt
```

---

## 注意事项

1. **不要使用 `uv sync` 与 `ai`/`lora` 组**：uv sync 在生成 lockfile 时需要解析所有组的依赖，会触发 torch（约 2 GB）的元数据/下载，耗时较长。直接使用 `uv pip install` 安装所需包即可。

2. **torch 版本必须与 CUDA 匹配**：当前环境 CUDA 12.8，安装时必须从 `https://download.pytorch.org/whl/cu128` 索引拉取。

3. **不要向 `packages/` 中的 TS 包添加 Python 依赖**：Python 脚本只放在 `scripts/` 目录中。
