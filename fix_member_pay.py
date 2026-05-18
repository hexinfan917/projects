import re

with open("/opt/petway/backend/order-service/main.py", "r") as f:
    content = f.read()

# Strategy: 
# 1. Replace pay_callback to also handle member_orders
# 2. Replace pay_member_order to call pay-service like regular orders do

# Step 1: Find and replace pay_callback
old_callback = '''@app.post("/api/v1/orders/pay/callback")
async def pay_callback(data: dict, db: AsyncSession = Depends(get_db)):
    """
    支付回调 - 更新订单支付状态
    
    由 pay-service 调用，通知订单支付结果
    """
    logger.info(f"Pay callback received: {data}")
    
    from app.models.order import Order
    
    # 获取订单标识
    order_no = data.get("order_no") or data.get("out_trade_no")
    transaction_id = data.get("transaction_id", "")
    pay_channel = data.get("pay_channel", "wechat")
    
    if not order_no:
        logger.error("Pay callback missing order_no")
        return {"code": "FAIL", "message": "Missing order_no"}
    
    try:
        # 查询订单
        result = await db.execute(select(Order).where(Order.order_no == order_no))
        order = result.scalar_one_or_none()
        
        if not order:
            logger.error(f"Pay callback order not found: {order_no}")
            return {"code": "FAIL", "message": "Order not found"}
        
        # 只能更新待支付订单
        if order.status != 10:
            logger.warning(f"Pay callback order status invalid: {order_no}, status={order.status}")
            return {"code": "SUCCESS", "message": "Order already processed"}
        
        # 更新订单状态
        order.status = 20  # 待出行
        order.pay_time = datetime.now()
        order.pay_channel = pay_channel
        order.pay_trade_no = transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        await db.commit()
        
        logger.info(f"Order paid via callback: {order_no}, id={order.id}")
        
        # TODO: 扣减排期库存（如需恢复库存管理，调用 route-service 扣减库存）
        # TODO: 发送支付成功通知（短信/推送）
        
    except Exception as e:
        logger.error(f"Pay callback processing error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": "FAIL", "message": "Internal error"}
    
    return {"code": "SUCCESS", "message": "OK"}'''

new_callback = '''@app.post("/api/v1/orders/pay/callback")
async def pay_callback(data: dict, db: AsyncSession = Depends(get_db)):
    """
    支付回调 - 更新订单支付状态
    
    由 pay-service 调用，通知订单支付结果
    """
    logger.info(f"Pay callback received: {data}")
    
    from app.models.order import Order
    
    # 获取订单标识
    order_no = data.get("order_no") or data.get("out_trade_no")
    transaction_id = data.get("transaction_id", "")
    pay_channel = data.get("pay_channel", "wechat")
    
    if not order_no:
        logger.error("Pay callback missing order_no")
        return {"code": "FAIL", "message": "Missing order_no"}
    
    try:
        # 先查询普通订单
        result = await db.execute(select(Order).where(Order.order_no == order_no))
        order = result.scalar_one_or_none()
        
        if order:
            # 普通订单处理
            if order.status != 10:
                logger.warning(f"Pay callback order status invalid: {order_no}, status={order.status}")
                return {"code": "SUCCESS", "message": "Order already processed"}
            
            order.status = 20
            order.pay_time = datetime.now()
            order.pay_channel = pay_channel
            order.pay_trade_no = transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"
            await db.commit()
            logger.info(f"Order paid via callback: {order_no}, id={order.id}")
            return {"code": "SUCCESS", "message": "OK"}
        
        # 普通订单不存在，尝试查找会员订单
        member_result = await db.execute(
            text("SELECT * FROM member_orders WHERE order_no = :order_no"),
            {"order_no": order_no}
        )
        member_order = member_result.mappings().one_or_none()
        
        if member_order:
            # 会员订单处理
            if member_order["status"] != 10:
                return {"code": "SUCCESS", "message": "Member order already processed"}
            
            # Update member order status
            await db.execute(
                text("UPDATE member_orders SET status = 20, pay_time = NOW(), pay_channel = :pay_channel, pay_trade_no = :trade_no, updated_at = NOW() WHERE id = :order_id"),
                {"order_id": member_order["id"], "pay_channel": pay_channel, "trade_no": transaction_id or f"WX{datetime.now().strftime('%Y%m%d%H%M%S')}"}
            )
            
            # Process membership
            plan_result = await db.execute(
                text("SELECT * FROM member_plans WHERE id = :plan_id"),
                {"plan_id": member_order["plan_id"]}
            )
            plan = plan_result.mappings().one_or_none()
            user_id = member_order["user_id"]
            
            membership_result = await db.execute(
                text("SELECT * FROM user_memberships WHERE user_id = :user_id AND status = 1"),
                {"user_id": user_id}
            )
            existing = membership_result.mappings().one_or_none()
            
            now = datetime.now()
            if existing:
                new_end = existing["end_date"] + timedelta(days=plan["duration_days"] if plan else 30)
                await db.execute(
                    text("UPDATE user_memberships SET end_date = :end_date, order_id = :order_id, pay_amount = :pay_amount, benefit_snapshot = :benefit_snapshot, updated_at = NOW() WHERE id = :membership_id"),
                    {
                        "end_date": new_end,
                        "order_id": member_order["id"],
                        "pay_amount": member_order["pay_amount"],
                        "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                        "membership_id": existing["id"],
                    }
                )
            else:
                await db.execute(
                    text("INSERT INTO user_memberships (user_id, plan_id, status, start_date, end_date, order_id, pay_amount, benefit_snapshot, created_at, updated_at) VALUES (:user_id, :plan_id, 1, :start_date, :end_date, :order_id, :pay_amount, :benefit_snapshot, NOW(), NOW())"),
                    {
                        "user_id": user_id,
                        "plan_id": member_order["plan_id"],
                        "start_date": date.today(),
                        "end_date": date.today() + timedelta(days=plan["duration_days"] if plan else 30),
                        "order_id": member_order["id"],
                        "pay_amount": member_order["pay_amount"],
                        "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                    }
                )
            
            # Issue coupons
            if plan and plan["coupon_package"]:
                coupon_package = plan["coupon_package"]
                if isinstance(coupon_package, str):
                    coupon_package = json.loads(coupon_package)
                templates = coupon_package.get("templates", [])
                for item in templates:
                    template_result = await db.execute(
                        text("SELECT * FROM coupon_templates WHERE id = :template_id"),
                        {"template_id": item["template_id"]}
                    )
                    template = template_result.mappings().one_or_none()
                    if not template:
                        continue
                    valid_days = item.get("valid_days", 30)
                    for _ in range(item.get("count", 1)):
                        await db.execute(
                            text("INSERT INTO user_coupons (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount, applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, created_at) VALUES (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount, :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, NOW())"),
                            {
                                "user_id": user_id,
                                "template_id": template["id"],
                                "coupon_no": generate_coupon_no(),
                                "name": template["name"],
                                "type": template["type"],
                                "value": template["value"],
                                "min_amount": template["min_amount"],
                                "max_discount": template["max_discount"],
                                "applicable_type": template["applicable_type"],
                                "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                                "valid_start": now,
                                "valid_end": now + timedelta(days=valid_days),
                                "source_id": member_order["id"],
                            }
                        )
            
            await db.commit()
            logger.info(f"Member order paid via callback: {order_no}, id={member_order['id']}")
            return {"code": "SUCCESS", "message": "OK"}
        
        logger.error(f"Pay callback order not found: {order_no}")
        return {"code": "FAIL", "message": "Order not found"}
        
    except Exception as e:
        logger.error(f"Pay callback processing error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"code": "FAIL", "message": "Internal error"}'''

