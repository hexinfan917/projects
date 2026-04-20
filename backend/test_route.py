import requests

def test_routes_api():
    resp = requests.get("http://localhost:8002/api/v1/routes")
    print(f"状态码: {resp.status_code}")
    print(f"路线数量: {len(resp.json().get('data', {}).get('list', []))}")

if __name__ == "__main__":
    test_routes_api()
