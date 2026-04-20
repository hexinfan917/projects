from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(text, color, output_path, size=(144, 144)):
    img = Image.new('RGB', size, color)
    draw = ImageDraw.Draw(img)
    
    # 尝试使用默认字体
    try:
        font = ImageFont.truetype("arial.ttf", 60)
    except:
        font = ImageFont.load_default()
    
    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size[0] - text_width) // 2
    y = (size[1] - text_height) // 2
    
    draw.text((x, y), text, fill="white", font=font)
    img.save(output_path)
    print(f"生成: {output_path}")

if __name__ == "__main__":
    output_dir = "frontend/miniapp/src/assets/images"
    os.makedirs(output_dir, exist_ok=True)
    
    icons = [
        ("首", "#FF6B6B", "icon_home.png"),
        ("路", "#4ECDC4", "icon_route.png"),
        ("订", "#45B7D1", "icon_order.png"),
        ("我", "#96CEB4", "icon_mine.png"),
    ]
    
    for text, color, filename in icons:
        create_icon(text, color, os.path.join(output_dir, filename))
