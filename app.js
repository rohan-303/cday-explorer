/* ============================================================
   KSU C-Day Showcase Explorer  v5
   1,286 projects · 11 domains · 21 semesters · 2016–2025
   "Take It Further" powered by LLM-generated suggestions
   ============================================================ */

const DOMAIN_COLORS = {
  'AI & Machine Learning':      '#66ABFF',  // KSU Blue
  'General Computing':           '#8A919A',  // Warm gray
  'Cybersecurity':               '#E05252',  // Muted red
  'Game Development':            '#F5873D',  // KSU Orange
  'Web & Mobile Development':    '#5CB88A',  // Soft green
  'IoT & Cloud Computing':       '#4ECDC4',  // Teal
  'Data Science & Analytics':    '#A682EB',  // KSU Purple
  'Healthcare & Bioinformatics': '#5ABEAA',  // Seafoam
  'Robotics & Hardware':         '#D4915E',  // Copper
  'Education Technology':        '#8B9DC3',  // Periwinkle
  'VR & Immersive Tech':         '#69B7CE',  // Sky blue
};

// ────────────────────────────────────────────────
// "Take It Further" Engine v3
// For OTHER STUDENTS: use cases, opportunities, guides, extensions
// Each suggestion answers: "How could a new student pick this up?"
// ────────────────────────────────────────────────

// "Take It Further" suggestions are pre-computed per project (stored in projects.json).
// Generated using LLM analysis of each project's abstract, domain, and topics.

// Semester sort order
const SEMESTER_ORDER = [
  'Spring 2016','Fall 2016','Spring 2017','Fall 2017',
  'Spring 2018','Fall 2018','Spring 2019','Fall 2019',
  'Spring 2020','Summer 2020','Fall 2020','Spring 2021',
  'Fall 2021','Spring 2022','Fall 2022','Spring 2023',
  'Fall 2023','Spring 2024','Fall 2024','Spring 2025','Fall 2025',
];

function semesterIndex(sem) {
  const idx = SEMESTER_ORDER.indexOf(sem);
  return idx >= 0 ? idx : 999;
}

let allProjects = [];
let activeFilter = 'all';
let searchQuery = '';
let activeDomain = null;
let currentSort = 'newest';
let currentView = 'graph'; // 'graph' or 'analytics'
let projectMap = {}; // id|semester -> project for quick lookups
let entryAnimationDone = false;

// ────────────────────────────────────────────────
// Data Loading
// ────────────────────────────────────────────────
async function loadData() {
  const res = await fetch('./projects.json');
  allProjects = await res.json();

  // Build lookup map for related projects
  allProjects.forEach(p => {
    projectMap[`${p.id}|${p.semester}`] = p;
  });

  populateSemesterDropdown();

  // Hide loading screen
  const loadingScreen = document.getElementById('loadingScreen');
  loadingScreen.classList.add('hidden');

  // Small delay to let loading screen fade
  setTimeout(() => {
    init();
    initParticleCanvas();
    buildMobileListView();
    initMobileUI();
    // Start stat bar slide-up after graph settles
    setTimeout(() => {
      document.getElementById('statBar').classList.add('visible');
    }, 1800);
  }, 400);
}

function populateSemesterDropdown() {
  const select = document.getElementById('semesterSelect');
  const sems = [...new Set(allProjects.map(p => p.semester))]
    .sort((a, b) => semesterIndex(b) - semesterIndex(a)); // newest first

  sems.forEach(sem => {
    const count = allProjects.filter(p => p.semester === sem).length;
    const opt = document.createElement('option');
    opt.value = sem;
    opt.textContent = `${sem} (${count})`;
    select.appendChild(opt);
  });
}

// ────────────────────────────────────────────────
// Filtered data helpers
// ────────────────────────────────────────────────
function getFiltered() {
  return allProjects.filter(p => {
    const matchSem = activeFilter === 'all' || p.semester === activeFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.abstract && p.abstract.toLowerCase().includes(q)) ||
      (p.authors && p.authors.toLowerCase().includes(q)) ||
      (p.domain && p.domain.toLowerCase().includes(q)) ||
      (p.department && p.department.toLowerCase().includes(q)) ||
      (p.topics && p.topics.toLowerCase().includes(q));
    return matchSem && matchSearch;
  });
}

function getDomainCounts(projects) {
  const counts = {};
  for (const p of projects) {
    counts[p.domain] = (counts[p.domain] || 0) + 1;
  }
  return counts;
}

// ────────────────────────────────────────────────
// Particle Canvas (constellation bg)
// ────────────────────────────────────────────────
let particleCtx, particleW, particleH, particles = [];
let particleAnimId;

function initParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  particleCtx = canvas.getContext('2d');
  resizeParticleCanvas();
  createParticles();
  canvas.classList.add('visible');
  animateParticles();
}

function resizeParticleCanvas() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  particleW = window.innerWidth;
  particleH = window.innerHeight - 64;
  canvas.width = particleW;
  canvas.height = particleH;
}

function createParticles() {
  particles = [];
  const count = Math.min(60, Math.floor((particleW * particleH) / 20000));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * particleW,
      y: Math.random() * particleH,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    });
  }
}

function animateParticles() {
  if (!particleCtx) return;
  particleCtx.clearRect(0, 0, particleW, particleH);

  // Move particles
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = particleW;
    if (p.x > particleW) p.x = 0;
    if (p.y < 0) p.y = particleH;
    if (p.y > particleH) p.y = 0;
  }

  // Draw connections
  const maxDist = 120;
  particleCtx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const opacity = (1 - dist / maxDist) * 0.05;
        particleCtx.strokeStyle = `rgba(255,198,41,${opacity})`;
        particleCtx.beginPath();
        particleCtx.moveTo(particles[i].x, particles[i].y);
        particleCtx.lineTo(particles[j].x, particles[j].y);
        particleCtx.stroke();
      }
    }
  }

  // Draw particles
  for (const p of particles) {
    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    particleCtx.fillStyle = 'rgba(255,198,41,0.15)';
    particleCtx.fill();
  }

  particleAnimId = requestAnimationFrame(animateParticles);
}

