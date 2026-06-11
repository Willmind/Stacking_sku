# 智能装柜助手

Vue 3 + Vite 版本的纸箱装载量与排布可视化工具。当前版本保留原有静态算法能力，并把界面、状态管理、2D/3D 渲染逐步拆分到可维护的前端模块中。

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址是 `http://127.0.0.1:5173/`。

## 构建与静态交付

```bash
npm run build
```

构建产物会输出到 `dist/`。这个目录可以直接部署到 Vercel、Netlify、Nginx、对象存储静态站点、公司内网静态服务器等位置。项目已设置 Vite `base: "./"`，所以放在域名根路径或子目录下都能找到资源。

如果不依赖 Vercel，可以把 `dist/` 打包发给别人，对方用任意静态服务器打开即可，例如：

```bash
npm run preview
```

或在 `dist/` 目录中启动常见静态服务器。直接双击 `dist/index.html` 在部分浏览器中也可以使用，但更推荐通过静态服务器访问，浏览器兼容性更稳定。

## 验证

```bash
npm run test:unit
npm run test:e2e
npm run build
```

E2E 测试覆盖两组实际码垛基准：`488 x 380 x 291 = 1,340` 箱，以及 `488 x 360 x 291 = 1,403` 箱。
