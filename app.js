const DB_URL = 'instruments.json';
const PROGRESS_KEY = 'surgicalInstrumentProgress';

const state = {
  instruments: [],
  filtered: [],
  search: '',
  category: 'all',
  difficulty: 'all',
  learned: 'all',
  sort: 'name',
  progress: loadProgress(),
  quizItem: null,
  answerVisible: false
};

const els = {
  cards: document.querySelector('#cards'),
  template: document.querySelector('#card-template'),
  search: document.querySelector('#search-input'),
  category: document.querySelector('#category-filter'),
  difficulty: document.querySelector('#difficulty-filter'),
  learned: document.querySelector('#learned-filter'),
  sort: document.querySelector('#sort-select'),
  total: document.querySelector('#total-count'),
  learnedCount: document.querySelector('#learned-count'),
  categoryCount: document.querySelector('#category-count'),
  resultCount: document.querySelector('#result-count'),
  activeTags: document.querySelector('#active-tags'),
  empty: document.querySelector('#empty-state'),
  quizDialog: document.querySelector('#quiz-dialog'),
  quizContent: document.querySelector('#quiz-content'),
  quizReveal: document.querySelector('#quiz-reveal'),
  quizNext: document.querySelector('#quiz-next')
};

init();

async function init() {
  try {
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error(`Could not load ${DB_URL}`);
    const database = await response.json();
    state.instruments = database.map(item => ({ ...item, learned: Boolean(state.progress[item.id] ?? item.learned) }));
    populateCategories();
    bindEvents();
    render();
  } catch (error) {
    els.cards.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
  }
}

function bindEvents() {
  els.search.addEventListener('input', event => { state.search = event.target.value; render(); });
  els.category.addEventListener('change', event => { state.category = event.target.value; render(); });
  els.difficulty.addEventListener('change', event => { state.difficulty = event.target.value; render(); });
  els.learned.addEventListener('change', event => { state.learned = event.target.value; render(); });
  els.sort.addEventListener('change', event => { state.sort = event.target.value; render(); });
  document.querySelector('#reset-progress').addEventListener('click', resetProgress);
  document.querySelector('#start-quiz').addEventListener('click', openQuiz);
  els.quizReveal.addEventListener('click', () => { state.answerVisible = true; renderQuiz(); });
  els.quizNext.addEventListener('click', nextQuizQuestion);
}

function populateCategories() {
  const categories = unique(state.instruments.map(item => item.category));
  els.category.insertAdjacentHTML('beforeend', categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(''));
}

function render() {
  state.filtered = state.instruments.filter(matchesFilters).sort(sortInstruments);
  renderStats();
  renderActiveTags();
  renderCards();
}

function matchesFilters(item) {
  const searchText = [item.name, item.category, item.subcategory, item.used_for, item.recognize_by, item.common_procedures, item.similar_to, item.do_not_confuse_with, item.difficulty, item.notes]
    .join(' ')
    .toLowerCase();
  const matchesSearch = !state.search || searchText.includes(state.search.trim().toLowerCase());
  const matchesCategory = state.category === 'all' || item.category === state.category;
  const matchesDifficulty = state.difficulty === 'all' || item.difficulty === state.difficulty;
  const matchesLearned = state.learned === 'all' || (state.learned === 'learned' ? item.learned : !item.learned);
  return matchesSearch && matchesCategory && matchesDifficulty && matchesLearned;
}

