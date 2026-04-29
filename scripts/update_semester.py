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
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ─── Paths ───────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.json"
ANALYTICS_FILE = ROOT / "analytics.json"

# ─── Digital Commons Base ────────────────────────────────────
DC_BASE = "https://digitalcommons.kennesaw.edu"

# ─── KSU C-Day Events Base ───────────────────────────────────
CDAY_BASE = "https://campus.kennesaw.edu/colleges-departments/ccse/events/computing-showcase"

# ─── Domain Classification Keywords ─────────────────────────
import re

DOMAIN_RULES = [
    ("VR & Immersive Tech", [
        "virtual reality", "augmented reality", "mixed reality",
        "hololens", "oculus", "immersive", "vr experience", "ar app", "metaverse",
        "quest 2", "quest 3", "htc vive", "extended reality", "xr", "haptic",
        "stereoscopic", "3d environment", "unity vr", "headset", "ar experience",
        "360-degree", "spatial computing", "virtual environment", "simulated reality",
    ]),
    ("Game Development", [
        "video game", "game", "gaming", "unity", "unreal engine", "gameplay", "rpg", "multiplayer",
        "fps", "platformer", "puzzle game", "game design", "godot",
        "game engine", "game development", "game jam", "npc", "game mechanic",
        "board game", "card game", "indie game", "game world", "combat",
        "playthrough", "enemies", "character", "controller", "interactive entertainment",
        "puzzle", "entity", "simulator", "racing game", "story-driven", "plugin",
        "mod", "minecraft", "speedrun", "esports", "esport",
        "sci-fi themed", "action-adventure", "thief", "raid", "first-person", "shooter",
        "third-person", "stealth", "quest", "level design", "texture", "sprite",
        "game assets", "roguelike", "tower defense", "sandbox", "open world", "visual novel",
        "indie", "unreal", "gamified", "metroidvania", "dungeon", "boss fight",
        "game project", "player experience", "level editor", "game logic",
    ]),
    ("Cybersecurity", [
        "security", "cyber", "malware", "intrusion detection", "encryption",
        "vulnerability", "attack", "firewall", "penetration test", "phishing",
        "ransomware", "forensic", "ids", "hardening", "authentication",
        "zero trust", "threat", "exploit", "cryptography", "blockchain",
        "network security", "privacy", "packet", "botnet", "incident response",
        "adversarial", "threat defense", "network protection", "privacy-preserving",
        "zero-knowledge", "steganography", "spoofing", "overflow", "sql injection",
        "cyber-attack", "denial of service", "ddos", "security audit", "breach",
    ]),
    ("Healthcare & Bioinformatics", [
        "healthcare", "health care", "medical", "clinical", "patient", "disease",
        "diagnosis", "bioinformatics", "eeg", "brain", "mri", "cancer detection",
        "telemedicine", "drug", "genomic", "protein", "biomedical",
        "health monitoring", "medical imaging", "radiology", "pathology",
        "hipaa", "clinic", "hospital", "doctor", "health", "caregiver",
        "alzheimer", "dementia", "coronary", "artery", "cardiac", "patient care",
        "burnout", "mental health", "therapy", "rehabilitation", "stroke", "diabetic",
        "diabetes", "blood flow", "imaging", "x-ray", "ct scan", "ultrasound",
        "bio", "plant disease", "rice plant", "agriculture", "crop", "farming",
        "biological", "pharmacology", "genetics", "medical record", "health record",
    ]),
    ("Robotics & Hardware", [
        "robot", "drone", "autonomous", "navigation", "lidar", "slam",
        "ros", "3d print", "circuit", "fpga", "hardware design",
        "microprocessor", "pcb", "mechatronics", "hardware",
        "micromouse", "computer design", "digital logic", "8-bit", "multisim",
        "circuitry", "assembly language", "vhdl", "verilog", "architecture",
        "instruction set", "cpu design", "hardware implementation", "fpga design",
    ]),
    ("IoT & Cloud Computing", [
        "iot", "internet of things", "cloud computing", "aws", "azure",
        "raspberry pi", "arduino", "sensor", "embedded system",
        "edge computing", "microcontroller", "docker", "kubernetes",
        "serverless", "distributed system", "mqtt", "node-red", "cloud",
        "telemetry", "smart home", "connected device", "network protocol",
    ]),
    ("Education Technology", [
        "education", "learning platform", "tutoring", "e-learning",
        "lms", "teaching tool", "student engagement", "gamification",
        "classroom", "academic", "student success", "pedagogy", "educational",
        "learning management", "canvas api", "grading", "teacher", "syllabus",
    ]),
    ("Web & Mobile Development", [
        "web application", "mobile app", "android app", "ios app",
        "react", "angular", "vue", "website redesign", "rest api",
        "responsive design", "full stack", "flutter", "swift",
        "website", "web app", "web development", "front end", "backend",
        "web portal", "web platform", "web site", "web service", "ui/ux",
        "user interface", "user experience", "progressive web app", "pwa",
        "bot", "discord", "marketplace", "ecommerce", "e-commerce", "application",
        "crm", "customer relationship", "cms", "content management",
    ]),
    ("Data Science & Analytics", [
        "data analysis", "data visualization", "big data", "analytics",
        "data mining", "hadoop", "spark", "tableau", "power bi",
        "statistical analysis", "dashboard", "etl", "data warehouse",
        "data science", "data set", "regression", "correlation", "pandas",
        "numpy", "matplotlib", "seaborn", "business intelligence",
        "predictive model", "forecasting", "trend analysis", "data processing",
    ]),
    ("AI & Machine Learning", [
        "machine learning", "artificial intelligence", "deep learning",
        "neural network", "cnn", "rnn", "lstm", "nlp", "computer vision",
        "image classification", "object detection", "natural language",
        "generative ai", "llm", "gpt", "transformer", "reinforcement learning",
        "ai model", "tensor flow", "pytorch", "keras", "predictive", "ai",
        "large language model", "diffusion model", "openai", "stable diffusion",
    ]),
]
DEFAULT_DOMAIN = "General Computing"


