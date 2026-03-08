# Translate Minimal

极简网页翻译 Chrome 扩展。按下 Ctrl 键即可翻译鼠标所在段落。

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## 功能

- **Ctrl 即译** — 鼠标悬停在段落上，按一下 Ctrl 键立即翻译，无需其他操作
- **虚线边框样式** — 译文以虚线边框展示在原文下方，清晰区分
- **三种翻译引擎**：
  - Google Translate（默认，免费，无需配置）
  - Microsoft Translate（免费，自动获取 Token）
  - Ollama（本地部署，支持 translategemma 等模型）

## 安装

### 从源码安装

1. 下载或 clone 本仓库：

   ```bash
   git clone https://github.com/wenzhiding/translate_minimal.git
   ```

2. 打开 Chrome 浏览器，进入 `chrome://extensions/`

3. 打开右上角 **开发者模式**

4. 点击 **加载已解压的扩展程序**，选择 clone 下来的文件夹

5. 安装完成，工具栏会出现「文A」翻译图标

## 使用方法

1. 点击工具栏图标，选择翻译引擎和目标语言
2. 在任意网页上，将鼠标移到想翻译的段落
3. **按一下 Ctrl 键** — 译文立即出现在原文下方

### 使用 Ollama 本地翻译

1. 安装 [Ollama](https://ollama.com)
2. 拉取翻译模型：

   ```bash
   ollama pull translategemma:4b
   ```

3. 在扩展弹窗中选择 **Ollama** 作为翻译引擎
4. 点击 **Options** 可修改 Ollama 地址和选择模型

## 文件结构

```
├── manifest.json    # 扩展清单 (Manifest V3)
├── background.js    # 后台服务：翻译 API 调用
├── content.js       # 内容脚本：Ctrl+悬停 段落检测
├── inject.css       # 注入样式：虚线边框主题
├── popup.html/js    # 弹窗：引擎/语言选择
├── options.html/js  # 设置页：Ollama 配置
├── rules.json       # 网络请求规则 (Ollama CORS)
└── icons/           # 扩展图标
```

## License

MIT
