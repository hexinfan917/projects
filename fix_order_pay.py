import re

with open('/opt/petway/backend/order-service/main.py', 'r') as f:
    content = f.read()

# Replace the mock pay_order function with real one
old_func = '''@app.post("/api/v1/orders/{order_id}/pay")
async def pay_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """发起支付并模拟支付成功（更新订单状态）"""
    from app.models.order import Order
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    logger.info(f"Pay order check: order_id={order_id}, status={order.status}, expected=10")
    if order.status != 10:  # 只能支付待支付订单
        raise BadRequestException(f"订单状态不允许支付，当前状态:{order.status}")
    
    # 模拟支付成功 - 更新订单状态
    from datetime import datetime
    order.status = 20  # 待出行
    order.pay_time = datetime.now()
    order.pay_channel = "wechat"
    order.pay_trade_no = f"WX{datetime.now().strftime(\'%Y%m%d%H%M%S\')}"'''

# We need to match the entire function - let\'s use a simpler approach
# Find the function start and replace from there
start_marker = '''@app.post("/api/v1/orders/{order_id}/pay")'''
end_marker = '''@app.post("/api/v1/orders/{order_id}/cancel")'''

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    old_func = content[start_idx:end_idx]
    
    new_func = '''@app.post("/api/v1/orders/{order_id}/pay")
async def pay_order(
    order_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """发起微信支付"""
    from app.models.order import Order
    from app.models.user import User
    import httpx
    
    user_id = current_user.get("user_id", 1)
    
    # 查询订单
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    logger.info(f"Pay order check: order_id={order_id}, status={order.status}, expected=10")
    if order.status != 10:  # 只能支付待支付订单
        raise BadRequestException(f"订单状态不允许支付，当前状态:{order.status}")
    
    # 查询用户openid
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    openid = user.openid if user else current_user.get("openid", "")
    
    if not openid:
        raise BadRequestException("用户未绑定微信，无法发起支付")
    
    # 调用 pay-service 创建支付订单
    pay_service_url = os.getenv("PAY_SERVICE_URL", "http://pay-service:8000")
    pay_payload = {
        "order_no": order.order_no,
        "amount": float(order.pay_amount),
        "description": f"尾巴旅行-{order.route_name or \'订单支付\'}",
        "method": "wechat_jsapi",
        "openid": openid
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            pay_response = await client.post(
                f"{pay_service_url}/api/v1/pay/create",
                json=pay_payload,
                headers={"Authorization": f"Bearer {current_user.get(\'token\', \'\')}"}
            )
            pay_result = pay_response.json()
    except Exception as e:
        logger.error(f"Call pay-service failed: {e}")
        raise HTTPException(status_code=500, detail=f"支付服务调用失败: {str(e)}")
    
    if pay_result.get("code") != 200:
        logger.error(f"Pay-service error: {pay_result}")
        raise HTTPException(status_code=500, detail=pay_result.get("message", "支付下单失败"))
    
    pay_data = pay_result.get("data", {})
    logger.info(f"Pay order created: {order.order_no}, pay_order_no={pay_data.get(\'pay_order_no\')}")
    
    return success({
        "pay_order_no": pay_data.get("pay_order_no"),
        "pay_params": pay_data.get("pay_params"),
        "mock": pay_data.get("mock", False)
    })

'''
    
    content = content[:start_idx] + new_func + content[end_idx:]
    
    with open('/opt/petway/backend/order-service/main.py', 'w') as f:
        f.write(content)
    
    print('Order-service pay function updated successfully')
else:
    print(f'Could not find markers. start_idx={start_idx}, end_idx={end_idx}')
