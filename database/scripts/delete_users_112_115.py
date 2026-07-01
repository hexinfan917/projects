#!/usr/bin/env python3
"""删除指定用户及其关联数据"""

import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

USER_IDS = [112, 113, 114, 115]

def run_sql(ssh, sql):
    cmd = f'cd /opt/petway && sudo docker exec petway-mysql mysql -u petway -pPetway123 -D petway -e "{sql}"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode().strip(), stderr.read().decode().strip()

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)
    
    for uid in USER_IDS:
        print(f"\n========== 删除用户 {uid} ==========")
        
        # 1. Get order IDs
        out, err = run_sql(ssh, f"SELECT id FROM orders WHERE user_id = {uid}")
        lines = out.split('\n')
        order_ids = [line.strip() for line in lines[1:] if line.strip()]
        print(f"订单IDs: {order_ids}")
        
        if order_ids:
            oid_str = ','.join(order_ids)
            
            # 2. Delete refund records
            out, err = run_sql(ssh, f"DELETE FROM refund_records WHERE order_id IN ({oid_str})")
            print(f"  删除退款记录")
            
            # 3. Restore coupons
            out, err = run_sql(ssh, f"UPDATE user_coupons SET used_order_id = NULL, status = 1, used_at = NULL WHERE used_order_id IN ({oid_str})")
            print(f"  恢复优惠券")
            
            # 4. Restore schedule stock (one by one)
            for oid in order_ids:
                sql = f"""UPDATE route_schedules SET sold = GREATEST(0, sold - (SELECT seat_count FROM orders WHERE id = {oid})) WHERE id = (SELECT schedule_id FROM orders WHERE id = {oid})"""
                out, err = run_sql(ssh, sql)
                print(f"  恢复库存(订单{oid})")
            
            # 5. Delete orders
            out, err = run_sql(ssh, f"DELETE FROM orders WHERE user_id = {uid}")
            print(f"  删除订单")
        
        # 6. Delete related records
        tables = [
            ('user_popup_logs', 'user_id'),
            ('video_watches', 'user_id'),
            ('notifications', 'user_id'),
            ('user_coupons', 'user_id'),
            ('user_memberships', 'user_id'),
            ('member_orders', 'user_id'),
            ('pet_profiles', 'user_id'),
            ('travelers', 'user_id'),
        ]
        
        for table, col in tables:
            out, err = run_sql(ssh, f"DELETE FROM {table} WHERE {col} = {uid}")
            print(f"  删除 {table}")
        
        # 7. Delete charity registrations by openid
        out, err = run_sql(ssh, f"DELETE FROM charity_registrations WHERE openid = (SELECT openid FROM users WHERE id = {uid})")
        print(f"  删除 charity_registrations")
        
        # 8. Delete contents/articles
        out, err = run_sql(ssh, f"DELETE FROM contents WHERE author_id = {uid}")
        print(f"  删除 contents")
        
        out, err = run_sql(ssh, f"DELETE FROM articles WHERE author_id = {uid}")
        print(f"  删除 articles")
        
        # 9. Delete user
        out, err = run_sql(ssh, f"DELETE FROM users WHERE id = {uid}")
        print(f"✅ 用户 {uid} 删除完成")
    
    print("\n========== 验证 ==========")
    out, err = run_sql(ssh, "SELECT COUNT(*) as remaining FROM users WHERE id IN (112,113,114,115)")
    print(f"剩余用户: {out}")
    
    out, err = run_sql(ssh, "SELECT COUNT(*) as remaining FROM orders WHERE user_id IN (112,113,114,115)")
    print(f"剩余订单: {out}")
    
    ssh.close()
    print("\n✅ 全部删除完成")

if __name__ == '__main__':
    main()
