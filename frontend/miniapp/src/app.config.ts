export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/routes/index',
    'pages/profile/pets/index',
    'pages/profile/index',
    'pages/routes/detail/index',
    'pages/map/index',
    'pages/community/index',
    'pages/login/index',
    'pages/profile/pet-edit/index',
    'pages/profile/travelers/index',
    'pages/profile/traveler-edit/index',
    'pages/profile/edit/index',
    'pages/profile/complete-info/index',
    'pages/profile/footprint/index',
    'pages/profile/about/index',
    'pages/profile/settings/index',
    'pages/profile/security/index',
    'pages/profile/privacy/index',
    'pages/profile/terms/index',
    'pages/profile/dog-personality-records/index',
    'pages/orders/confirm/index',
    'pages/orders/pay/index',
    'pages/orders/detail/index',
    'pages/orders/list/index',
    'pages/orders/evaluate/index',
    'pages/orders/refund/index',
    'pages/search/index',
    'pages/notifications/list/index',
    'pages/reviews/list/index',
    'pages/reviews/detail/index',
    'pages/charities/list/index',
    'pages/charities/detail/index',
    'pages/charities/enroll/index',
    'pages/adoption/index/index',
    'pages/adoption/detail/index',
    'pages/adoption/apply/index',
    'pages/adoption/records/index',
    'pages/member/center/index',
    'pages/member/info/index',
    'pages/member/pay/index',
    'pages/member/coupons/index',
    'pages/coupons/center/index',
    'pages/coupons/list/index',
    'pages/coupons/detail/index',
    'pages/agreements/detail/index',
    // 'pages/community/detail/index',
    // 'pages/map/detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#f5f7f5',
    navigationBarTitleText: '尾巴PetWay',
    navigationBarTextStyle: 'black'
  },
  subPackages: [
    {
      root: 'subpackage/dog-personality',
      pages: [
        'index/index',
        'pet-select/index',
        'pet-form/index',
        'test/index',
        'result/index',
        'pk/index/index',
        'pk/result/index',
      ],
    },
  ],
  tabBar: {
    custom: true,
    color: '#9CA3AF',
    selectedColor: '#006b1b',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/icons/tab-home.png',
        selectedIconPath: 'assets/icons/tab-home.png'
      },
      {
        pagePath: 'pages/routes/index',
        text: '活动',
        iconPath: 'assets/icons/tab-route.png',
        selectedIconPath: 'assets/icons/tab-route.png'
      },
      {
        pagePath: 'pages/profile/pets/index',
        text: '档案',
        iconPath: 'assets/icons/tab-pet.png',
        selectedIconPath: 'assets/icons/tab-pet.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/tab-profile.png',
        selectedIconPath: 'assets/icons/tab-profile.png'
      }
    ]
  }
})
