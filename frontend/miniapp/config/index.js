const config = {
  projectName: 'petway-miniapp',
  date: '2026-4-9',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  alias: {
    '@': require('path').resolve(__dirname, '..', 'src')
  },
  copy: {
    patterns: [
      { from: 'src/assets/icons', to: 'dist/assets/icons' },
      { from: 'src/assets/images', to: 'dist/assets/images' },
      { from: 'src/assets/toplogo.png', to: 'dist/assets/toplogo.png' },
      { from: 'src/assets/see-throughlogo.png', to: 'dist/assets/see-throughlogo.png' }
    ],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: false
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 1024
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    webpackChain: (chain) => {
      // 禁用进度插件避免兼容性问题
      chain.plugins.delete('progressPlugin')
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