def classify_domain(title: str, abstract: str) -> str:
    text = (title + " " + abstract).lower()
    # Priority-based matching with word boundaries
    for domain, keywords in DOMAIN_RULES:
        for kw in keywords:
            # Use regex to find whole words only
            # Escape kw to handle special chars, and use \b for boundaries
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text):
                return domain
    return DEFAULT_DOMAIN


def semester_to_winner_prefix(semester: str) -> str:
    """Convert 'Fall 2026' → 'fa26', 'Spring 2026' → 'sp26'"""
    parts = semester.split()
    season = parts[0].lower()[:2]
    year = parts[1][2:]
    return f"{season}{year}"


# ═══════════════════════════════════════════════════════════════
# STEP 1: Discover project URLs from Digital Commons
# ═══════════════════════════════════════════════════════════════
def discover_project_urls(semester: str) -> list[str]:
    """
    Digital Commons URL patterns have changed over the years.
    Try multiple known patterns to find the right one.
    """
    parts = semester.split()
    season = parts[0]   # "Fall" or "Spring" or "Summer"
    year = parts[1]     # "2026"
    
    # Known URL slug patterns (newest first — most likely for future semesters)
    slug_patterns = [
        f"{season}_{year}",          # Fall_2025, Spring_2025, Spring_2024, Fall_2024
        f"{year}{season.lower()}",   # 2023fall
        f"{season}{year}",           # Fall2021
        f"{season.lower()}",         # fall, spring (very old)
    ]
    
    # Known category patterns (newest first)
    category_sets = [
        # Pattern used since Fall 2024
        ["Undergraduate_Project", "Graduate_Project", "Undergraduate_Research",
         "Masters_Research", "PhD_Research", "Exploratory_Projects"],
        # Pattern used Spring 2022 - Spring 2024
        ["Undergraduate_Capstone", "Graduate_Capstone", "Undergraduate_Research",
         "Graduate_Research", "Masters_Research", "PhD_Research"],
        # Hyphenated variant (Spring 2022)
        ["Undergraduate_Capstone", "Graduate-Capstone", "Undergraduate_Research",
         "Graduate-Research"],
        # Old lowercase variant
        ["undergraduatecapstone", "graduatecapstone", "undergraduateresearch",
         "graduateresearch"],
        # Game/Internship (Summer 2020)
        ["internship", "machine_learning"],
        # Extras that appear in some semesters
        ["Game_Design", "Exploratory_Projects", "Exploratory_Project", "exploratory_projects"],
    ]
    
    all_urls = []
    found_slug = None
    
    for slug in slug_patterns:
        if found_slug:
            break
        for cat_set in category_sets:
            for cat in cat_set:
                url = f"{DC_BASE}/cday/{slug}/{cat}/index.html"
                try:
                    resp = requests.get(url, timeout=10, allow_redirects=True)
                    if resp.status_code != 200:
                        continue
                    
                    soup = BeautifulSoup(resp.text, "lxml")
                    # Look for project links — they end with a number
                    links = soup.select("a[href*='/cday/']")
                    project_links = []
                    for a in links:
                        href = a.get("href", "")
                        full = urljoin(url, href)
                        # Project pages end with /NUMBER/ or /NUMBER
                        if re.search(r"/\d+/?$", full.rstrip("/")):
                            project_links.append(full.rstrip("/") + "/")
                    
                    if project_links:
                        found_slug = slug
                        new = [u for u in project_links if u not in all_urls]
                        all_urls.extend(new)
                        print(f"  Found {len(new)} projects at cday/{slug}/{cat}/")
                except Exception:
                    continue
    
    # Deduplicate preserving order
    seen = set()
    unique = []
    for u in all_urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    
    if not unique:
        print(f"  WARNING: No projects found. Tried slugs: {slug_patterns}")
        print(f"  Check: {DC_BASE}/cday/ for the correct semester path")
    
    return unique


