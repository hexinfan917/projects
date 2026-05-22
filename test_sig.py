import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

with open("/app/certs/apiclient_key.pem", "rb") as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None)

msg = "POST\n/v3/refund/domestic/refunds\n1234567890\ntest_nonce\n{\"test\":\"value\"}\n"

sig = private_key.sign(msg.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
sig_b64 = base64.b64encode(sig).decode("utf-8")
print("Signature:", sig_b64[:50] + "...")

pub = private_key.public_key()
try:
    pub.verify(sig, msg.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    print("Local verify: OK")
except Exception as e:
    print("Local verify: FAIL -", e)

import httpx
from datetime import datetime
import random, string

def nonce(length=32):
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))

path = "/v3/certificates"
url = "https://api.mch.weixin.qq.com" + path
ts = str(int(datetime.now().timestamp()))
n = nonce()
msg = "GET\n" + path + "\n" + ts + "\n" + n + "\n\n"

sig = private_key.sign(msg.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
sig_b64 = base64.b64encode(sig).decode("utf-8")

sn = "578981595A43F2E58B46B5C4416E53937C7C5659"
mid = "1745520876"
auth = 'WECHATPAY2-SHA256-RSA2048 mchid="' + mid + '",nonce_str="' + n + '",signature="' + sig_b64 + '",timestamp="' + ts + '",serial_no="' + sn + '"'

try:
    r = httpx.get(url, headers={"Authorization": auth, "Accept": "application/json"}, timeout=10)
    print("GET /v3/certificates status:", r.status_code)
    print("Response:", r.text[:500])
except Exception as e:
    print("Request error:", e)
