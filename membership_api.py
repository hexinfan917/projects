
# ==================== 管理后台：会员列表 ====================

@app.get("/api/v1/admin/memberships")
async def admin_get_memberships(
    keyword: Optional[str] = None,
    status: Optional[int] = None,
    plan_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """管理后台获取会员订阅列表"""
    from app.models.member import UserMembership, MemberPlan
    from app.models.user import User
    from sqlalchemy import func

    # Build base query with joins
    base_query = select(
        UserMembership,
        User.nickname,
        User.phone,
        User.avatar,
        MemberPlan.name.label("plan_name")
    ).join(User, UserMembership.user_id == User.id, isouter=True
    ).join(MemberPlan, UserMembership.plan_id == MemberPlan.id, isouter=True
    ).order_by(UserMembership.created_at.desc())

    if status is not None:
        base_query = base_query.where(UserMembership.status == status)
    if plan_id is not None:
        base_query = base_query.where(UserMembership.plan_id == plan_id)
    if keyword:
        base_query = base_query.where(
            (User.nickname.contains(keyword)) | (User.phone.contains(keyword))
        )

    # Count total
    count_query = select(func.count()).select_from(UserMembership)
    if status is not None:
        count_query = count_query.where(UserMembership.status == status)
    if plan_id is not None:
        count_query = count_query.where(UserMembership.plan_id == plan_id)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    base_query = base_query.offset(offset).limit(page_size)

    result = await db.execute(base_query)
    rows = result.all()

    data = []
    for row in rows:
        m = row[0]
        data.append({
            "id": m.id,
            "user_id": m.user_id,
            "nickname": row[1] or "未知用户",
            "phone": row[2] or "-",
            "avatar": row[3] or "",
            "plan_id": m.plan_id,
            "plan_name": row[4] or "未知套餐",
            "status": m.status,
            "start_date": m.start_date.isoformat() if m.start_date else None,
            "end_date": m.end_date.isoformat() if m.end_date else None,
            "pay_amount": float(m.pay_amount) if m.pay_amount else 0,
            "is_auto_renew": m.is_auto_renew,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        })

    return success({
        "list": data,
        "total": total,
        "page": page,
        "page_size": page_size,
    })
