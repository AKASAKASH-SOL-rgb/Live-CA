import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(BASE_DIR)

# SQLite Database path (can be overridden with DB_PATH env var)
DB_PATH = os.environ.get("DB_PATH", os.path.join(PROJECT_DIR, "current_affairs.db"))

SOURCES = {
    "gktoday": {
        "name": "GKToday",
        "url": "https://www.gktoday.in/current-affairs/",
        "is_primary": True,
        "badge_color": "bg-emerald-500",
    },
    "drishti": {
        "name": "Drishti IAS",
        "url": "https://www.drishtiias.com/current-affairs-news-analysis-editorials",
        "is_primary": False,
        "badge_color": "bg-indigo-500",
    },
    "thehindu_national": {
        "name": "The Hindu (National)",
        "url": "https://www.thehindu.com/news/national/feeder/default.rss",
        "type": "rss",
        "badge_color": "bg-blue-600",
    },
    "thehindu_business": {
        "name": "The Hindu (Business)",
        "url": "https://www.thehindu.com/business/feeder/default.rss",
        "type": "rss",
        "badge_color": "bg-cyan-600",
    },
    "economic_times": {
        "name": "Economic Times",
        "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
        "type": "rss",
        "badge_color": "bg-amber-600",
    },
    "times_of_india": {
        "name": "Times of India",
        "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
        "type": "rss",
        "badge_color": "bg-red-500",
    }
}

EXAM_CATEGORIES = [
    "All Categories",
    "Banking & Economy",
    "National & Governance",
    "International & Summits",
    "Appointments & Resignations",
    "Defence, Science & Space",
    "Schemes & Initiatives",
    "Awards & Honours",
    "Sports & Games",
    "Important Days & Themes",
    "Environment & Ecology"
]

EXAM_TARGETS = [
    {"id": "all", "label": "All Exams", "icon": "layers"},
    {"id": "ssc", "label": "SSC (CGL/CHSL/MTS)", "icon": "award"},
    {"id": "railway", "label": "Railways (RRB NTPC/Group D)", "icon": "train"},
    {"id": "banking", "label": "Banking (IBPS/SBI/RBI)", "icon": "landmark"},
]
