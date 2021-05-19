const path = require('path')

const { src, dest, series, parallel, watch } = require('gulp'); // watch 监视

const del = require('del'); // 文件清除

const browserSync = require('browser-sync'); // 自动热更新服务器效果

const loadPlugins = require('gulp-load-plugins') // 自动加载插件load
const plugins = loadPlugins() // 可以自动加载插件gulp开头的插件，gulp-a-b这种，会自动将gulp-后的a-b转换成驼峰法命名为aB  plugins.sass, plugins.babel, plugins.imagemin, plugins.swig 替换

const bs = browserSync.create() // 创建开发服务器

const cwd = process.cwd() // cwd返回当前命令行所在的工作目录

let config = {
  // default config
  build: {
    src: 'src',
    dist: 'dist',
    temp: 'temp',
    public: 'public',
    paths: {
      styles: 'assets/styles/*.scss',
      scripts: 'assets/scripts/*.js',
      pages: '*.html',
      images: 'assets/images/**',
      fonts: 'assets/fonts/**',
    }
  }
} // 用let 是为了当没有这个配置文件时，可以初始化变量，不至于报错

try {
  // confg = require(path.join([cwd, 'pages.config.js']))
  const loadConfig = require(path.join(cwd, 'pages.config.js'));
  config = Object.assign({}, config, loadConfig)
} catch (error) {}

// 清除任务
const clean = () => {
  return del([config.build.dist, config.build.temp]);
}

const style = () => {
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src }) // base 是基准路径，会把src后面的路径保留下来, cwd指定工作目录，默认是当前项目的根目录
    .pipe(plugins.sass({              // 转换流
      outputStyle: 'expanded' // 输出样式格式，expanded 完全展开模式
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true })) // 以流的方式往浏览器推
}

const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.babel({
      presets: [require('@babel/preset-env')] // babel 当前所有特性包
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

const page = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src }) // 目录可以设置为'src/**/*.html'，代表src下所有子目录下的html
    .pipe(plugins.swig({ data: config.data }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
}

const extra = () => {
  return src('**', { base: config.build.public, cwd: config.build.public })
    .pipe(dest(config.build.dist))
}

// 把src内容打包
const compile = parallel(style, script, page);

// 开启服务器
const serve = () => {
  // 监视源文件变更，重新编译
  watch(config.build.paths.styles, { cwd:config.build.src  }, style) // 监视源文件变更 watch(通配符，任务函数)
  watch(config.build.paths.scripts, { cwd:config.build.src  }, script)
  watch(config.build.paths.pages, { cwd:config.build.src  }, page)
  // watch('src/assets/images/**', image)
  // watch('src/assets/fonts/**', font)
  // watch('public/**', extra)
  // 将这三种文件更新后做统一处理，直接更新浏览器
  watch([
    config.build.paths.images,
    config.build.paths.fonts,
    'public/**'
  ], { cwd:config.build.src  }, bs.reload)
  watch('**', { cwd:config.build.public }, bs.reload)

  bs.init({
    notify: false, // connect 右上角连接页面提示
    port: 2080, // 端口号
    // open: false, // 是否自动打开浏览器
    // files: 'dist/**', // 启动后监听文件
    server: {
      baseDir: [config.build.temp, config.build.src, config.build.public], // 浏览器运行加工后的结果
      routes: {
        '/node_modules': 'node_modules'
      }
    }
  })
}

// 处理打包后文件路径
const useref = () => {
  return src(config.build.paths.pages, { base: config.build.temp, cwd:config.build.temp  })
    .pipe(plugins.useref({ searchPath: [config.build.temp, '.'] })) // 数组形式一般把使用更多的情况放到前面
    // html js css 压缩
    .pipe(plugins.if(/\.js$/,plugins.uglify()))
    .pipe(plugins.if(/\.css$/,plugins.cleanCss()))
    .pipe(plugins.if(/\.html$/,plugins.htmlmin({ 
      collapseWhitespace: true, 
      minifyCSS: true, 
      minifyJS: true,
    })))
    .pipe(dest(config.build.dist))
}

// 上线之前执行的任务，把所有文件打包，先清除文件再打包，图片，文字，其他都在打包任务中执行一次
const build = series(clean, parallel(series(compile, useref), image, font, extra));

// 开发组合任务
const develop = series(compile, serve)

module.exports = {
  clean,
  build,
  develop,
}