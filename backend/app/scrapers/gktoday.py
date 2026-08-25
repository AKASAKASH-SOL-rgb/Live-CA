import requests
from bs4 import BeautifulSoup
import hashlib
from datetime import datetime
from typing import List, Dict, Any
from app.services.distiller import distill_to_2_3_linear, extract_static_gk, classify_exam_targets, detect_category

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

def fetch_gktoday_articles(max_articles: int = 15) -> List[Dict[str, Any]]:
    """
    Scrapes GKToday current affairs feed and detailed articles.
    Focus is GKToday as requested by the user.
    """
    articles = []
    main_url = "https://www.gktoday.in/current-affairs/"
    
    try:
        resp = requests.get(main_url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            print(f"[GKToday] Failed to fetch list: HTTP {resp.status_code}")
            return articles
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        headings = soup.find_all(['h1', 'h2', 'h3'])
        
        target_links = []
        for h in headings:
            a = h.find('a')
            if a and a.get('href') and 'gktoday.in/' in a['href']:
                href = a['href']
                title = a.get_text(strip=True)
                # Ignore generic links or archive links
                if len(title) > 12 and not any(x in href for x in ['/category/', '/quiz/', '/page/', '/contact', '/about']):
                    if href not in [t[1] for t in target_links]:
                        # Extract date or snippet if nearby
                        parent = h.find_parent(['div', 'article'])
                        snippet = parent.get_text(strip=True) if parent else ""
                        target_links.append((title, href, snippet))

        print(f"[GKToday] Found {len(target_links)} candidate articles. Fetching top {max_articles}...")
        
        for title, href, snippet in target_links[:max_articles]:
            art_id = f"gktoday_{hashlib.md5(href.encode()).hexdigest()[:10]}"
            pub_date = datetime.now().strftime("%Y-%m-%d")
            
            # Fetch article body to get high-fidelity 2-3 linear points
            body_paragraphs = []
            try:
                art_resp = requests.get(href, headers=HEADERS, timeout=8)
                if art_resp.status_code == 200:
                    art_soup = BeautifulSoup(art_resp.text, 'html.parser')
                    main_content = art_soup.find('main') or art_soup.find('div', class_='site-content') or art_soup.find('article')
                    if main_content:
                        for p in main_content.find_all(['p', 'li']):
                            p_txt = p.get_text(strip=True)
                            if len(p_txt) > 25 and not any(k in p_txt.lower() for k in ["leave a reply", "your email address"]):
                                body_paragraphs.append(p_txt)
            except Exception as ex:
                print(f"[GKToday] Error fetching article body {href}: {ex}")
                
            if not body_paragraphs and snippet:
                body_paragraphs = [snippet]
                
            bullets, one_liner = distill_to_2_3_linear(title, body_paragraphs)
            full_text = " ".join(body_paragraphs)
            category = detect_category(title, full_text, snippet)
            exam_targets = classify_exam_targets(title, full_text)
            static_gk = extract_static_gk(title, full_text)
            
            articles.append({
                "id": art_id,
                "title": title,
                "source_id": "gktoday",
                "source_name": "GKToday",
                "original_url": href,
                "published_date": pub_date,
                "category": category,
                "exam_targets": exam_targets,
                "bullets": bullets,
                "one_liner": one_liner,
                "static_gk": static_gk,
                "summary_raw": " ".join(body_paragraphs[:3]),
                "is_featured": True
            })
            
    except Exception as e:
        print(f"[GKToday] Global scrape error: {e}")
        
    return articles
