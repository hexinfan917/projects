import bcrypt
hash_str = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/I1K'
result = bcrypt.checkpw('admin123'.encode('utf-8'), hash_str.encode('utf-8'))
print('Check result:', result)
