# OpenAI到DeepSeek的API代理服务器

这是一个Node.js服务器，用于将符合OpenAI API格式的请求转发到DeepSeek API，并记录请求和响应日志。同时提供自动生成Markdown文档功能，方便查看和分析请求响应内容。

## 功能

- 接收OpenAI兼容格式的API请求
- 记录所有请求和响应到日志文件
- 自动生成请求和响应的Markdown文档
- 转发请求到DeepSeek API
- 将DeepSeek的响应返回给客户端
- 支持流式响应处理
- 服务启动时自动清空日志文件
- 提供查看日志的Web端点


## 项目结构

```
packages/compatible-server/
├── src/
│   ├── config.js          # 配置文件
│   ├── output.js          # 日志输出模块
│   ├── server.js          # 服务器主程序
├── logs/                  # 日志目录
│   ├── requests.log       # 请求和响应日志 
│   └── requests.md        # 实时生成的Markdown文档
```

## 配置

编辑`src/config.js`文件，设置以下参数：

- `PORT`: 服务器端口
- `DEEPSEEK_API_KEY`: DeepSeek API密钥
- `DEEPSEEK_API_URL`: DeepSeek API地址
- `LOG_FILE_PATH`: 日志文件路径
- `MARKDOWN_FILE_PATH`: Markdown文档路径

或者使用环境变量设置这些参数：

```
PORT=3000
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
LOG_FILE_PATH=logs/requests.log
MARKDOWN_FILE_PATH=logs/requests.md
```

## 使用

```bash
# 启动服务器
npm start
# 或
node src/server.js
```

## API端点

- **POST /v1/chat/completions**: 主要API端点，接收OpenAI格式的聊天完成请求
  - 支持普通同步请求
  - 支持流式响应(SSE)，只需在请求体中添加 `"stream": true`
- **GET /health**: 健康检查端点
- **GET /logs**: 查看记录的日志

## 示例请求

### 普通请求

使用与OpenAI API相同的格式发送请求：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "你是一个有用的助手。"},
      {"role": "user", "content": "你好，请介绍一下自己。"}
    ]
  }'
```

### 流式请求

添加 `"stream": true` 参数来启用流式响应：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "stream": true,
    "messages": [
      {"role": "system", "content": "你是一个有用的助手。"},
      {"role": "user", "content": "你好，请介绍一下自己。"}
    ]
  }'
```
