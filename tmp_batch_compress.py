import os
import re

# 定义每个文件的具体替换规则
# (文件路径, [(旧字符串, 新字符串), ...])
replacements = [
    # 1. 首页
    ("frontend/miniapp/src/pages/index/index.tsx", [
        # banner 轮播图 (大图 750)
        ("image: b.image_url ? (b.image_url.startsWith('http') ? b.image_url : `https://tailtravel.westilt.com${b.image_url}`) : ''",
         "image: b.image_url ? (b.image_url.startsWith('http') ? b.image_url : `https://tailtravel.westilt.com${b.image_url}`) + '?w=750&q=80' : ''"),
        # 热门路线封面 (卡片 400)
        ("cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) : 'https://via.placeholder.com/620x420/CCCCCC/FFFFFF?text=No+Image'",
         "cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) + '?w=400&q=80' : 'https://via.placeholder.com/620x420/CCCCCC/FFFFFF?text=No+Image'"),
        # 狗狗回顾封面 (卡片 400)
        ("image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : 'https://via.placeholder.com/700x380/CCCCCC/FFFFFF?text=No+Image'",
         "image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) + '?w=400&q=80' : 'https://via.placeholder.com/700x380/CCCCCC/FFFFFF?text=No+Image'"),
        # 公益活动封面 (卡片 400)
        ("image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : 'https://via.placeholder.com/700x380/96C93D/FFFFFF?text=Charity'",
         "image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) + '?w=400&q=80' : 'https://via.placeholder.com/700x380/96C93D/FFFFFF?text=Charity'"),
        # 弹窗海报 (中等 600)
        ("src={popupData.image ? (popupData.image.startsWith('http') ? popupData.image : `${BASE_URL}${popupData.image}`) : '/assets/images/member.jpg'}",
         "src={popupData.image ? (popupData.image.startsWith('http') ? popupData.image : `${BASE_URL}${popupData.image}`) + '?w=600&q=80' : '/assets/images/member.jpg'}"),
    ]),
    # 2. 路线列表
    ("frontend/miniapp/src/pages/routes/index.tsx", [
        ("cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) : ''",
         "cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) + '?w=400&q=80' : ''"),
    ]),
    # 3. 搜索
    ("frontend/miniapp/src/pages/search/index.tsx", [
        ("cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) : ''",
         "cover_image: r.cover_image ? (r.cover_image.startsWith('http') ? r.cover_image : `https://tailtravel.westilt.com${r.cover_image}`) + '?w=400&q=80' : ''"),
    ]),
    # 4. 社区
    ("frontend/miniapp/src/pages/community/index.tsx", [
        ("src={article.cover_image}", "src={article.cover_image ? (article.cover_image.startsWith('http') ? article.cover_image : `https://tailtravel.westilt.com${article.cover_image}`) + '?w=400&q=80' : ''}"),
    ]),
    # 5. 公益列表
    ("frontend/miniapp/src/pages/charities/list/index.tsx", [
        ("image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : ''",
         "image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) + '?w=400&q=80' : ''"),
    ]),
    # 6. 公益详情
    ("frontend/miniapp/src/pages/charities/detail/index.tsx", [
        ("const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `https://tailtravel.westilt.com${detail.cover_image}`) : ''",
         "const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `https://tailtravel.westilt.com${detail.cover_image}`) + '?w=750&q=80' : ''"),
        ("const getFullImageUrl = (url: string) => url.startsWith('http') ? url : `https://tailtravel.westilt.com${url}`",
         "const getFullImageUrl = (url: string) => url.startsWith('http') ? url + '?w=800&q=80' : `https://tailtravel.westilt.com${url}?w=800&q=80`"),
    ]),
    # 7. 回顾列表
    ("frontend/miniapp/src/pages/reviews/list/index.tsx", [
        ("image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) : ''",
         "image: a.cover_image ? (a.cover_image.startsWith('http') ? a.cover_image : `https://tailtravel.westilt.com${a.cover_image}`) + '?w=400&q=80' : ''"),
    ]),
    # 8. 回顾详情
    ("frontend/miniapp/src/pages/reviews/detail/index.tsx", [
        ("const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `https://tailtravel.westilt.com${detail.cover_image}`) : ''",
         "const coverImage = detail.cover_image ? (detail.cover_image.startsWith('http') ? detail.cover_image : `https://tailtravel.westilt.com${detail.cover_image}`) + '?w=750&q=80' : ''"),
        ("const getFullImageUrl = (url: string) => url.startsWith('http') ? url : `https://tailtravel.westilt.com${url}`",
         "const getFullImageUrl = (url: string) => url.startsWith('http') ? url + '?w=800&q=80' : `https://tailtravel.westilt.com${url}?w=800&q=80`"),
    ]),
    # 9. 足迹
    ("frontend/miniapp/src/pages/profile/footprint/index.tsx", [
        ("src={item.cover_image}", "src={item.cover_image ? (item.cover_image.startsWith('http') ? item.cover_image : `https://tailtravel.westilt.com${item.cover_image}`) + '?w=400&q=80' : ''}"),
    ]),
    # 10. 个人中心
    ("frontend/miniapp/src/pages/profile/index.tsx", [
        ("src={user.avatar}", "src={compressImageUrl(user.avatar, 200)}"),
    ]),
    # 11. 编辑资料
    ("frontend/miniapp/src/pages/profile/edit/index.tsx", [
        ("function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return url.startsWith('http') ? url : `${BASE_URL}${url}`\n}", "function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return compressImageUrl(url, 200)\n}"),
    ]),
    # 12. 宠物列表
    ("frontend/miniapp/src/pages/profile/pets/index.tsx", [
        ("function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return url.startsWith('http') ? url : `${BASE_URL}${url}`\n}", "function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return compressImageUrl(url, 200)\n}"),
    ]),
    # 13. 宠物编辑
    ("frontend/miniapp/src/pages/profile/pet-edit/index.tsx", [
        ("function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return url.startsWith('http') ? url : `${BASE_URL}${url}`\n}", "function fullImageUrl(url?: string) {\n  if (!url) return ''\n  return compressImageUrl(url, 200)\n}"),
    ]),
    # 14. 订单确认
    ("frontend/miniapp/src/pages/orders/confirm/index.tsx", [
        ("src={pet.avatar || 'https://via.placeholder.com/120'}", "src={compressImageUrl(pet.avatar, 200) || 'https://via.placeholder.com/120'}"),
    ]),
]

# 执行替换
for file_path, rules in replacements:
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for old, new in rules:
        content = content.replace(old, new)
    
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"已修改: {file_path}")
    else:
        print(f"未修改: {file_path}")

print("\n完成!")
