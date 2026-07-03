#!/usr/bin/env python3
"""
一键处理小程序 tabBar 图标。

用法：
1. 把 4 张带文字的原图放到 assets-raw/tab-icons/ 目录：
   - home.png     （首页：房子图标）
   - route.png    （活动：日历图标）
   - pet.png      （档案：文件+爪印图标）
   - profile.png  （我的：人物图标）
2. 运行：python scripts/prepare-tab-icons.py
3. 脚本会自动：去掉浅色背景、裁剪掉图片下半部分的文字、
   生成普通/选中两种状态，并覆盖到 src/assets/icons/ 下的 tab-*.png。
"""

from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "assets-raw/tab-icons"
OUT_DIR = BASE_DIR / "src/assets/icons"

# 微信小程序 tabBar 图标建议尺寸
SIZE = 81

# 颜色（用户要求图标为黑色，普通/选中均用黑色）
COLOR_NORMAL = (0, 0, 0, 255)           # #000000
COLOR_SELECTED = (0, 0, 0, 255)         # #000000

# 裁剪配置：保留图片上半部分（图标区域），去掉下半部分文字
CROP_TOP_RATIO = 0.65

# 背景去除阈值：RGB 都大于该值视为背景
BG_THRESHOLD = 200

# 最终图标留白（像素），越小图标越大
PADDING = 2

FILES = {
    "home.png": ("tab-home.png", "tab-home-active.png", False),
    "route.png": ("tab-route.png", "tab-route-active.png", True),
    "pet.png": ("tab-pet.png", "tab-pet-active.png", False),
    "profile.png": ("tab-profile.png", "tab-profile-active.png", False),
}


def remove_background(img: Image.Image) -> Image.Image:
    """将接近白色的背景转为透明，返回 RGBA。"""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r > BG_THRESHOLD and g > BG_THRESHOLD and b > BG_THRESHOLD:
                pixels[x, y] = (0, 0, 0, 0)
    return img


def recolor(img: Image.Image, color: tuple) -> Image.Image:
    """将非透明像素替换为指定颜色，保留透明度。"""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                pixels[x, y] = color
    return img


def get_bbox(img: Image.Image) -> tuple:
    """返回非透明像素的边界框 (left, top, right, bottom)。"""
    alpha = img.split()[3]
    return alpha.getbbox()


def process(src_name: str, normal_name: str, active_name: str, fill_height: bool = False):
    src_path = RAW_DIR / src_name
    if not src_path.exists():
        print(f"[跳过] 未找到 {src_path}")
        return

    with Image.open(src_path) as im:
        # 1. 去背景
        im = remove_background(im)

        # 2. 裁剪上半部分图标区域（去掉文字）
        w, h = im.size
        crop_h = int(h * CROP_TOP_RATIO)
        cropped = im.crop((0, 0, w, crop_h))

        # 3. 裁剪出图标实际占用区域，去掉四周空白
        bbox = get_bbox(cropped)
        if bbox:
            icon = cropped.crop(bbox)
        else:
            icon = cropped

        # 4. 缩放到 (SIZE - 2*PADDING) 的区域内
        iw, ih = icon.size
        max_side = SIZE - 2 * PADDING

        if fill_height:
            # 按高度撑满，允许宽度超出后水平居中裁剪
            scale = max_side / ih
            new_w = max(1, int(iw * scale))
            new_h = max_side
            scaled = icon.resize((new_w, new_h), Image.LANCZOS)
            # 水平居中，如果宽度超出则裁剪
            canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            offset_x = (SIZE - new_w) // 2
            offset_y = PADDING
            canvas.paste(scaled, (offset_x, offset_y), scaled)
        else:
            # 等比缩放，完整显示
            scale = min(max_side / iw, max_side / ih)
            new_w = max(1, int(iw * scale))
            new_h = max(1, int(ih * scale))
            scaled = icon.resize((new_w, new_h), Image.LANCZOS)

            canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            offset_x = (SIZE - new_w) // 2
            offset_y = (SIZE - new_h) // 2
            canvas.paste(scaled, (offset_x, offset_y), scaled)

        # 5. 生成普通和选中状态
        normal = recolor(canvas, COLOR_NORMAL)
        active = recolor(canvas, COLOR_SELECTED)

        normal.save(OUT_DIR / normal_name, "PNG")
        active.save(OUT_DIR / active_name, "PNG")
        print(f"[生成] {normal_name}, {active_name}")


def main():
    if not RAW_DIR.exists():
        RAW_DIR.mkdir(parents=True)
        print(f"已创建目录 {RAW_DIR}，请把 4 张原图放进去。")
        return

    for src, (normal, active, fill_height) in FILES.items():
        process(src, normal, active, fill_height)

    print("完成，请重新编译小程序查看效果。")


if __name__ == "__main__":
    main()
