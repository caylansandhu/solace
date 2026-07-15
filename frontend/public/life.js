/* ============ LIFE HUB — Unified Habits / Skills / Goals ============ */
(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if(cls) n.className = cls; if(html!=null) n.innerHTML = html; return n; };
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const toISO = (d) => new Date(d).toISOString().slice(0,10);
  const today = () => toISO(new Date());
  const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = (iso) => { if(!iso) return "—"; const d = new Date(iso+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); };
  const fmtDateShort = (iso) => { if(!iso) return "—"; const d = new Date(iso+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}); };
  const daysBetween = (a,b) => Math.round((new Date(b+"T00:00:00") - new Date(a+"T00:00:00"))/86400000);

  const KEY = "life_items_v1";

  const state = {
    editMode: false,
    view: "list", // list | history
    filter: null, // 'habit' | 'skill' | 'goal' | null (all)
    items: read(KEY, []),
    modalOpen: false,
  };

  function save(){ write(KEY, state.items); }

  // ============ TOAST + MODAL (self-contained, styled to match) ============
  let toastTimer = null;
  function toast(msg){
    let t = document.querySelector(".life-toast");
    if(!t){ t = el("div","life-toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove("show"), 2000);
  }

  // ============ SETTINGS PANEL (Add/Edit) ============
  function openItemPanel(item){
    const isNew = !item;
    const it = item ? {...item} : { id: uid(), type: state.filter || "habit", name: "", order: nextOrder(), recurring: (state.filter||"habit")==="habit", frequency:"daily", customDays: 2, target: "", countMode: "up", deadline: "", completions: [], completed: false, createdAt: today() };
    let ov = document.querySelector(".life-modal-overlay");
    if(!ov){ ov = el("div","life-modal-overlay"); document.body.appendChild(ov); }
    renderPanel(ov, it, isNew);
    requestAnimationFrame(()=> ov.classList.add("open"));
    ov.addEventListener("click",(e)=>{ if(e.target === ov) closePanel(); });
  }

  function renderPanel(ov, it, isNew){
    // Determine constraints per type
    const isHabit = it.type === "habit";
    const isGoal  = it.type === "goal";
    const isSkill = it.type === "skill";
    // Habit: always recurring. Goal: never recurring. Skill: optional.
    if(isHabit) it.recurring = true;
    if(isGoal)  it.recurring = false;

    ov.innerHTML = `
      <div class="life-modal" role="dialog" aria-modal="true" data-testid="life-panel">
        <div class="life-modal-head">
          <div class="life-modal-title">${isNew?"New item":"Edit item"}</div>
          <button type="button" class="life-modal-close" data-close data-testid="panel-close" aria-label="Close">✕</button>
        </div>

        <div class="life-field">
          <label class="life-label">Name</label>
          <input type="text" class="life-input" data-field="name" placeholder="e.g. Meditate 10 minutes" value="${escapeHtml(it.name)}" data-testid="panel-name" autofocus>
        </div>

        <div class="life-field">
          <label class="life-label">Type</label>
          <div class="life-seg" data-testid="panel-type">
            <button type="button" class="life-seg-btn ${isHabit?"active":""}" data-type="habit" data-testid="type-habit">Habit</button>
            <button type="button" class="life-seg-btn ${isSkill?"active":""}" data-type="skill" data-testid="type-skill">Skill</button>
            <button type="button" class="life-seg-btn ${isGoal?"active":""}" data-type="goal" data-testid="type-goal">Goal</button>
          </div>
        </div>

        ${isSkill ? `
          <div class="life-field">
            <div class="life-row-between">
              <label class="life-label" style="margin:0">Recurring</label>
              <button type="button" class="life-toggle ${it.recurring?"on":""}" data-toggle-recurring data-testid="panel-recurring">
                <span></span>
              </button>
            </div>
            <div class="life-help">On: repeats like a habit. Off: one-time goal with deadline.</div>
          </div>
        ` : ""}

        ${(isHabit || (isSkill && it.recurring)) ? `
          <div class="life-field">
            <label class="life-label">Frequency</label>
            <select class="life-input" data-field="frequency" data-testid="panel-frequency">
              <option value="daily" ${it.frequency==="daily"?"selected":""}>Daily</option>
              <option value="every-2-days" ${it.frequency==="every-2-days"?"selected":""}>Every 2 days</option>
              <option value="weekly" ${it.frequency==="weekly"?"selected":""}>Weekly</option>
              <option value="custom" ${it.frequency==="custom"?"selected":""}>Custom</option>
            </select>
            <div class="life-field ${it.frequency==="custom"?"":"life-hide"}" data-custom-days-wrap style="margin-top:10px">
              <label class="life-label">Every N days</label>
              <input type="number" min="1" max="365" class="life-input" data-field="customDays" value="${it.customDays||2}" data-testid="panel-custom-days">
            </div>
          </div>
        ` : ""}

        ${(isGoal || (isSkill && !it.recurring)) ? `
          <div class="life-field">
            <label class="life-label">Target date</label>
            <input type="date" class="life-input" data-field="deadline" value="${it.deadline||""}" data-testid="panel-deadline">
          </div>
          <div class="life-field">
            <label class="life-label">Count</label>
            <div class="life-seg" data-testid="panel-count">
              <button type="button" class="life-seg-btn ${it.countMode==="up"?"active":""}" data-count="up" data-testid="count-up">Count up</button>
              <button type="button" class="life-seg-btn ${it.countMode==="down"?"active":""}" data-count="down" data-testid="count-down">Count down</button>
            </div>
            <div class="life-help">Count up: accumulate progress toward target. Count down: time-remaining focus.</div>
          </div>
          <div class="life-field">
            <label class="life-label">Target amount (optional)</label>
            <input type="number" min="0" step="1" class="life-input" data-field="target" placeholder="e.g. 100" value="${it.target||""}" data-testid="panel-target">
            <div class="life-help">Leave blank if no numeric target — completion becomes a simple checkbox.</div>
          </div>
        ` : ""}

        <div class="life-modal-actions">
          <button type="button" class="life-btn life-btn-ghost" data-close data-testid="panel-cancel">Cancel</button>
          <button type="button" class="life-btn life-btn-primary" data-save data-testid="panel-save">Save</button>
        </div>
      </div>
    `;

    // Bindings
    ov.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closePanel));
    ov.querySelectorAll("[data-field]").forEach(inp => inp.addEventListener("input", (e)=>{
      let v = e.target.value;
      if(e.target.type === "number") v = v === "" ? "" : Number(v);
      it[e.target.dataset.field] = v;
      // Custom days visibility
      if(e.target.dataset.field === "frequency"){
        const wrap = ov.querySelector("[data-custom-days-wrap]");
        if(wrap) wrap.classList.toggle("life-hide", v !== "custom");
      }
    }));
    ov.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", ()=>{
      it.type = b.dataset.type;
      renderPanel(ov, it, isNew);
    }));
    ov.querySelectorAll("[data-count]").forEach(b => b.addEventListener("click", ()=>{
      it.countMode = b.dataset.count;
      ov.querySelectorAll("[data-count]").forEach(x => x.classList.toggle("active", x === b));
    }));
    const rt = ov.querySelector("[data-toggle-recurring]");
    if(rt){ rt.addEventListener("click", ()=>{ it.recurring = !it.recurring; renderPanel(ov, it, isNew); }); }
    ov.querySelector("[data-save]").addEventListener("click", ()=>{
      if(!it.name || !it.name.trim()){ toast("Name is required"); return; }
      it.name = it.name.trim();
      if(isNew){
        state.items.push(it);
      } else {
        const idx = state.items.findIndex(x => x.id === it.id);
        if(idx >= 0) state.items[idx] = it;
      }
      save();
      closePanel();
      toast(isNew ? "Added" : "Saved");
      render();
    });
  }

  function closePanel(){
    const ov = document.querySelector(".life-modal-overlay");
    if(!ov) return;
    ov.classList.remove("open");
    setTimeout(()=> ov.remove(), 220);
  }

  function nextOrder(){
    return (state.items.reduce((m,i)=> Math.max(m, i.order||0), 0)) + 1;
  }

  // ============ COMPLETION LOGIC ============
  function isRecurring(it){ return it.type === "habit" || (it.type === "skill" && it.recurring); }
  function isDoneToday(it){ return isRecurring(it) && (it.completions||[]).includes(today()); }
  function completeRecurringToggle(it){
    it.completions = it.completions || [];
    const t = today();
    const idx = it.completions.indexOf(t);
    if(idx >= 0) it.completions.splice(idx,1);
    else it.completions.push(t);
    save(); render();
  }
  function completeOneShotToggle(it){
    it.completed = !it.completed;
    it.completedAt = it.completed ? today() : null;
    save(); render();
    if(it.completed) toast("Completed");
  }

  // ============ STREAK ============
  function getStreak(it){
    if(!isRecurring(it)) return 0;
    const set = new Set(it.completions||[]);
    if(!set.size) return 0;
    let streak = 0;
    const d = new Date();
    // Determine step in days per frequency
    const step = freqStep(it);
    for(let i = 0; i < 400; i++){
      const iso = toISO(d);
      if(set.has(iso)){ streak++; d.setDate(d.getDate() - step); }
      else {
        // If today not done but yesterday was, allow the streak to include yesterday's chain (for daily)
        if(i === 0){ d.setDate(d.getDate() - step); continue; }
        break;
      }
    }
    return streak;
  }
  function freqStep(it){
    if(it.frequency === "daily") return 1;
    if(it.frequency === "every-2-days") return 2;
    if(it.frequency === "weekly") return 7;
    if(it.frequency === "custom") return Math.max(1, Number(it.customDays)||1);
    return 1;
  }

  // ============ PROGRESS ============
  function getProgress(it){
    // Returns { pct, label } for skills/goals with target OR countdown-timeline
    if(isRecurring(it)) return null;
    if(it.completed) return { pct: 100, label: "Completed" };
    if(it.target && Number(it.target) > 0){
      const cnt = (it.progressCount || 0);
      const pct = Math.min(100, Math.round((cnt / Number(it.target)) * 100));
      return { pct, label: `${cnt} / ${it.target}` };
    }
    if(it.deadline){
      const now = today();
      const remaining = daysBetween(now, it.deadline);
      if(it.countMode === "down"){
        // Progress based on elapsed
        const total = daysBetween(it.createdAt || now, it.deadline);
        const elapsed = total - remaining;
        const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
        return { pct, label: `${remaining < 0 ? "Overdue" : remaining + " days left"}` };
      } else {
        // Count up: unknown until numeric target — show elapsed
        return { pct: 0, label: `${remaining < 0 ? "Overdue" : remaining + " days left"}` };
      }
    }
    return null;
  }

  function incrementProgress(it, delta){
    it.progressCount = Math.max(0, (it.progressCount||0) + delta);
    if(it.target && it.progressCount >= Number(it.target)){
      it.completed = true;
      it.completedAt = today();
      toast("Goal reached!");
    }
    save(); render();
  }

  // ============ SORTING ============
  function sortedActive(){
    const active = state.items.filter(i => !i.completed);
    // Apply filter if set
    const filtered = state.filter ? active.filter(i => i.type === state.filter) : active;
    // Manual-order group: habits + recurring skills
    const manual = filtered.filter(i => isRecurring(i))
      .sort((a,b) => (a.order||0) - (b.order||0));
    // Deadline-sort group: goals + non-recurring skills
    const deadline = filtered.filter(i => !isRecurring(i))
      .sort((a,b) => {
        const ad = a.deadline || "9999-12-31";
        const bd = b.deadline || "9999-12-31";
        return ad.localeCompare(bd);
      });
    return { manual, deadline };
  }

  function completedHistory(){
    return state.items
      .filter(i => i.completed && !isRecurring(i))
      .sort((a,b) => (b.completedAt||"").localeCompare(a.completedAt||""));
  }

  // ============ RENDER ============
  function render(){
    const roots = document.querySelectorAll(".life-root");
    if(!roots.length) return;
    roots.forEach(root => {
      state.filter = root.dataset.filter || null;
      root.innerHTML = state.view === "history" ? renderHistory() : renderList();
      attachHandlers(root);
    });
  }

  function typeMeta(t){
    return t === "habit" ? { label:"Habit", ico:"◐", cls:"habit" }
         : t === "skill" ? { label:"Skill", ico:"✦", cls:"skill" }
         :                 { label:"Goal",  ico:"◎", cls:"goal" };
  }

  function pageTitle(){
    if(state.filter === "habit") return "Habits";
    if(state.filter === "skill") return "Skills";
    if(state.filter === "goal")  return "Goals";
    return "Life";
  }

  function renderList(){
    const { manual, deadline } = sortedActive();
    const total = manual.length + deadline.length;
    return `
      <div class="life-header">
        <div>
          <div class="life-eyebrow">Life</div>
          <h1 class="life-title" data-testid="life-title">${pageTitle()}</h1>
          <div class="life-sub">${total} active · ${state.items.filter(i=>i.completed).length} completed</div>
        </div>
        <div class="life-header-actions">
          <button type="button" class="life-icon-btn ${state.view==="history"?"active":""}" data-view="history" data-testid="view-history" aria-label="History" title="History">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </button>
          <button type="button" class="life-icon-btn ${state.editMode?"active":""}" data-toggle-edit data-testid="toggle-edit" aria-label="Edit" title="Edit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
      </div>

      ${total === 0 ? `
        <div class="life-empty" data-testid="life-empty">
          <div class="life-empty-ico">◇</div>
          <div class="life-empty-title">Nothing here yet</div>
          <div class="life-empty-sub">Tap the edit pencil, then <strong>+</strong> to add your first item.</div>
        </div>
      ` : ""}

      ${manual.length ? `
        <div class="life-section">
          <div class="life-section-head">
            <span class="life-section-title">Recurring</span>
            <span class="life-section-hint">${state.editMode ? "Hold & drag to reorder" : "Streak-tracked"}</span>
          </div>
          <div class="life-list" data-list="manual" data-testid="list-manual">
            ${manual.map((it,i) => renderItem(it, i, "manual")).join("")}
          </div>
        </div>
      ` : ""}

      ${deadline.length ? `
        <div class="life-section">
          <div class="life-section-head">
            <span class="life-section-title">Targets</span>
            <span class="life-section-hint">By soonest deadline</span>
          </div>
          <div class="life-list" data-list="deadline" data-testid="list-deadline">
            ${deadline.map((it,i) => renderItem(it, i, "deadline")).join("")}
          </div>
        </div>
      ` : ""}

      ${state.editMode ? `
        <button type="button" class="life-fab" data-action="add" data-testid="add-item-fab" aria-label="Add">
          <span>+</span>
        </button>
      ` : ""}
    `;
  }

  function renderItem(it, i, listKind){
    const meta = typeMeta(it.type);
    const done = isDoneToday(it);
    const recurring = isRecurring(it);
    const streak = recurring ? getStreak(it) : 0;
    const progress = getProgress(it);
    return `
      <div class="life-item ${state.editMode?"edit":""}" data-id="${it.id}" data-drag-idx="${i}" data-testid="item-${it.id}">
        <div class="life-item-drag ${state.editMode?"":"hidden"}" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="life-item-ico ${meta.cls}" title="${meta.label}">${meta.ico}</div>
        <div class="life-item-body">
          <div class="life-item-name">${escapeHtml(it.name)}</div>
          <div class="life-item-meta">
            <span class="life-item-badge ${meta.cls}">${meta.label}</span>
            ${recurring ? `<span class="life-item-freq">${freqLabel(it)}</span>` : (it.deadline?`<span class="life-item-freq">Due ${fmtDateShort(it.deadline)}</span>`:"")}
            ${streak > 0 ? `<span class="life-item-streak" data-testid="streak-${it.id}">🔥 ${streak}</span>` : ""}
          </div>
          ${progress ? `
            <div class="life-progress">
              <div class="life-progress-bar"><div class="life-progress-fill" style="width:${progress.pct}%"></div></div>
              <div class="life-progress-row">
                <span class="life-progress-label">${escapeHtml(progress.label)}</span>
                <span class="life-progress-pct">${progress.pct}%</span>
              </div>
            </div>
            ${!state.editMode && it.target && Number(it.target) > 0 && !it.completed ? `
              <div class="life-progress-actions">
                <button type="button" class="life-mini-btn" data-inc="${it.id}" data-delta="-1" data-testid="inc-minus-${it.id}">−</button>
                <button type="button" class="life-mini-btn" data-inc="${it.id}" data-delta="1" data-testid="inc-plus-${it.id}">+</button>
              </div>
            ` : ""}
          ` : ""}
        </div>
        ${state.editMode ? `
          <div class="life-item-edit-actions">
            <button type="button" class="life-icon-btn small" data-edit="${it.id}" data-testid="edit-${it.id}" aria-label="Edit">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="life-icon-btn small danger" data-delete="${it.id}" data-testid="delete-${it.id}" aria-label="Delete">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        ` : `
          <button type="button" class="life-item-toggle ${done||it.completed?"on":""}" data-toggle="${it.id}" data-testid="toggle-${it.id}" aria-label="Toggle complete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        `}
      </div>
    `;
  }

  function freqLabel(it){
    if(it.frequency === "daily") return "Daily";
    if(it.frequency === "every-2-days") return "Every 2 days";
    if(it.frequency === "weekly") return "Weekly";
    if(it.frequency === "custom") return `Every ${it.customDays||2} days`;
    return "Recurring";
  }

  function renderHistory(){
    const history = completedHistory();
    return `
      <div class="life-header">
        <div>
          <div class="life-eyebrow">History</div>
          <h1 class="life-title" data-testid="history-title">Completed</h1>
          <div class="life-sub">${history.length} completed items</div>
        </div>
        <div class="life-header-actions">
          <button type="button" class="life-icon-btn" data-view="list" data-testid="back-list" aria-label="Back">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        </div>
      </div>
      ${history.length ? `
        <div class="life-list" data-testid="history-list">
          ${history.map(it=>{
            const meta = typeMeta(it.type);
            return `
              <div class="life-item" data-testid="history-item-${it.id}">
                <div class="life-item-ico ${meta.cls}">${meta.ico}</div>
                <div class="life-item-body">
                  <div class="life-item-name">${escapeHtml(it.name)}</div>
                  <div class="life-item-meta">
                    <span class="life-item-badge ${meta.cls}">${meta.label}</span>
                    <span class="life-item-freq">Completed ${fmtDate(it.completedAt||"")}</span>
                  </div>
                </div>
                <button type="button" class="life-icon-btn small" data-restore="${it.id}" data-testid="restore-${it.id}" aria-label="Restore">↺</button>
              </div>
            `;
          }).join("")}
        </div>
      ` : `<div class="life-empty"><div class="life-empty-ico">◇</div><div class="life-empty-title">Nothing completed yet</div><div class="life-empty-sub">Finish a goal or a non-recurring skill and it will appear here.</div></div>`}
    `;
  }

  // ============ HANDLERS ============
  function attachHandlers(root){
    root.querySelectorAll("[data-toggle-edit]").forEach(b => b.addEventListener("click", ()=>{ state.editMode = !state.editMode; render(); }));
    root.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", ()=>{ state.view = b.dataset.view; render(); }));
    root.querySelectorAll("[data-action='add']").forEach(b => b.addEventListener("click", ()=> openItemPanel(null)));

    // Toggle complete
    root.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", (e)=>{
      const id = b.dataset.toggle;
      const it = state.items.find(x => x.id === id);
      if(!it) return;
      if(isRecurring(it)) completeRecurringToggle(it);
      else completeOneShotToggle(it);
    }));

    // Increment progress
    root.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", ()=>{
      const it = state.items.find(x => x.id === b.dataset.inc);
      if(it) incrementProgress(it, Number(b.dataset.delta));
    }));

    // Edit
    root.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", ()=>{
      const it = state.items.find(x => x.id === b.dataset.edit);
      if(it) openItemPanel(it);
    }));

    // Delete
    root.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", ()=>{
      const id = b.dataset.delete;
      const it = state.items.find(x => x.id === id);
      if(!it) return;
      if(!confirm(`Delete "${it.name}" permanently?`)) return;
      state.items = state.items.filter(x => x.id !== id);
      save(); toast("Deleted"); render();
    }));

    // Restore from history
    root.querySelectorAll("[data-restore]").forEach(b => b.addEventListener("click", ()=>{
      const it = state.items.find(x => x.id === b.dataset.restore);
      if(!it) return;
      it.completed = false;
      it.completedAt = null;
      save(); render();
    }));

    // Drag reorder (only for manual list in edit mode)
    if(state.editMode){
      root.querySelectorAll("[data-list='manual']").forEach(list => attachDrag(list));
    }
  }

  // ============ DRAG REORDER ============
  function attachDrag(list){
    const items = Array.from(list.querySelectorAll("[data-drag-idx]"));
    items.forEach(item => {
      let holdTimer = null;
      let dragging = false;
      let placeholder = null;
      let startY = 0, startX = 0;

      const onDown = (e) => {
        if(e.target.closest("[data-edit], [data-delete], [data-toggle], [data-inc]")) return;
        if(e.pointerType === "mouse" && e.button !== 0) return;
        startY = e.clientY; startX = e.clientX;
        holdTimer = setTimeout(()=> beginDrag(e), 380);
      };

      const beginDrag = (e) => {
        dragging = true;
        item.setPointerCapture?.(e.pointerId);
        const rect = item.getBoundingClientRect();
        placeholder = document.createElement("div");
        placeholder.style.height = rect.height + "px";
        placeholder.style.background = "var(--accent-soft, rgba(255,255,255,0.06))";
        placeholder.style.borderRadius = "14px";
        placeholder.style.border = "1px dashed var(--accent)";
        placeholder.style.marginBottom = getComputedStyle(item).marginBottom;
        item.parentNode.insertBefore(placeholder, item);
        item.classList.add("dragging");
        item.style.position = "fixed";
        item.style.zIndex = "9999";
        item.style.left = rect.left + "px";
        item.style.top = rect.top + "px";
        item.style.width = rect.width + "px";
        item.style.pointerEvents = "none";
        item.style.transform = "scale(1.02)";
        item.style.boxShadow = "0 16px 40px rgba(0,0,0,0.5)";
        if(navigator.vibrate) navigator.vibrate(15);
      };

      const onMove = (e) => {
        if(!dragging){
          if(Math.abs(e.clientX-startX)>8 || Math.abs(e.clientY-startY)>8){ clearTimeout(holdTimer); }
          return;
        }
        e.preventDefault();
        const rect = item.getBoundingClientRect();
        const dy = e.clientY - (rect.top + rect.height/2);
        item.style.top = (parseFloat(item.style.top) + dy) + "px";
        const siblings = Array.from(list.querySelectorAll("[data-drag-idx]")).filter(x => x !== item);
        for(const sib of siblings){
          const r = sib.getBoundingClientRect();
          if(e.clientY < r.top + r.height/2){ list.insertBefore(placeholder, sib); return; }
        }
        list.appendChild(placeholder);
      };

      const onUp = () => {
        clearTimeout(holdTimer);
        if(!dragging) return;
        placeholder.parentNode.replaceChild(item, placeholder);
        item.classList.remove("dragging");
        item.style.cssText = "";
        dragging = false;
        // Commit order
        const ids = Array.from(list.querySelectorAll("[data-id]")).map(n => n.dataset.id);
        // Rewrite order fields on the actually-shown manual items
        let cursor = 1;
        ids.forEach(id => { const it = state.items.find(x => x.id === id); if(it){ it.order = cursor++; } });
        save(); render();
      };

      item.addEventListener("pointerdown", onDown);
      item.addEventListener("pointermove", onMove);
      item.addEventListener("pointerup", onUp);
      item.addEventListener("pointercancel", onUp);
    });
  }

  // ============ EXPORT ============
  window.LifeHub = { render, state, openItemPanel };

  window.addEventListener("accentchange", () => {
    if(document.querySelector(".life-root")) render();
  });

  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(render, 100);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(render, 100));
  }
})();
