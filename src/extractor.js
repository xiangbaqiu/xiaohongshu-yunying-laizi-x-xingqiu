function extractTweetsFromPage() {
  const anchors = Array.from(document.querySelectorAll('a[href*="/status/"]'));
  const items = [];
  const seen = new Set();

  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const match = href.match(/^\/(.+?)\/status\/(\d+)/);
    if (!match) continue;

    const authorHandle = match[1];
    const tweetId = match[2];
    if (seen.has(tweetId)) continue;

    const article = a.closest('article');
    if (!article) continue;
    seen.add(tweetId);

    const timeEl = article.querySelector('time');
    const text = Array.from(article.querySelectorAll('[data-testid="tweetText"]'))
      .map((n) => n.innerText.trim())
      .filter(Boolean)
      .join('\n');

    const mediaUrls = Array.from(article.querySelectorAll('img[src], video[poster]'))
      .map((el) => el.getAttribute('src') || el.getAttribute('poster'))
      .filter(Boolean)
      .filter((src) => /twimg\.com|pbs\.twimg\.com/.test(src));

    const metricHints = Array.from(
      article.querySelectorAll('[role="group"] [aria-label], [data-testid$="count"]')
    )
      .map((el) => el.getAttribute('aria-label') || el.textContent || '')
      .map((s) => s.trim())
      .filter(Boolean);

    items.push({
      tweet_id: tweetId,
      url: new URL(href, location.origin).toString(),
      text,
      created_at: timeEl?.getAttribute('datetime') || null,
      author_handle: authorHandle,
      media_urls: Array.from(new Set(mediaUrls)),
      metric_hints: metricHints,
      article_text: article.innerText.slice(0, 2000)
    });
  }

  return {
    extracted_at: new Date().toISOString(),
    url: location.href,
    count: items.length,
    items
  };
}

module.exports = {
  extractTweetsFromPage,
  extractTweetsFromPageSource: `(${extractTweetsFromPage.toString()})()`
};
