#!/usr/bin/env python3
"""
Recompute TF-IDF keywords, project similarity, and analytics.json.
Run after adding new projects to projects.json.

Usage:
  python scripts/compute_analytics.py
"""

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.json"
ANALYTICS_FILE = ROOT / "analytics.json"

# ─── Stop Words ──────────────────────────────────────────────
STOP_WORDS = set(
    "a an the is are was were be been being have has had do does did will would "
    "shall should may might can could this that these those it its i me my we our "
    "you your he his she her they them their what which who whom how when where "
    "why all each every both few more most other some such no not only same so "
    "than too very just because but or and if as at by for from in into of on to "
    "with about between through during before after above below up down out off "
    "over under again further then once also back still already even now".split()
)

KSU_STOP = set([
    "ksu", "kennesaw", "state", "university", "ccse", "college", "computing",
    "software", "engineering", "department", "advisor", "professor", "capstone",
    "project", "research", "student", "students", "semester", "spring", "fall",
    "summer", "campus", "marietta", "course", "class", "team", "group",
    "system", "application", "app", "using", "based", "analysis", "data",
    "learning", "machine", "model", "approach", "method", "results",
    "study", "proposed", "developed", "design", "implemented", "paper",
    "work", "provide", "used", "use", "different", "new", "two", "one",
    "various", "many", "several", "first", "second", "also", "well",
    "however", "therefore", "addition", "order", "including", "aim",
    "goal", "objective", "present", "existing", "current", "future",
    "potential", "important", "significant", "performance", "information",
    "process", "user", "users", "website", "web", "tool", "tools",
    "provide", "allows", "create", "created", "built", "build",
    "intern", "internship", "experience", "major", "program", "end", "topic",
])

ALL_STOP = STOP_WORDS | KSU_STOP


def tokenize(text: str) -> list[str]:
    if not text:
        return []
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return [w for w in words if w not in ALL_STOP and len(w) > 2]


def project_key(p: dict) -> str:
    """Stable per-project key for cross-file references."""
    if p.get("project_key"):
        return p["project_key"]
    if p.get("detail_url"):
        return f"url:{p['detail_url']}"
    pid = p.get("id", "")
    sem = p.get("semester", "")
    title = (p.get("title", "") or "").strip().lower()
    return f"legacy:{pid}|{sem}|{title}"


def recompute_all(projects: list[dict] = None, output_path: Path = None):
    """Full recomputation of keywords, similarity, and analytics."""
    
    if projects is None:
        with open(PROJECTS_FILE) as f:
            projects = json.load(f)
    if output_path is None:
        output_path = ANALYTICS_FILE
    
    N = len(projects)
    print(f"Recomputing analytics for {N} projects...")
    
    # ══════════════════════════════════════════════════════════
    # 1. TF-IDF Keywords
    # ══════════════════════════════════════════════════════════
    print("  [1/3] Computing TF-IDF keywords...", flush=True)
    doc_freq = Counter()
    project_tokens = []
    
    for p in projects:
        text = f"{p.get('title', '')} {p.get('abstract', '')} {p.get('topics', '')}"
        tokens = tokenize(text)
        unique = set(tokens)
        for t in unique:
            doc_freq[t] += 1
        project_tokens.append(tokens)
    
    for i, p in enumerate(projects):
        p["project_key"] = project_key(p)
        tokens = project_tokens[i]
        if not tokens:
            p["keywords"] = []
            continue
        tf = Counter(tokens)
        max_tf = max(tf.values())
        scores = {}
        for word, count in tf.items():
            if doc_freq[word] < 3 or doc_freq[word] > N * 0.25:
                continue
            tfidf = (count / max_tf) * math.log(N / doc_freq[word])
            scores[word] = tfidf
        top = sorted(scores.items(), key=lambda x: -x[1])[:6]
        p["keywords"] = [w for w, s in top]
    
    kw_count = sum(1 for p in projects if p.get("keywords"))
    print(f"    {kw_count} projects with keywords")
    
    # ══════════════════════════════════════════════════════════
    # 2. Project Similarity
    # ══════════════════════════════════════════════════════════
    print("  [2/3] Computing project similarity...", flush=True)
    keyword_sets = []
    for p in projects:
        kw = set(p.get("keywords", []))
        title_tokens = set(tokenize(p.get("title", "")))
        kw.update(title_tokens)
        keyword_sets.append(kw)
    
    for i, p in enumerate(projects):
        if not keyword_sets[i]:
            p["similar"] = []
            continue
        
        scores = []
        for j, q in enumerate(projects):
            if i == j or not keyword_sets[j]:
                continue
            
            intersection = len(keyword_sets[i] & keyword_sets[j])
            union = len(keyword_sets[i] | keyword_sets[j])
            if union == 0 or intersection < 2:
                continue
            
            sim = intersection / union
            if p.get("domain") == q.get("domain"):
                sim += 0.05
            if p.get("semester") != q.get("semester"):
                sim += 0.02
            
            if sim > 0.15:
                scores.append((j, sim))
        
        scores.sort(key=lambda x: -x[1])
        refs = []
        seen_refs = set()
        src_key = project_key(p)
        for j, s in scores:
            ref_key = project_key(projects[j])
            if ref_key == src_key:
                continue
            if ref_key in seen_refs:
                continue
            seen_refs.add(ref_key)
            refs.append(ref_key)
            if len(refs) >= 3:
                break
        p["similar"] = refs
    
    sim_count = sum(1 for p in projects if p.get("similar"))
    print(f"    {sim_count} projects with related connections")
    
    # ══════════════════════════════════════════════════════════
    # 3. Analytics JSON
    # ══════════════════════════════════════════════════════════
    print("  [3/3] Building analytics.json...", flush=True)
    
    # Semester order
    semester_set = sorted(
        set(p.get("semester", "") for p in projects if p.get("semester")),
        key=lambda s: (
            int(s.split()[-1]) if s.split() else 0,
            {"Spring": 0, "Summer": 1, "Fall": 2}.get(s.split()[0] if s.split() else "", 0),
        ),
    )
    
    # Domain trends (% per semester)
    domain_trends = {}
    for sem in semester_set:
        sem_projects = [p for p in projects if p.get("semester") == sem]
        total = len(sem_projects)
        if total == 0:
            continue
        domain_counts = Counter(p.get("domain", "") for p in sem_projects)
        domain_trends[sem] = {d: round(c / total * 100, 1) for d, c in domain_counts.items()}
    
    # Domain keywords (for word cloud)
    domain_keywords = {}
    for domain in set(p.get("domain", "") for p in projects):
        domain_projects = [p for p in projects if p.get("domain") == domain]
        all_tokens = []
        for p in domain_projects:
            text = f"{p.get('title', '')} {p.get('abstract', '')}"
            all_tokens.extend(tokenize(text))
        
        tf = Counter(all_tokens)
        filtered = {w: c for w, c in tf.items() if doc_freq[w] < N * 0.2 and c >= 3}
        top = sorted(filtered.items(), key=lambda x: -x[1])[:30]
        domain_keywords[domain] = [{"word": w, "count": c} for w, c in top]
    
    analytics = {
        "domain_trends": domain_trends,
        "domain_keywords": domain_keywords,
        "semester_order": semester_set,
    }
    
    with open(output_path, "w") as f:
        json.dump(analytics, f)
    
    print(f"    Saved analytics.json ({len(semester_set)} semesters, {len(domain_keywords)} domains)")
    
    # Save updated projects
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f)
    
    print(f"  Done! Updated {N} projects with keywords + similarity")


if __name__ == "__main__":
    recompute_all()
