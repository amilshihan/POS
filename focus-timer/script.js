(() => {
  const DURATIONS = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const RING_CIRCUMFERENCE = 2 * Math.PI * 108;

  const timeEl = document.getElementById('time');
  const currentTaskEl = document.getElementById('currentTask');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const skipBtn = document.getElementById('skipBtn');
  const ringProgress = document.querySelector('.ring-progress');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const taskForm = document.getElementById('taskForm');
  const taskInput = document.getElementById('taskInput');
  const taskList = document.getElementById('taskList');
  const sessionsTodayEl = document.getElementById('sessionsToday');
  const focusMinutesEl = document.getElementById('focusMinutes');
  const streakEl = document.getElementById('streak');
  const toastEl = document.getElementById('toast');

  const MODE_COLORS = {
    work: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    short: getComputedStyle(document.documentElement).getPropertyValue('--short').trim(),
    long: getComputedStyle(document.documentElement).getPropertyValue('--long').trim(),
  };

  const state = load('ft_state', {
    mode: 'work',
    remaining: DURATIONS.work,
    running: false,
    tasks: [],
    selectedTaskId: null,
    stats: { date: todayStr(), sessionsToday: 0, focusMinutes: 0, streak: 0, lastActiveDate: null },
  });

  if (state.stats.date !== todayStr()) {
    rolloverDay();
  }

  let tickHandle = null;
  let endTimestamp = null;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
      return fallback;
    }
  }

  function save() {
    localStorage.setItem('ft_state', JSON.stringify(state));
  }

  function rolloverDay() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const wasActiveYesterday = state.stats.lastActiveDate === yesterday;
    const hadSessionsToday = state.stats.sessionsToday > 0;
    state.stats.streak = hadSessionsToday ? state.stats.streak : (wasActiveYesterday ? state.stats.streak : 0);
    state.stats.date = todayStr();
    state.stats.sessionsToday = 0;
    state.stats.focusMinutes = 0;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateRing() {
    const total = DURATIONS[state.mode];
    const frac = state.remaining / total;
    ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - frac);
    ringProgress.style.stroke = MODE_COLORS[state.mode];
  }

  function render() {
    timeEl.textContent = formatTime(state.remaining);
    updateRing();
    document.title = `${formatTime(state.remaining)} - Focus Timer`;

    modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.mode));
    startBtn.textContent = state.running ? 'Pause' : 'Start';

    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    currentTaskEl.textContent = task ? task.text : 'No task selected';

    sessionsTodayEl.textContent = state.stats.sessionsToday;
    focusMinutesEl.textContent = state.stats.focusMinutes;
    streakEl.textContent = state.stats.streak;

    renderTasks();
    save();
  }

  function renderTasks() {
    taskList.innerHTML = '';
    if (state.tasks.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'Add a task to focus on.';
      taskList.appendChild(li);
      return;
    }
    state.tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '') + (task.id === state.selectedTaskId ? ' selected' : '');

      const check = document.createElement('span');
      check.className = 'task-check';
      check.textContent = task.done ? '✓' : '';
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        task.done = !task.done;
        render();
      });

      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;

      const pomos = document.createElement('span');
      pomos.className = 'task-pomos';
      pomos.textContent = task.pomos > 0 ? `${'●'.repeat(Math.min(task.pomos, 5))}${task.pomos > 5 ? ' +' + (task.pomos - 5) : ''}` : '';

      const del = document.createElement('button');
      del.className = 'task-delete';
      del.textContent = '✕';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        if (state.selectedTaskId === task.id) state.selectedTaskId = null;
        render();
      });

      li.addEventListener('click', () => {
        state.selectedTaskId = task.id;
        render();
      });

      li.appendChild(check);
      li.appendChild(text);
      li.appendChild(pomos);
      li.appendChild(del);
      taskList.appendChild(li);
    });
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => ctx.close();
    } catch { /* audio unavailable */ }
  }

  function switchMode(mode, resetTime = true) {
    state.mode = mode;
    if (resetTime) state.remaining = DURATIONS[mode];
    render();
  }

  function tick() {
    const now = Date.now();
    state.remaining = Math.max(0, Math.round((endTimestamp - now) / 1000));
    if (state.remaining <= 0) {
      completeSession();
      return;
    }
    render();
  }

  function completeSession() {
    stopTicking();
    state.running = false;

    if (state.mode === 'work') {
      state.stats.sessionsToday += 1;
      state.stats.focusMinutes += Math.round(DURATIONS.work / 60);
      state.stats.lastActiveDate = todayStr();
      const task = state.tasks.find(t => t.id === state.selectedTaskId);
      if (task) task.pomos = (task.pomos || 0) + 1;
      // bump streak once per day
      if (state.stats.sessionsToday === 1) state.stats.streak += 1;
      showToast('Nice work! Time for a break.');
      const nextMode = state.stats.sessionsToday % 4 === 0 ? 'long' : 'short';
      switchMode(nextMode);
    } else {
      showToast('Break over. Ready to focus?');
      switchMode('work');
    }

    beep();
    render();
  }

  function startTicking() {
    endTimestamp = Date.now() + state.remaining * 1000;
    tickHandle = setInterval(tick, 250);
  }

  function stopTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  }

  function toggleStart() {
    state.running = !state.running;
    if (state.running) {
      startTicking();
    } else {
      stopTicking();
    }
    render();
  }

  function resetTimer() {
    stopTicking();
    state.running = false;
    state.remaining = DURATIONS[state.mode];
    render();
  }

  function skipSession() {
    stopTicking();
    state.running = false;
    if (state.mode === 'work') {
      switchMode(state.stats.sessionsToday % 4 === 3 ? 'long' : 'short');
    } else {
      switchMode('work');
    }
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      stopTicking();
      state.running = false;
      switchMode(btn.dataset.mode);
    });
  });

  startBtn.addEventListener('click', toggleStart);
  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', skipSession);

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;
    const task = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, done: false, pomos: 0 };
    state.tasks.push(task);
    if (!state.selectedTaskId) state.selectedTaskId = task.id;
    taskInput.value = '';
    render();
  });

  render();
})();