content = content.replace(old_callback, new_callback)

# Step 2: Replace pay_member_order
old_member_pay = '''@app.post("/api/v1/member/orders/{order_id}/pay")
async def pay_member_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """会员订单支付（模拟支付成功）"""
    user_id = current_user.get("user_id", 1)
    now = datetime.now()
    
    # 查询订单
    order_result = await db.execute(
        text("SELECT * FROM member_orders WHERE id = :order_id AND user_id = :user_id"),
        {"order_id": order_id, "user_id": user_id}
    )
    order = order_result.mappings().one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    if order["status"] != 10:
        return {"code": 400, "message": "订单状态不允许支付", "data": None}
    
    # 查询套餐
    plan_result = await db.execute(
        text("SELECT * FROM member_plans WHERE id = :plan_id"),
        {"plan_id": order["plan_id"]}
    )
    plan = plan_result.mappings().one_or_none()
    
    # 更新订单状态
    await db.execute(
        text("""
            UPDATE member_orders 
            SET status = 20, pay_time = NOW(), pay_channel = 'wechat', pay_trade_no = :trade_no, updated_at = NOW()
            WHERE id = :order_id
        """),
        {"order_id": order_id, "trade_no": f"WX{now.strftime('%Y%m%d%H%M%S')}"}
    )
    
    # 检查是否已有生效会员，如果有则续期
    membership_result = await db.execute(
        text("SELECT * FROM user_memberships WHERE user_id = :user_id AND status = 1"),
        {"user_id": user_id}
    )
    existing = membership_result.mappings().one_or_none()
    
    if existing:
        # 续期：在原有结束日期上增加
        new_end = existing["end_date"] + timedelta(days=plan["duration_days"])
        await db.execute(
            text("""
                UPDATE user_memberships 
                SET end_date = :end_date, order_id = :order_id, pay_amount = :pay_amount, 
                    benefit_snapshot = :benefit_snapshot, updated_at = NOW()
                WHERE id = :membership_id
            """),
            {
                "end_date": new_end,
                "order_id": order_id,
                "pay_amount": order["pay_amount"],
                "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
                "membership_id": existing["id"],
            }
        )
    else:
        # 新建会员
        await db.execute(
            text("""
                INSERT INTO user_memberships 
                (user_id, plan_id, status, start_date, end_date, order_id, pay_amount, benefit_snapshot, created_at, updated_at)
                VALUES 
                (:user_id, :plan_id, 1, :start_date, :end_date, :order_id, :pay_amount, :benefit_snapshot, NOW(), NOW())
            """),
            {
                "user_id": user_id,
                "plan_id": order["plan_id"],
                "start_date": date.today(),
                "end_date": date.today() + timedelta(days=plan["duration_days"] if plan else 30),
                "order_id": order_id,
                "pay_amount": order["pay_amount"],
                "benefit_snapshot": json.dumps(json.loads(plan["benefit_config"]) if isinstance(plan.get("benefit_config"), str) else (plan["benefit_config"] if plan else {})),
            }
        )
    
    # 发放消费券
    if plan and plan["coupon_package"]:
        coupon_package = plan["coupon_package"]
        if isinstance(coupon_package, str):
            coupon_package = json.loads(coupon_package)
        
        templates = coupon_package.get("templates", [])
        for item in templates:
            template_result = await db.execute(
                text("SELECT * FROM coupon_templates WHERE id = :template_id"),
                {"template_id": item["template_id"]}
            )
            template = template_result.mappings().one_or_none()
            if not template:
                continue
            
            valid_days = item.get("valid_days", 30)
            for _ in range(item.get("count", 1)):
                await db.execute(
                    text("""
                        INSERT INTO user_coupons 
                        (user_id, template_id, coupon_no, name, type, value, min_amount, max_discount,
                         applicable_type, applicable_ids, valid_start_time, valid_end_time, status, source_type, source_id, created_at)
                        VALUES 
                        (:user_id, :template_id, :coupon_no, :name, :type, :value, :min_amount, :max_discount,
                         :applicable_type, :applicable_ids, :valid_start, :valid_end, 1, 2, :source_id, NOW())
                    """),
                    {
                        "user_id": user_id,
                        "template_id": template["id"],
                        "coupon_no": generate_coupon_no(),
                        "name": template["name"],
                        "type": template["type"],
                        "value": template["value"],
                        "min_amount": template["min_amount"],
                        "max_discount": template["max_discount"],
                        "applicable_type": template["applicable_type"],
                        "applicable_ids": json.dumps(template["applicable_ids"]) if template["applicable_ids"] else None,
                        "valid_start": now,
                        "valid_end": now + timedelta(days=valid_days),
                        "source_id": order_id,
                    }
                )
    
    await db.commit()
    
    return success({
        "order_id": order_id,
        "status": 20,
        "message": "支付成功"
    })'''