// ────────────────────────────────────────────────
// D3 Graph
// ────────────────────────────────────────────────
let simulation, svg, g, zoomBehavior;

function init() {
  const svgEl = document.getElementById('graph');
  const W = svgEl.clientWidth || window.innerWidth;
  const H = svgEl.clientHeight || (window.innerHeight - 64);

  svg = d3.select('#graph');
  svg.selectAll('*').remove();

  // Subtle radial gradient background
  const defs = svg.append('defs');
  const grad = defs.append('radialGradient')
    .attr('id', 'bg-grad')
    .attr('cx', '50%').attr('cy', '50%')
    .attr('r', '60%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,198,41,0.03)');
  grad.append('stop').attr('offset', '100%').attr('stop-color', 'transparent');

  svg.append('rect')
    .attr('width', '100%').attr('height', '100%')
    .attr('fill', 'url(#bg-grad)');

  g = svg.append('g');

  zoomBehavior = d3.zoom()
    .scaleExtent([0.2, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoomBehavior);

  buildGraph(W, H);

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePanel(); closeModal(); closeAbout(); }
  });

  // Hide hint after 6s
  setTimeout(() => {
    const hint = document.getElementById('graphHint');
    if (hint) hint.classList.add('hidden');
  }, 6000);
}

function buildGraph(W, H) {
  const filtered = getFiltered();
  const domainCounts = getDomainCounts(filtered);
  const domains = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a]);

  // Stats
  const winners = filtered.filter(p => p.award).length;
  const statParts = [`${filtered.length} projects`, `${domains.length} domains`];
  if (winners > 0) statParts.push(`${winners} award winners`);
  document.getElementById('statText').textContent = statParts.join(' · ');

  if (filtered.length === 0) {
    g.append('text')
      .attr('x', W/2).attr('y', H/2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b')
      .attr('font-size', '14px')
      .attr('font-family', 'Montserrat, sans-serif')
      .text('No projects match your search.');
    return;
  }

  // For large datasets, limit visible project nodes for performance
  const MAX_VISIBLE_NODES = 300;
  const ratio = Math.min(1, MAX_VISIBLE_NODES / filtered.length);

  // Build nodes
  const nodes = [];
  const links = [];

  // Center hub
  nodes.push({ id: '__hub__', type: 'hub', x: W/2, y: H/2, fx: W/2, fy: H/2 });

  // Domain nodes in a circle
  const R_domain = Math.min(W, H) * 0.28;
  domains.forEach((domain, i) => {
    const angle = (i / domains.length) * 2 * Math.PI - Math.PI / 2;
    const x = W/2 + R_domain * Math.cos(angle);
    const y = H/2 + R_domain * Math.sin(angle);
    nodes.push({
      id: `domain:${domain}`,
      type: 'domain',
      domain,
      count: domainCounts[domain],
      color: DOMAIN_COLORS[domain] || '#FFC629',
      x, y,
    });
    links.push({ source: '__hub__', target: `domain:${domain}`, type: 'hub-domain' });
  });

  // Project nodes — sample if too many
  const visibleProjects = [];
  if (ratio < 1) {
    domains.forEach(domain => {
      const domainProjects = filtered.filter(p => p.domain === domain);
      const quota = Math.max(3, Math.round(domainProjects.length * ratio));
      const winners = domainProjects.filter(p => p.award);
      const nonWinners = domainProjects.filter(p => !p.award);
      for (let i = nonWinners.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nonWinners[i], nonWinners[j]] = [nonWinners[j], nonWinners[i]];
      }
      const sample = [...winners, ...nonWinners].slice(0, quota);
      visibleProjects.push(...sample);
    });
  } else {
    visibleProjects.push(...filtered);
  }

  // Build a map of domain node positions for clustering force
  const domainPositions = {};
  nodes.filter(n => n.type === 'domain').forEach(n => {
    domainPositions[n.domain] = { x: n.x, y: n.y };
  });

  visibleProjects.forEach(p => {
    const domainNode = nodes.find(n => n.id === `domain:${p.domain}`);
    nodes.push({
      id: `proj:${p.id}:${p.semester}`,
      type: 'project',
      project: p,
      domain: p.domain,
      color: DOMAIN_COLORS[p.domain] || '#FFC629',
      isWinner: !!p.award,
      x: domainNode ? domainNode.x + (Math.random() - 0.5) * 60 : W/2,
      y: domainNode ? domainNode.y + (Math.random() - 0.5) * 60 : H/2,
    });
    links.push({ source: `domain:${p.domain}`, target: `proj:${p.id}:${p.semester}`, type: 'domain-proj' });
  });

  // Custom clustering force — pulls project nodes toward their domain center
  function clusterForce(alpha) {
    for (const node of nodes) {
      if (node.type !== 'project') continue;
      const domainNode = nodes.find(n => n.id === `domain:${node.domain}`);
      if (!domainNode) continue;
      // Pull toward domain node with strength proportional to distance
      const dx = domainNode.x - node.x;
      const dy = domainNode.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 120; // max allowed distance from domain center
      if (dist > maxDist) {
        // Strong pull back when too far
        const strength = 0.3 * alpha;
        node.vx += dx * strength;
        node.vy += dy * strength;
      } else {
        // Gentle pull always
        const strength = 0.05 * alpha;
        node.vx += dx * strength;
        node.vy += dy * strength;
      }
    }
  }

  // Simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => {
        if (d.type === 'hub-domain') return R_domain * 0.9;
        return 40;
      })
      .strength(d => d.type === 'hub-domain' ? 1 : 0.6)
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        if (d.type === 'hub') return -300;
        if (d.type === 'domain') return -500;
        return -30;
      })
    )
    .force('collide', d3.forceCollide()
      .radius(d => {
        if (d.type === 'hub') return 20;
        if (d.type === 'domain') return 55;
        return 8;
      })
      .strength(0.6)
    )
    .force('center', d3.forceCenter(W/2, H/2).strength(0.05))
    .force('cluster', clusterForce)
    .alphaDecay(0.025);

  // Draw links
  const linkSel = g.selectAll('.link-line')
    .data(links)
    .join('line')
    .attr('class', 'link-line')
    .attr('stroke-width', d => d.type === 'hub-domain' ? 1.5 : 0.5)
    .attr('stroke', d => d.type === 'hub-domain' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');

  // Draw hub
  const hubNode = nodes.find(n => n.id === '__hub__');
  const hub = g.append('g').attr('class', 'hub-node');
  hub.append('circle')
    .attr('r', 16)
    .attr('fill', 'rgba(255,255,255,0.05)')
    .attr('stroke', 'rgba(255,255,255,0.15)')
    .attr('stroke-width', 1.5);
  hub.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '9px')
    .attr('fill', 'rgba(255,255,255,0.5)')
    .attr('font-family', 'Montserrat, sans-serif')
    .attr('font-weight', '700')
    .text('C•DAY');

  // Draw domain nodes
  const domainSel = g.selectAll('.domain-node')
    .data(nodes.filter(n => n.type === 'domain'))
    .join('g')
    .attr('class', 'domain-node')
    .style('--node-color', d => d.color)
    .on('click', (event, d) => {
      event.stopPropagation();
      openPanel(d.domain);
    });

  // Outer ring — subtle, thin
  domainSel.append('circle')
    .attr('class', 'outer')
    .attr('r', d => 30 + Math.sqrt(d.count) * 3)
    .attr('fill', 'none')
    .attr('stroke', d => d.color)
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.3);

  // Inner filled circle
  domainSel.append('circle')
    .attr('r', d => 20 + Math.sqrt(d.count) * 2)
    .attr('fill', d => d.color)
    .attr('fill-opacity', 0.12)
    .attr('stroke', d => d.color)
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.5);

  // Domain label — split long names
  domainSel.each(function(d) {
    const el = d3.select(this);
    const name = abbrevDomain(d.domain);
    const parts = name.split(' & ');
    if (parts.length === 2 && name.length > 14) {
      el.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.6em')
        .text(parts[0] + ' &');
      el.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.6em')
        .text(parts[1]);
    } else {
      el.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.3em')
        .text(name);
    }
  });

  // Count badge
  domainSel.append('text')
    .attr('class', 'count-badge')
    .attr('text-anchor', 'middle')
    .attr('dy', d => {
      const name = abbrevDomain(d.domain);
      return (name.split(' & ').length === 2 && name.length > 14) ? '1.7em' : '1.1em';
    })
    .text(d => `${d.count} projects`);

  // Domain hover
  domainSel
    .on('mouseenter', function() {
      d3.select(this).select('circle:nth-child(2)')
        .transition().duration(200).attr('fill-opacity', 0.22);
    })
    .on('mouseleave', function() {
      d3.select(this).select('circle:nth-child(2)')
        .transition().duration(200).attr('fill-opacity', 0.12);
    });

  // Draw project nodes
  const projSel = g.selectAll('.project-node')
    .data(nodes.filter(n => n.type === 'project'))
    .join('g')
    .attr('class', 'project-node')
    .on('click', (event, d) => {
      event.stopPropagation();
      openModal(d.project);
    })
    .on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(150).attr('r', 8).attr('fill-opacity', 1).attr('fill', '#FFC629');
      showTooltip(event, d.project.title);
    })
    .on('mouseleave', function() {
      const nd = d3.select(this).datum();
      d3.select(this).select('circle')
        .transition().duration(150)
        .attr('r', nd.isWinner ? 6 : 4)
        .attr('fill', '#FFC629')
        .attr('fill-opacity', nd.isWinner ? 1.0 : 0.75);
      hideTooltip();
    });

  projSel.append('circle')
    .attr('r', d => d.isWinner ? 6 : 4)
    .attr('fill', '#FFC629')
    .attr('fill-opacity', d => d.isWinner ? 1.0 : 0.75)
    .attr('stroke', '#FFC629')
    .attr('stroke-width', d => d.isWinner ? 2 : 0.8)
    .attr('stroke-opacity', d => d.isWinner ? 0.9 : 0.2);

  // Entry animation — stagger domain and project nodes fading in
  if (!entryAnimationDone) {
    domainSel.each(function(d, i) {
      setTimeout(() => {
        d3.select(this).classed('animate-in', true);
      }, 200 + i * 100);
    });
    projSel.each(function(d, i) {
      const domainIdx = domains.indexOf(d.domain);
      setTimeout(() => {
        d3.select(this).classed('animate-in', true);
      }, 500 + domainIdx * 100 + Math.random() * 200);
    });
    entryAnimationDone = true;
  } else {
    // Skip animation on subsequent builds
    domainSel.classed('animate-in', true);
    projSel.classed('animate-in', true);
  }

  // Click empty area to close panel
  svg.on('click', () => { closePanel(); });

  // Tooltip
  const tooltip = d3.select('body').selectAll('.d3-tooltip')
    .data([1]).join('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'fixed')
    .style('pointer-events', 'none')
    .style('background', 'rgba(28,28,28,0.95)')
    .style('border', '1px solid rgba(255,198,41,0.12)')
    .style('border-radius', '8px')
    .style('padding', '7px 12px')
    .style('font-size', '12px')
    .style('color', '#e0e0e0')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.5)')
    .style('font-family', 'Montserrat, sans-serif')
    .style('max-width', '240px')
    .style('line-height', '1.4')
    .style('opacity', 0)
    .style('z-index', 999)
    .style('transition', 'opacity 0.15s');

  function showTooltip(event, text) {
    tooltip.style('opacity', 1).text(text)
      .style('left', (event.clientX + 12) + 'px')
      .style('top', (event.clientY - 30) + 'px');
  }
  function hideTooltip() {
    tooltip.style('opacity', 0);
  }

  // Auto-fit after settle
  simulation.on('end', () => {
    const bounds = g.node().getBBox();
    const padding = 60;
    const dx = bounds.width + padding * 2;
    const dy = bounds.height + padding * 2;
    const scale = Math.min(0.95, Math.min(W / dx, H / dy));
    const tx = (W - scale * (bounds.x * 2 + bounds.width)) / 2;
    const ty = (H - scale * (bounds.y * 2 + bounds.height)) / 2;
    svg.transition().duration(600).ease(d3.easeCubicOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  });

  // Tick
  simulation.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    hub.attr('transform', `translate(${hubNode.x},${hubNode.y})`);
    domainSel.attr('transform', d => `translate(${d.x},${d.y})`);
    projSel.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // Drag
  function dragBehavior() {
    return d3.drag()
      .on('start', (event, d) => {
        // C-DAY hub is permanently fixed — never drag it
        if (d.id === '__hub__') return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        if (d.id === '__hub__') return;
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (d.id === '__hub__') return;
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }
  domainSel.call(dragBehavior());
  projSel.call(dragBehavior());

  if (activeDomain) highlightDomain(activeDomain);
}

function abbrevDomain(d) {
  const abbrevs = {
    'Healthcare & Bioinformatics': 'Health & Bio',
    'Web & Mobile Development': 'Web & Mobile',
    'IoT & Cloud Computing': 'IoT & Cloud',
    'Data Science & Analytics': 'Data Science',
    'Education Technology': 'EdTech',
    'VR & Immersive Tech': 'VR & Immersive',
    'AI & Machine Learning': 'AI & ML',
    'Robotics & Hardware': 'Robotics',
  };
  return abbrevs[d] || d;
}

// ────────────────────────────────────────────────
// Domain highlight
// ────────────────────────────────────────────────
function highlightDomain(domain) {
  g.selectAll('.project-node circle')
    .attr('fill-opacity', d => d.domain === domain ? 1 : 0.12)
    .attr('stroke-opacity', d => d.domain === domain ? 0.8 : 0.05);
  g.selectAll('.link-line')
    .attr('stroke-opacity', d => {
      const src = d.source, tgt = d.target;
      return (src.domain === domain || tgt.domain === domain ||
              src.id === `domain:${domain}` || tgt.id === `domain:${domain}`)
        ? 0.35 : 0.02;
    });
  g.selectAll('.domain-node')
    .style('opacity', d => d.domain === domain ? 1 : 0.3);
}

function clearHighlight() {
  g.selectAll('.project-node circle')
    .attr('fill-opacity', d => d.isWinner ? 1.0 : 0.75)
    .attr('stroke-opacity', d => d.isWinner ? 0.9 : 0.2);
  g.selectAll('.link-line')
    .attr('stroke-opacity', d => d.type === 'hub-domain' ? 0.15 : 0.04);
  g.selectAll('.domain-node')
    .style('opacity', 1);
}

// ────────────────────────────────────────────────
// Side Panel
// ────────────────────────────────────────────────
function openPanel(domain) {
  activeDomain = domain;
  highlightDomain(domain);

  const panel = document.getElementById('sidePanel');
  const badge = document.getElementById('panelDomainBadge');
  const meta = document.getElementById('panelMeta');

  const color = DOMAIN_COLORS[domain] || '#FFC629';
  panel.style.setProperty('--domain-color', color);
  badge.textContent = domain;

  currentSort = 'newest';
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === 'newest');
  });

  renderProjectList(domain);
  panel.classList.add('open');
}

