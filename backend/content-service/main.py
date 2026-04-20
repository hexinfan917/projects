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
                "summary": a.summary,
                "category": a.category,
                "tags": a.tags.split(",") if a.tags else [],
                "author_name": a.author_name,
                "view_count": a.view_count,
                "like_count": a.like_count,
                "status": a.status,
                "is_top": a.is_top,
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
        
        article = Article(
            title=data.get("title"),
            subtitle=data.get("subtitle"),
            cover_image=data.get("cover_image"),
            summary=data.get("summary"),
            content=data.get("content"),
            category=data.get("category", "travel"),
            tags=",".join(data.get("tags", [])) if data.get("tags") else None,
            author_name=data.get("author_name"),
            status=data.get("status", 0),
            is_top=data.get("is_top", 0),
            sort_order=data.get("sort_order", 0),
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
        
        result = await db.execute(select(Article).where(Article.id == article_id))
        article = result.scalar_one_or_none()
        
        if not article:
            return {"code": 404, "message": "文章不存在", "data": None}
        
        article.title = data.get("title", article.title)
        article.subtitle = data.get("subtitle", article.subtitle)
        article.cover_image = data.get("cover_image", article.cover_image)
        article.summary = data.get("summary", article.summary)
        article.content = data.get("content", article.content)
        article.category = data.get("category", article.category)
        article.tags = ",".join(data["tags"]) if data.get("tags") else article.tags
        article.author_name = data.get("author_name", article.author_name)
        article.status = data.get("status", article.status)
        article.is_top = data.get("is_top", article.is_top)
        article.sort_order = data.get("sort_order", article.sort_order)
        
        if data.get("status") == 1 and not article.publish_time:
            article.publish_time = datetime.now()
        
        await db.commit()
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
