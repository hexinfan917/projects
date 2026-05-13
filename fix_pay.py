import re

with open('/opt/petway/backend/pay-service/main.py', 'r') as f:
    content = f.read()

# Add XML utilities after generate_out_trade_no function
xml_utils = '''

def dict_to_xml(data: dict) -> str:
    """将字典转换为 XML 字符串"""
    xml_parts = ['<xml>']
    for key, value in data.items():
        if value is not None:
            xml_parts.append(f'<{key}><![CDATA[{value}]]></{key}>')
    xml_parts.append('</xml>')
    return ''.join(xml_parts)


def xml_to_dict(xml_str: str) -> dict:
    """将 XML 字符串解析为字典"""
    import xml.etree.ElementTree as ET
    result = {}
    try:
        root = ET.fromstring(xml_str)
        for child in root:
            result[child.tag] = child.text
    except Exception:
        pass
    return result

'''

# Insert after generate_out_trade_no function
insert_after = 'def generate_out_trade_no():\n    """生成商户订单号"""\n    return f"{datetime.now().strftime(\'%Y%m%d%H%M%S\')}{uuid.uuid4().hex[:8].upper()}"\n'

if insert_after in content and 'def dict_to_xml' not in content:
    content = content.replace(insert_after, insert_after + xml_utils)

# Replace mock unified order with real implementation
old_func = '''async def call_wechat_unified_order(params: dict) -> dict:
    """
    调用微信支付统一下单接口
    
    实际项目中需要:
    1. 将参数转换为 XML 格式
    2. 发送 POST 请求到微信 API
    3. 解析返回的 XML
    4. 获取 prepay_id
    
    这里使用模拟实现
    """
    config = WECHAT_PAY_CONFIG
    
    # 检查配置
    if not config["appid"] or not config["mchid"]:
        logger.warning("WeChat pay config not set, using mock mode")
        return {
            "return_code": "SUCCESS",
            "result_code": "SUCCESS",
            "prepay_id": f"wx{generate_nonce_str(20)}",
            "trade_type": "JSAPI",
            "mock": True
        }
    
    # TODO: 实现真实的微信支付 API 调用
    # url = "https://api.mch.weixin.qq.com/pay/unifiedorder"
    # if config["sandbox"]:
    #     url = "https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder"
    
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(url, data=xml_data)
    #     result = parse_xml(response.text)
    
    # 模拟返回
    return {
        "return_code": "SUCCESS",
        "result_code": "SUCCESS",
        "prepay_id": f"wx{generate_nonce_str(20)}",
        "trade_type": "JSAPI",
        "mock": True
    }'''

new_func = '''async def call_wechat_unified_order(params: dict) -> dict:
    """
    调用微信支付统一下单接口 (V2)
    """
    config = WECHAT_PAY_CONFIG
    
    # 检查配置
    if not config["appid"] or not config["mchid"] or not config["apikey"]:
        logger.warning("WeChat pay config not set, using mock mode")
        return {
            "return_code": "SUCCESS",
            "result_code": "SUCCESS",
            "prepay_id": f"wx{generate_nonce_str(20)}",
            "trade_type": "JSAPI",
            "mock": True
        }
    
    url = "https://api.mch.weixin.qq.com/pay/unifiedorder"
    if config["sandbox"]:
        url = "https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder"
    
    xml_data = dict_to_xml(params)
    logger.info(f"WeChat unified order request: {params.get('out_trade_no')}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, content=xml_data, headers={"Content-Type": "text/xml"})
            result = xml_to_dict(response.text)
            logger.info(f"WeChat unified order response: {result.get('return_code')}, {result.get('result_code')}")
            return result
    except Exception as e:
        logger.error(f"WeChat unified order failed: {e}")
        return {
            "return_code": "FAIL",
            "return_msg": str(e)
        }'''

content = content.replace(old_func, new_func)

with open('/opt/petway/backend/pay-service/main.py', 'w') as f:
    f.write(content)

print('Pay service patched successfully')