function renderProjectList(domain) {
  const meta = document.getElementById('panelMeta');
  const list = document.getElementById('projectList');

  let projects = getFiltered().filter(p => p.domain === domain);

  // Show/hide "Oldest" button based on whether we're viewing all semesters
  const oldestBtn = document.querySelector('.sort-btn[data-sort="oldest"]');
  if (oldestBtn) {
    oldestBtn.style.display = activeFilter === 'all' ? '' : 'none';
    // If currently sorted by oldest but a specific semester is selected, switch to newest
    if (activeFilter !== 'all' && currentSort === 'oldest') {
      currentSort = 'newest';
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'newest'));
    }
  }

  // Sort
  if (currentSort === 'newest') {
    projects.sort((a, b) => semesterIndex(b.semester) - semesterIndex(a.semester));
  } else if (currentSort === 'oldest') {
    projects.sort((a, b) => semesterIndex(a.semester) - semesterIndex(b.semester));
  } else if (currentSort === 'winners') {
    projects.sort((a, b) => {
      if (a.award && !b.award) return -1;
      if (!a.award && b.award) return 1;
      return semesterIndex(b.semester) - semesterIndex(a.semester);
    });
  }

  const winnerCount = projects.filter(p => p.award).length;
  let metaText = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;
  if (winnerCount > 0) metaText += ` · ${winnerCount} winners`;
  metaText += ' · Click any card for details';
  meta.textContent = metaText;

  list.innerHTML = '';

  const fragment = document.createDocumentFragment();
  projects.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.animationDelay = `${Math.min(i * 20, 300)}ms`;

    let topRow = `<span class="project-card-id">${escHtml(p.id)}</span>`;
    if (p.award) {
      topRow += `<span class="project-card-award">🏆 ${escHtml(shortAward(p.award))}</span>`;
    }

    card.innerHTML = `
      <div class="project-card-top">${topRow}</div>
      <div class="project-card-title">${escHtml(p.title)}</div>
      <div class="project-card-meta">
        <span class="project-card-type">${escHtml(p.type || '')}</span>
        <span class="project-card-sem">${escHtml(p.semester)}</span>
      </div>
      ${p.abstract ? `<div class="project-card-abstract">${escHtml(p.abstract)}</div>` : ''}
    `;
    card.addEventListener('click', () => openModal(p));
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
}

