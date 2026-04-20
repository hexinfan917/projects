import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Terms() {
  return (
    <View className='terms-page'>
      <View className='content-section'>
        <Text className='title'>用户协议</Text>
        <Text className='paragraph'>
          欢迎使用尾巴旅行 PetWay！在您使用我们的服务之前，请仔细阅读本用户协议。
        </Text>
        <Text className='subtitle'>1. 服务范围</Text>
        <Text className='paragraph'>
          我们提供宠物友好旅行路线预订、出行人管理、订单跟踪、评价分享等服务。
        </Text>
        <Text className='subtitle'>2. 用户责任</Text>
        <Text className='paragraph'>
          用户应确保提供的个人信息真实有效，遵守国家法律法规，文明出行，爱护环境，尊重其他游客和宠物。
        </Text>
        <Text className='subtitle'>3. 订单与支付</Text>
        <Text className='paragraph'>
          用户下单后应在规定时间内完成支付。订单取消和退款规则以具体活动页面的说明为准。
        </Text>
        <Text className='subtitle'>4. 免责声明</Text>
        <Text className='paragraph'>
          用户应对携带宠物的安全负责，我们不对因宠物自身原因或用户疏忽导致的意外承担责任。
        </Text>
        <Text className='subtitle'>5. 协议修改</Text>
        <Text className='paragraph'>
          我们保留随时修改本协议的权利，修改后的协议将在小程序内公布。
        </Text>
      </View>
    </View>
  )
}
