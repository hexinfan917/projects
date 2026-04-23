import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Privacy() {
  return (
    <View className='privacy-page' style={{ paddingTop: '140rpx' }}>

        <View className='page-back' onClick={() => Taro.navigateBack()}>
          <Text className='page-back-icon'>←</Text>
        </View>
      <View className='content-section'>
        <Text className='title'>隐私政策</Text>
        <Text className='paragraph'>
          尾巴旅行 PetWay（以下简称"我们"）非常重视用户的隐私和个人信息保护。本隐私政策将帮助您了解我们如何收集、使用、存储和保护您的个人信息。
        </Text>
        <Text className='subtitle'>1. 信息收集</Text>
        <Text className='paragraph'>
          我们可能会收集您的微信昵称、头像、手机号、位置信息等，用于提供更好的旅行服务体验。
        </Text>
        <Text className='subtitle'>2. 信息使用</Text>
        <Text className='paragraph'>
          您的个人信息将仅用于订单处理、客服沟通、行程通知以及产品优化等目的，不会向第三方出售或共享。
        </Text>
        <Text className='subtitle'>3. 信息保护</Text>
        <Text className='paragraph'>
          我们采用行业标准的加密技术和安全措施，确保您的个人信息在传输和存储过程中的安全性。
        </Text>
        <Text className='subtitle'>4. 联系我们</Text>
        <Text className='paragraph'>
          如您对隐私政策有任何疑问，请联系客服微信：Petway_
        </Text>
      </View>
    </View>
  )
}
