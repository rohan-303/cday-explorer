#!/usr/bin/env python3
"""
Generate AI-powered "Take It Further" suggestions for projects.
Uses OpenAI-compatible API (works with OpenAI, Groq, Together, etc.)

Usage:
  python scripts/generate_suggestions.py                    # Generate for projects missing suggestions
  python scripts/generate_suggestions.py --semester "Fall 2026"  # Only for a specific semester
  python scripts/generate_suggestions.py --regenerate       # Regenerate ALL suggestions

Environment:
  OPENAI_API_KEY    — Your API key
  OPENAI_BASE_URL   — API base URL (default: https://api.openai.com/v1)
  OPENAI_MODEL      — Model name (default: gpt-4o-mini)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = ROOT / "projects.json"

# ─── Configuration ───────────────────────────────────────────
API_KEY = os.environ.get("OPENAI_API_KEY", "    ")
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE = 5  # projects per API call

SYSTEM_PROMPT = """You generate "Take It Further" suggestions for university CS projects. These are aimed at OTHER students who want to pick up someone else's C-Day project and extend it into something new.

Rules:
1. Every suggestion must be SPECIFIC to the project's actual content — reference concrete technologies, methods, datasets, or domains from the abstract
2. Give actionable guidance — what to build, what tools/APIs/datasets to use, what the end result looks like
3. Cover varied angles across the 4 suggestions
4. Be ambitious but achievable for a motivated CS student in one semester
5. NEVER use generic titles like "Turn This into a Startup", "Learn from This Project", "Submit to Competition"
6. Each title should be unique and specific to THIS project

Return JSON only. No markdown fences."""


def call_llm(projects: list[dict]) -> dict:
    """Call the LLM API with a batch of projects."""
    import requests
    
    # Build prompt
    sections = []
    key_map = {}
    for i, p in enumerate(projects):
        key = f"P{i+1:03d}"
        key_map[key] = p
        sections.append(f"""### PROJECT {key}
ID: {p.get('id', '')}
Title: {p['title']}
Domain: {p.get('domain', 'N/A')}
Abstract: {p.get('abstract', 'No abstract')[:600]}""")
    
    prompt = f"""Generate 4 "Take It Further" suggestions for EACH of the following {len(projects)} projects.

{chr(10).join(sections)}

Return a JSON object where keys are the PROJECT keys above (e.g., P001, P002) and values are arrays of 4 suggestions.
Each suggestion: {{"icon": "CATEGORY", "title": "specific title", "desc": "2-3 sentences"}}
icon must be one of: TECHNICAL, RESEARCH, USE CASE, OPPORTUNITY
"""
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 4096,
        "temperature": 0.7,
    }
    
    resp = requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=body, timeout=120)
    resp.raise_for_status()
    
    text = resp.json()["choices"][0]["message"]["content"].strip()
    
    # Strip markdown fences if present
    import re
    text = re.sub(r'^```(?:json)?\s*\n?', '', text)
    text = re.sub(r'\n?\s*```\s*$', '', text)
    
    return json.loads(text), key_map


def generate_suggestions_for_projects(projects: list[dict]):
    """Generate suggestions for a list of projects (called from update_semester.py)."""
    if not API_KEY:
        print("  ERROR: OPENAI_API_KEY not set")
        return
    
    total = len(projects)
    generated = 0
    
    for i in range(0, total, BATCH_SIZE):
        batch = projects[i:i + BATCH_SIZE]
        print(f"  [{i+1}-{min(i+BATCH_SIZE, total)}/{total}] Generating...", end="", flush=True)
        
        try:
            result, key_map = call_llm(batch)
            for key, p in key_map.items():
                suggestions = result.get(key, [])
                if suggestions:
                    p["suggestions"] = suggestions[:4]
                    generated += 1
            print(f" {len([p for p in batch if p.get('suggestions')])} ok")
        except Exception as e:
            print(f" ERROR: {e}")
        
        time.sleep(0.5)
    
    print(f"  Generated suggestions for {generated}/{total} projects")


def main():
    parser = argparse.ArgumentParser(description="Generate AI suggestions for C-Day projects")
    parser.add_argument("--semester", help="Only generate for this semester")
    parser.add_argument("--regenerate", action="store_true", help="Regenerate ALL suggestions")
    args = parser.parse_args()
    
    if not API_KEY:
        print("ERROR: Set OPENAI_API_KEY environment variable")
        print("  export OPENAI_API_KEY='sk-...'")
        print("  Optionally set OPENAI_BASE_URL and OPENAI_MODEL")
        sys.exit(1)
    
    print(f"Model: {MODEL} | Base URL: {BASE_URL}")
    
    with open(PROJECTS_FILE) as f:
        projects = json.load(f)
    
    # Filter
    if args.semester:
        targets = [p for p in projects if p.get("semester") == args.semester]
    elif args.regenerate:
        targets = projects
    else:
        targets = [p for p in projects if not p.get("suggestions")]
    
    if not targets:
        print("No projects need suggestions. Use --regenerate to force.")
        return
    
    print(f"Generating suggestions for {len(targets)} projects...")
    generate_suggestions_for_projects(targets)
    
    # Save
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=2)
    
    generated = sum(1 for p in targets if p.get("suggestions"))
    print(f"\nDone! {generated}/{len(targets)} projects updated.")


if __name__ == "__main__":
    main()