function shortAward(award) {
  if (!award) return '';
  return award
    .replace('Undergraduate ', 'UG ')
    .replace('Graduate ', 'Grad ')
    .replace('Capstone', 'Cap.')
    .replace('Research', 'Res.')
    .replace('Internship', 'Intern.')
    .replace('The Best ', 'Best ')
    .replace(/\(\$\d+.*/g, '')
    .trim();
}

function closePanel() {
  activeDomain = null;
  clearHighlight();
  document.getElementById('sidePanel').classList.remove('open');
}

// ────────────────────────────────────────────────
// Modal
// ────────────────────────────────────────────────
function openModal(project, skipHistory) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modal');
  const color = DOMAIN_COLORS[project.domain] || '#FFC629';

  // Scroll modal to top when opening a new project
  if (modal) modal.scrollTop = 0;

  // Clear history when opening from outside related projects
  if (!skipHistory && modalHistory.length > 0) modalHistory.length = 0;

  // Category badge — muted, text-based
  const catBadge = document.getElementById('modalCategory');
  catBadge.textContent = project.domain;
  catBadge.style.background = 'rgba(255,198,41,0.08)';
  catBadge.style.borderColor = 'rgba(255,198,41,0.15)';
  catBadge.style.color = '#FFC629';

  // Winner badge
  const winnerBadge = document.getElementById('modalWinner');
  if (project.award) {
    winnerBadge.style.display = 'inline-flex';
    winnerBadge.textContent = `🏆 ${project.award}`;
  } else {
    winnerBadge.style.display = 'none';
  }

  document.getElementById('modalTitle').textContent = project.title;
  document.getElementById('modalAuthors').textContent = `By ${project.authors}`;
  document.getElementById('modalDept').style.setProperty('--domain-color', color);
  const deptText = [project.type, project.department].filter(Boolean).join(' · ') || project.domain;
  document.getElementById('modalDept').textContent = deptText;
  document.getElementById('modalSem').textContent = project.semester;
  document.getElementById('modalAbstract').textContent = project.abstract || 'No abstract available.';

  // Supervisor
  let supervisorEl = document.querySelector('.modal-supervisor');
  if (!supervisorEl) {
    supervisorEl = document.createElement('div');
    supervisorEl.className = 'modal-supervisor';
    document.getElementById('modalAuthors').after(supervisorEl);
  }
  if (project.supervisor) {
    supervisorEl.textContent = `Advisor: ${project.supervisor}`;
    supervisorEl.style.display = 'block';
  } else {
    supervisorEl.style.display = 'none';
  }

  // Links section — View on Digital Commons + Download Poster (direct PDF)
  const linksEl = document.getElementById('modalLinks');
  linksEl.innerHTML = '';

  if (project.detail_url) {
    linksEl.innerHTML += `<a href="${escAttr(project.detail_url)}" target="_blank" rel="noopener" class="modal-link-btn primary">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9"/><path d="M9 11l8-8M12 3h5v5"/></svg>
      View on Digital Commons
    </a>`;
  }

  if (project.poster_url) {
    linksEl.innerHTML += `<a href="${escAttr(project.poster_url)}" target="_blank" rel="noopener" class="modal-link-btn secondary">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3v10M6 9l4 4 4-4"/><path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2"/></svg>
      Download Poster
    </a>`;
  }

  if (project.video_url) {
    linksEl.innerHTML += `<a href="${escAttr(project.video_url)}" target="_blank" rel="noopener" class="modal-link-btn secondary">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="7,4 17,10 7,16" fill="currentColor" stroke="none"/></svg>
      Presentation Video
    </a>`;
  }

  // Topics tags
  let topicsContainer = document.querySelector('.modal-topics');
  if (!topicsContainer) {
    topicsContainer = document.createElement('div');
    topicsContainer.className = 'modal-topics';
    const divider = document.querySelector('#modal .modal-divider');
    divider.parentNode.insertBefore(topicsContainer, divider);
  }
  topicsContainer.innerHTML = '';
  if (project.topics && project.topics.trim()) {
    const tags = project.topics.split(',').map(t => t.trim()).filter(Boolean);
    tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'modal-topic-tag';
      span.textContent = tag;
      topicsContainer.appendChild(span);
    });
    topicsContainer.style.display = 'flex';
  } else {
    topicsContainer.style.display = 'none';
  }

  // Next steps — pre-computed project-specific suggestions for OTHER STUDENTS
  const steps = project.suggestions || [];
  const grid = document.getElementById('nextStepsGrid');
  if (steps.length > 0) {
    grid.innerHTML = steps.map(s => `
      <div class="next-step-card">
        <div class="next-step-icon">${s.icon}</div>
        <div class="next-step-title">${escHtml(s.title)}</div>
        <div class="next-step-desc">${escHtml(s.desc)}</div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = '<p style="color:var(--text-secondary);font-style:italic;">No suggestions available for this project.</p>';
  }

  // Related Projects
  renderRelatedProjects(project);

  overlay.classList.add('open');
}

// Navigation history for related project browsing
const modalHistory = [];

function renderRelatedProjects(project) {
  const container = document.getElementById('modalRelated');
  const grid = document.getElementById('relatedGrid');

  if (!project.similar || project.similar.length === 0) {
    container.style.display = 'none';
    return;
  }

  grid.innerHTML = '';

  // Back button if there's history
  if (modalHistory.length > 0) {
    const backBtn = document.createElement('button');
    backBtn.className = 'related-back-btn';
    backBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 4l-4 4 4 4"/></svg> Back to previous project`;
    backBtn.addEventListener('click', () => {
      const prev = modalHistory.pop();
      if (prev) openModal(prev, /* skipHistory */ true);
    });
    grid.appendChild(backBtn);
  }

  let count = 0;
  for (const ref of project.similar) {
    if (count >= 3) break;
    const related = projectMap[ref];
    if (!related) continue;

    const color = DOMAIN_COLORS[related.domain] || '#FFC629';
    // Show full abstract in tooltip (CSS handles overflow with max-height + scroll)
    const abstractPreview = (related.abstract || '').trim();
    const card = document.createElement('div');
    card.className = 'related-card';
    card.innerHTML = `
      <div class="related-card-dot" style="background:${color}"></div>
      <div class="related-card-info">
        <div class="related-card-title">${escHtml(related.title)}</div>
        <div class="related-card-meta">${escHtml(related.semester)} · ${escHtml(abbrevDomain(related.domain))}</div>
      </div>
      <svg class="related-card-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4l4 4-4 4"/></svg>
      ${abstractPreview ? `<div class="related-card-tooltip">${escHtml(abstractPreview)}</div>` : ''}
    `;
    card.addEventListener('click', () => {
      modalHistory.push(project);
      openModal(related, true);
    });
    grid.appendChild(card);
    count++;
  }

  container.style.display = count > 0 ? 'block' : 'none';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ────────────────────────────────────────────────
// About Modal
// ────────────────────────────────────────────────
function openAbout() {
  document.getElementById('aboutOverlay').classList.add('open');
}
function closeAbout() {
  document.getElementById('aboutOverlay').classList.remove('open');
}

// ────────────────────────────────────────────────
// View Toggle (Graph vs Analytics)
// ────────────────────────────────────────────────
function switchView(view) {
  currentView = view;
  const graphView = document.getElementById('graphView');
  const analyticsView = document.getElementById('analyticsView');
  const mobileList = document.getElementById('mobileListView');
  const isMobile = window.innerWidth <= 768;

  // Update toggle buttons
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'graph') {
    graphView.classList.remove('hidden');
    analyticsView.classList.remove('active');
    if (isMobile) {
      mobileList.classList.remove('hidden-mobile');
    }
  } else {
    graphView.classList.add('hidden');
    analyticsView.classList.add('active');
    if (isMobile) {
      mobileList.classList.add('hidden-mobile');
    }
    // Initialize analytics on first view
    if (typeof initAnalytics === 'function') {
      initAnalytics();
    }
  }
}

