import paramiko

HOST = "101.43.50.236"
USER = "ubuntu"
KEY_FILE = "D:/projects/petway.pem"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, key_filename=KEY_FILE)

cmds = [
    ("Menu data", "sudo docker exec -i petway-mysql mysql -uroot -pPetway123 petway -e 'SELECT id, name FROM admin_menus LIMIT 5' 2>/dev/null"),
    ("Charset vars", "sudo docker exec -i petway-mysql mysql -uroot -pPetway123 -e 'SHOW VARIABLES LIKE \"character_set%\";' 2>/dev/null"),
    ("Table create", "sudo docker exec -i petway-mysql mysql -uroot -pPetway123 petway -e 'SHOW CREATE TABLE admin_menus' 2>/dev/null"),
]

for label, cmd in cmds:
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode('utf-8', errors='ignore')
    print(f"=== {label} ===")
    print(out)

ssh.close()
