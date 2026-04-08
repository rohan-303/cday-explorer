/* ============================================================
   Analytics Dashboard for C-Day Explorer
   Trend charts, word clouds, winner distribution
   ============================================================ */

let analyticsData = null;
let analyticsInitialized = false;
let trendChartInstance = null;
let winnerChartInstance = null;
let countUpDone = false;

async function loadAnalyticsData() {
  if (analyticsData) return analyticsData;
  const res = await fetch('./analytics.json');
  analyticsData = await res.json();
  return analyticsData;
}

async function initAnalytics() {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  const data = await loadAnalyticsData();

  // Count-up animation
  animateCountUp();

  // Build trend chart
  buildTrendChart(data);

  // Build winner chart
  buildWinnerChart(data);

  // Build domain chips
  buildDomainChips(data);
}

// ────────────────────────────────────────────────
// Count-Up Animation
// ────────────────────────────────────────────────
function animateCountUp() {
  if (countUpDone) return;
  countUpDone = true;

  document.querySelectorAll('.hero-stat-num').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ────────────────────────────────────────────────
// Domain Trends Line Chart
// ────────────────────────────────────────────────
function buildTrendChart(data) {
  const semesters = data.semester_order;
  const trends = data.domain_trends;
  const domains = Object.keys(DOMAIN_COLORS);

  // Short semester labels
  const labels = semesters.map(s => {
    const parts = s.split(' ');
    return parts[0].substring(0, 1) + "'" + parts[1].substring(2);
  });

  const datasets = domains.map(domain => {
    const values = semesters.map(sem => {
      const semData = trends[sem];
      return semData && semData[domain] ? semData[domain] : 0;
    });
    const color = DOMAIN_COLORS[domain];
    return {
      label: domain,
      data: values,
      borderColor: color,
      backgroundColor: color + '15',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: color,
      tension: 0.3,
      fill: false,
    };
  });

  const ctx = document.getElementById('trendChart').getContext('2d');

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,19,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e4e4e7',
          bodyColor: '#a1a1aa',
          titleFont: { family: 'Space Grotesk', weight: '600', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
            }
          }
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#52525b',
            font: { family: 'Inter', size: 10 },
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#52525b',
            font: { family: 'Inter', size: 10 },
            callback: v => v + '%',
          },
          beginAtZero: true,
        },
      },
    },
  });

  // Build legend
  const legendEl = document.getElementById('trendLegend');
  legendEl.innerHTML = '';
  domains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'trend-legend-item';
    item.innerHTML = `<div class="trend-legend-dot" style="background:${DOMAIN_COLORS[domain]}"></div>${abbrevDomain(domain)}`;
    item.addEventListener('click', () => {
      // Toggle dataset visibility
      const ds = trendChartInstance.data.datasets.find(d => d.label === domain);
      const idx = trendChartInstance.data.datasets.indexOf(ds);
      const meta = trendChartInstance.getDatasetMeta(idx);
      meta.hidden = !meta.hidden;
      item.style.opacity = meta.hidden ? '0.3' : '1';
      trendChartInstance.update();
    });
    legendEl.appendChild(item);
  });
}

// ────────────────────────────────────────────────
// Winner Distribution Bar Chart
// ────────────────────────────────────────────────
function buildWinnerChart(data) {
  const semesters = data.semester_order;

  // Count winners per semester from allProjects (loaded in app.js)
  const winnerCounts = {};
  allProjects.forEach(p => {
    if (p.award) {
      winnerCounts[p.semester] = (winnerCounts[p.semester] || 0) + 1;
    }
  });

  const labels = semesters.map(s => {
    const parts = s.split(' ');
    return parts[0].substring(0, 1) + "'" + parts[1].substring(2);
  });

  const values = semesters.map(sem => winnerCounts[sem] || 0);

  const ctx = document.getElementById('winnerChart').getContext('2d');

  winnerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Award Winners',
        data: values,
        backgroundColor: 'rgba(251,191,36,0.35)',
        borderColor: '#fbbf24',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(251,191,36,0.6)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,17,19,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e4e4e7',
          bodyColor: '#fbbf24',
          titleFont: { family: 'Space Grotesk', weight: '600', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: function(items) {
              return semesters[items[0].dataIndex];
            },
            label: function(context) {
              return `${context.parsed.y} winners`;
            }
          }
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#52525b',
            font: { family: 'Inter', size: 10 },
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#52525b',
            font: { family: 'Inter', size: 10 },
            stepSize: 4,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ────────────────────────────────────────────────
// Domain Chips & Word Cloud
// ────────────────────────────────────────────────
let activeWordCloudDomain = null;

function buildDomainChips(data) {
  const container = document.getElementById('domainChips');
  container.innerHTML = '';

  const domains = Object.keys(DOMAIN_COLORS);
  domains.forEach(domain => {
    const color = DOMAIN_COLORS[domain];
    const chip = document.createElement('button');
    chip.className = 'domain-chip';
    chip.style.setProperty('--chip-color', color);
    chip.style.setProperty('--chip-bg', color + '18');
    chip.innerHTML = `<span class="domain-chip-dot" style="background:${color}"></span>${abbrevDomain(domain)}`;

    chip.addEventListener('click', () => {
      // Toggle
      if (activeWordCloudDomain === domain) {
        activeWordCloudDomain = null;
        chip.classList.remove('active');
        showWordCloudPlaceholder();
      } else {
        document.querySelectorAll('.domain-chip').forEach(c => c.classList.remove('active'));
        activeWordCloudDomain = domain;
        chip.classList.add('active');
        renderWordCloud(domain, data.domain_keywords[domain], color);
      }
    });

    container.appendChild(chip);
  });
}

function showWordCloudPlaceholder() {
  const container = document.getElementById('wordCloudContainer');
  container.innerHTML = '<div class="word-cloud-placeholder">Select a domain above to see keywords</div>';
}

function renderWordCloud(domain, keywords, baseColor) {
  const container = document.getElementById('wordCloudContainer');
  container.innerHTML = '';

  if (!keywords || keywords.length === 0) {
    container.innerHTML = '<div class="word-cloud-placeholder">No keywords available for this domain</div>';
    return;
  }

  // Take top 40 keywords
  const words = keywords.slice(0, 40);
  const maxCount = words[0].count;
  const minCount = words[words.length - 1].count;

  // Parse base color to create variations
  const r = parseInt(baseColor.slice(1, 3), 16);
  const gVal = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'cloud-word';

    // Scale font size from 0.7rem to 2.2rem based on count
    const ratio = maxCount === minCount ? 0.5 : (w.count - minCount) / (maxCount - minCount);
    const fontSize = 0.7 + ratio * 1.5;
    const opacity = 0.4 + ratio * 0.6;

    span.style.fontSize = `${fontSize}rem`;
    span.style.color = baseColor;
    span.style.opacity = opacity;
    span.textContent = w.word;

    // Stagger animation
    span.style.animation = `fadeIn 0.3s ease ${i * 20}ms both`;

    container.appendChild(span);
  });
}