// ────────────────────────────────────────────────
// Mobile List View — Premium Redesign
// ────────────────────────────────────────────────
let mobileActiveDomain = null; // null = 'All'
let mobileSortMode = 'newest'; // 'newest' or 'winners'

function buildMobileListView() {
  const container = document.getElementById('mobileListScroll');
  if (!container) return;

  const filtered = getFiltered();
  const domainCounts = getDomainCounts(filtered);
  const domains = Object.keys(domainCounts).sort((a, b) => domainCounts[b] - domainCounts[a]);
  const totalProjects = filtered.length;
  const totalWinners = filtered.filter(p => p.award).length;
  const totalSemesters = new Set(filtered.map(p => p.semester)).size;

  container.innerHTML = '';

  // 1. Domain bubble scroll row
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'm-domain-scroll-wrap';
  const scrollRow = document.createElement('div');
  scrollRow.className = 'm-domain-scroll';
  scrollRow.id = 'mDomainScrollRow';

  function selectDomain(domain, cardEl) {
    mobileActiveDomain = domain;
    // Update active states without full rebuild
    scrollRow.querySelectorAll('.m-domain-card').forEach(c => c.classList.remove('active'));
    cardEl.classList.add('active');
    // Gentle scroll — just center the card
    cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    // Only rebuild the project list + stats, not domain cards
    updateMobileProjectList(container, filtered, domainCounts, domains);
  }

  // "All" card
  const allCard = document.createElement('div');
  allCard.className = 'm-domain-card' + (mobileActiveDomain === null ? ' active' : '');
  allCard.style.setProperty('--dc-color', '#FFC629');
  allCard.innerHTML = `
    <div class="m-domain-card-count">${totalProjects}</div>
    <div class="m-domain-card-name">All Projects</div>
    <div class="m-domain-card-dot" style="background:#FFC629"></div>
  `;
  allCard.addEventListener('click', () => selectDomain(null, allCard));
  scrollRow.appendChild(allCard);

  // Domain cards
  domains.forEach(domain => {
    const color = DOMAIN_COLORS[domain] || '#FFC629';
    const count = domainCounts[domain];
    const card = document.createElement('div');
    card.className = 'm-domain-card' + (mobileActiveDomain === domain ? ' active' : '');
    card.style.setProperty('--dc-color', color);
    card.innerHTML = `
      <div class="m-domain-card-count">${count}</div>
      <div class="m-domain-card-name">${escHtml(abbrevDomain(domain))}</div>
      <div class="m-domain-card-dot" style="background:${color}"></div>
    `;
    card.addEventListener('click', () => selectDomain(domain, card));
    scrollRow.appendChild(card);
  });

  scrollWrap.appendChild(scrollRow);
  container.appendChild(scrollWrap);

  // Build the rest (stats + sort + project list)
  updateMobileProjectList(container, filtered, domainCounts, domains);
}

