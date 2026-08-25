import re
from typing import List, Dict, Tuple, Any

# Keyword dictionaries for exam classification
BANKING_KEYWORDS = [
    "rbi", "reserve bank", "sebi", "irdai", "nabard", "sidbi", "exim", "sbi", "hdfc", "icici",
    "bank", "banking", "inflation", "cpi", "wpi", "repo rate", "reverse repo", "crr", "slr",
    "monetary policy", "mpc", "gdp", "fiscal deficit", "foreign exchange", "forex", "rupee",
    "imf", "world bank", "adb", "aiib", "npa", "fintech", "upi", "neft", "rtgs", "cbdc",
    "disinvestment", "tax", "gst", "economic", "budget", "fdi", "fii", "stock exchange", "nse", "bse"
]

RAILWAY_KEYWORDS = [
    "railway", "railways", "train", "vande bharat", "bullet train", "amrit bharat", "namo bharat",
    "irctc", "locomotive", "track", "freight", "dfccil", "rail corridor", "station redevelopment",
    "metro", "rrts", "kavach", "safety system", "transport", "infrastructure", "nhai", "expressway",
    "port", "inland waterway", "shipping", "aviation", "airport", "udsn"
]

SSC_KEYWORDS = [
    "supreme court", "high court", "constitution", "article", "amendment", "parliament", "bill",
    "act", "president", "prime minister", "governor", "chief minister", "drdo", "isro", "iit",
    "missile", "satellite", "defence", "exercise", "yojana", "scheme", "portal", "award",
    "padma", "khel ratna", "olympics", "world cup", "championship", "summit", "g20", "brics",
    "asean", "sco", "un", "unesco", "who", "wto", "appointment", "director general", "chief"
]

CATEGORY_RULES = [
    ("Banking & Economy", ["bank", "rbi", "sebi", "monetary", "inflation", "gdp", "gst", "finance", "economy", "fiscal", "rupee", "imf", "world bank", "shares", "stock", "fund", "loan"]),
    ("Defence, Science & Space", ["drdo", "isro", "missile", "defence", "army", "navy", "air force", "satellite", "nasa", "space", "exercise", "warship", "submarine", "ai", "technology", "csir"]),
    ("Appointments & Resignations", ["appointed", "appointment", "sworn in", "assumes charge", "elected", "resigns", "resignation", "new chief", "named as", "takes over"]),
    ("Schemes & Initiatives", ["scheme", "yojana", "portal", "initiative", "campaign", "mission", "launched", "inaugurated", "pradhan mantri", "aatmanirbhar"]),
    ("Awards & Honours", ["award", "honour", "prize", "conferred", "medal", "felicitated", "oscar", "grammy", "padma", "nobel", "sahitya"]),
    ("Sports & Games", ["cricket", "football", "chess", "badminton", "olympics", "gold medal", "trophy", "world cup", "grandmaster", "bcci", "fifa", "wimbledon"]),
    ("International & Summits", ["summit", "bilateral", "treaty", "united nations", "un", "g20", "g7", "brics", "asean", "sco", "global", "pact", "mou", "ambassador", "foreign"]),
    ("Important Days & Themes", ["day", "celebrated", "observed", "theme", "anniversary", "world day", "national day", "jayanti"]),
    ("Environment & Ecology", ["environment", "climate", "tiger reserve", "national park", "wildlife", "wetland", "ramsar", "carbon", "forest", "pollution"]),
    ("National & Governance", ["cabinet", "ministry", "state", "centre", "government", "parliament", "bill", "act", "court", "tribunal", "governor", "cm"])
]

STATIC_GK_KNOWLEDGE_BASE = {
    "drdo": [
        {"label": "Full Form", "value": "Defence Research and Development Organisation"},
        {"label": "Headquarters", "value": "New Delhi"},
        {"label": "Founded", "value": "1958"},
        {"label": "Ministry", "value": "Ministry of Defence"}
    ],
    "isro": [
        {"label": "Full Form", "value": "Indian Space Research Organisation"},
        {"label": "Headquarters", "value": "Bengaluru, Karnataka"},
        {"label": "Founded", "value": "15 August 1969"},
        {"label": "Parent Dept", "value": "Department of Space"}
    ],
    "rbi": [
        {"label": "Establishment", "value": "1 April 1935 (RBI Act, 1934)"},
        {"label": "Headquarters", "value": "Mumbai, Maharashtra"},
        {"label": "Nationalised", "value": "1 January 1949"},
        {"label": "First Governor", "value": "Sir Osborne Smith (1st Indian: CD Deshmukh)"}
    ],
    "sebi": [
        {"label": "Statutory Status", "value": "1992 (SEBI Act, 1992)"},
        {"label": "Headquarters", "value": "Mumbai"},
        {"label": "Function", "value": "Regulates Securities and Capital Markets"}
    ],
    "nabard": [
        {"label": "Establishment", "value": "12 July 1982 (B. Sivaraman Committee)"},
        {"label": "Headquarters", "value": "Mumbai"}
    ],
    "brics": [
        {"label": "Original Members", "value": "Brazil, Russia, India, China, South Africa"},
        {"label": "Headquarters", "value": "Shanghai, China (NDB)"}
    ],
    "asean": [
        {"label": "Headquarters", "value": "Jakarta, Indonesia"},
        {"label": "Founded", "value": "8 August 1967 (Bangkok Declaration)"}
    ],
    "unesco": [
        {"label": "Headquarters", "value": "Paris, France"},
        {"label": "Founded", "value": "16 November 1945"}
    ],
    "imf": [
        {"label": "Headquarters", "value": "Washington, D.C., USA"},
        {"label": "Managing Director", "value": "Kristalina Georgieva"},
        {"label": "Currency Unit", "value": "SDR (Special Drawing Rights)"}
    ],
    "world bank": [
        {"label": "Headquarters", "value": "Washington, D.C., USA"},
        {"label": "President", "value": "Ajay Banga"}
    ],
    "railway": [
        {"label": "First Train in India", "value": "16 April 1853 (Mumbai to Thane - 34 km)"},
        {"label": "Railway Board Founded", "value": "1905"},
        {"label": "HQ", "value": "Rail Bhavan, New Delhi"}
    ]
}

