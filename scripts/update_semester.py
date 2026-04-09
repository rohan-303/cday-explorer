#!/usr/bin/env python3
"""
C-Day Explorer — Automated Semester Update Pipeline
====================================================
Fetches new projects from Digital Commons, classifies domains,
matches posters/videos/winners, and updates projects.json.

Usage:
  python scripts/update_semester.py --semester "Spring 2026"
  python scripts/update_semester.py --semester "Fall 2026" --skip-suggestions

Requires: requests, beautifulsoup4, lxml
"""

import argparse
import json
import os
import re
import sys
import time
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ─── Paths ───────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.json"
ANALYTICS_FILE = ROOT / "analytics.json"

# ─── Digital Commons Base URLs ───────────────────────────────
DC_BASE = "https://digitalcommons.kennesaw.edu/ccse_computing_showcase"

# ─── KSU C-Day Events Base ───────────────────────────────────
CDAY_BASE = "https://campus.kennesaw.edu/colleges-departments/ccse/events/computing-showcase"

# ─── YouTube Channel ─────────────────────────────────────────
YT_CHANNEL = "https://www.youtube.com/@KSUCCSE"

# ─── Domain Classification Keywords ─────────────────────────
DOMAIN_RULES = [
    ("AI & Machine Learning", [
        "machine learning", "deep learning", "neural network", "artificial intelligence",
        "nlp", "natural language", "computer vision", "classification", "prediction model",
        "tensorflow", "pytorch", "cnn", "rnn", "lstm", "transformer", "gpt",
        "sentiment analysis", "reinforcement learning", "object detection",
        "image recognition", "chatbot", "llm", "generative ai", "diffusion",
        "random forest", "decision tree", "regression model", "clustering algorithm",
    ]),
    ("Cybersecurity", [
        "security", "cyber", "malware", "intrusion detection", "encryption",
        "vulnerability", "attack", "firewall", "penetration test", "phishing",
        "ransomware", "forensic", "ids", "hardening", "authentication",
        "zero trust", "threat", "exploit",
    ]),
    ("Game Development", [
        "game", "unity", "unreal engine", "gameplay", "rpg", "multiplayer",
        "fps", "platformer", "puzzle game", "game design", "godot",
        "game engine", "player experience", "npc",
    ]),
    ("VR & Immersive Tech", [
        "virtual reality", "augmented reality", "mixed reality",
        "hololens", "oculus", "immersive", "vr experience", "ar app", "metaverse",
        "xr", "spatial computing",
    ]),
    ("Web & Mobile Development", [
        "web application", "mobile app", "android app", "ios app",
        "react", "angular", "vue", "website redesign", "rest api",
        "responsive design", "full stack", "flutter", "swift", "kotlin",
        "progressive web", "e-commerce", "cms",
    ]),
    ("Data Science & Analytics", [
        "data analysis", "data visualization", "big data", "analytics",
        "data mining", "hadoop", "spark", "tableau", "power bi",
        "statistical analysis", "exploratory data", "dashboard",
        "etl", "data warehouse", "data pipeline",
    ]),
    ("IoT & Cloud Computing", [
        "iot", "internet of things", "cloud computing", "aws", "azure",
        "raspberry pi", "arduino", "sensor", "embedded system",
        "edge computing", "microcontroller", "docker", "kubernetes",
        "serverless", "mqtt", "smart home",
    ]),
    ("Healthcare & Bioinformatics", [
        "health", "medical", "clinical", "patient", "disease", "diagnosis",
        "bioinformatics", "eeg", "brain", "mri", "cancer", "telemedicine",
        "drug", "genomic", "protein", "biomedical", "wearable health",
    ]),
    ("Robotics & Hardware", [
        "robot", "drone", "autonomous", "navigation", "lidar", "slam",
        "ros", "3d print", "circuit", "fpga", "hardware design",
        "motor control", "servo",
    ]),
    ("Education Technology", [
        "education", "learning platform", "tutoring", "e-learning",
        "lms", "teaching tool", "student engagement", "gamification",
        "educational", "mooc", "adaptive learning",
    ]),
]
DEFAULT_DOMAIN = "General Computing"

# ─── Semester → URL Slug Mapping ─────────────────────────────
def semester_to_dc_slug(semester: str) -> str:
    """Convert 'Fall 2026' → 'Fall_2026'"""
    return semester.replace(" ", "_")