function updateMobileProjectList(container, filtered, domainCounts, domains) {
  // Remove old stats, sort bar, and project list (keep domain scroll)
  const oldStats = container.querySelector('.m-stats-bar');
  const oldSort = container.querySelector('.m-sort-bar');
  const oldList = container.querySelector('.m-project-list');
  if (oldStats) oldStats.remove();
  if (oldSort) oldSort.remove();
  if (oldList) oldList.remove();

  const totalProjects = filtered.length;
  const totalWinners = filtered.filter(p => p.award).length;
  const totalSemesters = new Set(filtered.map(p => p.semester)).size;

  // 2. Stats bar
  const statsBar = document.createElement('div');
  statsBar.className = 'm-stats-bar';
  if (mobileActiveDomain) {
    const domProjects = filtered.filter(p => p.domain === mobileActiveDomain);
    const domWinners = domProjects.filter(p => p.award).length;
    const domSems = new Set(domProjects.map(p => p.semester)).size;
    const sp = [`${domProjects.length} project${domProjects.length !== 1 ? 's' : ''}`];
    if (domWinners > 0) sp.push(`${domWinners} winner${domWinners !== 1 ? 's' : ''}`);
    sp.push(`${domSems} semester${domSems !== 1 ? 's' : ''}`);
    statsBar.textContent = sp.join(' · ');
  } else {
    const parts = [`${totalProjects.toLocaleString()} project${totalProjects !== 1 ? 's' : ''}`];
    if (totalWinners > 0) parts.push(`${totalWinners} winner${totalWinners !== 1 ? 's' : ''}`);
    parts.push(`${totalSemesters} semester${totalSemesters !== 1 ? 's' : ''}`);
    statsBar.textContent = parts.join(' · ');
  }
  container.appendChild(statsBar);

  // 2b. Sort bar
  const sortBar = document.createElement('div');
  sortBar.className = 'm-sort-bar';
  const sortModes = activeFilter === 'all' ? ['newest', 'oldest', 'winners'] : ['newest', 'winners'];
  // If currently on oldest but a semester filter is active, reset
  if (activeFilter !== 'all' && mobileSortMode === 'oldest') mobileSortMode = 'newest';
  sortModes.forEach(mode => {
    const btn = document.createElement('button');
    btn.className = 'm-sort-btn' + (mobileSortMode === mode ? ' active' : '');
    btn.textContent = mode === 'newest' ? 'Newest' : mode === 'oldest' ? 'Oldest' : 'Winners';
    btn.addEventListener('click', () => {
      mobileSortMode = mode;
      updateMobileProjectList(container, filtered, domainCounts, domains);
    });
    sortBar.appendChild(btn);
  });
  container.appendChild(sortBar);

  // 3. Project list
  const listDiv = document.createElement('div');
  listDiv.className = 'm-project-list';

  if (totalProjects === 0) {
    listDiv.innerHTML = `
      <div class="m-empty-state">
        <div class="m-empty-state-text">No projects match your search</div>
        <div class="m-empty-state-sub">Try a different keyword or clear filters</div>
      </div>`;
    container.appendChild(listDiv);
    return;
  }

  // Determine which domains to show
  const showDomains = mobileActiveDomain ? [mobileActiveDomain] : domains;

  showDomains.forEach(domain => {
    let projects = filtered.filter(p => p.domain === domain);
    // Apply sort
    if (mobileSortMode === 'winners') {
      projects.sort((a, b) => {
        if (a.award && !b.award) return -1;
        if (!a.award && b.award) return 1;
        return semesterIndex(b.semester) - semesterIndex(a.semester);
      });
    } else if (mobileSortMode === 'oldest') {
      projects.sort((a, b) => semesterIndex(a.semester) - semesterIndex(b.semester));
    } else {
      projects.sort((a, b) => semesterIndex(b.semester) - semesterIndex(a.semester));
    }
    if (projects.length === 0) return;
    const color = DOMAIN_COLORS[domain] || '#FFC629';

    // Domain group header (show when viewing "All")
    if (mobileActiveDomain === null) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'm-domain-group-header';
      groupHeader.innerHTML = `
        <div class="m-domain-group-header-dot" style="background:${color}"></div>
        <span>${escHtml(abbrevDomain(domain))}</span>
        <span class="m-domain-group-header-count">${projects.length}</span>
      `;
      listDiv.appendChild(groupHeader);
    }

    // Project cards
    const fragment = document.createDocumentFragment();
    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'm-project-card';

      // Icons for poster / video
      let icons = '';
      if (p.poster_url) icons += '<span title="Poster">📄</span>';
      if (p.video_url) icons += '<span title="Video">🎥</span>';

      const categoryLabel = p.type || p.department || '';
      card.innerHTML = `
        <div class="m-project-card-accent" style="background:${color}"></div>
        <div class="m-project-card-body">
          <div class="m-project-card-title">${escHtml(p.title)}</div>
          <div class="m-project-card-row">
            <span>${escHtml(p.semester)}</span>
            ${categoryLabel ? `<span class="m-project-card-type">· ${escHtml(categoryLabel)}</span>` : ''}
            ${icons ? `<span class="m-project-card-icons">${icons}</span>` : ''}
          </div>
          ${p.award ? `<div class="m-project-card-award-row"><span class="m-project-card-winner">★ ${escHtml(shortAward(p.award))}</span></div>` : ''}
        </div>
      `;
      card.addEventListener('click', () => openModal(p));
      fragment.appendChild(card);
    });
    listDiv.appendChild(fragment);
  });

  container.appendChild(listDiv);

  // Scroll the active domain card into view if returning to the view
  if (mobileActiveDomain !== null) {
    setTimeout(() => {
      const activeCard = scrollRow.querySelector('.m-domain-card.active');
      if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
  }
}

// ────────────────────────────────────────────────
// Mobile Search, Filter & Interaction
// ────────────────────────────────────────────────
function initMobileUI() {
  // Search toggle
  const searchToggle = document.getElementById('mSearchToggle');
  const searchExpanded = document.getElementById('mSearchExpanded');
  const searchInput = document.getElementById('mSearchInput');
  const searchCancel = document.getElementById('mSearchCancel');

  if (searchToggle) {
    searchToggle.addEventListener('click', () => {
      searchExpanded.classList.add('open');
      searchInput.value = searchQuery;
      setTimeout(() => searchInput.focus(), 100);
    });
  }
  if (searchCancel) {
    searchCancel.addEventListener('click', () => {
      searchExpanded.classList.remove('open');
      searchInput.blur();
    });
  }
  if (searchInput) {
    let mSearchTimer;
    searchInput.addEventListener('input', e => {
      clearTimeout(mSearchTimer);
      mSearchTimer = setTimeout(() => {
        searchQuery = e.target.value;
        // Sync desktop search too
        document.getElementById('searchInput').value = searchQuery;
        mobileActiveDomain = null;
        buildMobileListView();
        rebuildGraph();
      }, 250);
    });
    // Close on Enter
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        searchExpanded.classList.remove('open');
        searchInput.blur();
      }
    });
  }

  // Filter toggle & bottom sheet
  const filterToggle = document.getElementById('mFilterToggle');
  const filterOverlay = document.getElementById('mFilterOverlay');
  const filterPills = document.getElementById('mFilterPills');

  if (filterToggle && filterOverlay) {
    filterToggle.addEventListener('click', () => {
      populateMobileFilterPills();
      filterOverlay.classList.add('open');
    });
    filterOverlay.addEventListener('click', e => {
      if (e.target === filterOverlay) {
        filterOverlay.classList.remove('open');
      }
    });
  }
}

