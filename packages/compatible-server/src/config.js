const path = require('path');

// 默认配置
const config = {
  PORT: process.env.PORT || 3000,
  LOG_FILE_PATH: process.env.LOG_FILE_PATH || path.join(__dirname, "..",'logs', 'requests.log'),
  MARKDOWN_FILE_PATH: process.env.MARKDOWN_FILE_PATH || path.join(__dirname, "..",'logs', 'requests.md'),
  DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
};

module.exports = config; 