new_member_pay = '''@app.post("/api/v1/member/orders/{order_id}/pay")
async def pay_member_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """会员订单支付 - 调用微信支付"""
    import httpx
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    order_result = await db.execute(
        text("SELECT * FROM member_orders WHERE id = :order_id AND user_id = :user_id"),
        {"order_id": order_id, "user_id": user_id}
    )
    order = order_result.mappings().one_or_none()
    
    if not order:
        return {"code": 404, "message": "订单不存在", "data": None}
    
    if order["status"] != 10:
        return {"code": 400, "message": "订单状态不允许支付", "data": None}
    
    # 查询用户openid
    from app.models.user import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    openid = user.openid if user else current_user.get("openid", "")
    
    if not openid:
        return {"code": 400, "message": "用户未绑定微信，无法发起支付", "data": None}
    
    # 查询套餐名称
    plan_result = await db.execute(
        text("SELECT * FROM member_plans WHERE id = :plan_id"),
        {"plan_id": order["plan_id"]}
    )
    plan = plan_result.mappings().one_or_none()
    plan_name = plan["name"] if plan else "会员套餐"
    
    # 调用 pay-service 创建支付订单
    pay_service_url = os.getenv("PAY_SERVICE_URL", "http://pay-service:8000")
    pay_payload = {
        "order_no": order["order_no"],
        "amount": float(order["pay_amount"]),
        "description": f"尾巴旅行-{plan_name}",
        "method": "wechat_jsapi",
        "openid": openid
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            pay_response = await client.post(
                f"{pay_service_url}/api/v1/pay/create",
                json=pay_payload,
                headers={"Authorization": f"Bearer {current_user.get('token', '')}"}
            )
            pay_result = pay_response.json()
    except Exception as e:
        logger.error(f"Call pay-service failed: {e}")
        return {"code": 500, "message": f"支付服务调用失败: {str(e)}"}
    
    if pay_result.get("code") != 200:
        return {"code": 500, "message": pay_result.get("message", "支付下单失败")}
    
    pay_data = pay_result.get("data", {})
    return success({
        "pay_order_no": pay_data.get("pay_order_no"),
        "pay_params": pay_data.get("pay_params"),
        "mock": pay_data.get("mock", False)
    })'''

content = content.replace(old_member_pay, new_member_pay)

with open("/opt/petway/backend/order-service/main.py", "w") as f:
    f.write(content)

print("Done")
