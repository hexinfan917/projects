"""
内容服务 - Content Service
端口: 8005
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from common.config import settings
from common.database import init_db, close_db, get_db
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success

# 导入所有模型，确保 init_db() 能创建所有表
from app.models.article import Article
from app.models.banner import Banner

settings.app_name = "content-service"
settings.app_port = 8005
logger = setup_logger("content-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    await init_db()
    await redis_client.connect()
    yield
    await redis_client.close()
    await close_db()


app = FastAPI(title="内容服务", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


@app.get("/api/v1/admin/articles")
async def admin_get_articles(
    category: Optional[str] = None,
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取文章列表"""
    try:
        from app.models.article import Article
        from sqlalchemy import or_
        
        query = select(Article)
        
        if category:
            query = query.where(Article.category == category)
        if status is not None:
            query = query.where(Article.status == status)
        if keyword:
            query = query.where(or_(Article.title.contains(keyword), Article.summary.contains(keyword)))
        
        query = query.order_by(Article.is_top.desc(), Article.sort_order.desc(), Article.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        articles_db = result.scalars().all()
        
        articles = []
        for a in articles_db:
            articles.append({
                "id": a.id,
                "title": a.title,
                "subtitle": a.subtitle,
                "cover_image": a.cover_image,
                "images": a.images,
                "summary": a.summary,
                "category": a.category,
                "tags": a.tags.split(",") if a.tags else [],
                "author_name": a.author_name,
                "view_count": a.view_count,
                "like_count": a.like_count,
                "status": a.status,
                "is_top": a.is_top,
                "content": a.content,
                "location": a.location,
                "event_date": a.event_date,
                "participants": a.participants,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "articles": articles})
    except Exception as e:
        logger.error(f"Error getting articles: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/articles/{article_id}")
async def admin_get_article_detail(article_id: int, db: AsyncSession = Depends(get_db)):
    """获取文章详情"""
    try:
        from app.models.article import Article
        
        result = await db.execute(select(Article).where(Article.id == article_id))
        a = result.scalar_one_or_none()
        
        if not a:
            return {"code": 404, "message": "文章不存在", "data": None}
        
        return success({
            "id": a.id,
            "title": a.title,
            "subtitle": a.subtitle,
            "cover_image": a.cover_image,
            "images": a.images,
            "summary": a.summary,
            "content": a.content,
            "category": a.category,
            "tags": a.tags.split(",") if a.tags else [],
            "author_name": a.author_name,
            "view_count": a.view_count,
            "like_count": a.like_count,
            "status": a.status,
            "is_top": a.is_top,
            "sort_order": a.sort_order,
            "location": a.location,
            "event_date": a.event_date,
            "participants": a.participants,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    except Exception as e:
        logger.error(f"Error getting article: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/articles")
async def admin_create_article(data: dict, db: AsyncSession = Depends(get_db)):
    """创建文章"""
    try:
        from app.models.article import Article
        
        logger.info(f"[Create Article] Received data, images={data.get('images')}")
        
        article = Article(
            title=data.get("title"),
            subtitle=data.get("subtitle"),
            cover_image=data.get("cover_image"),
            images=data.get("images"),
            summary=data.get("summary"),
            content=data.get("content"),
            category=data.get("category", "travel"),
            tags=",".join(data.get("tags", [])) if data.get("tags") else None,
            author_name=data.get("author_name"),
            status=data.get("status", 0),
            is_top=data.get("is_top", 0),
            sort_order=data.get("sort_order", 0),
            location=data.get("location"),
            event_date=data.get("event_date"),
            participants=data.get("participants", 0),
            publish_time=datetime.now() if data.get("status") == 1 else None,
        )
        db.add(article)
        await db.commit()
        await db.refresh(article)
        
        return success({"id": article.id}, message="创建成功")
    except Exception as e:
        logger.error(f"Error creating article: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/articles/{article_id}")
async def admin_update_article(article_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新文章"""
    try:
        from app.models.article import Article
        
        logger.info(f"[Update Article] ID={article_id}, images={data.get('images')}")
        
        result = await db.execute(select(Article).where(Article.id == article_id))
        article = result.scalar_one_or_none()
        
        if not article:
            return {"code": 404, "message": "文章不存在", "data": None}
        
        article.title = data.get("title", article.title)
        article.subtitle = data.get("subtitle", article.subtitle)
        article.cover_image = data.get("cover_image", article.cover_image)
        article.images = data.get("images", article.images)
        article.summary = data.get("summary", article.summary)
        article.content = data.get("content", article.content)
        article.category = data.get("category", article.category)
        article.tags = ",".join(data["tags"]) if data.get("tags") else article.tags
        article.author_name = data.get("author_name", article.author_name)
        article.status = data.get("status", article.status)
        article.is_top = data.get("is_top", article.is_top)
        article.sort_order = data.get("sort_order", article.sort_order)
        article.location = data.get("location", article.location)
        article.event_date = data.get("event_date", article.event_date)
        article.participants = data.get("participants", article.participants)
        
        if data.get("status") == 1 and not article.publish_time:
            article.publish_time = datetime.now()
        
        await db.commit()
        logger.info(f"[Update Article] ID={article_id} updated successfully, images={article.images}")
        return success({"id": article.id}, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating article: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/articles/{article_id}")
async def admin_delete_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """删除文章"""
    try:
        from app.models.article import Article
        
        result = await db.execute(select(Article).where(Article.id == article_id))
        article = result.scalar_one_or_none()
        
        if not article:
            return {"code": 404, "message": "文章不存在", "data": None}
        
        await db.delete(article)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting article: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


# ==================== 小程序端 API ====================

@app.get("/api/v1/contents/articles")
async def get_articles(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    小程序端获取文章列表
    只返回已发布(status=1)的文章
    """
    try:
        from app.models.article import Article
        from sqlalchemy import or_
        
        query = select(Article).where(Article.status == 1)
        
        if category:
            query = query.where(Article.category == category)
        if keyword:
            query = query.where(or_(Article.title.contains(keyword), Article.summary.contains(keyword)))
        
        query = query.order_by(Article.is_top.desc(), Article.sort_order.desc(), Article.publish_time.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        articles_db = result.scalars().all()
        
        articles = []
        for a in articles_db:
            articles.append({
                "id": a.id,
                "title": a.title,
                "subtitle": a.subtitle,
                "cover_image": a.cover_image,
                "images": a.images,
                "summary": a.summary,
                "category": a.category,
                "tags": a.tags.split(",") if a.tags else [],
                "author_name": a.author_name,
                "view_count": a.view_count,
                "like_count": a.like_count,
                "location": a.location,
                "event_date": a.event_date,
                "participants": a.participants,
                "publish_time": a.publish_time.isoformat() if a.publish_time else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "articles": articles})
    except Exception as e:
        logger.error(f"Error getting articles: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/contents/articles/{article_id}")
async def get_article_detail(article_id: int, db: AsyncSession = Depends(get_db)):
    """
    小程序端获取文章详情
    自动增加浏览量
    """
    try:
        from app.models.article import Article
        
        result = await db.execute(select(Article).where(Article.id == article_id, Article.status == 1))
        a = result.scalar_one_or_none()
        
        if not a:
            return {"code": 404, "message": "文章不存在或已下架", "data": None}
        
        # 增加浏览量
        a.view_count = (a.view_count or 0) + 1
        await db.commit()
        
        return success({
            "id": a.id,
            "title": a.title,
            "subtitle": a.subtitle,
            "cover_image": a.cover_image,
            "images": a.images,
            "summary": a.summary,
            "content": a.content,
            "category": a.category,
            "tags": a.tags.split(",") if a.tags else [],
            "author_name": a.author_name,
            "view_count": a.view_count,
            "like_count": a.like_count,
            "location": a.location,
            "event_date": a.event_date,
            "participants": a.participants,
            "publish_time": a.publish_time.isoformat() if a.publish_time else None,
        })
    except Exception as e:
        logger.error(f"Error getting article: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/contents/articles/{article_id}/like")
async def like_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """小程序端文章点赞"""
    try:
        from app.models.article import Article
        
        result = await db.execute(select(Article).where(Article.id == article_id, Article.status == 1))
        article = result.scalar_one_or_none()
        
        if not article:
            return {"code": 404, "message": "文章不存在", "data": None}
        
        article.like_count = (article.like_count or 0) + 1
        await db.commit()
        
        return success({"like_count": article.like_count}, message="点赞成功")
    except Exception as e:
        logger.error(f"Error liking article: {e}")
        return {"code": 500, "message": f"操作失败: {str(e)}", "data": None}


# ==================== 轮播图管理 API ====================

@app.get("/api/v1/admin/banners")
async def admin_get_banners(
    status: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取轮播图列表"""
    try:
        from app.models.banner import Banner
        from sqlalchemy import or_
        
        query = select(Banner)
        
        if status is not None:
            query = query.where(Banner.status == status)
        if keyword:
            query = query.where(or_(Banner.title.contains(keyword)))
        
        query = query.order_by(Banner.sort_order.desc(), Banner.created_at.desc())
        
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(query)
        banners_db = result.scalars().all()
        
        banners = []
        for b in banners_db:
            banners.append({
                "id": b.id,
                "title": b.title,
                "image_url": b.image_url,
                "link_url": b.link_url,
                "status": b.status,
                "sort_order": b.sort_order,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            })
        
        return success({"total": total, "page": page, "page_size": page_size, "banners": banners})
    except Exception as e:
        logger.error(f"Error getting banners: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.get("/api/v1/admin/banners/{banner_id}")
async def admin_get_banner_detail(banner_id: int, db: AsyncSession = Depends(get_db)):
    """获取轮播图详情"""
    try:
        from app.models.banner import Banner
        
        result = await db.execute(select(Banner).where(Banner.id == banner_id))
        b = result.scalar_one_or_none()
        
        if not b:
            return {"code": 404, "message": "轮播图不存在", "data": None}
        
        return success({
            "id": b.id,
            "title": b.title,
            "image_url": b.image_url,
            "link_url": b.link_url,
            "status": b.status,
            "sort_order": b.sort_order,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    except Exception as e:
        logger.error(f"Error getting banner: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


@app.post("/api/v1/admin/banners")
async def admin_create_banner(data: dict, db: AsyncSession = Depends(get_db)):
    """创建轮播图"""
    try:
        from app.models.banner import Banner
        
        banner = Banner(
            title=data.get("title"),
            image_url=data.get("image_url"),
            link_url=data.get("link_url"),
            status=data.get("status", 1),
            sort_order=data.get("sort_order", 0),
        )
        db.add(banner)
        await db.commit()
        await db.refresh(banner)
        
        return success({"id": banner.id}, message="创建成功")
    except Exception as e:
        logger.error(f"Error creating banner: {e}")
        return {"code": 500, "message": f"创建失败: {str(e)}", "data": None}


@app.put("/api/v1/admin/banners/{banner_id}")
async def admin_update_banner(banner_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """更新轮播图"""
    try:
        from app.models.banner import Banner
        
        result = await db.execute(select(Banner).where(Banner.id == banner_id))
        banner = result.scalar_one_or_none()
        
        if not banner:
            return {"code": 404, "message": "轮播图不存在", "data": None}
        
        banner.title = data.get("title", banner.title)
        banner.image_url = data.get("image_url", banner.image_url)
        banner.link_url = data.get("link_url", banner.link_url)
        banner.status = data.get("status", banner.status)
        banner.sort_order = data.get("sort_order", banner.sort_order)
        
        await db.commit()
        return success({"id": banner.id}, message="更新成功")
    except Exception as e:
        logger.error(f"Error updating banner: {e}")
        return {"code": 500, "message": f"更新失败: {str(e)}", "data": None}


@app.delete("/api/v1/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: int, db: AsyncSession = Depends(get_db)):
    """删除轮播图"""
    try:
        from app.models.banner import Banner
        
        result = await db.execute(select(Banner).where(Banner.id == banner_id))
        banner = result.scalar_one_or_none()
        
        if not banner:
            return {"code": 404, "message": "轮播图不存在", "data": None}
        
        await db.delete(banner)
        await db.commit()
        
        return success(None, message="删除成功")
    except Exception as e:
        logger.error(f"Error deleting banner: {e}")
        return {"code": 500, "message": f"删除失败: {str(e)}", "data": None}


@app.get("/api/v1/contents/banners")
async def get_banners(db: AsyncSession = Depends(get_db)):
    """
    小程序端获取轮播图列表
    只返回已启用(status=1)的轮播图，按排序倒序
    """
    try:
        from app.models.banner import Banner
        
        query = select(Banner).where(Banner.status == 1).order_by(Banner.sort_order.desc(), Banner.created_at.desc())
        result = await db.execute(query)
        banners_db = result.scalars().all()
        
        banners = []
        for b in banners_db:
            banners.append({
                "id": b.id,
                "title": b.title,
                "image_url": b.image_url,
                "link_url": b.link_url,
            })
        
        return success({"banners": banners})
    except Exception as e:
        logger.error(f"Error getting banners: {e}")
        return {"code": 500, "message": f"查询失败: {str(e)}", "data": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
