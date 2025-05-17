const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const config = require('./config');
const output = require('./output');


const app = express();
// 增加请求体大小限制到100MB
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb', extended: true}));

// 启动时清空日志文件
output.clearLogFile(config.LOG_FILE_PATH);
output.clearLogFile(config.MARKDOWN_FILE_PATH);


// OpenAI兼容的聊天完成API端点
app.post('/v1/chat/completions', async (req, res) => {
  try {
    
    // 记录收到的请求
    output.logMessage(config.LOG_FILE_PATH, req.body, '请求');
    
    // 检查是否是流式请求
    const isStreamRequest = req.body.stream === true;
    
    if (isStreamRequest) {
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 准备发送到DeepSeek的请求体
      const deepseekRequest = {
        ...req.body,
        stream: true
      };

      // 使用axios发送流式请求并处理流式响应
      axios({
        method: 'post',
        url: config.DEEPSEEK_API_URL,
        data: deepseekRequest,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`,
          'Accept': 'text/event-stream'
        },
        responseType: 'stream',
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }).then(response => {
        let buffer = '';
        // 用于收集完整的内容
        const completedResponse = {
          id: req.body.id || `chatcmpl-${Date.now()}`,
          model: req.body.model || 'unknown',
          choices: []
        };
        
        response.data.on('data', (chunk) => {
          const chunkString = chunk.toString();
          buffer += chunkString;
          // 处理接收到的数据块，分割成单独的SSE事件
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // 保留最后一个可能不完整的块
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') {
              // 流结束
              res.write('data: [DONE]\n\n');
              continue;
            }
            
            try {
              // 提取JSON数据部分
              const dataMatch = line.match(/^data: (.+)$/);
              if (dataMatch) {
                const jsonData = dataMatch[1];
                const parsedData = JSON.parse(jsonData);
                
                // 更新完整响应对象
                if (parsedData.id) {
                  completedResponse.id = parsedData.id;
                }
                if (parsedData.model) {
                  completedResponse.model = parsedData.model;
                }
                
                // 处理选择内容
                if (parsedData.choices && Array.isArray(parsedData.choices)) {
                  for (const choice of parsedData.choices) {
                    const index = choice.index || 0;
                    
                    // 如果该索引的选择不存在，初始化它
                    if (!completedResponse.choices[index]) {
                      completedResponse.choices[index] = {
                        index: index,
                        message: { role: 'assistant', content: '' },
                        finish_reason: null
                      };
                    }
                    
                    // 更新内容
                    if (choice.delta && choice.delta.content) {
                      completedResponse.choices[index].message.content += choice.delta.content;
                    }
                    
                    // 更新角色
                    if (choice.delta && choice.delta.role) {
                      completedResponse.choices[index].message.role = choice.delta.role;
                    }
                    
                    // 更新结束原因
                    if (choice.finish_reason) {
                      completedResponse.choices[index].finish_reason = choice.finish_reason;
                    }
                  }
                }
                
                // 将数据原样转发给客户端
                res.write(`data: ${jsonData}\n\n`);
              }
            } catch (e) {
              output.logMessage(config.LOG_FILE_PATH, `解析流式响应出错: ${e.message}`, '错误');
              console.error('解析流式响应出错:', e);
            }
          }
        });
        
        response.data.on('end', () => {
          // 处理最后可能剩余的内容
          if (buffer.trim() && buffer.trim() !== 'data: [DONE]') {
            try {
              const dataMatch = buffer.match(/^data: (.+)$/);
              if (dataMatch) {
                const jsonData = dataMatch[1];
                const parsedData = JSON.parse(jsonData);
                
                // 更新完整响应对象
                if (parsedData.choices && Array.isArray(parsedData.choices)) {
                  for (const choice of parsedData.choices) {
                    const index = choice.index || 0;
                    if (!completedResponse.choices[index]) {
                      completedResponse.choices[index] = {
                        index: index,
                        message: { role: 'assistant', content: '' },
                        finish_reason: null
                      };
                    }
                    
                    if (choice.delta && choice.delta.content) {
                      completedResponse.choices[index].message.content += choice.delta.content;
                    }
                    
                    if (choice.finish_reason) {
                      completedResponse.choices[index].finish_reason = choice.finish_reason;
                    }
                  }
                }
                
              }
            } catch (e) {
              console.error('处理最后一块数据出错:', e);
            }
          }
          
          // 添加时间戳和使用令牌信息
          completedResponse.created = Math.floor(Date.now() / 1000);
          completedResponse.usage = {
            prompt_tokens: 0,  // 这些值在流式响应中通常不可用
            completion_tokens: 0,
            total_tokens: 0
          };
          
          // 记录完整的流式响应
          output.logMessage(config.LOG_FILE_PATH, completedResponse, '完整流式响应');
          
          // 将请求和完整流式响应写入Markdown文件
          output.writeToMarkdown(config.MARKDOWN_FILE_PATH, req.body, completedResponse, '完整流式响应');
          
          // 结束响应
          res.end();
        });
        
      }).catch(error => {
        output.logMessage(config.LOG_FILE_PATH, `流式请求错误: ${error.message}`, '错误');
        if (error.response) {
          res.write(`data: ${JSON.stringify({error: error.response.data})}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({error: {message: error.message}})}\n\n`);
        }
        res.end();
      });
      
    } else {
      // 非流式请求，与之前相同
      const deepseekResponse = await axios.post(
        config.DEEPSEEK_API_URL,
        req.body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.DEEPSEEK_API_KEY}`
          },
          // 增加Axios请求超时时间和最大请求体大小
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      // 记录DeepSeek的响应
      output.logMessage(config.LOG_FILE_PATH, deepseekResponse.data, '响应');
      
      // 将请求和响应写入Markdown文件
      output.writeToMarkdown(config.MARKDOWN_FILE_PATH, req.body, deepseekResponse.data, '响应');
      
      // 返回DeepSeek的响应给客户端
      res.json(deepseekResponse.data);
    }
  } catch (error) {
    // 记录错误
    output.logMessage(config.LOG_FILE_PATH, `错误: ${error.message}`, '错误');
    
    // 创建错误对象用于 Markdown 记录
    const errorResponse = {
      error: {
        message: error.message,
        type: 'server_error'
      },
      created: Math.floor(Date.now() / 1000)
    };
    
    // 将请求和错误写入 Markdown
    if (req.body) {
      output.writeToMarkdown(config.MARKDOWN_FILE_PATH, req.body, errorResponse, '错误');
    }
    
    if (error.response) {
      output.logMessage(config.LOG_FILE_PATH, error.response.data, '错误响应');
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        error: {
          message: `服务器错误: ${error.message}`,
          type: 'server_error'
        }
      });
    }
  }
});


// 启动服务器
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`日志文件路径: ${config.LOG_FILE_PATH}`);
  console.log(`Markdown文件路径: ${config.MARKDOWN_FILE_PATH}`);
}); 
