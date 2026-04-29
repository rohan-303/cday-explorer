import json
from pathlib import Path
import sys

# Add parent directory to sys.path to import update_semester
sys.path.append(str(Path(__file__).resolve().parent))

try:
    from update_semester import classify_domain, PROJECTS_FILE, ANALYTICS_FILE
    from compute_analytics import recompute_all
except ImportError as e:
    print(f"Error importing scripts: {e}")
    sys.exit(1)

def main():
    if not PROJECTS_FILE.exists():
        print(f"Error: {PROJECTS_FILE} not found.")
        return

    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    changes = 0
    for p in projects:
        old_domain = p.get("domain")
        new_domain = classify_domain(p.get("title", ""), p.get("abstract", ""))
        
        if old_domain != new_domain:
            p["domain"] = new_domain
            changes += 1
            # print(f"[{p.get('id')}] {old_domain} -> {new_domain}")

    print(f"Total projects: {len(projects)}")
    print(f"Re-classified {changes} projects.")

    if changes > 0:
        with open(PROJECTS_FILE, "w") as f:
            json.dump(projects, f, indent=2)
        print("Updated projects.json")
        
        print("Recomputing analytics...")
        recompute_all(projects, ANALYTICS_FILE)
        print("Updated analytics.json")
    else:
        print("No changes needed.")

if __name__ == "__main__":
    main()
