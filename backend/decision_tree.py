# backend/decision_tree.py
from typing import Dict

def compute_risk_score(features: Dict) -> int:
    # Features is the 'features' dict from Gemini result
    score = 0
    # Purulent discharge - high weight
    disp = features.get("discharge", {})
    if disp.get("present") and disp.get("type") == "purulent":
        score += 60
    # redness extent
    rdr = features.get("redness", {})
    if rdr.get("present") and isinstance(rdr.get("extent_percent"), (int, float)):
        score += int(25 * (rdr.get("extent_percent") / 100.0))
    # swelling presence
    if features.get("swelling", {}).get("present"):
        score += 10
    # dressing lift
    if features.get("dressing_lift", {}).get("present"):
        score += 5
    # open wound
    if features.get("open_wound", {}).get("present"):
        score += 20
    # clamp
    if score > 100:
        score = 100
    if score < 0:
        score = 0
    return score

def classify_label(gemini_json: Dict) -> Dict:
    features = gemini_json.get("features", {})
    overall_conf = gemini_json.get("overall_confidence", 0.0)

    # Compute risk score
    risk = compute_risk_score(features)

    # Rule-based mapping (same logic as prompt suggestions)
    label = "Green"
    explanation = "No concerning signs detected."

    # Highest-priority rules
    disp = features.get("discharge", {})
    if disp.get("present") and disp.get("type") == "purulent":
        label = "Red"
        explanation = "Purulent discharge detected — urgent clinician review recommended."
    elif features.get("redness", {}).get("present") and features.get("redness", {}).get("extent_percent", 0) > 30 and features.get("swelling", {}).get("present"):
        label = "Yellow"
        explanation = "Widespread redness with swelling — escalate for clinician review."
    elif features.get("dressing_lift", {}).get("present") and (disp.get("present") or features.get("redness", {}).get("present")):
        label = "Yellow"
        explanation = "Dressing lift with local signs — check dressing and review clinically."
    elif features.get("open_wound", {}).get("present") and (features.get("open_wound", {}).get("size_mm") or 0) > 10:
        label = "Yellow"
        explanation = "Open wound >10mm — needs clinical attention."
    elif overall_conf < 0.5:
        label = "Uncertain"
        explanation = "Low confidence — request a clearer photo."

    # Map risk score to color if not already Red/Yellow by rules
    if label == "Green":
        if risk >= 60:
            label = "Red"
            explanation = "Risk score high based on features — urgent review."
        elif risk >= 25:
            label = "Yellow"
            explanation = "Moderate risk score — clinician review advised."

    return {
        "label": label,
        "risk_score": risk,
        "explanation": explanation,
        "overall_confidence": overall_conf
    }