function populateMobileFilterPills() {
  const container = document.getElementById('mFilterPills');
  if (!container) return;
  container.innerHTML = '';

  const sems = [...new Set(allProjects.map(p => p.semester))]
    .sort((a, b) => semesterIndex(b) - semesterIndex(a));

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'm-filter-pill' + (activeFilter === 'all' ? ' active' : '');
  allPill.textContent = 'All Semesters';
  allPill.addEventListener('click', () => {
    activeFilter = 'all';
    document.getElementById('semesterSelect').value = 'all';
    document.getElementById('mFilterToggle').classList.remove('has-filter');
    document.getElementById('mFilterOverlay').classList.remove('open');
    mobileActiveDomain = null;
    buildMobileListView();
    rebuildGraph();
  });
  container.appendChild(allPill);

  sems.forEach(sem => {
    const count = allProjects.filter(p => p.semester === sem).length;
    const pill = document.createElement('button');
    pill.className = 'm-filter-pill' + (activeFilter === sem ? ' active' : '');
    pill.textContent = `${sem} (${count})`;
    pill.addEventListener('click', () => {
      activeFilter = sem;
      document.getElementById('semesterSelect').value = sem;
      document.getElementById('mFilterToggle').classList.add('has-filter');
      document.getElementById('mFilterOverlay').classList.remove('open');
      mobileActiveDomain = null;
      buildMobileListView();
      rebuildGraph();
    });
    container.appendChild(pill);
  });
}

