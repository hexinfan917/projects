import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE, timeout=15)

print("=== 路线13的排期价格 ===")
stdin, stdout, stderr = ssh.exec_command(
    'docker exec petway-mysql mysql -uroot -pPetway123 petway -e "'
    'SELECT id, route_id, schedule_date, single_person_price, two_person_one_pet_price, '
    'one_person_two_pet_price, single_pet_price, extra_person_price, extra_pet_price, '
    'self_drive_single_person_price, self_drive_two_person_one_pet_price, self_drive_one_person_two_pet_price, self_drive_single_pet_price '
    'FROM route_schedules WHERE route_id = 13;" 2>&1'
)
print(stdout.read().decode())

print("\n=== 路线13的基本信息 ===")
stdin, stdout, stderr = ssh.exec_command(
    'docker exec petway-mysql mysql -uroot -pPetway123 petway -e "'
    'SELECT id, title, base_price, transport_type, status FROM routes WHERE id = 13;" 2>&1'
)
print(stdout.read().decode())

ssh.close()
