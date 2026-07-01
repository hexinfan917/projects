#!/usr/bin/env python3
"""
安全清理测试数据脚本

使用方式:
    python cleanup_test_data.py --mode dry-run    # 预览将要删除的数据
    python cleanup_test_data.py --mode delete     # 执行删除

清理规则:
    1. 删除已取消(status=30)且创建时间超过7天的订单
    2. 删除待支付(status=10)且创建时间超过3天的订单（已过期）
    3. 可选: 删除没有订单、没有宠物的测试用户
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 数据库配置
DB_URL = "mysql+aiomysql://petway:Petway123@localhost:3306/petway"

async def cleanup_orders(session: AsyncSession, dry_run: bool = True):
    """清理过期测试订单"""
    
    # 1. 已取消且超过7天的订单
    cancel_cutoff = datetime.now() - timedelta(days=7)
    cancel_query = text("""
        SELECT o.id, o.order_no, o.status, o.created_at, o.user_id, u.phone 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        WHERE o.status = 30 AND o.created_at < :cutoff
        ORDER BY o.created_at DESC
    """)
    
    result = await session.execute(cancel_query, {"cutoff": cancel_cutoff})
    cancel_orders = result.fetchall()
    
    print(f"\n=== 已取消订单(>7天): {len(cancel_orders)} 个 ===")
    for row in cancel_orders[:10]:
        print(f"  订单 {row.order_no} | 用户 {row.phone} | 创建于 {row.created_at}")
    if len(cancel_orders) > 10:
        print(f"  ... 还有 {len(cancel_orders) - 10} 个")
    
    # 2. 待支付且超过3天的订单（已过期）
    pending_cutoff = datetime.now() - timedelta(days=3)
    pending_query = text("""
        SELECT o.id, o.order_no, o.status, o.created_at, o.user_id, u.phone 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        WHERE o.status = 10 AND o.created_at < :cutoff
        ORDER BY o.created_at DESC
    """)
    
    result = await session.execute(pending_query, {"cutoff": pending_cutoff})
    pending_orders = result.fetchall()
    
    print(f"\n=== 过期待支付订单(>3天): {len(pending_orders)} 个 ===")
    for row in pending_orders[:10]:
        print(f"  订单 {row.order_no} | 用户 {row.phone} | 创建于 {row.created_at}")
    if len(pending_orders) > 10:
        print(f"  ... 还有 {len(pending_orders) - 10} 个")
    
    if not dry_run and (cancel_orders or pending_orders):
        confirm = input(f"\n确认删除以上 {len(cancel_orders) + len(pending_orders)} 个订单? (yes/no): ")
        if confirm.lower() != 'yes':
            print("已取消")
            return
        
        # 删除退款记录
        all_order_ids = [row.id for row in cancel_orders + pending_orders]
        if all_order_ids:
            # 使用 IN 子句批量删除
            placeholders = ','.join(['%s'] * len(all_order_ids))
            
            # 1. 删除退款记录
            refund_sql = text(f"DELETE FROM refund_records WHERE order_id IN ({placeholders})")
            await session.execute(refund_sql, all_order_ids)
            print(f"  已删除退款记录")
            
            # 2. 恢复优惠券
            coupon_sql = text(f"""
                UPDATE user_coupons 
                SET used_order_id = NULL, status = 1, used_at = NULL 
                WHERE used_order_id IN ({placeholders})
            """)
            await session.execute(coupon_sql, all_order_ids)
            print(f"  已恢复优惠券")
            
            # 3. 恢复排期库存
            for order_id in all_order_ids:
                stock_sql = text("""
                    UPDATE route_schedules rs
                    SET rs.sold = GREATEST(0, rs.sold - (
                        SELECT seat_count FROM orders WHERE id = :order_id
                    ))
                    WHERE rs.id = (SELECT schedule_id FROM orders WHERE id = :order_id)
                """)
                await session.execute(stock_sql, {"order_id": order_id})
            print(f"  已恢复排期库存")
            
            # 4. 删除订单
            delete_sql = text(f"DELETE FROM orders WHERE id IN ({placeholders})")
            result = await session.execute(delete_sql, all_order_ids)
            print(f"  已删除 {result.rowcount} 个订单")
            
            await session.commit()
            print("✅ 订单清理完成")

async def cleanup_test_users(session: AsyncSession, dry_run: bool = True):
    """清理没有订单、没有宠物的测试用户"""
    
    query = text("""
        SELECT u.id, u.phone, u.nickname, u.created_at,
               (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
               (SELECT COUNT(*) FROM pet_profiles WHERE user_id = u.id) as pet_count
        FROM users u
        HAVING order_count = 0 AND pet_count = 0
        ORDER BY u.created_at DESC
        LIMIT 50
    """)
    
    result = await session.execute(query)
    test_users = result.fetchall()
    
    print(f"\n=== 无订单无宠物的用户: {len(test_users)} 个 ===")
    for row in test_users[:10]:
        print(f"  用户 {row.nickname} | 手机 {row.phone} | 创建于 {row.created_at}")
    if len(test_users) > 10:
        print(f"  ... 还有 {len(test_users) - 10} 个")
    
    if not dry_run and test_users:
        confirm = input(f"\n确认删除以上 {len(test_users)} 个用户? (yes/no): ")
        if confirm.lower() != 'yes':
            print("已取消")
            return
        
        for user in test_users:
            user_id = user.id
            
            # 按依赖顺序删除
            await session.execute(text("DELETE FROM user_popup_logs WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM video_watches WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM notifications WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM user_coupons WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM user_memberships WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM charity_registrations WHERE openid = (SELECT openid FROM users WHERE id = :uid)"), {"uid": user_id})
            await session.execute(text("DELETE FROM member_orders WHERE user_id = :uid"), {"uid": user_id})
            await session.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})
        
        await session.commit()
        print(f"✅ 已删除 {len(test_users)} 个用户")

async def main():
    parser = argparse.ArgumentParser(description='清理测试数据')
    parser.add_argument('--mode', choices=['dry-run', 'delete'], default='dry-run',
                       help='dry-run: 仅预览, delete: 执行删除')
    parser.add_argument('--users', action='store_true', help='同时清理无订单无宠物的用户')
    args = parser.parse_args()
    
    dry_run = args.mode == 'dry-run'
    
    print(f"模式: {'预览' if dry_run else '删除'}")
    print(f"时间: {datetime.now()}")
    
    engine = create_async_engine(DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            await cleanup_orders(session, dry_run)
            
            if args.users:
                await cleanup_test_users(session, dry_run)
            
            if dry_run:
                print("\n⚠️  这是预览模式，没有实际删除数据")
                print("    要执行删除，请添加 --mode delete 参数")
        except Exception as e:
            print(f"\n❌ 错误: {e}")
            await session.rollback()
            raise
    
    await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
