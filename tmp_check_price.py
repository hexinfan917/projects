import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

print("=== 路线13排期的price和self_drive_price ===")
stdin, stdout, stderr = ssh.exec_command(
    'docker exec petway-mysql mysql -uroot -pPetway123 petway -e "'
    'SELECT id, route_id, schedule_date, price, self_drive_price FROM route_schedules WHERE route_id = 13;" 2>&1'
)
print(stdout.read().decode())

ssh.close()
