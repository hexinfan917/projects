files = {
    '/opt/petway/backend/user-service/app/models/admin_user.py': '''"""
管理员账号模型
对应 admin_users 表
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base


class AdminUser(Base):
    """管理员账号表"""
    __tablename__ = "admin_users"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="ID")
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="用户名")
    password: Mapped[str] = mapped_column(String(255), nullable=False, comment="密码")
    real_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="真实姓名")
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="手机号")
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="邮箱")
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="头像")
    role_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("admin_roles.id"), nullable=True, comment="角色ID")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="最后登录时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    role: Mapped[Optional["AdminRole"]] = relationship("AdminRole", lazy="joined")
''',
    '/opt/petway/backend/user-service/app/models/admin_role.py': '''"""
管理员角色模型
对应 admin_roles 表
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, func, Table, Column, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base

admin_role_menus = Table(
    "admin_role_menus",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True, comment="ID"),
    Column("role_id", Integer, ForeignKey("admin_roles.id"), nullable=False, comment="角色ID"),
    Column("menu_id", Integer, ForeignKey("admin_menus.id"), nullable=False, comment="菜单ID"),
)

class AdminRole(Base):
    """管理员角色表"""
    __tablename__ = "admin_roles"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="角色名称")
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="角色编码")
    description: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="角色描述")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    menus: Mapped[List["AdminMenu"]] = relationship(
        "AdminMenu",
        secondary=admin_role_menus,
        lazy="selectin"
    )
''',
    '/opt/petway/backend/user-service/app/models/admin_menu.py': '''"""
系统菜单模型
对应 admin_menus 表
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from common.database import Base

class AdminMenu(Base):
    """系统菜单表"""
    __tablename__ = "admin_menus"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="ID")
    parent_id: Mapped[int] = mapped_column(Integer, default=0, comment="父菜单ID")
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="菜单名称")
    path: Mapped[Optional[str]] = mapped_column(String(200), nullable=True, comment="路由路径")
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="图标")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    type: Mapped[int] = mapped_column(Integer, nullable=False, comment="1目录 2菜单 3按钮")
    permission: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="权限标识")
    status: Mapped[int] = mapped_column(Integer, default=1, comment="0禁用 1启用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
''',
    '/opt/petway/backend/user-service/app/models/__init__.py': '''from .user import User
from .pet import PetProfile
from .traveler import Traveler
from .member import MemberPlan, UserMembership, MemberOrder
from .popup import PopupConfig, UserPopupLog
from .setting import SystemSetting
from .operation_log import OperationLog
from .admin_user import AdminUser
from .admin_role import AdminRole, admin_role_menus
from .admin_menu import AdminMenu
''',
}

for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed {path}')
