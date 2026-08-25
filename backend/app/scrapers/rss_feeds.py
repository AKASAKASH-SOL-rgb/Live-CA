import feedparser
import hashlib
from datetime import datetime
from typing import List, Dict, Any
from app.services.distiller import (
    distill_to_2_3_linear,
    extract_static_gk,
    classify_exam_targets,
    detect_category,
    is_exam_relevant,
    clean_html_text
)

RSS_CHANNELS = [
    {
        "source_id": "thehindu_national",
        "source_name": "The Hindu (National)",
        "url": "https://www.thehindu.com/news/national/feeder/default.rss",
        "max": 10
    },
    {
        "source_id": "thehindu_business",
        "source_name": "The Hindu (Business)",
        "url": "https://www.thehindu.com/business/feeder/default.rss",
        "max": 10
    },
    {
        "source_id": "economic_times",
        "source_name": "Economic Times",
        "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        "max": 10
    },
    {
        "source_id": "times_of_india",
        "source_name": "Times of India",
        "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
        "max": 8
    }
]

def fetch_rss_articles() -> List[Dict[str, Any]]:
    """
    Parses RSS feeds from The Hindu, Economic Times, and Times of India.
    Filters out noise and distills exam-oriented facts.
    """
    articles = []
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    for ch in RSS_CHANNELS:
        try:
            feed = feedparser.parse(ch["url"])
            count = 0
            for entry in feed.entries:
                title = clean_html_text(entry.get("title", ""))
                summary = clean_html_text(entry.get("summary", "") or entry.get("description", ""))
                link = entry.get("link", "")
                
                # Check exam relevance
                if not is_exam_relevant(title, summary):
                    continue
                    
                art_id = f"{ch['source_id']}_{hashlib.md5(link.encode()).hexdigest()[:10]}"
                bullets, one_liner = distill_to_2_3_linear(title, [summary], summary)
                category = detect_category(title, summary)
                exam_targets = classify_exam_targets(title, summary)
                static_gk = extract_static_gk(title, summary)
                
                articles.append({
                    "id": art_id,
                    "title": title,
                    "source_id": ch["source_id"],
                    "source_name": ch["source_name"],
                    "original_url": link,
                    "published_date": today_str,
                    "category": category,
                    "exam_targets": exam_targets,
                    "bullets": bullets,
                    "one_liner": one_liner,
                    "static_gk": static_gk,
                    "summary_raw": summary,
                    "is_featured": False
                })
                
                count += 1
                if count >= ch["max"]:
                    break
        except Exception as e:
            print(f"[RSS Scraper] Error for {ch['source_name']}: {e}")
            
    return articles
