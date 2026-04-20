"""
操作日志模型
"""
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from common.database import Base


class OperationLog(Base):
    """操作日志表"""
    __tablename__ = "operation_logs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="操作用户ID")
    username: Mapped[str] = mapped_column(String(50), nullable=True, comment="用户名")
    action: Mapped[str] = mapped_column(String(50), nullable=False, comment="操作类型")
    module: Mapped[str] = mapped_column(String(50), nullable=False, comment="操作模块")
    description: Mapped[str] = mapped_column(Text, nullable=True, comment="操作描述")
    request_path: Mapped[str] = mapped_column(String(500), nullable=True, comment="请求路径")
    request_method: Mapped[str] = mapped_column(String(10), nullable=True, comment="请求方法")
    request_params: Mapped[str] = mapped_column(Text, nullable=True, comment="请求参数")
    response_code: Mapped[int] = mapped_column(Integer, nullable=True, comment="响应状态码")
    ip_address: Mapped[str] = mapped_column(String(50), nullable=True, comment="IP地址")
    user_agent: Mapped[str] = mapped_column(String(500), nullable=True, comment="User-Agent")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