def semester_to_winner_prefix(semester: str) -> str:
    """Convert 'Fall 2026' → 'fa26', 'Spring 2026' → 'sp26'"""
    parts = semester.split()
    season = parts[0].lower()[:2]  # 'fa', 'sp', 'su'
    year = parts[1][2:]  # '26'
    return f"{season}{year}"


# ═══════════════════════════════════════════════════════════════
# STEP 1: Fetch projects from Digital Commons
# ═══════════════════════════════════════════════════════════════
def fetch_dc_project_list(semester: str) -> list[str]:
    """Get all project page URLs from the DC semester index."""
    slug = semester_to_dc_slug(semester)
    categories = [
        "Undergraduate_Capstone", "Graduate_Capstone",
        "Undergraduate_Research", "Graduate_Research",
        "Masters_Research", "PhD_Research",
        "Game_Design", "Internship",
    ]
    
    all_urls = []
    for cat in categories:
        page = 1
        while True:
            url = f"{DC_BASE}/{slug}/{cat}/index.{page}.html" if page > 1 else f"{DC_BASE}/{slug}/{cat}/index.html"
            print(f"  Fetching {cat} page {page}...", end="", flush=True)
            try:
                resp = requests.get(url, timeout=15)
                if resp.status_code != 200:
                    print(f" (not found)")
                    break
                soup = BeautifulSoup(resp.text, "lxml")
                links = soup.select("a[href*='/cday/']")
                project_links = [
                    urljoin(url, a["href"]) for a in links
                    if "/cday/" in a["href"] and a["href"].rstrip("/").split("/")[-1].isdigit()
                ]
                if not project_links:
                    print(f" (no projects)")
                    break
                # Deduplicate
                new = [u for u in project_links if u not in all_urls]
                all_urls.extend(new)
                print(f" {len(new)} projects")
                # Check for next page
                if not soup.select("a.next, a[rel='next']"):
                    break
                page += 1
            except Exception as e:
                print(f" ERROR: {e}")
                break
    
    return list(dict.fromkeys(all_urls))  # preserve order, deduplicate


def fetch_dc_project(url: str) -> dict:
    """Fetch a single project page and extract metadata."""
    resp = requests.get(url, timeout=15)
    soup = BeautifulSoup(resp.text, "lxml")
    
    # Title
    title = ""
    title_el = soup.select_one("meta[name='bepress_citation_title']")
    if title_el:
        title = title_el.get("content", "")
    if not title:
        h1 = soup.select_one("#title h1, h1.title, h1")
        title = h1.get_text(strip=True) if h1 else ""
    
    # Authors
    authors = []
    for meta in soup.select("meta[name='bepress_citation_author']"):
        authors.append(meta.get("content", ""))
    
    # Abstract
    abstract = ""
    abstract_div = soup.select_one("#abstract")
    if abstract_div:
        abstract = abstract_div.get_text(" ", strip=True)
        if abstract.startswith("Description "):
            abstract = abstract[len("Description "):]
    if not abstract:
        desc = soup.select_one("meta[name='description']")
        if desc:
            abstract = desc.get("content", "")
    
    # Department
    dept = ""
    dept_el = soup.select_one("meta[name='bepress_citation_custom_tag_name'][content='department']")
    if dept_el:
        dept_val = dept_el.find_next_sibling("meta")
        if dept_val:
            dept = dept_val.get("content", "")
    # Fallback: look in breadcrumb or discipline
    if not dept:
        for meta in soup.select("meta[name='bepress_citation_online_date']"):
            pass  # just skip
        disc = soup.select_one("meta[name='bepress_citation_discipline']")
        if disc:
            dept = disc.get("content", "").split(";")[0].strip()
    
    # Advisor
    advisor = ""
    advisor_el = soup.select_one("p.advisor, #advisor, .faculty-advisor")
    if advisor_el:
        advisor = advisor_el.get_text(strip=True)
    
    # Poster PDF URL
    poster_url = ""
    pdf_meta = soup.select_one("meta[name='bepress_citation_pdf_url']")
    if pdf_meta:
        poster_url = pdf_meta.get("content", "")
    
    # Project ID (from title prefix like "UC-0224" or page content)
    project_id = ""
    # Try to find ID pattern in title
    id_match = re.match(r"^([A-Z]+-?\d+)\s", title)
    if id_match:
        project_id = id_match.group(1)
        title = title[id_match.end():].strip()
    else:
        # Try in the URL or page
        for text in soup.stripped_strings:
            m = re.match(r"^([A-Z]{1,4}-?\d{1,5})\b", text)
            if m:
                project_id = m.group(1)
                break
    
    # Type (from URL path)
    project_type = "Other"
    url_lower = url.lower()
    if "undergraduate_capstone" in url_lower:
        project_type = "Undergraduate Project"
    elif "graduate_capstone" in url_lower:
        project_type = "Graduate Project"
    elif "undergraduate_research" in url_lower:
        project_type = "Undergraduate Research"
    elif "graduate_research" in url_lower or "masters_research" in url_lower:
        project_type = "Graduate Research"
    elif "phd_research" in url_lower:
        project_type = "PhD Research"
    elif "game_design" in url_lower:
        project_type = "Game Design"
    elif "internship" in url_lower:
        project_type = "Internship"
    
    return {
        "id": project_id,
        "title": title,
        "type": project_type,
        "authors": ", ".join(authors),
        "abstract": abstract,
        "department": dept,
        "supervisor": advisor,
        "topics": "",
        "detail_url": url,
        "poster_url": poster_url,
        "video_url": "",
    }


