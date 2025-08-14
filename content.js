// 豆瓣BT资源搜索插件 - 内容脚本

// 获取电影标题
function getMovieTitle() {
  // 从页面标题中提取电影名称
  const titleElement = document.querySelector('h1 > span[property="v:itemreviewed"]');
  if (titleElement) {
    return titleElement.textContent.trim();
  }
  
  // 备用方案：从title标签提取
  const pageTitle = document.title;
  const match = pageTitle.match(/^(.+?)\s*\(/);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

// 获取电影ID
function getMovieId() {
  const match = window.location.pathname.match(/\/subject\/(\d+)/);
  return match ? match[1] : null;
}

// 搜索BT资源
async function searchBTResources(movieTitle) {
  try {
    // 发送消息给background script进行跨域请求
    const response = await chrome.runtime.sendMessage({
      action: 'searchBT',
      title: movieTitle
    });
    
    return response;
  } catch (error) {
    console.error('搜索BT资源失败:', error);
    return null;
  }
}

// 解析搜索结果
function parseSearchResults(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 获取搜索结果数量
  const totalElement = doc.querySelector('.mac_total');
  const totalCount = totalElement ? parseInt(totalElement.textContent) : 0;
  
  // 解析影片列表
  const results = [];
  const items = doc.querySelectorAll('.module-item');
  
  items.forEach(item => {
    const titleLink = item.querySelector('.module-item-title');
    const descElement = item.querySelector('.video-text');
    const yearElement = item.querySelector('.module-item-caption span:first-child');
    const typeElement = item.querySelector('.video-class');
    const imageElement = item.querySelector('.module-item-pic img');
    
    if (titleLink) {
      results.push({
        title: titleLink.textContent.trim(),
        link: 'https://www.btbtla.com' + titleLink.getAttribute('href'),
        description: descElement ? descElement.textContent.trim() : '',
        year: yearElement ? yearElement.textContent.trim() : '',
        type: typeElement ? typeElement.textContent.trim() : '',
        image: imageElement ? imageElement.getAttribute('src') : ''
      });
    }
  });
  
  return {
    total: totalCount,
    results: results
  };
}

// 创建BT资源显示区域
function createBTSection() {
  const container = document.createElement('div');
  container.id = 'douban-bt-resources';
  container.className = 'douban-bt-container';
  
  container.innerHTML = `
    <div class="bt-header">
      <h2><i>BT资源搜索</i></h2>
    </div>
    <div class="bt-content">
      <div class="bt-results">
        <div class="bt-loading">
          <span class="loading-text">正在搜索...</span>
        </div>
      </div>
    </div>
  `;
  
  return container;
}

// 显示搜索结果
function displayResults(data, container) {
  const resultsElement = container.querySelector('.bt-results');
  
  if (!data || data.total === 0) {
    resultsElement.innerHTML = `
      <div class="bt-empty">
        <span class="no-result">未找到相关资源</span>
        <p class="empty-message">暂无BT资源，可能需要尝试其他关键词</p>
      </div>
    `;
    return;
  }
  
  // 生成结果HTML
  let resultsHTML = `
    <div class="bt-result-info">
      <span class="result-count">找到 <strong>${data.total}</strong> 个资源</span>
    </div>
    <div class="bt-list">
  `;
  
  data.results.forEach(item => {
    resultsHTML += `
      <div class="bt-item">
        <div class="bt-item-main">
          <h3><a href="${item.link}" target="_blank" class="bt-title">${item.title}</a></h3>
          ${item.year ? `<span class="bt-year">${item.year}</span>` : ''}
          ${item.type ? `<span class="bt-type">${item.type}</span>` : ''}
        </div>
        ${item.description ? `<p class="bt-desc">${item.description}</p>` : ''}
        <div class="bt-actions">
          <a href="${item.link}" target="_blank" class="bt-link-btn">查看详情 →</a>
        </div>
      </div>
    `;
  });
  resultsHTML += '</div>';
  
  // 添加查看更多链接
  if (data.total > data.results.length) {
    const movieTitle = getMovieTitle();
    const searchUrl = `https://www.btbtla.com/search/${encodeURIComponent(movieTitle)}`;
    resultsHTML += `
      <div class="bt-more">
        <a href="${searchUrl}" target="_blank" class="bt-more-link">
          查看全部 ${data.total} 个资源 →
        </a>
      </div>
    `;
  }
  
  resultsElement.innerHTML = resultsHTML;
}

// 处理分词搜索
async function searchWithKeywords(title) {
  const searchAttempts = [];
  
  // 1. 先提取中文部分（包括季数信息）
  // 匹配中文标题和可能的季数信息
  const chineseMatch = title.match(/^([^a-zA-Z]+?)(?:\s+[A-Z]|$)/);
  if (chineseMatch) {
    const chineseTitle = chineseMatch[1].trim();
    if (chineseTitle && chineseTitle !== title) {
      searchAttempts.push(chineseTitle);
      
      // 2. 如果包含季数，再尝试去除季数搜索
      const withoutSeason = chineseTitle
        .replace(/[第]\d+[季部集]/g, '')
        .replace(/\s+\d+$/, '') // 去除末尾数字
        .replace(/Season\s*\d+/i, '') // 去除英文季数
        .trim();
      
      if (withoutSeason && withoutSeason !== chineseTitle) {
        searchAttempts.push(withoutSeason);
      }
    }
  }
  
  // 3. 如果没有中文，尝试其他分词策略
  if (searchAttempts.length === 0) {
    // 去除英文部分，保留中文
    const chineseOnly = title.replace(/[a-zA-Z\s]+/g, '').trim();
    if (chineseOnly && chineseOnly.length > 1) {
      searchAttempts.push(chineseOnly);
    }
    
    // 去除冒号后的副标题
    const beforeColon = title.split(/[：:]/)[0].trim();
    if (beforeColon && beforeColon !== title) {
      searchAttempts.push(beforeColon);
    }
  }
  
  // 4. 依次尝试搜索
  for (const keyword of searchAttempts) {
    console.log('尝试分词搜索:', keyword);
    const response = await searchBTResources(keyword);
    if (response && response.success) {
      const data = parseSearchResults(response.html);
      if (data.total > 0) {
        return response;
      }
    }
  }
  
  return null;
}

// 插入BT资源区域到页面
function insertBTSection() {
  // 找到合适的插入位置（在剧情简介之后）
  const relatedInfo = document.querySelector('.related-info');
  const celebrities = document.querySelector('#celebrities');
  const insertPoint = relatedInfo || celebrities;
  
  if (!insertPoint) {
    console.log('未找到合适的插入位置');
    return;
  }
  
  const btSection = createBTSection();
  insertPoint.parentNode.insertBefore(btSection, insertPoint.nextSibling);
  
  return btSection;
}

// 初始化函数
async function init() {
  // 检查是否在电影详情页
  if (!window.location.pathname.match(/\/subject\/\d+/)) {
    return;
  }
  
  const movieTitle = getMovieTitle();
  if (!movieTitle) {
    console.log('未能获取电影标题');
    return;
  }
  
  console.log('电影标题:', movieTitle);
  
  // 插入BT资源区域
  const btSection = insertBTSection();
  if (!btSection) {
    return;
  }
  
  // 搜索BT资源
  let searchResponse = await searchBTResources(movieTitle);
  
  if (searchResponse && searchResponse.success) {
    const data = parseSearchResults(searchResponse.html);
    
    // 如果没有结果，尝试分词搜索
    if (data.total === 0) {
      console.log('完整标题无结果，尝试分词搜索...');
      
      const keywordResponse = await searchWithKeywords(movieTitle);
      if (keywordResponse && keywordResponse.success) {
        const keywordData = parseSearchResults(keywordResponse.html);
        displayResults(keywordData, btSection);
      } else {
        displayResults(data, btSection);
      }
    } else {
      displayResults(data, btSection);
    }
  } else {
    // 显示错误信息
    const resultsElement = btSection.querySelector('.bt-results');
    resultsElement.innerHTML = `
      <div class="bt-error">
        <span class="error">搜索失败，请稍后重试</span>
      </div>
    `;
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}