with open('/app/main.py', 'r') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if 'WeChat unified order response' in line and 'result.get' in line:
        lines[i] = '            logger.info(f"WeChat unified order response: {result}")'
        print(f'Fixed line {i}')

with open('/app/main.py', 'w') as f:
    f.write('\n'.join(lines))
