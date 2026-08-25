import random
import hashlib
from typing import List, Dict, Any

def generate_mcqs_from_articles(articles: List[Dict[str, Any]], count: int = 10) -> List[Dict[str, Any]]:
    """
    Generates realistic 4-option MCQs based on the real current affairs articles.
    """
    questions = []
    
    for idx, art in enumerate(articles):
        title = art.get("title", "")
        bullets = art.get("bullets", [])
        category = art.get("category", "General Awareness")
        exam_targets = art.get("exam_targets", ["ssc"])
        primary_target = exam_targets[0].upper() if exam_targets else "SSC/BANK"
        static_gk = art.get("static_gk", [])
        
        # Build question types based on content
        q_id = f"mcq_{hashlib.md5(title.encode()).hexdigest()[:8]}_{idx}"
        
        # Strategy 1: Title-based who/what question
        q_text = f"Which organisation / entity or key event is associated with: '{title}'?"
        
        # Distractors pool
        distractor_pool = [
            "Ministry of Finance & Reserve Bank of India",
            "Defence Research and Development Organisation (DRDO)",
            "Indian Space Research Organisation (ISRO)",
            "NITI Aayog & Ministry of Commerce",
            "Ministry of Railways & IRCTC",
            "Securities and Exchange Board of India (SEBI)",
            "National Bank for Agriculture and Rural Development (NABARD)",
            "State Bank of India & Indian Banks Association"
        ]
        
        correct_ans = art.get("source_name", "GKToday Current Affairs") + " Highlights"
        if len(bullets) > 0:
            # Let's craft an authentic option
            correct_ans = bullets[0]
            if len(correct_ans) > 90:
                correct_ans = correct_ans[:87] + "..."

        distractors = [d for d in distractor_pool if d.lower() not in title.lower()][:3]
        while len(distractors) < 3:
            distractors.append(f"Standard Initiative Option {len(distractors)+1}")
            
        options = [correct_ans] + distractors
        random.seed(idx * 42)
        random.shuffle(options)
        correct_idx = options.index(correct_ans)
        
        explanation = f"Correct Answer: {correct_ans}\n\nKey Takeaway: {' '.join(bullets[:2])}"
        if static_gk:
            static_text = " | ".join([f"{item['label']}: {item['value']}" for item in static_gk])
            explanation += f"\n\nStatic GK Booster: {static_text}"

        questions.append({
            "id": q_id,
            "question": f"Regarding recent developments, which of the following is correct about '{title}'?",
            "options": options,
            "correct_index": correct_idx,
            "explanation": explanation,
            "category": category,
            "exam_target": primary_target,
            "source_article_id": art.get("id")
        })
        
        if len(questions) >= count:
            break
            
    return questions
