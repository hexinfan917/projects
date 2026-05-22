import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

SQL = """UPDATE admin_users SET password = '$2b$12$HneJCU7wR7xcB4XqHLgGSusZO/T0Exxgdr6CQKvvbUjJBHB.S7/1G' WHERE username = 'admin';"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE)

cmd = f"""sudo docker exec -i petway-mysql mysql -uroot -pPetway123 petway -e "{SQL}" """
print(f">>> {cmd}")
stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print("STDOUT:", out)
print("STDERR:", err)

ssh.close()
print("Done!")