def clean_html_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def is_exam_relevant(title: str, content: str) -> bool:
    """Filter out pure clickbait, local crime, celebrity gossip, etc."""
    combined = (title + " " + content).lower()
    
    # Irrelevant noise indicators
    noise_keywords = [
        "box office collection", "celebrity gossip", "spotted at airport",
        "horoscope", "astrology", "zodiac sign", "ott release", "movie review",
        "red carpet", "fashion police", "dating rumours", "viral reel"
    ]
    if any(k in combined for k in noise_keywords):
        return False
    
    # Relevant exam indicators
    valid_indicators = [
        "india", "ministry", "government", "rbi", "bank", "railway", "isro", "drdo",
        "supreme court", "president", "prime minister", "award", "summit", "treaty",
        "scheme", "yojana", "portal", "index", "ranking", "gdp", "defence", "space",
        "sports", "championship", "appointed", "bilateral", "act", "bill", "commission"
    ]
    return any(k in combined for k in valid_indicators) or len(title) > 20

def classify_exam_targets(title: str, text: str) -> List[str]:
    combined = (title + " " + text).lower()
    targets = []
    
    is_bank = any(k in combined for k in BANKING_KEYWORDS)
    is_rail = any(k in combined for k in RAILWAY_KEYWORDS)
    is_ssc = any(k in combined for k in SSC_KEYWORDS) or True # Almost all CA applies to SSC GA
    
    if is_ssc:
        targets.append("ssc")
    if is_rail:
        targets.append("railway")
    if is_bank:
        targets.append("banking")
        
    if not targets:
        targets = ["ssc", "railway", "banking"]
        
    return targets

def detect_category(title: str, text: str, source_category: str = None) -> str:
    combined = (title + " " + (source_category or "") + " " + text).lower()
    
    for cat_name, keywords in CATEGORY_RULES:
        if any(k in combined for k in keywords):
            return cat_name
            
    return "National & Governance"

def extract_static_gk(title: str, text: str) -> List[Dict[str, str]]:
    combined = (title + " " + text).lower()
    static_items = []
    
    for key, items in STATIC_GK_KNOWLEDGE_BASE.items():
        if key in combined:
            static_items.extend(items)
            
    # Remove duplicates
    seen = set()
    unique_items = []
    for item in static_items:
        key = (item["label"], item["value"])
        if key not in seen:
            seen.add(key)
            unique_items.append(item)
            
    return unique_items[:4] # Max 4 booster points

def distill_to_2_3_linear(title: str, raw_paragraphs: List[str], raw_text: str = "") -> Tuple[List[str], str]:
    """
    Distills news into strictly 2 to 3 high-impact linear bullet points
    and 1 crisp exam one-liner.
    """
    candidates = []
    
    # Process given paragraphs
    if raw_paragraphs:
        for p in raw_paragraphs:
            cleaned = clean_html_text(p)
            # Split into individual sentences
            sentences = re.split(r'(?<=[.!?])\s+', cleaned)
            for s in sentences:
                s = s.strip()
                if len(s) > 30 and len(s) < 220:
                    if not any(noise in s.lower() for noise in ["leave a reply", "subscribe", "click here", "read more", "advertisement", "email address"]):
                        candidates.append(s)
    elif raw_text:
        cleaned = clean_html_text(raw_text)
        sentences = re.split(r'(?<=[.!?])\s+', cleaned)
        for s in sentences:
            s = s.strip()
            if len(s) > 30 and len(s) < 220:
                candidates.append(s)

    # Pick top 2 or 3 high-yield sentences
    bullets = []
    for c in candidates:
        if c not in bullets and len(bullets) < 3:
            bullets.append(c)
            
    # If not enough bullets, format smartly from title and text
    if not bullets:
        bullets = [
            f"Key Event: {title.strip()}.",
            "Crucial for General Awareness in upcoming SSC, Railway, and Banking exams."
        ]
    elif len(bullets) == 1:
        bullets.append("Exam Takeaway: Direct question expected on responsible entity, target location, and static GK background.")

    # Generate 1-liner summary
    first_bullet = bullets[0]
    one_liner = first_bullet if len(first_bullet) <= 140 else first_bullet[:137] + "..."
    
    return bullets, one_liner
