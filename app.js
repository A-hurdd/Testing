// ── Auth ──
(function () {
  const screen = document.getElementById('lock-screen');
  const sub    = document.getElementById('lock-sub');
  const pw     = document.getElementById('lock-pw');
  const pw2    = document.getElementById('lock-pw2');
  const err    = document.getElementById('lock-err');
  const btn    = document.getElementById('lock-btn');

  if (sessionStorage.getItem('fr_unlocked') === '1') {
    screen.classList.add('hidden');
    return;
  }

  const isSetup = !localStorage.getItem('fr_hash');

  if (isSetup) {
    sub.textContent = 'CREATE PASSWORD';
    pw.placeholder  = 'NEW PASSWORD';
    pw2.classList.remove('hidden');
    btn.textContent = '[ SET PASSWORD ]';
  } else {
    sub.textContent = 'ENTER PASSWORD';
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function unlock() {
    sessionStorage.setItem('fr_unlocked', '1');
    screen.style.animation = 'lock-out 0.2s ease-in forwards';
    setTimeout(() => screen.classList.add('hidden'), 200);
  }

  async function submit() {
    const val = pw.value;
    if (!val) return;
    err.classList.add('hidden');

    if (isSetup) {
      if (val.length < 6) {
        err.textContent = 'MINIMUM 6 CHARACTERS';
        err.classList.remove('hidden');
        return;
      }
      if (val !== pw2.value) {
        err.textContent = 'PASSWORDS DO NOT MATCH';
        err.classList.remove('hidden');
        return;
      }
      localStorage.setItem('fr_hash', await sha256(val));
      unlock();
    } else {
      if (await sha256(val) === localStorage.getItem('fr_hash')) {
        unlock();
      } else {
        err.textContent = 'INVALID — ACCESS DENIED';
        err.classList.remove('hidden');
        pw.value = '';
        pw.focus();
      }
    }
  }

  btn.addEventListener('click', submit);
  pw.addEventListener('keydown',  e => { if (e.key === 'Enter') submit(); });
  pw2.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  setTimeout(() => pw.focus(), 100);
})();

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
      const hay = [e.name, e.notes, e.genre, e.brand, e.type, e.age, e.volume]
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
    document.getElementById('stat-value-wrap').classList.add('hidden');
  } else {
    document.getElementById('stat-label-b').textContent = 'OPEN';
    document.getElementById('stat-label-c').textContent = 'SEALED';
    document.getElementById('stat-b').textContent = cat.filter(e => e.status === 'Open').length;
    document.getElementById('stat-c').textContent = cat.filter(e => e.status === 'Sealed').length;
    const total = cat.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0);
    document.getElementById('stat-value').textContent = '$' + total.toFixed(2);
    document.getElementById('stat-value-wrap').classList.remove('hidden');
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
    const volumeLabel = e.volume ? `${e.volume}ml` : (e.size || '');
    body = `
      ${e.brand ? `<div class="card-genre">${esc(e.brand)}</div>` : ''}
      <div class="card-volumes">
        TYPE: <span>${e.type || '—'}</span>
        ${e.age  ? ` &nbsp;·&nbsp; <span>${esc(e.age)}</span>` : ''}
        ${e.abv  ? ` &nbsp;·&nbsp; ABV: <span>${e.abv}%</span>` : ''}
      </div>
      <div class="card-volumes">
        ${volumeLabel ? `VOL: <span>${esc(volumeLabel)}</span>` : ''}
        ${volumeLabel && e.price ? ' &nbsp;·&nbsp; ' : ''}
        ${e.price ? `PRICE: <span>$${parseFloat(e.price).toFixed(2)}</span>` : ''}
        ${e.volume && e.price ? ` &nbsp;·&nbsp; $/100ml: <span>$${((parseFloat(e.price) / parseFloat(e.volume)) * 100).toFixed(2)}</span>` : ''}
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
    const volumeLabel = e.volume ? `${e.volume}ml` : (e.size || '');
    mid = `
      <span class="list-genre">${e.type || '—'}${e.brand ? ' · ' + esc(e.brand) : ''}</span>
      <span class="list-vols">${volumeLabel ? `<span>${esc(volumeLabel)}</span>` : ''}${volumeLabel && e.abv ? ' · ' : ''}${e.abv ? `ABV: <span>${e.abv}%</span>` : ''}</span>
      ${e.price ? `<span class="list-vols">$<span>${parseFloat(e.price).toFixed(2)}</span></span>` : ''}`;
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

// ── Modal helpers ──
function showModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id)  { document.getElementById(id).classList.add('hidden'); }

function setFormCategory(cat) {
  document.getElementById('form-manga').classList.toggle('hidden',   cat !== 'manga');
  document.getElementById('form-spirits').classList.toggle('hidden', cat !== 'spirits');
  document.getElementById('edit-cat').value = cat;
  document.getElementById('modal-title').textContent =
    (document.getElementById('edit-id').value ? 'Edit' : 'Add') +
    (cat === 'manga' ? ' Manga' : ' Spirit');
}

// ── Score buttons ──
let selectedScore = null;

document.querySelectorAll('.score-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.dataset.val);
    // clicking the active score again clears it
    if (selectedScore === val) {
      selectedScore = null;
      document.getElementById('f-score').value = '';
      document.getElementById('score-label').textContent = '—';
      document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
    } else {
      selectedScore = val;
      document.getElementById('f-score').value = val;
      document.getElementById('score-label').textContent = SCORE_TAG[val];
      document.querySelectorAll('.score-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.val) === val)
      );
    }
  });
});

function resetScoreButtons(score) {
  selectedScore = score || null;
  document.getElementById('f-score').value = score || '';
  document.getElementById('score-label').textContent = score ? SCORE_TAG[score] : '—';
  document.querySelectorAll('.score-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.val) === score)
  );
}

// ── Open Add modal ──
document.getElementById('btn-add').addEventListener('click', () => {
  document.getElementById('edit-id').value = '';
  document.getElementById('entry-form').reset();
  resetScoreButtons(null);
  setFormCategory(state.cat);
  showModal('modal-overlay');
  setTimeout(() => document.getElementById('f-name').focus(), 50);
});

// ── Open Edit modal ──
function openEdit(id) {
  const entry = loadAll().find(e => e.id === id);
  if (!entry) return;

  document.getElementById('edit-id').value = id;
  document.getElementById('f-name').value  = entry.name || '';
  document.getElementById('f-notes').value = entry.notes || '';
  resetScoreButtons(entry.score || null);

  if (entry.cat === 'manga') {
    document.getElementById('f-volumes').value      = entry.volumes || '';
    document.getElementById('f-total').value        = entry.total   || '';
    document.getElementById('f-genre').value        = entry.genre   || '';
    document.getElementById('f-manga-status').value = entry.status  || 'Plan to Read';
  } else {
    document.getElementById('f-brand').value           = entry.brand  || '';
    document.getElementById('f-spirit-type').value     = entry.type   || 'Whiskey';
    document.getElementById('f-age').value             = entry.age    || '';
    document.getElementById('f-abv').value             = entry.abv    || '';
    document.getElementById('f-price').value           = entry.price  || '';
    document.getElementById('f-size').value             = entry.size   || '';
    document.getElementById('f-spirits-status').value  = entry.status || 'Sealed';
  }

  setFormCategory(entry.cat);
  showModal('modal-overlay');
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}

// ── Form submit (Add + Edit) ──
document.getElementById('entry-form').addEventListener('submit', e => {
  e.preventDefault();

  const cat   = document.getElementById('edit-cat').value;
  const id    = document.getElementById('edit-id').value;
  const score = parseInt(document.getElementById('f-score').value) || null;

  let entry = {
    id:        id || uid(),
    cat,
    name:      document.getElementById('f-name').value.trim(),
    score,
    notes:     document.getElementById('f-notes').value.trim(),
    dateAdded: id ? undefined : Date.now()
  };

  if (cat === 'manga') {
    entry.volumes = parseInt(document.getElementById('f-volumes').value) || 0;
    entry.total   = parseInt(document.getElementById('f-total').value)   || 0;
    entry.genre   = document.getElementById('f-genre').value.trim();
    entry.status  = document.getElementById('f-manga-status').value;
  } else {
    entry.brand  = document.getElementById('f-brand').value.trim();
    entry.type   = document.getElementById('f-spirit-type').value;
    entry.age    = document.getElementById('f-age').value.trim();
    entry.abv    = parseFloat(document.getElementById('f-abv').value) || null;
    entry.price  = parseFloat(document.getElementById('f-price').value) || null;
    entry.size   = document.getElementById('f-size').value || null;
    entry.status = document.getElementById('f-spirits-status').value;
  }

  const data = loadAll();
  if (id) {
    const idx = data.findIndex(e => e.id === id);
    if (idx !== -1) {
      entry.dateAdded = data[idx].dateAdded;
      data[idx] = entry;
    }
  } else {
    data.push(entry);
  }

  saveAll(data);
  hideModal('modal-overlay');
  render();
});

// ── Delete ──
let pendingDeleteId = null;

function openDelete(id) {
  const entry = loadAll().find(e => e.id === id);
  if (!entry) return;
  pendingDeleteId = id;
  document.getElementById('delete-msg').textContent =
    `"${entry.name}" will be permanently removed from the registry.`;
  showModal('delete-overlay');
}

document.getElementById('btn-delete-confirm').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const data = loadAll().filter(e => e.id !== pendingDeleteId);
  saveAll(data);
  pendingDeleteId = null;
  hideModal('delete-overlay');
  render();
});

document.getElementById('btn-delete-cancel').addEventListener('click', () => {
  pendingDeleteId = null;
  hideModal('delete-overlay');
});

// ── Cancel / close ──
document.getElementById('btn-cancel').addEventListener('click', () => hideModal('modal-overlay'));

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) hideModal('modal-overlay');
});
document.getElementById('delete-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('delete-overlay')) hideModal('delete-overlay');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideModal('modal-overlay');
    hideModal('delete-overlay');
  }
});

// ── Mobile FAB ──
document.getElementById('fab-add').addEventListener('click', () => {
  document.getElementById('btn-add').click();
});

// ── Mobile bottom nav ──
document.querySelectorAll('.bnav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    // mirror the category tab click
    const tab = document.querySelector(`.cat-tab[data-cat="${btn.dataset.cat}"]`);
    if (tab) tab.click();
    // update bottom nav active state
    document.querySelectorAll('.bnav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// keep bottom nav in sync when desktop tabs are clicked
document.querySelectorAll('.cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bnav-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === btn.dataset.cat)
    );
  });
});

// ── Export ──
document.getElementById('btn-export').addEventListener('click', () => {
  const data = loadAll();
  if (!data.length) { alert('Nothing to export yet.'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `field-registry-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import ──
document.getElementById('import-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const incoming = JSON.parse(e.target.result);
      if (!Array.isArray(incoming)) throw new Error();
      const existing = loadAll();
      let merged;
      if (existing.length && confirm(`You have ${existing.length} existing entries.\n\nOK = Merge (keep both)\nCancel = Replace (overwrite all)`)) {
        const ids = new Set(existing.map(x => x.id));
        merged = [...existing, ...incoming.filter(x => !ids.has(x.id))];
      } else if (existing.length) {
        merged = incoming;
      } else {
        merged = incoming;
      }
      saveAll(merged);
      render();
      alert(`Import complete — ${merged.length} entries loaded.`);
    } catch {
      alert('Import failed. File must be a valid Field Registry .json backup.');
    }
    this.value = '';
  };
  reader.readAsText(file);
});

// ── Boot ──
render();
