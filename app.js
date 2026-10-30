(() => {
  "use strict";
  const STORAGE_KEY = "calendar-tasks-v1";
  const $ = (id) => document.getElementById(id);
  const els = {
    monthLabel: $("monthLabel"), monthSummary: $("monthSummary"), grid: $("calendarGrid"),
    selectedDateLabel: $("selectedDateLabel"), selectedSummary: $("selectedSummary"),
    taskList: $("taskList"), emptyState: $("emptyState"), taskCount: $("taskCount"),
    progressText: $("progressText"), progressBar: $("progressBar"), taskForm: $("taskForm"),
    taskTitle: $("taskTitle"), taskDate: $("taskDate"), taskTime: $("taskTime"),
    addTaskBtn: $("addTaskBtn"), toast: $("toast"), backupPanel: $("backupPanel"), backupFileInput: $("backupFileInput"),
    calendarPanel: $("calendarPanel"), viewToggle: $("viewToggle"), allTasksControls: $("allTasksControls"), taskSearch: $("taskSearch"), statusFilter: $("statusFilter"), sortTasks: $("sortTasks"), viewTitle: $("viewTitle")
  };
  const today = new Date();
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const parseDate = (key) => { const [y,m,d] = key.split("-").map(Number); return new Date(y,m-1,d); };
  const prettyDate = (key, opts={weekday:"long", month:"long", day:"numeric", year:"numeric"}) =>
    parseDate(key).toLocaleDateString(undefined, opts);
  const todayKey = dateKey(today);
  let selectedDate = todayKey;
  let visibleYear = today.getFullYear();
  let visibleMonth = today.getMonth();
  let editingId = null;
  let currentView = "calendar";
  let toastTimer = null;
  let tasks = loadTasks();

  function loadTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(t => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.date === "string") : [];
    } catch { return []; }
  }
  function saveTasks() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
    catch { showToast("Could not save. Check device storage."); }
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }
  function tasksOn(key) { return tasks.filter(t => t.date === key); }
  function renderCalendar() {
    const first = new Date(visibleYear, visibleMonth, 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(visibleYear, visibleMonth, 1 - mondayOffset);
    els.monthLabel.textContent = first.toLocaleDateString(undefined, {month:"long", year:"numeric"});
    const monthTasks = tasks.filter(t => {
      const d = parseDate(t.date);
      return d.getFullYear() === visibleYear && d.getMonth() === visibleMonth;
    });
    const doneCount = monthTasks.filter(t => t.completed).length;
    els.monthSummary.textContent = `${monthTasks.length} ${monthTasks.length === 1 ? "task" : "tasks"} · ${doneCount} completed`;
    els.grid.innerHTML = "";
    for (let i=0; i<42; i++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
      const key = dateKey(day);
      const dayTasks = tasksOn(key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-day";
      btn.setAttribute("role","gridcell");
      btn.setAttribute("aria-label", `${prettyDate(key)}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`);
      if (day.getMonth() !== visibleMonth) btn.classList.add("other-month");
      if (key === todayKey) btn.classList.add("today");
      if (key === selectedDate) btn.classList.add("selected");
      const num = document.createElement("span");
      num.className = "day-number";
      num.textContent = day.getDate();
      btn.appendChild(num);
      const dots = document.createElement("span");
      dots.className = "day-dots";
      const maxDots = Math.min(dayTasks.length, 3);
      for (let j=0; j<maxDots; j++) {
        const dot = document.createElement("i");
        dot.className = "day-dot" + (dayTasks[j].completed ? " done" : "");
        dots.appendChild(dot);
      }
      btn.appendChild(dots);
      btn.addEventListener("click", () => {
        selectedDate = key;
        visibleYear = day.getFullYear();
        visibleMonth = day.getMonth();
        closeForm();
        render();
      });
      els.grid.appendChild(btn);
    }
  }
  function renderTasks() {
    const isAll = currentView === "all";
    const query = isAll ? (els.taskSearch?.value || "").trim().toLowerCase() : "";
    const status = isAll ? (els.statusFilter?.value || "all") : "all";
    const sort = els.sortTasks?.value || "date";
    let visible = isAll ? [...tasks] : tasksOn(selectedDate);
    visible = visible.filter(task => {
      const matchesQuery = !query || task.title.toLowerCase().includes(query);
      const matchesStatus = status === "all" ||
        (status === "completed" && task.completed) ||
        (status === "pending" && !task.completed) ||
        (status === "overdue" && !task.completed && task.date < todayKey);
      return matchesQuery && matchesStatus;
    });
    visible.sort((a,b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
      if (sort === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sort === "created") return (b.createdAt || 0) - (a.createdAt || 0);
      return a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99") || (a.createdAt || 0)-(b.createdAt || 0);
    });
    const allForProgress = isAll ? tasks : tasksOn(selectedDate);
    const done = allForProgress.filter(t => t.completed).length;
    const pct = allForProgress.length ? Math.round(done/allForProgress.length*100) : 0;
    els.selectedDateLabel.textContent = isAll ? "Every task" : prettyDate(selectedDate, {weekday:"short", month:"short", day:"numeric"});
    els.selectedSummary.textContent = isAll
      ? `${tasks.length} total · ${tasks.filter(t=>!t.completed).length} pending · ${done} completed`
      : (allForProgress.length ? `${done} of ${allForProgress.length} completed` : "A clear day is a good place to start.");
    els.progressText.textContent = `${pct}%`;
    els.progressBar.style.width = `${pct}%`;
    els.taskCount.textContent = `${visible.length} ${visible.length === 1 ? "task" : "tasks"}`;
    els.taskList.innerHTML = "";
    els.emptyState.hidden = visible.length > 0;
    const emptyHeading = els.emptyState.querySelector("h3");
    const emptyMessage = els.emptyState.querySelector("p");
    if (emptyHeading) emptyHeading.textContent = isAll ? "No matching tasks" : "Nothing planned for this day";
    if (emptyMessage) emptyMessage.textContent = isAll ? "Try changing your search or filters, or add a task." : "Add a task to get started, or choose another date.";
    for (const task of visible) {
      const item = document.createElement("div");
      item.className = "task-item" + (task.completed ? " completed" : "");
      const check = document.createElement("button");
      check.type = "button";
      check.className = "check-button";
      check.setAttribute("aria-pressed", String(!!task.completed));
      check.setAttribute("aria-label", task.completed ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`);
      check.textContent = task.completed ? "✓" : "";
      check.addEventListener("click", () => {
        task.completed = !task.completed;
        saveTasks(); render();
        showToast(task.completed ? "Task marked completed" : "Task marked incomplete");
      });
      const main = document.createElement("div");
      main.className = "task-main";
      const title = document.createElement("div");
      title.className = "task-title";
      title.textContent = task.title;
      main.appendChild(title);
      const meta = document.createElement("div");
      meta.className = "task-time";
      meta.textContent = `${prettyDate(task.date, {month:"short",day:"numeric",year:"numeric"})}${task.time ? " · " + formatTime(task.time) : ""}${!task.completed && task.date < todayKey ? " · Overdue" : ""}`;
      main.appendChild(meta);
      const actions = document.createElement("div");
      actions.className = "task-actions";
      const edit = document.createElement("button");
      edit.type = "button"; edit.className = "small-action"; edit.textContent = "✎";
      edit.setAttribute("aria-label", `Edit or reschedule ${task.title}`);
      edit.addEventListener("click", () => openForm(task));
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "small-action"; remove.textContent = "×";
      remove.setAttribute("aria-label", `Delete ${task.title}`);
      remove.addEventListener("click", () => {
        if (!confirm(`Delete “${task.title}”?`)) return;
        tasks = tasks.filter(t => t.id !== task.id);
        saveTasks(); render(); showToast("Task deleted");
      });
      actions.append(edit, remove);
      item.append(check, main, actions);
      els.taskList.appendChild(item);
    }
  }
  function formatTime(time) {
    const [h,m] = time.split(":").map(Number);
    return new Date(2000,0,1,h,m).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  }
  function openForm(task=null) {
    editingId = task ? task.id : null;
    els.taskForm.hidden = false;
    els.taskTitle.value = task ? task.title : "";
    els.taskDate.value = task ? task.date : selectedDate;
    els.taskTime.value = task ? (task.time || "") : "";
    els.taskForm.querySelector('button[type="submit"]').textContent = task ? "Save changes" : "Save task";
    els.addTaskBtn.textContent = "＋ Add task";
    els.taskTitle.focus();
  }
  function closeForm() {
    els.taskForm.hidden = true;
    els.taskForm.reset();
    editingId = null;
  }
  function render() {
    const isAll = currentView === "all";
    els.calendarPanel.hidden = isAll;
    els.allTasksControls.hidden = !isAll;
    els.viewTitle.textContent = isAll ? "All tasks" : "Tasks for";
    renderCalendar();
    renderTasks();
  }
  function setView(view) {
    currentView = view === "all" ? "all" : "calendar";
    els.viewToggle.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === currentView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    closeForm();
    render();
  }
  els.viewToggle.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  [els.taskSearch, els.statusFilter, els.sortTasks].forEach(control => control.addEventListener("input", renderTasks));
  [els.taskSearch, els.statusFilter, els.sortTasks].forEach(control => control.addEventListener("change", renderTasks));
  $("prevMonth").addEventListener("click", () => {
    visibleMonth--; if (visibleMonth < 0) { visibleMonth=11; visibleYear--; } renderCalendar();
  });
  $("nextMonth").addEventListener("click", () => {
    visibleMonth++; if (visibleMonth > 11) { visibleMonth=0; visibleYear++; } renderCalendar();
  });
  $("todayBtn").addEventListener("click", () => {
    selectedDate = todayKey; visibleYear = today.getFullYear(); visibleMonth = today.getMonth(); closeForm(); render();
  });
  els.addTaskBtn.addEventListener("click", () => openForm());
  $("emptyAddBtn").addEventListener("click", () => openForm());
  $("cancelTaskBtn").addEventListener("click", closeForm);
  els.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.taskTitle.value.trim();
    const date = els.taskDate.value;
    if (!title || !date) { showToast("Enter a task name and date"); return; }
    const wasEditing = Boolean(editingId);
    if (editingId) {
      const task = tasks.find(t => t.id === editingId);
      if (task) { task.title = title; task.date = date; task.time = els.taskTime.value; }
    } else {
      tasks.push({id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`), title, date, time: els.taskTime.value, completed:false, createdAt:Date.now()});
    }
    selectedDate = date;
    const d = parseDate(date); visibleYear = d.getFullYear(); visibleMonth = d.getMonth();
    saveTasks(); closeForm(); render(); showToast(wasEditing ? "Task updated" : "Task saved");
  });
  $("clearCompletedBtn").addEventListener("click", () => {
    const dayTasks = tasksOn(selectedDate);
    const completedIds = new Set(dayTasks.filter(t => t.completed).map(t => t.id));
    if (!completedIds.size) { showToast("No completed tasks to clear"); return; }
    if (!confirm(`Remove ${completedIds.size} completed ${completedIds.size === 1 ? "task" : "tasks"} from this day?`)) return;
    tasks = tasks.filter(t => !completedIds.has(t.id)); saveTasks(); render(); showToast("Completed tasks cleared");
  });
  function exportBackup() {
    const payload = {
      app: "Calendar Tasks",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      tasks: tasks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0,10);
    link.href = url;
    link.download = `calendar-tasks-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Backup downloaded (${tasks.length} ${tasks.length === 1 ? "task" : "tasks"})`);
  }
  function validateBackup(parsed) {
    const candidate = Array.isArray(parsed) ? parsed : parsed && parsed.tasks;
    if (!Array.isArray(candidate)) throw new Error("This file does not contain a Calendar Tasks backup.");
    const cleaned = [];
    const seen = new Set();
    for (const item of candidate) {
      if (!item || typeof item !== "object" || typeof item.title !== "string" || typeof item.date !== "string") {
        throw new Error("The backup contains an invalid task. Nothing was changed.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(parseDate(item.date).getTime())) {
        throw new Error("The backup contains an invalid task date. Nothing was changed.");
      }
      const id = typeof item.id === "string" && item.id.trim() ? item.id : `restored-${Date.now()}-${cleaned.length}`;
      if (seen.has(id)) throw new Error("The backup contains duplicate task IDs. Nothing was changed.");
      seen.add(id);
      cleaned.push({
        id,
        title: item.title.trim().slice(0,180),
        date: item.date,
        time: typeof item.time === "string" && /^\d{2}:\d{2}$/.test(item.time) ? item.time : "",
        completed: item.completed === true,
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now() + cleaned.length
      });
      if (!cleaned[cleaned.length-1].title) throw new Error("The backup contains an empty task name. Nothing was changed.");
    }
    return cleaned;
  }
  async function restoreBackup(file) {
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const restored = validateBackup(parsed);
      const message = `Restore ${restored.length} ${restored.length === 1 ? "task" : "tasks"} from this backup?\\n\\nThis replaces all tasks currently stored on this device. This cannot be undone.`;
      if (!confirm(message)) return;
      tasks = restored;
      saveTasks();
      closeForm();
      selectedDate = restored.length ? restored[0].date : todayKey;
      const selected = parseDate(selectedDate);
      visibleYear = selected.getFullYear();
      visibleMonth = selected.getMonth();
      render();
      showToast(`Restored ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`);
      els.backupPanel.hidden = true;
    } catch (error) {
      if (error instanceof SyntaxError) showToast("That file is not valid JSON");
      else showToast(error && error.message ? error.message : "Could not restore this backup");
    } finally {
      els.backupFileInput.value = "";
    }
  }
  $("backupBtn").addEventListener("click", () => {
    els.backupPanel.hidden = !els.backupPanel.hidden;
    if (!els.backupPanel.hidden) els.backupPanel.scrollIntoView({behavior:"smooth", block:"nearest"});
  });
  $("closeBackupBtn").addEventListener("click", () => { els.backupPanel.hidden = true; });
  $("exportBackupBtn").addEventListener("click", exportBackup);
  $("chooseBackupBtn").addEventListener("click", () => els.backupFileInput.click());
  els.backupFileInput.addEventListener("change", () => restoreBackup(els.backupFileInput.files && els.backupFileInput.files[0]));
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => showToast("Offline mode could not be enabled yet")));
  }
  render();
})();