# ═══════════════════════════════════════════════════════════════
# STEP 2: Classify domains
# ═══════════════════════════════════════════════════════════════
def classify_domain(title: str, abstract: str) -> str:
    """Assign a domain based on title + abstract keywords."""
    text = (title + " " + abstract).lower()
    scores = {}
    for domain, keywords in DOMAIN_RULES:
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[domain] = score
    if not scores:
        return DEFAULT_DOMAIN
    return max(scores, key=scores.get)


# ═══════════════════════════════════════════════════════════════
# STEP 3: Fetch winners
# ═══════════════════════════════════════════════════════════════
def fetch_winners(semester: str) -> dict[str, str]:
    """Try to fetch winner data from the C-Day winner page."""
    prefix = semester_to_winner_prefix(semester)
    url = f"{CDAY_BASE}/{prefix}-cday-winners.php"
    
    print(f"  Checking winners at {url}...", end="", flush=True)
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            print(f" (not found)")
            return {}
        
        soup = BeautifulSoup(resp.text, "lxml")
        text = soup.get_text()
        
        # Parse winner entries — look for patterns like "Project ID - Award"
        winners = {}
        # Look for <li> or <p> elements with project IDs and award text
        for el in soup.select("li, p, tr"):
            el_text = el.get_text(strip=True)
            # Match patterns like "UC-123 Title - 1st Place..."
            m = re.search(r"([A-Z]{1,4}-?\d{1,5})", el_text)
            if m:
                pid = m.group(1)
                # Look for award text
                for award_term in ["1st Place", "2nd Place", "3rd Place", 
                                   "First Place", "Second Place", "Third Place",
                                   "Audience Favorite"]:
                    if award_term.lower() in el_text.lower():
                        # Extract the full award context
                        award = el_text[el_text.lower().index(award_term.lower().split()[0]):]
                        award = award[:60].strip()
                        winners[pid] = award
                        break
        
        print(f" found {len(winners)} winners")
        return winners
    except Exception as e:
        print(f" ERROR: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════
# STEP 4: Match YouTube videos
# ═══════════════════════════════════════════════════════════════
def match_youtube_videos(projects: list[dict], semester: str) -> int:
    """Try to match YouTube videos from KSUCCSE channel.
    
    Note: This is a best-effort match. YouTube API would be more reliable
    but requires an API key. This scrapes the channel page.
    """
    # For now, just mark as TODO — manual step or use yt-dlp
    print(f"  YouTube matching: skipped (add videos manually or run yt-dlp)")
    return 0


# ═══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="C-Day Explorer — Semester Update Pipeline")
    parser.add_argument("--semester", required=True, help="Semester to fetch, e.g., 'Spring 2026'")
    parser.add_argument("--skip-suggestions", action="store_true", help="Skip LLM suggestion generation")
    parser.add_argument("--skip-analytics", action="store_true", help="Skip analytics recomputation")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and classify but don't write files")
    args = parser.parse_args()
    
    semester = args.semester
    print(f"\n{'='*60}")
    print(f"C-Day Explorer — Adding {semester}")
    print(f"{'='*60}")
    
    # ── Load existing projects ───────────────────────────────
    print(f"\n[1/7] Loading existing projects...")
    existing = []
    if PROJECTS_FILE.exists():
        with open(PROJECTS_FILE) as f:
            existing = json.load(f)
    existing_keys = set()
    for p in existing:
        existing_keys.add(p["id"] + "|" + p.get("semester", ""))
    print(f"  Loaded {len(existing)} existing projects ({len(existing_keys)} unique)")
    
    # Check if semester already exists
    existing_semester = [p for p in existing if p.get("semester") == semester]
    if existing_semester:
        print(f"  WARNING: {len(existing_semester)} projects already exist for {semester}")
        resp = input("  Continue and replace? [y/N]: ")
        if resp.lower() != "y":
            print("  Aborted.")
            return
        # Remove existing semester projects
        existing = [p for p in existing if p.get("semester") != semester]
        existing_keys = set(p["id"] + "|" + p.get("semester", "") for p in existing)
    
    # ── Fetch from Digital Commons ───────────────────────────
    print(f"\n[2/7] Fetching projects from Digital Commons...")
    project_urls = fetch_dc_project_list(semester)
    print(f"  Found {len(project_urls)} project pages")
    
    if not project_urls:
        print("  No projects found. Check if the semester exists on Digital Commons.")
        print(f"  Expected URL: {DC_BASE}/{semester_to_dc_slug(semester)}/")
        return
    
    # ── Fetch each project ───────────────────────────────────
    print(f"\n[3/7] Fetching individual project metadata...")
    new_projects = []
    for i, url in enumerate(project_urls):
        print(f"  [{i+1}/{len(project_urls)}] ", end="", flush=True)
        try:
            proj = fetch_dc_project(url)
            proj["semester"] = semester
            print(f"{proj['id'] or '???'}: {proj['title'][:50]}")
            new_projects.append(proj)
            time.sleep(0.3)  # Be respectful
        except Exception as e:
            print(f"ERROR: {e}")
    
    print(f"  Fetched {len(new_projects)} projects")
    
    # ── Classify domains ─────────────────────────────────────
    print(f"\n[4/7] Classifying domains...")
    for p in new_projects:
        p["domain"] = classify_domain(p["title"], p["abstract"])
    
    # Domain distribution
    from collections import Counter
    domain_counts = Counter(p["domain"] for p in new_projects)
    for d, c in domain_counts.most_common():
        print(f"  {d}: {c}")
    
    # ── Fetch winners ────────────────────────────────────────
    print(f"\n[5/7] Checking for winners...")
    winners = fetch_winners(semester)
    if winners:
        matched = 0
        for p in new_projects:
            if p["id"] in winners:
                p["award"] = winners[p["id"]]
                matched += 1
        print(f"  Matched {matched} winners to projects")
    else:
        print(f"  No winners found (may not be posted yet)")
    
    # ── Generate suggestions ─────────────────────────────────
    if not args.skip_suggestions:
        print(f"\n[6/7] Generating AI suggestions...")
        try:
            from generate_suggestions import generate_suggestions_for_projects
            generate_suggestions_for_projects(new_projects)
        except ImportError:
            print("  generate_suggestions.py not found or missing API key")
            print("  Run separately: python scripts/generate_suggestions.py")
        except Exception as e:
            print(f"  Suggestion generation failed: {e}")
            print("  Run separately: python scripts/generate_suggestions.py")
    else:
        print(f"\n[6/7] Skipping suggestion generation (--skip-suggestions)")
    
    # ── Merge and save ───────────────────────────────────────
    print(f"\n[7/7] Merging and saving...")
    all_projects = existing + new_projects
    
    if args.dry_run:
        print(f"  DRY RUN — would write {len(all_projects)} projects ({len(new_projects)} new)")
        # Print a sample
        for p in new_projects[:3]:
            print(f"    {p['id']}: {p['title'][:50]} [{p['domain']}]")
        return
    
    with open(PROJECTS_FILE, "w") as f:
        json.dump(all_projects, f, indent=2)
    print(f"  Saved {len(all_projects)} projects ({len(new_projects)} new)")
    
    # ── Recompute analytics ──────────────────────────────────
    if not args.skip_analytics:
        print(f"\n[BONUS] Recomputing analytics...")
        try:
            from compute_analytics import recompute_all
            recompute_all(all_projects, ANALYTICS_FILE)
        except ImportError:
            print("  compute_analytics.py not found")
            print("  Run separately: python scripts/compute_analytics.py")
    
    print(f"\n{'='*60}")
    print(f"DONE! Added {len(new_projects)} projects for {semester}")
    print(f"Total projects: {len(all_projects)}")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"  1. Review projects.json for accuracy")
    print(f"  2. Run: python scripts/generate_suggestions.py  (if skipped)")
    print(f"  3. Run: python scripts/compute_analytics.py     (if skipped)")
    print(f"  4. Commit and push to deploy")


if __name__ == "__main__":
    main()
