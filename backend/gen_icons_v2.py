from PIL import Image, ImageDraw, ImageFont
import os

def create_rounded_icon(text, bg_color, output_path, size=(144, 144)):
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆角矩形背景
    draw.rounded_rectangle([0, 0, size[0], size[1]], radius=28, fill=bg_color)
    
    try:
        font = ImageFont.truetype("arial.ttf", 64)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, fill="white", font=font)
    img.save(output_path)
    print(f"生成: {output_path}")

if __name__ == "__main__":
    output_dir = "frontend/miniapp/src/assets/images/tabbar"
    os.makedirs(output_dir, exist_ok=True)
    
    icons = [
        ("首", "#FF6B6B", "home.png"),
        ("路", "#4ECDC4", "route.png"),
        ("订", "#45B7D1", "order.png"),
        ("我", "#96CEB4", "profile.png"),
    ]
    
    for text, color, filename in icons:
        create_rounded_icon(text, color, os.path.join(output_dir, filename))