function sortInstruments(a, b) {
  if (state.sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  if (state.sort === 'difficulty') return difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}

function renderStats() {
  els.total.textContent = state.instruments.length;
  els.learnedCount.textContent = state.instruments.filter(item => item.learned).length;
  els.categoryCount.textContent = unique(state.instruments.map(item => item.category)).length;
  els.resultCount.textContent = state.filtered.length;
}

function renderActiveTags() {
  const tags = [];
  if (state.search) tags.push(`Search: ${state.search}`);
  if (state.category !== 'all') tags.push(state.category);
  if (state.difficulty !== 'all') tags.push(state.difficulty);
  if (state.learned !== 'all') tags.push(state.learned === 'learned' ? 'Learned' : 'Not learned');
  els.activeTags.innerHTML = tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
}

function renderCards() {
  els.cards.innerHTML = '';
  els.empty.hidden = state.filtered.length !== 0;
  const fragment = document.createDocumentFragment();

  state.filtered.forEach(item => {
    const card = els.template.content.cloneNode(true);
    const article = card.querySelector('.instrument-card');
    const image = card.querySelector('.card-image');
    const title = card.querySelector('h2');
    const category = card.querySelector('.category');
    const difficulty = card.querySelector('.difficulty');
    const subcategory = card.querySelector('.subcategory');
    const facts = card.querySelector('.facts');
    const tags = card.querySelector('.tags');
    const checkbox = card.querySelector('input[type="checkbox"]');

    article.dataset.id = item.id;
    image.textContent = initials(item.name);
    if (item.image_url) {
      image.style.background = `center / cover no-repeat url('${item.image_url}')`;
      image.textContent = '';
    }
    title.textContent = item.name;
    category.textContent = item.category;
    difficulty.textContent = item.difficulty;
    difficulty.classList.add(item.difficulty.toLowerCase());
    subcategory.textContent = item.subcategory;
    facts.innerHTML = factRows(item);
    tags.innerHTML = [item.common_procedures, item.similar_to, item.do_not_confuse_with]
      .filter(Boolean)
      .flatMap(value => value.split(';').map(part => part.trim()).filter(Boolean))
      .slice(0, 6)
      .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    checkbox.checked = item.learned;
    checkbox.addEventListener('change', () => toggleLearned(item.id, checkbox.checked));
    fragment.appendChild(card);
  });

  els.cards.appendChild(fragment);
}

function factRows(item) {
  const facts = [
    ['Used for', item.used_for],
    ['Recognize by', item.recognize_by],
    ['Common procedures', item.common_procedures],
    ['Similar to', item.similar_to],
    ['Do not confuse with', item.do_not_confuse_with],
    ['Notes', item.notes]
  ].filter(([, value]) => value);
  return facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}

function toggleLearned(id, learned) {
  const item = state.instruments.find(entry => entry.id === id);
  if (!item) return;
  item.learned = learned;
  state.progress[id] = learned;
  saveProgress();
  render();
}

function resetProgress() {
  state.progress = {};
  state.instruments = state.instruments.map(item => ({ ...item, learned: false }));
  localStorage.removeItem(PROGRESS_KEY);
  render();
}

function openQuiz() {
  nextQuizQuestion();
  if (typeof els.quizDialog.showModal === 'function') els.quizDialog.showModal();
}

function nextQuizQuestion() {
  const pool = state.filtered.length ? state.filtered : state.instruments;
  state.quizItem = pool[Math.floor(Math.random() * pool.length)];
  state.answerVisible = false;
  renderQuiz();
}

function renderQuiz() {
  const item = state.quizItem;
  if (!item) return;
  els.quizContent.innerHTML = `
    <div class="quiz-question">
      <p class="eyebrow">Clue</p>
      <h3>${escapeHtml(item.recognize_by)}</h3>
      <p><strong>Used for:</strong> ${escapeHtml(item.used_for)}</p>
      <p><strong>Category:</strong> ${escapeHtml(item.category)} · ${escapeHtml(item.difficulty)}</p>
      ${state.answerVisible ? `<div class="quiz-answer"><p class="eyebrow">Answer</p><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.subcategory)}</p><p><strong>Do not confuse with:</strong> ${escapeHtml(item.do_not_confuse_with || '—')}</p></div>` : ''}
    </div>`;
  els.quizReveal.disabled = state.answerVisible;
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch { return {}; }
}

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
}

function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function difficultyRank(value) { return { Easy: 1, Medium: 2, Hard: 3 }[value] || 99; }
function initials(name) { return name.replace(/#|-/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