// ────────────────────────────────────────────────
// Event Listeners
// ────────────────────────────────────────────────
document.getElementById('closePanel').addEventListener('click', () => closePanel());
document.getElementById('modalClose').addEventListener('click', () => closeModal());
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

// About button
document.getElementById('aboutBtn').addEventListener('click', () => openAbout());
document.getElementById('aboutClose').addEventListener('click', () => closeAbout());
document.getElementById('aboutOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('aboutOverlay')) closeAbout();
});

// View toggle
document.querySelectorAll('.view-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Semester dropdown
document.getElementById('semesterSelect').addEventListener('change', (e) => {
  activeFilter = e.target.value;
  closePanel();
  rebuildGraph();
  buildMobileListView();
});

// Sort buttons
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    if (activeDomain) renderProjectList(activeDomain);
  });
});

// Search
let searchTimer;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value;
    closePanel();
    rebuildGraph();
    buildMobileListView();

    // Auto-open if single domain result
    const filtered = getFiltered();
    const domains = [...new Set(filtered.map(p => p.domain))];
    if (domains.length === 1 && filtered.length > 0) {
      setTimeout(() => openPanel(domains[0]), 400);
    }
  }, 250);
});

function rebuildGraph() {
  const svgEl = document.getElementById('graph');
  const W = svgEl.clientWidth || window.innerWidth;
  const H = svgEl.clientHeight || (window.innerHeight - 64);
  if (simulation) simulation.stop();
  g.selectAll('*').remove();
  buildGraph(W, H);
}

// Resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    closePanel();
    resizeParticleCanvas();
    createParticles();
    if (window.innerWidth > 768) {
      init();
    }
    buildMobileListView();
  }, 250);
});

// ────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────
loadData();
