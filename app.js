// ── State ──
const state = {
  cat:     'manga',
  view:    'grid',
  search:  '',
  sort:    'name',
  filters: {
    manga:   { status: '', genre: '' },
    spirits: { status: '', type:  '' }
  }
};

// ── Storage ──
function loadAll() {
  return JSON.parse(localStorage.getItem('fieldRegistry') || '[]');
}

function saveAll(data) {
  localStorage.setItem('fieldRegistry', JSON.stringify(data));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Render pipeline ──
function render() {
  const data    = loadAll();
  const catData = data.filter(e => e.cat === state.cat);
  const visible = applyFiltersAndSort(catData);

  updateStats(data);
  updateGenreFilter(catData);
  renderInventory(visible);
}

function applyFiltersAndSort(entries) {
  const f = state.filters[state.cat];
  const q = state.search.toLowerCase().trim();

  let out = entries.filter(e => {
    if (q) {
      const hay = [e.name, e.notes, e.genre, e.brand, e.type, e.age]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.cat === 'manga') {
      if (f.status && e.status !== f.status) return false;
      if (f.genre  && (e.genre || '').toLowerCase() !== f.genre.toLowerCase()) return false;
    } else {
      if (f.status && e.status !== f.status) return false;
      if (f.type   && e.type   !== f.type)   return false;
    }
    return true;
  });

  out.sort((a, b) => {
    switch (state.sort) {
      case 'score':     return (b.score || 0) - (a.score || 0);
      case 'status':    return (a.status || '').localeCompare(b.status || '');
      case 'dateAdded': return (b.dateAdded || 0) - (a.dateAdded || 0);
      case 'volumes':   return (b.volumes || 0) - (a.volumes || 0);
      default:          return a.name.localeCompare(b.name);
    }
  });

  return out;
}

// ── Stats bar ──
function updateStats(data) {
  const cat = data.filter(e => e.cat === state.cat);
  document.getElementById('stat-total').textContent = cat.length;

  if (state.cat === 'manga') {
    document.getElementById('stat-label-b').textContent = 'READING';
    document.getElementById('stat-label-c').textContent = 'COMPLETE';
    document.getElementById('stat-b').textContent = cat.filter(e => e.status === 'Reading').length;
    document.getElementById('stat-c').textContent = cat.filter(e => e.status === 'Completed').length;
  } else {
    document.getElementById('stat-label-b').textContent = 'OPEN';
    document.getElementById('stat-label-c').textContent = 'SEALED';
    document.getElementById('stat-b').textContent = cat.filter(e => e.status === 'Open').length;
    document.getElementById('stat-c').textContent = cat.filter(e => e.status === 'Sealed').length;
  }
}

// ── Dynamic genre dropdown ──
function updateGenreFilter(catData) {
  if (state.cat !== 'manga') return;
  const sel     = document.getElementById('filter-manga-genre');
  const current = sel.value;
  const genres  = [...new Set(catData.map(e => e.genre).filter(Boolean))].sort();
  sel.innerHTML  = '<option value="">All Genres</option>' +
    genres.map(g => `<option value="${g}"${g === current ? ' selected' : ''}>${g}</option>`).join('');
}

// ── Render inventory container ──
function renderInventory(entries) {
  const inv   = document.getElementById('inventory');
  const empty = document.getElementById('empty-msg');

  if (!entries.length) {
    inv.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  inv.className = state.view === 'grid' ? 'grid-view' : 'list-view';
  inv.innerHTML = entries.map((e, i) =>
    state.view === 'grid' ? renderCard(e, i) : renderRow(e, i)
  ).join('');
}

// ── Card (grid) ──
function renderCard(e, i) {
  const idx       = String(i + 1).padStart(3, '0');
  const badge     = `<span class="${badgeCls(e.status)}">${e.status}</span>`;
  const scoreHtml = scoreDisplay(e.score);
  const notesHtml = e.notes
    ? `<div class="card-notes">${esc(e.notes)}</div>` : '';

  let body = '';
  if (e.cat === 'manga') {
    const owned = e.volumes || 0;
    const total = e.total   || 0;
    const pct   = total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;
    body = `
      ${e.genre ? `<div class="card-genre">${esc(e.genre)}</div>` : ''}
      <div class="card-volumes">VOL: <span>${owned}</span> / ${total || '?'}</div>
      ${total > 0 ? `<div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}`;
  } else {
    body = `
      ${e.brand ? `<div class="card-genre">${esc(e.brand)}</div>` : ''}
      <div class="card-volumes">
        TYPE: <span>${e.type || '—'}</span>
        ${e.age  ? ` &nbsp;·&nbsp; <span>${esc(e.age)}</span>` : ''}
        ${e.abv  ? ` &nbsp;·&nbsp; ABV: <span>${e.abv}%</span>` : ''}
      </div>`;
  }

  return `
    <div class="card bracketed" data-id="${e.id}">
      <div class="card-index">REC-${idx} &nbsp; ${badge}</div>
      <div class="card-title">${esc(e.name)}</div>
      ${body}
      ${scoreHtml}
      ${notesHtml}
      <div class="card-actions">
        <button class="btn-edit" onclick="openEdit('${e.id}')">[ Edit ]</button>
        <button class="btn-del"  onclick="openDelete('${e.id}')">[ Del ]</button>
      </div>
    </div>`;
}

// ── Row (list) ──
function renderRow(e, i) {
  const idx   = String(i + 1).padStart(3, '0');
  const badge = `<span class="${badgeCls(e.status)}">${e.status}</span>`;

  let mid = '';
  if (e.cat === 'manga') {
    mid = `
      <span class="list-genre">${e.genre ? esc(e.genre) : '—'}</span>
      <span class="list-vols">VOL: <span>${e.volumes || 0}${e.total ? ' / ' + e.total : ''}</span></span>`;
  } else {
    mid = `
      <span class="list-genre">${e.type || '—'}${e.brand ? ' · ' + esc(e.brand) : ''}</span>
      <span class="list-vols">${e.abv ? `ABV: <span>${e.abv}%</span>` : '—'}</span>`;
  }

  return `
    <div class="list-row" data-id="${e.id}">
      <span class="list-index">${idx}</span>
      <span class="list-title">${esc(e.name)}</span>
      ${mid}
      ${e.score ? `<span class="list-vols">SCORE: <span>${e.score}/10</span></span>` : ''}
      ${badge}
      <div class="list-actions">
        <button class="btn-edit" onclick="openEdit('${e.id}')">Edit</button>
        <button class="btn-del"  onclick="openDelete('${e.id}')">Del</button>
      </div>
    </div>`;
}

// ── Score display ──
const SCORE_TAG = ['', 'AVOID', 'AVOID', 'LOW', 'FAIR', 'FAIR', 'GOOD', 'GOOD', 'GREAT', 'GREAT', 'ELITE'];

function scoreDisplay(score) {
  if (!score) return '';
  const n    = parseInt(score);
  const pips = Array.from({ length: 10 }, (_, i) =>
    `<span class="${i < n ? 'score-pip-filled' : ''}">${i < n ? '■' : '□'}</span>`
  ).join('');
  return `<div class="card-score">
    <span class="score-val">${n}/10</span>
    <span class="score-tag">${SCORE_TAG[n]}</span>
    <span class="score-pips">${pips}</span>
  </div>`;
}

// ── Helpers ──
function badgeCls(status) {
  return 'badge badge-' + (status || 'Unknown').replace(/\s+/g, '-');
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Tab switching ──
document.querySelectorAll('.cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    state.cat = btn.dataset.cat;
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('filters-manga').classList.toggle('hidden',   state.cat !== 'manga');
    document.getElementById('filters-spirits').classList.toggle('hidden', state.cat !== 'spirits');
    render();
  });
});

// ── View toggle ──
document.getElementById('view-grid').addEventListener('click', () => {
  state.view = 'grid';
  document.getElementById('view-grid').classList.add('active');
  document.getElementById('view-list').classList.remove('active');
  render();
});
document.getElementById('view-list').addEventListener('click', () => {
  state.view = 'list';
  document.getElementById('view-list').classList.add('active');
  document.getElementById('view-grid').classList.remove('active');
  render();
});

// ── Search ──
document.getElementById('search').addEventListener('input', e => {
  state.search = e.target.value;
  render();
});

// ── Filter & sort listeners ──
document.getElementById('filter-manga-status').addEventListener('change',   e => { state.filters.manga.status   = e.target.value; render(); });
document.getElementById('filter-manga-genre').addEventListener('change',    e => { state.filters.manga.genre    = e.target.value; render(); });
document.getElementById('filter-spirits-status').addEventListener('change', e => { state.filters.spirits.status = e.target.value; render(); });
document.getElementById('filter-spirits-type').addEventListener('change',   e => { state.filters.spirits.type   = e.target.value; render(); });
document.getElementById('sort-by').addEventListener('change',               e => { state.sort                   = e.target.value; render(); });

// ── Stubs — wired in Chunk 3 ──
function openEdit(id)   {}
function openDelete(id) {}

// ── Boot ──
render();
