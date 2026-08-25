import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime
from typing import List, Dict, Any
from app.services.distiller import distill_to_2_3_linear, extract_static_gk, classify_exam_targets, detect_category

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

def fetch_drishti_articles(max_articles: int = 8) -> List[Dict[str, Any]]:
    """
    Scrapes Drishti IAS Current Affairs & News Analysis.
    """
    articles = []
    url = "https://www.drishtiias.com/current-affairs-news-analysis-editorials"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            print(f"[Drishti] HTTP error: {resp.status_code}")
            return articles
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        candidate_links = []
        
        for a in soup.find_all('a', href=True):
            href = a['href']
            title = a.get_text(strip=True)
            if ('/daily-updates/' in href or '/current-affairs/' in href) and len(title) > 15:
                if not href.startswith('http'):
                    href = 'https://www.drishtiias.com' + href
                if href not in [c[1] for c in candidate_links]:
                    candidate_links.append((title, href))
                    
        print(f"[Drishti] Found {len(candidate_links)} candidate articles.")
        
        for title, href in candidate_links[:max_articles]:
            art_id = f"drishti_{hashlib.md5(href.encode()).hexdigest()[:10]}"
            pub_date = datetime.now().strftime("%Y-%m-%d")
            
            body_paragraphs = []
            try:
                art_resp = requests.get(href, headers=HEADERS, timeout=8)
                if art_resp.status_code == 200:
                    art_soup = BeautifulSoup(art_resp.text, 'html.parser')
                    container = art_soup.find('div', class_='article-detail') or art_soup.find('article') or art_soup.find('main')
                    if container:
                        for p in container.find_all(['p', 'li']):
                            txt = p.get_text(strip=True)
                            if len(txt) > 25:
                                body_paragraphs.append(txt)
            except Exception as e:
                print(f"[Drishti] Detail error for {href}: {e}")
                
            bullets, one_liner = distill_to_2_3_linear(title, body_paragraphs)
            full_text = " ".join(body_paragraphs)
            category = detect_category(title, full_text)
            exam_targets = classify_exam_targets(title, full_text)
            static_gk = extract_static_gk(title, full_text)
            
            articles.append({
                "id": art_id,
                "title": title,
                "source_id": "drishti",
                "source_name": "Drishti IAS",
                "original_url": href,
                "published_date": pub_date,
                "category": category,
                "exam_targets": exam_targets,
                "bullets": bullets,
                "one_liner": one_liner,
                "static_gk": static_gk,
                "summary_raw": " ".join(body_paragraphs[:3]),
                "is_featured": False
            })
    except Exception as e:
        print(f"[Drishti] Scrape error: {e}")
        
    return articles
