const fs = require('fs');
const path = require('path');

/**
 * 确保日志目录存在
 * @param {string} filePath 日志文件路径
 */
function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

/**
 * 清空日志文件
 * @param {string} filePath 日志文件路径
 */
function clearLogFile(filePath) {
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, '', 'utf8');
  console.log(`已清空日志文件: ${filePath}`);
}

/**
 * 写入日志消息
 * @param {string} filePath 日志文件路径
 * @param {object|string} message 日志消息
 * @param {string} type 日志类型
 */
function logMessage(filePath, message, type) {
  ensureDirectoryExists(filePath);
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${typeof message === 'object' ? JSON.stringify(message, null, 2) : message}\n`;
  fs.appendFileSync(filePath, logEntry, 'utf8');
}

/**
 * 读取日志文件内容
 * @param {string} filePath 日志文件路径
 * @returns {string} 文件内容
 */
function readLogFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`读取日志文件错误: ${error.message}`);
    return '';
  }
}



/**
 * 将会话写入Markdown文件
 * @param {string} mdFilePath Markdown文件路径
 * @param {object} request 请求对象
 * @param {object|null} response 响应对象
 * @param {string} type 响应类型（'响应'或'完整流式响应'）
 */
function writeToMarkdown(mdFilePath, request, response = null, type = '响应') {
  ensureDirectoryExists(mdFilePath);
  
  // 生成唯一的会话ID
  const requestId = request.id || `request-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  // 初始化Markdown内容
  let markdown = `# 会话ID: ${requestId}\n\n`;
  markdown += `## 请求（${timestamp}）\n\n`;
  
  // 添加模型信息
  markdown += `**模型**: ${request.model || '未指定'}\n\n`;
  markdown += `**温度**: ${request.temperature !== undefined ? request.temperature : '未指定'}\n\n`;
  markdown += `**流式响应**: ${request.stream ? '是' : '否'}\n\n`;
  
  // 添加消息内容
  if (request.messages && Array.isArray(request.messages)) {
    markdown += '# 消息\n\n';
    
    for (const message of request.messages) {
      markdown += `## ${message.role}\n\n`;
      
      if (message.content) {
        // 如果 content 是数组，则将数组中的每个元素转换为字符串
        if (Array.isArray(message.content)) {
          markdown += message.content.map(item => item.type === 'text' ? item.text : item.text).join('\n\n');
        } else {
          markdown += message.content + '\n\n';
        }
      }
    }
  }
  
  // 添加响应内容（如果有）
  if (response) {
    markdown += `## ${type}（${timestamp}）\n\n`;
    
    if (response.choices && Array.isArray(response.choices)) {
      for (let i = 0; i < response.choices.length; i++) {
        const choice = response.choices[i];
        markdown += `### 响应 ${i + 1}\n\n`;
        
        if (choice.message) {
          markdown += `#### ${choice.message.role}\n\n`;
          
          if (choice.message.content) {
            markdown += choice.message.content + '\n\n';
          }
        }
        
        if (choice.finish_reason) {
          markdown += `**结束原因**: ${choice.finish_reason}\n\n`;
        }
      }
    }
  }
  
  // 写入Markdown文件（如果文件存在，追加内容，否则创建新文件）
  if (fs.existsSync(mdFilePath)) {
    markdown = '\n---\n\n' + markdown;  // 添加分隔符
    fs.appendFileSync(mdFilePath, markdown, 'utf8');
  } else {
    fs.writeFileSync(mdFilePath, markdown, 'utf8');
  }
}

module.exports = {
  clearLogFile,
  logMessage,
  readLogFile,
  writeToMarkdown
};
