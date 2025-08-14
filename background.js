// 后台脚本 - 处理跨域请求

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchBT') {
    searchBTWebsite(request.title)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // 返回true表示异步响应
    return true;
  }
});

// 向BT网站发送搜索请求
async function searchBTWebsite(title) {
  try {
    const searchUrl = `https://www.btbtla.com/search/${encodeURIComponent(title)}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    return {
      success: true,
      html: html
    };
  } catch (error) {
    console.error('搜索BT网站失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}