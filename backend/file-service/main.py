"""
文件服务 - File Service
端口: 8008
职责: 文件上传/处理/分发
"""
import sys
import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from common.config import settings
from common.redis_client import redis_client
from common.middleware import setup_cors, RequestLogMiddleware
from common.exceptions import APIException, api_exception_handler
from common.logger import setup_logger
from common.response import success

settings.app_name = "file-service"
settings.app_port = 8008
logger = setup_logger("file-service")

# 上传配置
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 允许的文件类型
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo"}
ALLOWED_FILE_TYPES = {"application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}

# 最大文件大小 (MB)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name}...")
    try:
        await redis_client.connect()
    except:
        logger.warning("Redis connection failed, continuing without Redis")
    yield
    try:
        await redis_client.close()
    except:
        pass

app = FastAPI(title="文件服务", description="文件上传/处理/分发", version="1.0.0", lifespan=lifespan)
setup_cors(app)
app.add_middleware(RequestLogMiddleware)
app.add_exception_handler(APIException, api_exception_handler)

# 静态文件服务 - 用于访问上传的文件
app.mount("/static", StaticFiles(directory=str(UPLOAD_DIR)), name="static")


def generate_unique_filename(original_filename: str) -> str:
    """生成唯一文件名"""
    ext = Path(original_filename).suffix.lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    return f"{timestamp}_{unique_id}{ext}"


def validate_file(file: UploadFile, file_type: str = "image"):
    """验证文件类型和大小"""
    content_type = file.content_type or ""
    
    if file_type == "image":
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"不支持的图片格式: {content_type}")
    elif file_type == "video":
        if content_type not in ALLOWED_VIDEO_TYPES:
            raise HTTPException(status_code=400, detail=f"不支持的视频格式: {content_type}")
    elif file_type == "file":
        allowed = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | ALLOWED_FILE_TYPES
        if content_type not in allowed:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {content_type}")
    
    return True


async def save_upload_file(upload_file: UploadFile, folder: str = "") -> dict:
    """保存上传文件"""
    # 生成唯一文件名
    unique_filename = generate_unique_filename(upload_file.filename or "unknown")
    
    # 按日期组织文件夹
    date_folder = datetime.now().strftime("%Y%m")
    if folder:
        save_dir = UPLOAD_DIR / folder / date_folder
    else:
        save_dir = UPLOAD_DIR / date_folder
    save_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = save_dir / unique_filename
    
    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail="文件保存失败")
    finally:
        upload_file.file.close()
    
    # 计算文件大小
    file_size = file_path.stat().st_size
    
    # 构建访问 URL
    if folder:
        relative_path = f"{folder}/{date_folder}/{unique_filename}"
    else:
        relative_path = f"{date_folder}/{unique_filename}"
    
    # 构建 URL (使用当前服务地址)
    file_url = f"/api/v1/files/static/{relative_path}"
    
    return {
        "filename": unique_filename,
        "original_name": upload_file.filename,
        "url": file_url,
        "full_url": file_url,
        "size": file_size,
        "content_type": upload_file.content_type,
        "path": str(relative_path)
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/v1/files/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """
    上传图片
    
    - 支持格式: jpg, jpeg, png, gif, webp
    - 最大大小: 10MB
    """
    # 验证文件类型
    validate_file(file, "image")
    
    # 读取文件内容检查大小
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"图片大小超过限制 (最大 {MAX_IMAGE_SIZE // 1024 // 1024}MB)")
    
    # 重置文件指针
    file.file.seek(0)
    
    # 保存文件
    result = await save_upload_file(file, folder="images")
    
    logger.info(f"Image uploaded: {result['filename']}")
    return success(result)


@app.post("/api/v1/files/upload/images")
async def upload_images(files: list[UploadFile] = File(...)):
    """
    批量上传图片
    
    - 最多支持 9 张图片
    - 支持格式: jpg, jpeg, png, gif, webp
    """
    if len(files) > 9:
        raise HTTPException(status_code=400, detail="最多一次上传 9 张图片")
    
    results = []
    for file in files:
        try:
            validate_file(file, "image")
            content = await file.read()
            if len(content) > MAX_IMAGE_SIZE:
                raise HTTPException(status_code=400, detail=f"图片 {file.filename} 大小超过限制")
            file.file.seek(0)
            result = await save_upload_file(file, folder="images")
            results.append(result)
        except HTTPException as e:
            results.append({"error": e.detail, "original_name": file.filename})
        except Exception as e:
            logger.error(f"Failed to upload file {file.filename}: {e}")
            results.append({"error": "上传失败", "original_name": file.filename})
    
    logger.info(f"Batch upload: {len([r for r in results if 'error' not in r])} success, {len([r for r in results if 'error' in r])} failed")
    return success({"files": results, "total": len(files), "success": len([r for r in results if 'error' not in r])})


@app.post("/api/v1/files/upload/video")
async def upload_video(file: UploadFile = File(...)):
    """
    上传视频
    
    - 支持格式: mp4, mov, avi
    - 最大大小: 100MB
    """
    # 验证文件类型
    validate_file(file, "video")
    
    # 检查大小
    content = await file.read()
    if len(content) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail=f"视频大小超过限制 (最大 {MAX_VIDEO_SIZE // 1024 // 1024}MB)")
    
    file.file.seek(0)
    
    # 保存文件
    result = await save_upload_file(file, folder="videos")
    
    logger.info(f"Video uploaded: {result['filename']}")
    return success(result)


@app.get("/api/v1/files/static/{folder}/{date}/{filename}")
async def serve_file(folder: str, date: str, filename: str):
    """提供文件访问"""
    file_path = UPLOAD_DIR / folder / date / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 根据扩展名确定 content_type
    ext = Path(filename).suffix.lower()
    content_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
    }
    content_type = content_type_map.get(ext, "application/octet-stream")
    
    return FileResponse(str(file_path), media_type=content_type)


@app.delete("/api/v1/files/{folder}/{date}/{filename}")
async def delete_file(folder: str, date: str, filename: str):
    """删除文件"""
    file_path = UPLOAD_DIR / folder / date / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    try:
        file_path.unlink()
        logger.info(f"File deleted: {filename}")
        return success({"message": "文件已删除"})
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise HTTPException(status_code=500, detail="删除失败")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=settings.debug)
