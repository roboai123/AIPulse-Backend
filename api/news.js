// api/news.js
export default async function handler(req, res) {
  // CORS configuration to allow your GitHub Pages site to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Securely read key from server environment variable
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Server configuration error: NEWS_API_KEY environment variable missing.'
    });
  }

  const { category = 'all' } = req.query;

  // 2. Build target NewsAPI URL based on requested category
  let targetUrl = '';
  const cat = category.toLowerCase();

  if (cat === 'all') {
    targetUrl = `https://newsapi.org/v2/top-headlines?language=en&pageSize=40&apiKey=${apiKey}`;
  } else if (cat === 'india') {
    targetUrl = `https://newsapi.org/v2/top-headlines?country=in&pageSize=40&apiKey=${apiKey}`;
  } else if (['technology', 'science', 'business', 'sports', 'entertainment'].includes(cat)) {
    targetUrl = `https://newsapi.org/v2/top-headlines?category=${cat}&language=en&pageSize=40&apiKey=${apiKey}`;
  } else {
    targetUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(cat)}&sortBy=publishedAt&language=en&pageSize=40&apiKey=${apiKey}`;
  }

  try {
    const apiResponse = await fetch(targetUrl);
    const data = await apiResponse.json();

    if (data.status !== 'ok') {
      return res.status(apiResponse.status || 500).json({
        status: 'error',
        message: data.message || 'Error fetching data from NewsAPI.'
      });
    }

    const rawArticles = data.articles || [];
    const seenTitles = new Set();
    const cleanArticles = [];

    // 3. Process, Filter & Deduplicate
    for (const item of rawArticles) {
      // Reject invalid articles or missing publication dates
      if (!item.title || item.title === '[Removed]' || !item.publishedAt) {
        continue;
      }

      // Verify date is valid
      const pubTimestamp = new Date(item.publishedAt).getTime();
      if (isNaN(pubTimestamp)) {
        continue;
      }

      const normalizedTitle = item.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }

      seenTitles.add(normalizedTitle);

      cleanArticles.push({
        id: `news-${pubTimestamp}-${Math.random().toString(36).substr(2, 5)}`,
        title: item.title,
        source: item.source?.name || 'Verified Publisher',
        author: item.author || null,
        pubDate: item.publishedAt,
        link: item.url,
        image: item.urlToImage || null,
        summary: item.description || item.content || 'No narrative description provided by publisher.'
      });
    }

    // 4. Sort chronologically (Newest First)
    cleanArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return res.status(200).json({
      status: 'ok',
      count: cleanArticles.length,
      articles: cleanArticles
    });

  } catch (error) {
    console.error("Backend Proxy Error:", error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server proxy execution error.'
    });
  }
}
