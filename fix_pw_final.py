import paramiko
import bcrypt

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

# Generate hash locally (safe, no shell escaping issues)
hash_val = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
print(f"Generated hash: {hash_val}")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE)

# Write hash to file on server
with ssh.open_sftp() as sftp:
    with sftp.file("/tmp/hash.txt", "w") as f:
        f.write(hash_val)

# Create Python script to update DB
script = '''import sys
with open("/tmp/hash.txt", "r") as f:
    hash_val = f.read().strip()
import pymysql
conn = pymysql.connect(host="mysql", user="root", password="Petway123", database="petway")
cur = conn.cursor()
cur.execute("UPDATE admin_users SET password = %s WHERE username = 'admin'", (hash_val,))
conn.commit()
print("Updated rows:", cur.rowcount)
# Verify
cur.execute("SELECT password FROM admin_users WHERE username = 'admin'")
print("Stored password:", cur.fetchone()[0])
cur.close()
conn.close()
'''

with ssh.open_sftp() as sftp:
    with sftp.file("/tmp/update_db.py", "w") as f:
        f.write(script)

# Copy script to user-service and run
stdin, stdout, stderr = ssh.exec_command(
    "sudo docker cp /tmp/update_db.py petway-user-service:/tmp/update_db.py && "
    "sudo docker cp /tmp/hash.txt petway-user-service:/tmp/hash.txt && "
    "sudo docker exec petway-user-service python3 /tmp/update_db.py",
    get_pty=True
)
out = stdout.read().decode("utf-8", errors="ignore")
err = stderr.read().decode("utf-8", errors="ignore")
print("OUT:", out)
print("ERR:", err)

ssh.close()
print("Done!")
