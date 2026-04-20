import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import './index.scss'

const CATEGORIES = ['全部', '牵引绳', '便携水碗', '宠物背包', '防护鞋', '救生衣', '帐篷']

const PRODUCTS = [
  { id: 1, name: '便携式宠物饮水碗', price: 25, sold: 1200, image: 'https://via.placeholder.com/300x300/F5F5F5/333?text=Bowl' },
  { id: 2, name: '户外宠物双肩背包', price: 189, sold: 856, image: 'https://via.placeholder.com/300x300/F5F5F5/333?text=Bag' },
  { id: 3, name: '反光牵引绳 3米', price: 45, sold: 2300, image: 'https://via.placeholder.com/300x300/F5F5F5/333?text=Leash' },
  { id: 4, name: '宠物户外防护鞋套', price: 68, sold: 540, image: 'https://via.placeholder.com/300x300/F5F5F5/333?text=Shoes' },
]

export default function Equipment() {
  const [activeCat, setActiveCat] = useState('全部')

  return (
    <View className='equipment-page'>
      <ScrollView className='cat-scroll' scrollX>
        {CATEGORIES.map(c => (
          <Text
            key={c}
            className={`cat-item ${activeCat === c ? 'active' : ''}`}
            onClick={() => setActiveCat(c)}
          >
            {c}
          </Text>
        ))}
      </ScrollView>

      <ScrollView className='product-scroll' scrollY>
        <View className='product-grid'>
          {PRODUCTS.map(p => (
            <View key={p.id} className='product-card'>
              <Image className='product-image' src={p.image} mode='aspectFill' />
              <Text className='product-name'>{p.name}</Text>
              <Text className='product-price'>￥{p.price}</Text>
              <Text className='product-sold'>已售 {p.sold}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
