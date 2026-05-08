export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/routes/index',
    'pages/profile/pets/index',
    'pages/profile/index',
    'pages/routes/detail/index',
    'pages/map/index',
    'pages/community/index',
    'pages/equipment/index',
    'pages/login/index',
    'pages/profile/pet-edit/index',
    'pages/profile/travelers/index',
    'pages/profile/traveler-edit/index',
    'pages/profile/edit/index',
    'pages/profile/footprint/index',
    'pages/profile/about/index',
    'pages/profile/settings/index',
    'pages/profile/security/index',
    'pages/profile/privacy/index',
    'pages/profile/terms/index',
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
    'pages/charities/enroll/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationStyle: 'custom',
    navigationBarBackgroundColor: '#f5f7f5',
    navigationBarTitleText: '尾巴旅行',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#22C55E',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/icons/tab-home.png',
        selectedIconPath: 'assets/icons/tab-home-active.png'
      },
      {
        pagePath: 'pages/routes/index',
        text: '线路',
        iconPath: 'assets/icons/tab-route.png',
        selectedIconPath: 'assets/icons/tab-route-active.png'
      },
      {
        pagePath: 'pages/profile/pets/index',
        text: '档案',
        iconPath: 'assets/icons/tab-pet.png',
        selectedIconPath: 'assets/icons/tab-pet-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/tab-profile.png',
        selectedIconPath: 'assets/icons/tab-profile-active.png'
      }
    ]
  }
})
