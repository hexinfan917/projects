import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE)

# Step 1: Generate bcrypt hash inside user-service container
script1 = """
import bcrypt
pw = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()
print(pw)
"""

with ssh.open_sftp() as sftp:
    with sftp.file('/tmp/gen_hash.py', 'w') as f:
        f.write(script1)

stdin, stdout, stderr = ssh.exec_command('sudo docker cp /tmp/gen_hash.py petway-user-service:/tmp/gen_hash.py && sudo docker exec petway-user-service python3 /tmp/gen_hash.py', get_pty=True)
hash_val = stdout.read().decode('utf-8', errors='ignore').strip()
err = stderr.read().decode('utf-8', errors='ignore')
print('Generated hash:', hash_val)
print('Gen ERR:', err)

# Step 2: Update DB with the hash
script2 = f"""
import pymysql
conn = pymysql.connect(host='mysql', user='root', password='Petway123', database='petway')
cur = conn.cursor()
cur.execute("UPDATE admin_users SET password = %s WHERE username = 'admin'", ('{hash_val}',))
conn.commit()
print('Updated rows:', cur.rowcount)
cur.close()
conn.close()
"""

with ssh.open_sftp() as sftp:
    with sftp.file('/tmp/update_pw.py', 'w') as f:
        f.write(script2)

stdin, stdout, stderr = ssh.exec_command('sudo docker cp /tmp/update_pw.py petway-user-service:/tmp/update_pw.py && sudo docker exec petway-user-service python3 /tmp/update_pw.py', get_pty=True)
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('Update OUT:', out)
print('Update ERR:', err)

ssh.close()
print('Done!')
