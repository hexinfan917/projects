
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

    # 批量查询订单信息和优惠券数量
    membership_ids = [row[0].id for row in rows]
    order_data = {}
    if membership_ids:
        order_result = await db.execute(
            text("SELECT id, order_no, pay_channel FROM member_orders WHERE id IN :ids"),
            {"ids": tuple(membership_ids) if len(membership_ids) > 1 else (membership_ids[0], membership_ids[0])}
        )
        for row in order_result.mappings().all():
            order_data[row["id"]] = {"order_no": row["order_no"], "pay_channel": row["pay_channel"]}

    coupon_counts = {}
    if membership_ids:
        coupon_result = await db.execute(
            text("SELECT source_id, COUNT(*) as cnt FROM user_coupons WHERE source_type = 2 AND source_id IN :ids GROUP BY source_id"),
            {"ids": tuple(membership_ids) if len(membership_ids) > 1 else (membership_ids[0], membership_ids[0])}
        )
        for row in coupon_result.mappings().all():
            coupon_counts[row["source_id"]] = row["cnt"]

    data = []
    for row in rows:
        m = row[0]
        benefit = m.benefit_snapshot or {}
        if isinstance(benefit, str):
            try:
                benefit = json.loads(benefit)
            except:
                benefit = {}
        benefits_list = []
        if benefit.get("discount_rate"):
            benefits_list.append(f"{int(benefit['discount_rate'] * 10)}折")
        if benefit.get("priority_booking"):
            benefits_list.append("优先预订")
        if benefit.get("free_cancellation"):
            benefits_list.append("免费退改")
        if benefit.get("points_multiplier"):
            benefits_list.append(f"{benefit['points_multiplier']}倍积分")
        if benefit.get("free_pet_insurance"):
            benefits_list.append("宠物保险")

        order_info = order_data.get(m.order_id, {})
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
            "benefits": benefits_list,
            "order_no": order_info.get("order_no", "-"),
            "pay_channel": order_info.get("pay_channel", "-"),
            "coupon_count": coupon_counts.get(m.order_id, 0),
        })

    return success({
        "list": data,
        "total": total,
        "page": page,
        "page_size": page_size,
    })
