import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import { getOrderDetail, evaluateOrder } from '../../../utils/api'
import './index.scss'

const TAGS = ['风景优美', '领队专业', '宠物友好', '餐饮满意', '行程安排合理', '性价比高']

export default function OrderEvaluate() {
  const [order, setOrder] = useState<any>(null)
  const [score, setScore] = useState(5)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.id
    if (id) {
      getOrderDetail(Number(id)).then(res => setOrder(res.data))
    }
  }, [])

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const uploadImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      setImages([...images, res.tempFilePaths[0]])
    } catch (err) {
      // ignore
    }
  }

  const submit = async () => {
    if (!content) {
      Taro.showToast({ title: '请填写评价内容', icon: 'none' })
      return
    }
    try {
      await evaluateOrder(order.id, { score, tags: selectedTags, content, images })
      Taro.showToast({ title: '评价成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (err) {
      Taro.showToast({ title: '评价失败', icon: 'none' })
    }
  }

  return (
    <View className='evaluate-page'>
      <View className='card'>
        <Text className='card-title'>订单评价</Text>
        <Text className='route-name'>{order?.route_name}</Text>
      </View>

      <View className='card'>
        <Text className='label'>总体评分</Text>
        <View className='star-row'>
          {[1, 2, 3, 4, 5].map(s => (
            <Text key={s} className={`star ${s <= score ? 'active' : ''}`} onClick={() => setScore(s)}>★</Text>
          ))}
        </View>
      </View>

      <View className='card'>
        <Text className='label'>评价标签</Text>
        <View className='tag-list'>
          {TAGS.map(tag => (
            <Text
              key={tag}
              className={`tag ${selectedTags.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Text>
          ))}
        </View>
      </View>

      <View className='card'>
        <Text className='label'>评价内容</Text>
        <Textarea
          className='textarea'
          placeholder='分享您的出行体验，帮助更多宠友...'
          value={content}
          onInput={(e) => setContent(e.detail.value)}
        />
      </View>

      <View className='card'>
        <Text className='label'>上传图片</Text>
        <View className='image-list'>
          {images.map((img, idx) => (
            <Image key={idx} className='preview-img' src={img} mode='aspectFill' />
          ))}
          <View className='upload-btn' onClick={uploadImage}>+</View>
        </View>
      </View>

      <Button className='submit-btn' onClick={submit}>提交评价</Button>
    </View>
  )
}