# ═══════════════════════════════════════════════════════════════
# STEP 2: Fetch individual project metadata
# ═══════════════════════════════════════════════════════════════
def fetch_project(url: str) -> dict:
    """Fetch a single project page and extract all metadata."""
    resp = requests.get(url, timeout=15)
    soup = BeautifulSoup(resp.text, "lxml")
    
    # Title — try bepress meta first, then H1
    title = ""
    meta_title = soup.select_one("meta[name='bepress_citation_title']")
    if meta_title:
        title = meta_title.get("content", "").strip()
    if not title:
        h1 = soup.select_one("h1")
        title = h1.get_text(strip=True) if h1 else ""
    
    # Extract project ID from title (e.g., "UC-0224 Loving Arms...")
    project_id = ""
    id_match = re.match(r"^([A-Z]{1,5}-?\d{1,6})\s+", title)
    if id_match:
        project_id = id_match.group(1)
        title = title[id_match.end():].strip()
    
    # Authors
    authors = []
    for meta in soup.select("meta[name='bepress_citation_author']"):
        authors.append(meta.get("content", "").strip())
    
    # Abstract
    abstract = ""
    abstract_div = soup.select_one("#abstract")
    if abstract_div:
        abstract = abstract_div.get_text(" ", strip=True)
        if abstract.startswith("Description "):
            abstract = abstract[len("Description "):]
    if not abstract:
        desc_meta = soup.select_one("meta[name='description']")
        if desc_meta:
            abstract = desc_meta.get("content", "").strip()
    
    # Department / Discipline
    dept = ""
    disc_meta = soup.select_one("meta[name='bepress_citation_discipline']")
    if disc_meta:
        dept = disc_meta.get("content", "").split(";")[0].strip()
    
    # Advisor — look for "Advisor:" or "Faculty Advisor" text
    advisor = ""
    for p_tag in soup.select("p"):
        text = p_tag.get_text(strip=True)
        if "advisor" in text.lower() and len(text) < 200:
            advisor = text
            break
    
    # Poster PDF URL
    poster_url = ""
    pdf_meta = soup.select_one("meta[name='bepress_citation_pdf_url']")
    if pdf_meta:
        poster_url = pdf_meta.get("content", "").strip()
    
    # Project type from URL path
    project_type = "Other"
    url_lower = url.lower()
    type_map = {
        "undergraduate_project": "Undergraduate Project",
        "undergraduate_capstone": "Undergraduate Project",
        "undergraduatecapstone": "Undergraduate Project",
        "graduate_project": "Graduate Project",
        "graduate_capstone": "Graduate Project",
        "graduate-capstone": "Graduate Project",
        "graduatecapstone": "Graduate Project",
        "undergraduate_research": "Undergraduate Research",
        "undergraduateresearch": "Undergraduate Research",
        "graduate_research": "Graduate Research",
        "graduate-research": "Graduate Research",
        "graduateresearch": "Graduate Research",
        "masters_research": "Graduate Research",
        "phd_research": "PhD Research",
        "exploratory_projects": "Exploratory Project",
        "exploratory_project": "Exploratory Project",
        "game_design": "Game Design",
        "internship": "Internship",
    }
    for pattern, ptype in type_map.items():
        if pattern in url_lower:
            project_type = ptype
            break
    
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
# STEP 3: Fetch winners
# ═══════════════════════════════════════════════════════════════
def fetch_winners(semester: str) -> dict[str, str]:
    prefix = semester_to_winner_prefix(semester)
    url = f"{CDAY_BASE}/{prefix}-cday-winners.php"
    
    print(f"  Checking {url}...", end="", flush=True)
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            print(" (not posted yet)")
            return {}
        
        soup = BeautifulSoup(resp.text, "lxml")
        winners = {}
        
        for el in soup.select("li, p, td, tr, div"):
            text = el.get_text(strip=True)
            m = re.search(r"([A-Z]{1,5}-?\d{1,6})", text)
            if not m:
                continue
            pid = m.group(1)
            for term in ["1st Place", "2nd Place", "3rd Place",
                         "First Place", "Second Place", "Third Place",
                         "Audience Favorite"]:
                if term.lower() in text.lower():
                    idx = text.lower().index(term.lower().split()[0])
                    award = text[idx:idx+60].strip()
                    winners[pid] = award
                    break
        
        print(f" {len(winners)} winners")
        return winners
    except Exception as e:
        print(f" error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="C-Day Explorer — Semester Update")
    parser.add_argument("--semester", required=True, help="e.g., 'Spring 2026'")
    parser.add_argument("--skip-suggestions", action="store_true")
    parser.add_argument("--skip-analytics", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    
    semester = args.semester
    print(f"\n{'='*60}")
    print(f"C-Day Explorer — Adding {semester}")
    print(f"{'='*60}")
    
    # Load existing
    print(f"\n[1/6] Loading existing projects...")
    existing = []
    if PROJECTS_FILE.exists():
        with open(PROJECTS_FILE) as f:
            existing = json.load(f)
    print(f"  {len(existing)} existing projects")
    
    # Check for duplicates
    existing_semester = [p for p in existing if p.get("semester") == semester]
    if existing_semester:
        print(f"  WARNING: {len(existing_semester)} projects already exist for {semester}")
        if not args.dry_run:
            existing = [p for p in existing if p.get("semester") != semester]
            print(f"  Removed old {semester} data — will replace with fresh fetch")
    
    # Discover URLs
    print(f"\n[2/6] Discovering project URLs on Digital Commons...")
    urls = discover_project_urls(semester)
    print(f"  Total: {len(urls)} project pages found")
    
    if not urls:
        print("\n  No projects found. The semester may not be on Digital Commons yet.")
        return
    
    # Fetch each
    print(f"\n[3/6] Fetching project metadata...")
    new_projects = []
    for i, url in enumerate(urls):
        print(f"  [{i+1}/{len(urls)}] ", end="", flush=True)
        try:
            proj = fetch_project(url)
            proj["semester"] = semester
            proj["domain"] = classify_domain(proj["title"], proj["abstract"])
            print(f"{proj['id'] or '???'}: {proj['title'][:45]} [{proj['domain'][:15]}]")
            new_projects.append(proj)
            time.sleep(0.2)
        except Exception as e:
            print(f"ERROR: {e}")
    print(f"  Fetched {len(new_projects)} projects")
    
    # Domain stats
    from collections import Counter
    print(f"\n[4/6] Domain distribution:")
    for d, c in Counter(p["domain"] for p in new_projects).most_common():
        print(f"  {d}: {c}")
    
    # Winners
    print(f"\n[5/6] Checking winners...")
    winners = fetch_winners(semester)
    if winners:
        matched = 0
        for p in new_projects:
            if p["id"] in winners:
                p["award"] = winners[p["id"]]
                matched += 1
        print(f"  Matched {matched} winners")
    
    # Suggestions
    if not args.skip_suggestions:
        print(f"\n[6/6] Generating suggestions...")
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if api_key:
            sys.path.insert(0, str(Path(__file__).parent))
            try:
                from generate_suggestions import generate_suggestions_for_projects
                generate_suggestions_for_projects(new_projects)
            except Exception as e:
                print(f"  Failed: {e}")
        else:
            print("  Skipped (no OPENAI_API_KEY)")
    else:
        print(f"\n[6/6] Skipping suggestions")
    
    # Merge and save
    if args.dry_run:
        print(f"\n--- DRY RUN ---")
        print(f"Would add {len(new_projects)} projects for {semester}")
        for p in new_projects[:5]:
            print(f"  {p['id']}: {p['title'][:50]} [{p['domain']}]")
        if len(new_projects) > 5:
            print(f"  ... and {len(new_projects)-5} more")
        return
    
    all_projects = existing + new_projects
    with open(PROJECTS_FILE, "w") as f:
        json.dump(all_projects, f, indent=2)
    
    # Recompute analytics
    if not args.skip_analytics:
        sys.path.insert(0, str(Path(__file__).parent))
        try:
            from compute_analytics import recompute_all
            recompute_all(all_projects, ANALYTICS_FILE)
        except Exception as e:
            print(f"  Analytics failed: {e}")
    
    print(f"\n{'='*60}")
    print(f"DONE! Added {len(new_projects)} projects for {semester}")
    print(f"Total: {len(all_projects)} projects")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
