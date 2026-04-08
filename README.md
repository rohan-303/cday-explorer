# C-Day Explorer

**An interactive visualization of a decade of computing innovation at Kennesaw State University.**

Explore 1,286 capstone projects, research papers, and games from 21 semesters of the KSU College of Computing and Software Engineering (CCSE) Computing Showcase (C-Day), spanning Spring 2016 through Fall 2025.

🔗 **[Live Site](https://rohan-303.github.io/cday-explorer/)**

---

## Features

- **Force-Directed Graph** — D3.js visualization with 11 domain clusters and 1,286 project nodes. Click a domain to browse its projects, drag to rearrange, scroll to zoom.
- **Analytics Dashboard** — Toggle to view domain trends over time, award winner distribution, and domain keyword clouds powered by Chart.js.
- **Project Detail Modals** — Full abstract, author/advisor info, links to Digital Commons pages, poster PDFs, and YouTube presentation videos.
- **Take It Further** — AI-generated, project-specific suggestions for other students to extend each project. Four categories: Technical, Research, Use Case, and Opportunity.
- **Related Projects** — NLP-based similarity matching connects projects across semesters using TF-IDF keyword analysis.
- **Mobile Responsive** — Collapsible domain list view on screens below 768px with full-screen modals and touch-friendly targets.
- **About/Methodology** — Transparent documentation of the data pipeline and engineering process.

---

## Data Sources

| Source | Coverage | Projects | Method |
|--------|----------|----------|--------|
| [KSU Digital Commons](https://digitalcommons.kennesaw.edu/ccse_computing_showcase/) | Fall 2019 – Fall 2025 | ~600 | Fetched metadata, abstracts, and poster PDF URLs from individual project pages |
| C-Day Archive PDFs | Spring 2016 – Fall 2020 | ~686 | Parsed program PDFs from [KSU C-Day Events page](https://campus.kennesaw.edu/colleges-departments/ccse/events/computing-showcase/index.php) |
| YouTube [@KSUCCSE](https://www.youtube.com/@KSUCCSE) | 27 playlists | 345 videos | Matched presentation videos to projects by title + semester from channel playlists |
| C-Day Winner Pages | Spring 2017 – Fall 2025 | 223 winners | Extracted from semester-specific winner PHP pages and PDF certificate pages |

### Semester Coverage (21 semesters)

| Period | Semesters | Notes |
|--------|-----------|-------|
| 2016 | Spring 2016, Fall 2016 | Archive PDFs only |
| 2017 | Spring 2017, Fall 2017 | Archive PDFs, winners from PDF |
| 2018 | Spring 2018, Fall 2018 | Archive PDFs + Digital Commons begins |
| 2019 | Spring 2019, Fall 2019 | Mixed sources |
| 2020 | Spring 2020, Summer 2020, Fall 2020 | Includes rare Summer session |
| 2021 | Spring 2021, Fall 2021 | Digital Commons primary |
| 2022 | Spring 2022, Fall 2022 | Digital Commons primary |
| 2023 | Spring 2023, Fall 2023 | Digital Commons + winner pages |
| 2024 | Spring 2024, Fall 2024 | Digital Commons + winner pages |
| 2025 | Spring 2025, Fall 2025 | Digital Commons + winner pages |

### Data Completeness

| Field | Coverage |
|-------|----------|
| Abstracts | 97% (1,250 / 1,286) |
| Take It Further suggestions | 100% |
| Authors | 100% |
| Domain classification | 100% |
| Poster PDF URLs | 49% (631) |
| YouTube video URLs | 26% (345) |
| Digital Commons detail URLs | 46% (600) |
| Award winners | 223 across all semesters |

---

## Domain Taxonomy (11 Domains)

Projects are classified into 11 computing domains based on title, abstract, and topic analysis:

| Domain | Count | Examples |
|--------|-------|----------|
| General Computing | 369 | Software systems, databases, IT infrastructure |
| AI & Machine Learning | 340 | Neural networks, NLP, computer vision, prediction models |
| Cybersecurity | 126 | Network security, malware analysis, penetration testing |
| Game Development | 124 | Unity/Unreal games, VR games, game design |
| Web & Mobile Development | 97 | Web apps, mobile apps, full-stack projects |
| IoT & Cloud Computing | 69 | Raspberry Pi, sensors, AWS/Azure, embedded systems |
| Data Science & Analytics | 64 | Data visualization, statistical analysis, big data |
| Healthcare & Bioinformatics | 35 | Medical imaging, EEG analysis, clinical tools |
| Robotics & Hardware | 35 | Drones, autonomous systems, hardware design |
| Education Technology | 17 | Learning platforms, tutoring systems, EdTech |
| VR & Immersive Tech | 10 | Virtual/augmented reality experiences |

---

## Take It Further Engine

Every project has 4 AI-generated suggestions designed for **other students** to pick up the work and extend it. The engine works as follows:

### Generation Pipeline

1. **Input**: Each project's title, abstract (up to 800 chars), domain, and topics are sent to an LLM via batch API calls.
2. **Prompt**: The system prompt instructs the model to generate suggestions that are:
   - Specific to the project's actual technologies, methods, and domain
   - Actionable with concrete tools, APIs, datasets, and techniques
   - Varied across four angles: Technical improvement, Research extension, New use case, and Commercial/career opportunity
   - Ambitious but achievable for a motivated CS student in one semester
3. **Output**: 4 suggestions per project, each with a category label, specific title, and 2-3 sentence description.
4. **Processing**: 1,286 projects processed in batches of 10, with 291 re-generated after abstract improvements.

### Category Labels

| Label | Meaning |
|-------|---------|
| TECHNICAL | Engineering improvements — better algorithms, architectures, or tooling |
| RESEARCH | Academic extensions — new hypotheses, datasets, or methodologies |
| USE CASE | New applications — applying the same approach to a different domain |
| OPPORTUNITY | Commercial/career potential — products, services, or industry applications |

### Quality Controls

- No generic suggestions (e.g., "Submit to a competition", "Learn from this project")
- Every suggestion title is unique to its project
- Suggestions reference concrete technologies from the project's abstract
- Projects with improved abstracts (289 fetched from Digital Commons) had suggestions regenerated

---

## Related Projects (NLP Similarity)

Projects are connected to up to 3 related projects from other semesters using keyword-based similarity:

1. **Tokenization**: Title + abstract text tokenized with stop word removal (including KSU-specific terms like "campus", "capstone", "advisor")
2. **TF-IDF Keywords**: Top 6 keywords per project computed using term frequency-inverse document frequency
3. **Similarity Score**: Jaccard similarity on keyword sets, with bonuses for same domain (+0.05) and different semester (+0.02, for cross-temporal discovery)
4. **Threshold**: Minimum 2 shared keywords and 0.15 similarity score required
5. **Result**: 968 projects have 1-3 related project connections (2,144 total connections)

---

## Tech Stack

- **D3.js v7** — Force-directed graph visualization with custom clustering forces
- **Chart.js** — Analytics dashboard charts (domain trends, winner distribution)
- **Vanilla JavaScript** — No frameworks, ~1,200 lines
- **Python** — Data pipeline (PDF parsing, web fetching, NLP analysis, LLM API calls)
- **LLM API** — AI-powered suggestion generation

---

## Project Structure

```
cday-showcase/
├── index.html          # Main page
├── style.css           # All styles (KSU brand: Montserrat, Gold #FFC629, Black)
├── app.js              # D3 graph, modals, search, filter, mobile view
├── analytics.js        # Analytics dashboard (Chart.js charts, word clouds)
├── projects.json       # 1,286 projects with all metadata (~3.3MB)
├── analytics.json      # Pre-computed domain trends and keyword data
└── README.md
```

---

## Brand

Styled with [Kennesaw State University's official brand identity](https://campus.kennesaw.edu/offices-services/stratcomm/branding/index.php):
- **Colors**: KSU Gold (#FFC629) accent on warm black (#121212) backgrounds
- **Typography**: Montserrat (primary) + Source Serif 4 (abstract text)
- **Domain palette**: Derived from KSU secondary colors (Blue #66ABFF, Orange #F5873D, Purple #A682EB, Green #5CB88A)

---

## Author

**Rohan Jonnalagadda**  
MS Computer Science — Kennesaw State University  
College of Computing and Software Engineering
