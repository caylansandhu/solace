/* ============ TRAINING TAB ============ */
(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if(cls) n.className = cls; if(html!=null) n.innerHTML = html; return n; };
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
  const toISO = (d) => new Date(d).toISOString().slice(0,10);
  const today = () => toISO(new Date());
  const fmtDate = (iso) => { const d = new Date(iso+"T00:00:00"); return d.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}); };
  const dayName = (iso) => new Date(iso+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"});
  const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const KEYS = {
    programs: "tr_programs_v1",
    workouts: "tr_workouts_v1",
    photos: "tr_photos_v1",
    weights: "tr_bodyweight_v1",
    benchTips: "tr_bench_tips_v1",
    current: "tr_current_workout_v1",
    goals: "tr_goals_v1",
    prefs: "tr_prefs_v1",
  };

  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const BODY_PARTS = ["Chest","Back","Shoulders","Biceps","Triceps","Quads","Hamstrings","Glutes","Calves","Core"];

  const defaultProgram = () => DAYS.map(d => ({ day: d, name: "", exercises: [], rest: d==="Sun" }));

  const state = {
    tab: "home",
    selectedDate: today(),
    data: {
      programs: read(KEYS.programs, defaultProgram()),
      workouts: read(KEYS.workouts, []),
      photos: read(KEYS.photos, []),
      weights: read(KEYS.weights, []),
      benchTips: read(KEYS.benchTips, []),
      current: read(KEYS.current, null),
      goals: read(KEYS.goals, []),
      prefs: read(KEYS.prefs, { unit: "kg" }),
    },
  };

  function save(key){ write(KEYS[key], state.data[key]); }
  function saveAll(){ Object.keys(KEYS).forEach(k => write(KEYS[k], state.data[k])); }

  // ============ TOAST ============
  let toastTimer = null;
  function toast(msg){
    let t = document.querySelector(".tr-toast");
    if(!t){ t = el("div","tr-toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove("show"), 2200);
  }

  // ============ MODAL ============
  function openModal(title, sub, bodyHtml, actions){
    let ov = document.querySelector(".tr-modal-overlay");
    if(!ov){ ov = el("div","tr-modal-overlay"); document.body.appendChild(ov); }
    ov.innerHTML = `
      <div class="tr-modal" role="dialog" aria-modal="true">
        <div class="tr-modal-title">${escapeHtml(title)}</div>
        ${sub?`<div class="tr-modal-sub">${escapeHtml(sub)}</div>`:""}
        <div class="tr-modal-body">${bodyHtml||""}</div>
        <div class="tr-modal-actions">${(actions||[]).map(a=>`<button type="button" class="tr-btn ${a.primary?"tr-btn-primary":"tr-btn-ghost"}" data-act="${a.id}" data-testid="modal-btn-${a.id}">${escapeHtml(a.label)}</button>`).join("")}</div>
      </div>`;
    requestAnimationFrame(()=> ov.classList.add("open"));
    return new Promise(resolve => {
      const close = (result)=> { ov.classList.remove("open"); setTimeout(()=> ov.remove(), 240); resolve(result); };
      ov.addEventListener("click", (e)=> {
        if(e.target === ov) return close(null);
        const btn = e.target.closest("[data-act]");
        if(btn){
          const act = btn.dataset.act;
          const inputs = {};
          ov.querySelectorAll("[data-modal-field]").forEach(i => inputs[i.dataset.modalField] = i.value);
          close({ action: act, inputs });
        }
      });
    });
  }

  // ============ RENDER ============
  function render(){
    const root = $("trainingRoot") || $("fitnessRoot");
    if(!root) return;
    root.innerHTML = renderHeader() + renderTabs() + `<div class="tr-body">${renderTabContent()}</div>`;
    attachHandlers(root);
  }

  function renderHeader(){
    const d = new Date();
    const dow = d.toLocaleDateString(undefined,{weekday:"long"});
    const dateStr = d.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});
    return `
      <div class="tr-header">
        <div class="tr-eyebrow">Training</div>
        <div class="tr-title tr-title-lg" data-testid="training-title">Progress in motion.</div>
        <div class="tr-date">
          <span class="tr-date-day">${dow}</span>
          <span class="tr-date-dot"></span>
          <span>${dateStr}</span>
        </div>
      </div>`;
  }

  const TABS = [
    {id:"home", label:"Home"},
    {id:"workouts", label:"Workouts"},
    {id:"progress", label:"Progress"},
    {id:"programs", label:"Programs"},
    {id:"bench", label:"Bench"},
    {id:"calendar", label:"Calendar"},
  ];

  function renderTabs(){
    return `<div class="tr-tabs" role="tablist" data-testid="training-tabs">
      ${TABS.map(t=>`<button type="button" class="tr-tab ${state.tab===t.id?"active":""}" data-tab="${t.id}" data-testid="tab-${t.id}">${t.label}</button>`).join("")}
    </div>`;
  }

  function renderTabContent(){
    switch(state.tab){
      case "home": return renderHome();
      case "workouts": return renderWorkouts();
      case "progress": return renderProgress();
      case "programs": return renderPrograms();
      case "bench": return renderBench();
      case "calendar": return renderCalendar();
      default: return "";
    }
  }

  // ============ HOME ============
  function renderHome(){
    const nextWorkout = getNextWorkout();
    const upcoming = getUpcoming(5);
    const completed = state.data.workouts.slice().sort((a,b)=> b.date.localeCompare(a.date)).slice(0,5);
    const cur = state.data.current;

    // Date scrubber (7 days)
    const dates = [];
    for(let i=-2;i<=4;i++){
      const d = new Date(); d.setDate(d.getDate()+i);
      const iso = toISO(d);
      dates.push({ iso, day: d.toLocaleDateString(undefined,{weekday:"short"}), num: d.getDate(), isToday: iso===today() });
    }

    const doneSet = new Set(state.data.workouts.map(w=> w.date));

    return `
      <div class="tr-section">
        <div class="tr-date-strip" data-testid="date-strip">
          ${dates.map(d=>`
            <button type="button" class="tr-date-pill ${d.iso===state.selectedDate?"active":""} ${doneSet.has(d.iso)?"done":""}" data-date="${d.iso}" data-testid="date-pill-${d.iso}">
              <span class="tr-date-pill-day">${d.day}</span>
              <span class="tr-date-pill-num">${d.num}</span>
            </button>`).join("")}
        </div>
      </div>

      <div class="tr-section">
        <div class="tr-next-hero" data-testid="next-workout-hero">
          <div class="tr-next-label">${cur ? "In progress" : "Next workout"}</div>
          <div class="tr-next-name">${escapeHtml(cur ? cur.name : (nextWorkout?.name || "Rest day"))}</div>
          <div class="tr-next-meta">${cur ? (cur.exercises.length+" exercises · started "+timeAgo(cur.startedAt)) : (nextWorkout ? (nextWorkout.exercises.length+" exercises planned · "+nextWorkout.day) : "Plan your week in Programs")}</div>
          <div class="tr-next-actions">
            ${cur
              ? `<button type="button" class="tr-btn tr-btn-primary" data-action="resume-workout" data-testid="resume-workout-btn">Resume</button>
                 <button type="button" class="tr-btn tr-btn-ghost" data-action="cancel-workout" data-testid="cancel-workout-btn">Discard</button>`
              : `<button type="button" class="tr-btn tr-btn-primary" data-action="start-workout" data-testid="start-workout-btn">Start workout</button>
                 <button type="button" class="tr-btn tr-btn-ghost" data-action="go-programs" data-testid="edit-plan-btn">Edit plan</button>`
            }
          </div>
        </div>
      </div>

      <div class="tr-section">
        <div class="tr-section-head">
          <div class="tr-section-title">Explore</div>
        </div>
        <div class="tr-nav-cards">
          ${[
            {id:"workouts",title:"Workouts",sub:"Log your session",ico:"⚡"},
            {id:"progress",title:"Progress",sub:"PRs · photos · trends",ico:"↗"},
            {id:"programs",title:"Programs",sub:"Weekly split",ico:"◱"},
            {id:"bench",title:"Bench",sub:"Dedicated lift focus",ico:"▬"},
            {id:"calendar",title:"Calendar",sub:"History & heatmap",ico:"▦"},
          ].map(c=>`
            <button type="button" class="tr-nav-card" data-nav="${c.id}" data-testid="nav-card-${c.id}">
              <div class="tr-nav-card-ico">${c.ico}</div>
              <div class="tr-nav-card-title">${c.title}</div>
              <div class="tr-nav-card-sub">${c.sub}</div>
            </button>`).join("")}
        </div>
      </div>

      <div class="tr-section">
        <div class="tr-section-head">
          <div class="tr-section-title">Upcoming sessions</div>
        </div>
        ${upcoming.length ? `<div class="tr-list" data-testid="upcoming-list">
          ${upcoming.map(u=>`
            <div class="tr-list-item">
              <div class="tr-list-icon">${escapeHtml((u.name||"?").slice(0,1).toUpperCase())}</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${escapeHtml(u.name||"Workout")}</div>
                <div class="tr-list-sub">${escapeHtml(u.dateLabel)} · ${u.exercises.length} exercises</div>
              </div>
              <div class="tr-list-value">${escapeHtml(u.day)}</div>
            </div>`).join("")}
        </div>` : `<div class="tr-empty" data-testid="upcoming-empty">Add exercises to your weekly split in <strong>Programs</strong> to see upcoming sessions.</div>`}
      </div>

      <div class="tr-section">
        <div class="tr-section-head">
          <div class="tr-section-title">Recently completed</div>
        </div>
        ${completed.length ? `<div class="tr-list" data-testid="completed-list">
          ${completed.map(w=>{
            const vol = totalVolume(w);
            return `<div class="tr-list-item" data-view-workout="${w.id}">
              <div class="tr-list-icon">✓</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${escapeHtml(w.name||"Workout")}</div>
                <div class="tr-list-sub">${fmtDate(w.date)} · ${w.exercises.length} exercises</div>
              </div>
              <div class="tr-list-value">${vol ? vol+" "+state.data.prefs.unit : "—"}</div>
            </div>`;
          }).join("")}
        </div>` : `<div class="tr-empty">No completed workouts yet. Tap <strong>Start workout</strong> above.</div>`}
      </div>
    `;
  }

  function timeAgo(ts){
    if(!ts) return "just now";
    const s = Math.floor((Date.now() - ts)/1000);
    if(s < 60) return "just now";
    if(s < 3600) return Math.floor(s/60)+"m ago";
    if(s < 86400) return Math.floor(s/3600)+"h ago";
    return Math.floor(s/86400)+"d ago";
  }

  function getNextWorkout(){
    // find next non-rest day starting today
    const todayDow = (new Date().getDay()+6)%7; // Mon=0
    for(let i=0;i<7;i++){
      const idx = (todayDow+i)%7;
      const p = state.data.programs[idx];
      if(p && !p.rest && p.exercises.length){ return { ...p, dayIndex: idx }; }
    }
    return null;
  }

  function getUpcoming(n){
    const list = [];
    const todayDow = (new Date().getDay()+6)%7;
    for(let i=0;i<7;i++){
      const idx = (todayDow+i)%7;
      const p = state.data.programs[idx];
      if(p && !p.rest && p.exercises.length){
        const d = new Date(); d.setDate(d.getDate()+i);
        list.push({ ...p, dateLabel: i===0?"Today":i===1?"Tomorrow":d.toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}) });
        if(list.length >= n) break;
      }
    }
    return list;
  }

  function totalVolume(w){
    let v = 0;
    (w.exercises||[]).forEach(ex => (ex.sets||[]).forEach(s => { if(s.done) v += (Number(s.weight)||0) * (Number(s.reps)||0); }));
    return Math.round(v);
  }

  // ============ WORKOUTS ============
  function renderWorkouts(){
    const cur = state.data.current;
    if(cur) return renderActiveWorkout(cur);

    const history = state.data.workouts.slice().sort((a,b)=> b.date.localeCompare(a.date));
    return `
      <div class="tr-card">
        <div class="tr-flex-between">
          <div>
            <h3>Ready to train?</h3>
            <p style="margin-top:6px">Start a fresh session or pick from your program.</p>
          </div>
        </div>
        <div class="tr-mt" style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="tr-btn tr-btn-primary" data-action="start-workout" data-testid="start-workout-btn-2">Start empty workout</button>
          <button type="button" class="tr-btn tr-btn-ghost" data-action="start-from-plan" data-testid="start-from-plan-btn">Start from plan</button>
        </div>
      </div>

      <div class="tr-section tr-mt-lg">
        <div class="tr-section-head">
          <div class="tr-section-title">Workout history</div>
          <span class="tr-list-value">${history.length} total</span>
        </div>
        ${history.length ? `<div class="tr-list" data-testid="workout-history">
          ${history.map(w=>{
            const vol = totalVolume(w);
            return `<div class="tr-list-item" data-view-workout="${w.id}" data-testid="history-item-${w.id}">
              <div class="tr-list-icon">${escapeHtml((w.name||"?").slice(0,1).toUpperCase())}</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${escapeHtml(w.name||"Workout")}</div>
                <div class="tr-list-sub">${fmtDate(w.date)} · ${w.exercises.length} exercises</div>
              </div>
              <div class="tr-list-value">${vol?vol+" "+state.data.prefs.unit:"—"}</div>
            </div>`;
          }).join("")}
        </div>` : `<div class="tr-empty">Your logged workouts will appear here.</div>`}
      </div>
    `;
  }

  function renderActiveWorkout(w){
    return `
      <div class="tr-card">
        <div class="tr-flex-between">
          <div style="flex:1">
            <div class="tr-eyebrow" style="margin-bottom:4px">Active workout</div>
            <input type="text" class="tr-input" style="font-size:20px;font-weight:700;padding:8px 12px;background:transparent;border-color:transparent" placeholder="Name this workout..." value="${escapeHtml(w.name||"")}" data-workout-name data-testid="workout-name-input">
          </div>
        </div>
        <div class="tr-mt" style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="tr-btn tr-btn-primary" data-action="finish-workout" data-testid="finish-workout-btn">Finish workout</button>
          <button type="button" class="tr-btn tr-btn-danger" data-action="cancel-workout" data-testid="cancel-workout-btn-2">Discard</button>
        </div>
      </div>

      <div class="tr-mt-lg" data-testid="exercise-list">
        ${(w.exercises||[]).map((ex,ei)=> renderExercise(ex,ei)).join("")}
      </div>

      <button type="button" class="tr-btn tr-btn-ghost tr-btn-full tr-mt" data-action="add-exercise" data-testid="add-exercise-btn">+ Add exercise</button>
    `;
  }

  function renderExercise(ex, ei){
    const prev = findPrevious(ex.name);
    return `
      <div class="tr-exercise" data-ex-index="${ei}" data-testid="exercise-${ei}">
        <div class="tr-exercise-head">
          <div class="tr-exercise-name">
            <input type="text" placeholder="Exercise name" value="${escapeHtml(ex.name||"")}" data-ex-name="${ei}" data-testid="ex-name-${ei}">
          </div>
          <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-remove-ex="${ei}" data-testid="remove-ex-${ei}" aria-label="Remove exercise">✕</button>
        </div>
        <div class="tr-set-head">
          <div class="tr-set-head-grid">
            <div>#</div><div>${state.data.prefs.unit==="kg"?"KG":"LB"}</div><div>Reps</div><div>✓</div><div></div>
          </div>
        </div>
        ${(ex.sets||[]).map((s,si)=> `
          <div class="tr-set" data-set="${si}">
            <div class="tr-set-num">${si+1}</div>
            <input type="number" inputmode="decimal" placeholder="0" value="${s.weight??""}" data-set-field="weight" data-set-idx="${si}" data-ex-idx="${ei}" data-testid="set-weight-${ei}-${si}">
            <input type="number" inputmode="numeric" placeholder="0" value="${s.reps??""}" data-set-field="reps" data-set-idx="${si}" data-ex-idx="${ei}" data-testid="set-reps-${ei}-${si}">
            <button type="button" class="tr-set-check ${s.done?"done":""}" data-toggle-set="${si}" data-ex-idx="${ei}" data-testid="set-check-${ei}-${si}">✓</button>
            <button type="button" class="tr-set-del" data-remove-set="${si}" data-ex-idx="${ei}" data-testid="remove-set-${ei}-${si}">✕</button>
          </div>`).join("")}
        <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-add-set="${ei}" data-testid="add-set-${ei}" style="margin-top:8px">+ Add set</button>
        ${prev ? `<div class="tr-exercise-prev" data-testid="prev-compare-${ei}">
          <strong style="color:#fff">Last session:</strong> ${prev.setsText} · <strong style="color:#fff">Best set:</strong> ${prev.best.weight}${state.data.prefs.unit} × ${prev.best.reps}
          ${renderOverload(ex, prev)}
        </div>` : ""}
      </div>
    `;
  }

  function findPrevious(name){
    if(!name) return null;
    const past = state.data.workouts
      .filter(w => (w.exercises||[]).some(e => (e.name||"").toLowerCase() === name.toLowerCase()))
      .sort((a,b)=> b.date.localeCompare(a.date));
    if(!past.length) return null;
    const w = past[0];
    const ex = w.exercises.find(e => (e.name||"").toLowerCase() === name.toLowerCase());
    const doneSets = (ex.sets||[]).filter(s => s.done && s.weight && s.reps);
    if(!doneSets.length) return null;
    const best = doneSets.reduce((a,b)=> (Number(a.weight)>Number(b.weight)?a:b));
    const setsText = doneSets.map(s => `${s.weight}×${s.reps}`).join(", ");
    return { best, setsText, date: w.date };
  }

  function renderOverload(ex, prev){
    const doneSets = (ex.sets||[]).filter(s => s.done && s.weight && s.reps);
    if(!doneSets.length) return "";
    const bestNow = doneSets.reduce((a,b)=> (Number(a.weight)>Number(b.weight)?a:b));
    const delta = Number(bestNow.weight) - Number(prev.best.weight);
    if(delta > 0) return ` <span class="up">▲ +${delta}${state.data.prefs.unit}</span>`;
    if(delta < 0) return ` <span class="down">▼ ${delta}${state.data.prefs.unit}</span>`;
    return ` <span style="color:var(--tr-text-3)">= same</span>`;
  }

  function startWorkout(fromPlan){
    let name = "";
    let exercises = [];
    if(fromPlan){
      const next = getNextWorkout();
      if(next){
        name = next.name || "";
        exercises = (next.exercises||[]).map(exName => ({
          id: uid(), name: typeof exName === "string" ? exName : (exName.name||""),
          sets: [{ reps:"", weight:"", done:false },{ reps:"", weight:"", done:false },{ reps:"", weight:"", done:false }]
        }));
      }
    }
    state.data.current = {
      id: uid(),
      name,
      date: today(),
      startedAt: Date.now(),
      exercises
    };
    save("current");
    state.tab = "workouts";
    render();
  }

  function finishWorkout(){
    const w = state.data.current;
    if(!w) return;
    w.completedAt = Date.now();
    // strip empty exercises
    w.exercises = (w.exercises||[]).filter(e => (e.name||"").trim() && (e.sets||[]).some(s => s.done || s.weight || s.reps));
    if(!w.exercises.length){
      toast("Log at least one set before finishing");
      return;
    }
    state.data.workouts.unshift(w);
    state.data.current = null;
    save("workouts"); save("current");
    updatePRs(w);
    toast("Workout saved");
    state.tab = "home";
    render();
  }

  function updatePRs(w){
    // recomputed on the fly from history; no separate PR store needed
    (w.exercises||[]).forEach(ex => {
      const best = (ex.sets||[]).filter(s => s.done).reduce((a,s)=> Number(s.weight)>Number(a?.weight||0)?s:a, null);
      if(best){
        const prevBest = getBestSet(ex.name, w.id);
        if(!prevBest || Number(best.weight) > Number(prevBest.weight)){
          toast(`🎉 New PR: ${ex.name}`);
        }
      }
    });
  }

  function getBestSet(exName, excludeWorkoutId){
    let best = null;
    state.data.workouts.forEach(w => {
      if(w.id === excludeWorkoutId) return;
      (w.exercises||[]).forEach(ex => {
        if((ex.name||"").toLowerCase() !== (exName||"").toLowerCase()) return;
        (ex.sets||[]).forEach(s => {
          if(s.done && Number(s.weight) > Number(best?.weight||0)) best = { ...s, date: w.date };
        });
      });
    });
    return best;
  }

  // ============ PROGRESS ============
  function renderProgress(){
    const uniqueExercises = getUniqueExercises();
    const prs = uniqueExercises.map(name => ({ name, best: getBestSet(name) })).filter(p => p.best).sort((a,b)=> Number(b.best.weight) - Number(a.best.weight)).slice(0,8);
    const latestWeight = state.data.weights[0];
    const latestPhotos = state.data.photos[0] || {};

    return `
      <div class="tr-grid-2">
        <div class="tr-stat" data-testid="stat-workouts">
          <div class="tr-stat-label">Total workouts</div>
          <div class="tr-stat-value">${state.data.workouts.length}</div>
          <div class="tr-stat-sub neu">All time</div>
        </div>
        <div class="tr-stat" data-testid="stat-volume">
          <div class="tr-stat-label">This week volume</div>
          <div class="tr-stat-value">${weekVolume()}</div>
          <div class="tr-stat-sub">${state.data.prefs.unit}</div>
        </div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Progress photos</div>
        <div class="tr-photo-grid" data-testid="photo-grid">
          ${["front","side","back"].map(v => `
            <label class="tr-photo-slot" data-testid="photo-slot-${v}">
              ${latestPhotos[v] ? `<img src="${latestPhotos[v]}" alt="${v}">` : `<span class="tr-photo-slot-empty">+</span>`}
              <span class="tr-photo-slot-label">${v}</span>
              <input type="file" accept="image/*" capture="environment" data-photo-view="${v}">
            </label>
          `).join("")}
        </div>
        <div class="tr-flex-between tr-mt">
          <div>
            <div style="font-size:12px;color:var(--tr-text-3);letter-spacing:0.08em;text-transform:uppercase">Bodyweight</div>
            <div style="font-size:24px;font-weight:700;color:#fff;margin-top:4px" data-testid="latest-weight">${latestWeight?latestWeight.weight+" "+state.data.prefs.unit:"—"}</div>
          </div>
          <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-action="log-weight" data-testid="log-weight-btn">Log weight</button>
        </div>
        <div class="tr-mt" style="font-size:11px;color:var(--tr-text-3)">${state.data.photos.length} photo entries · ${state.data.weights.length} weight entries</div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Body strength map</div>
        <div class="tr-body-map">
          ${bodyMapSVG()}
        </div>
        <div style="font-size:12px;color:var(--tr-text-3);text-align:center;margin-top:8px">Intensity based on training volume per body region</div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Personal records</div>
        ${prs.length ? `<div class="tr-list" data-testid="pr-list">
          ${prs.map(p=>`
            <div class="tr-list-item">
              <div class="tr-list-icon">★</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${escapeHtml(p.name)}</div>
                <div class="tr-list-sub">${fmtDate(p.best.date)} · ${p.best.reps} reps</div>
              </div>
              <div class="tr-list-value">${p.best.weight} ${state.data.prefs.unit}</div>
            </div>`).join("")}
        </div>` : `<div class="tr-empty">Complete workouts to see your PRs here.</div>`}
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Strength trend</div>
        ${uniqueExercises.length ? `<select class="tr-select" data-strength-select data-testid="strength-select">
          ${uniqueExercises.slice(0,15).map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")}
        </select>
        <canvas class="tr-chart tr-mt" id="strengthChart" data-testid="strength-chart"></canvas>` : `<div class="tr-empty">Log some workouts to see trends.</div>`}
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Goals</div>
        ${(state.data.goals||[]).length ? `<div class="tr-list" data-testid="goals-list">
          ${state.data.goals.map((g,i)=>{
            const cur = getBestSet(g.exercise) || {weight:0};
            const pct = Math.min(100, Math.round((Number(cur.weight)/Number(g.target))*100));
            return `<div class="tr-list-item" style="flex-direction:column;align-items:stretch">
              <div class="tr-flex-between">
                <div>
                  <div class="tr-list-title">${escapeHtml(g.exercise)}</div>
                  <div class="tr-list-sub">${cur.weight||0} → ${g.target} ${state.data.prefs.unit}</div>
                </div>
                <div class="tr-flex" style="gap:8px">
                  <span class="tr-pr-badge">${pct}%</span>
                  <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-remove-goal="${i}" data-testid="remove-goal-${i}">✕</button>
                </div>
              </div>
              <div class="tr-progress"><div class="tr-progress-fill" style="width:${pct}%"></div></div>
            </div>`;
          }).join("")}
        </div>` : `<div class="tr-empty">No goals yet — add one to track your progression.</div>`}
        <button type="button" class="tr-btn tr-btn-ghost tr-btn-full tr-mt" data-action="add-goal" data-testid="add-goal-btn">+ Add goal</button>
      </div>
    `;
  }

  function getUniqueExercises(){
    const set = new Set();
    state.data.workouts.forEach(w => (w.exercises||[]).forEach(e => e.name && set.add(e.name)));
    return Array.from(set);
  }

  function weekVolume(){
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-7);
    const cutoffIso = toISO(cutoff);
    return state.data.workouts.filter(w => w.date >= cutoffIso).reduce((sum,w)=> sum + totalVolume(w), 0);
  }

  // Body map with strength levels (based on volume)
  function bodyMapSVG(){
    // Approx exercise → body part mapping
    const map = { chest:["bench","chest","incline","dip","fly","press"], back:["row","pull","deadlift","lat"], shoulders:["shoulder","overhead","ohp","press","lateral","raise"], biceps:["curl","biceps","chin"], triceps:["triceps","dip","pushdown","extension"], quads:["squat","lunge","leg press","leg extension"], hamstrings:["hamstring","deadlift","curl","rdl"], glutes:["glute","hip thrust","squat"], calves:["calf"], core:["ab","crunch","plank","core"] };
    const vol = {};
    Object.keys(map).forEach(k => vol[k]=0);
    state.data.workouts.forEach(w=>{
      (w.exercises||[]).forEach(ex=>{
        const n = (ex.name||"").toLowerCase();
        Object.entries(map).forEach(([part, kws])=>{
          if(kws.some(kw => n.includes(kw))){
            (ex.sets||[]).forEach(s=>{ if(s.done) vol[part] += (Number(s.weight)||0) * (Number(s.reps)||0); });
          }
        });
      });
    });
    const maxV = Math.max(1, ...Object.values(vol));
    const lvl = (p) => {
      const r = vol[p]/maxV;
      if(r === 0) return 0;
      if(r < 0.2) return 1;
      if(r < 0.4) return 2;
      if(r < 0.6) return 3;
      if(r < 0.85) return 4;
      return 5;
    };
    const cls = (p) => `tr-body-part${lvl(p)?" lvl-"+lvl(p):""}`;
    return `<svg class="tr-body-svg" viewBox="0 0 180 320" xmlns="http://www.w3.org/2000/svg">
      <!-- Head -->
      <circle cx="90" cy="26" r="16" class="tr-body-part" fill="var(--tr-surface-3)"/>
      <!-- Shoulders -->
      <path class="${cls("shoulders")}" d="M50 62 Q60 52 78 54 L78 74 Q60 76 50 72 Z" data-part="shoulders"/>
      <path class="${cls("shoulders")}" d="M130 62 Q120 52 102 54 L102 74 Q120 76 130 72 Z" data-part="shoulders"/>
      <!-- Chest -->
      <path class="${cls("chest")}" d="M78 60 L102 60 L108 90 Q90 96 72 90 Z" data-part="chest"/>
      <!-- Biceps -->
      <path class="${cls("biceps")}" d="M48 72 L60 78 L58 110 L44 104 Z" data-part="biceps"/>
      <path class="${cls("biceps")}" d="M132 72 L120 78 L122 110 L136 104 Z" data-part="biceps"/>
      <!-- Triceps (side of arm) -->
      <path class="${cls("triceps")}" d="M42 104 L58 110 L54 138 L40 132 Z" data-part="triceps"/>
      <path class="${cls("triceps")}" d="M138 104 L122 110 L126 138 L140 132 Z" data-part="triceps"/>
      <!-- Core -->
      <path class="${cls("core")}" d="M72 92 L108 92 L110 148 Q90 152 70 148 Z" data-part="core"/>
      <!-- Quads -->
      <path class="${cls("quads")}" d="M70 152 L90 150 L88 210 L72 210 Z" data-part="quads"/>
      <path class="${cls("quads")}" d="M110 152 L90 150 L92 210 L108 210 Z" data-part="quads"/>
      <!-- Hamstrings (side/lower thigh) -->
      <path class="${cls("hamstrings")}" d="M72 210 L88 210 L86 236 L74 236 Z" data-part="hamstrings"/>
      <path class="${cls("hamstrings")}" d="M108 210 L92 210 L94 236 L106 236 Z" data-part="hamstrings"/>
      <!-- Calves -->
      <path class="${cls("calves")}" d="M74 238 L86 238 L84 288 L76 288 Z" data-part="calves"/>
      <path class="${cls("calves")}" d="M106 238 L94 238 L96 288 L104 288 Z" data-part="calves"/>
      <!-- Back placeholder (glutes represented as hips) -->
      <path class="${cls("glutes")}" d="M68 148 L112 148 L110 158 Q90 162 70 158 Z" data-part="glutes"/>
      <!-- Neck -->
      <rect x="82" y="40" width="16" height="14" class="tr-body-part" fill="var(--tr-surface-3)"/>
      <!-- Feet -->
      <ellipse cx="80" cy="298" rx="8" ry="6" class="tr-body-part" fill="var(--tr-surface-3)"/>
      <ellipse cx="100" cy="298" rx="8" ry="6" class="tr-body-part" fill="var(--tr-surface-3)"/>
      <!-- Forearms -->
      <path class="tr-body-part" d="M40 132 L54 138 L52 168 L38 162 Z" fill="var(--tr-surface-3)"/>
      <path class="tr-body-part" d="M140 132 L126 138 L128 168 L142 162 Z" fill="var(--tr-surface-3)"/>
    </svg>`;
  }

  // ============ PROGRAMS ============
  function renderPrograms(){
    return `
      <div class="tr-card">
        <div class="tr-card-title">Weekly split</div>
        <p style="font-size:13px;color:var(--tr-text-2);margin-bottom:16px">Structure your week. Add exercises to each training day and mark rest days.</p>
        ${state.data.programs.map((p,i)=> renderProgramDay(p,i)).join("")}
      </div>
    `;
  }

  function renderProgramDay(p, i){
    return `
      <div class="tr-day-row" data-day-idx="${i}" data-testid="program-day-${p.day}">
        <div class="tr-day-head">
          <div class="tr-day-name">${p.day} <span style="font-size:12px;color:var(--tr-text-3);font-weight:400">· ${p.rest?"Rest":(p.name||"Training")}</span></div>
          <button type="button" class="tr-day-tag ${p.rest?"rest":"workout"}" data-toggle-rest="${i}" data-testid="toggle-rest-${p.day}">${p.rest?"Rest":"Workout"}</button>
        </div>
        ${!p.rest ? `
          <div style="margin-bottom:10px">
            <input type="text" class="tr-input" placeholder="e.g. Push day, Upper body..." value="${escapeHtml(p.name||"")}" data-day-name="${i}" data-testid="day-name-${p.day}">
          </div>
          <div class="tr-day-exercises" data-testid="day-exercises-${p.day}">
            ${p.exercises.length ? p.exercises.map((ex,ei)=>`
              <div class="tr-flex-between" style="padding:4px 0">
                <span>• ${escapeHtml(typeof ex === "string" ? ex : ex.name)}</span>
                <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-remove-day-ex="${i}" data-ex-i="${ei}" data-testid="remove-day-ex-${p.day}-${ei}" style="padding:4px 8px">✕</button>
              </div>`).join("") : `<div class="empty">No exercises assigned yet.</div>`}
          </div>
          <div class="tr-row tr-mt">
            <input type="text" class="tr-input" placeholder="Add exercise..." data-day-add-input="${i}" data-testid="day-add-input-${p.day}">
            <button type="button" class="tr-btn tr-btn-ghost" style="flex:0" data-add-day-ex="${i}" data-testid="add-day-ex-${p.day}">Add</button>
          </div>
        ` : `<div style="font-size:12px;color:var(--tr-text-3);font-style:italic">Rest & recover.</div>`}
      </div>
    `;
  }

  // ============ BENCH ============
  function renderBench(){
    const benchAliases = ["bench","bench press","barbell bench","flat bench"];
    const benchName = benchAliases.find(n => getBestSet(n));
    const best = benchName ? getBestSet(benchName) : null;
    const history = state.data.workouts.filter(w => (w.exercises||[]).some(e => benchAliases.includes((e.name||"").toLowerCase()))).sort((a,b)=> a.date.localeCompare(b.date));

    return `
      <div class="tr-bench-hero" data-testid="bench-hero">
        <div class="tr-bench-hero-lbl">Bench 1RM Best</div>
        <div>
          <span class="tr-bench-hero-pr">${best ? best.weight : "—"}</span>
          <span class="tr-bench-hero-unit">${best ? state.data.prefs.unit : ""}</span>
        </div>
        <div class="tr-bench-hero-sub">${best ? `${best.reps} reps on ${fmtDate(best.date)}` : "Log a bench press session to unlock your PR."}</div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Bench progression</div>
        ${history.length >= 2 ? `<canvas class="tr-chart" id="benchChart" data-testid="bench-chart"></canvas>` : `<div class="tr-empty">Need at least 2 bench sessions to plot progression.</div>`}
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Bench log</div>
        ${history.length ? `<div class="tr-list" data-testid="bench-log">
          ${history.slice().reverse().slice(0,8).map(w=>{
            const ex = (w.exercises||[]).find(e => benchAliases.includes((e.name||"").toLowerCase()));
            const b = (ex?.sets||[]).filter(s=>s.done).reduce((a,s)=> Number(s.weight)>Number(a?.weight||0)?s:a, null);
            return `<div class="tr-list-item">
              <div class="tr-list-icon">▬</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${b ? b.weight+" "+state.data.prefs.unit+" × "+b.reps : "—"}</div>
                <div class="tr-list-sub">${fmtDate(w.date)}</div>
              </div>
              <div class="tr-list-value">${(ex?.sets||[]).filter(s=>s.done).length} sets</div>
            </div>`;
          }).join("")}
        </div>` : `<div class="tr-empty">No bench sessions logged yet.</div>`}
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Notes & tips</div>
        <p style="font-size:13px;color:var(--tr-text-2);margin-bottom:12px">Your personal cues, form notes, and reminders for bench day.</p>
        ${(state.data.benchTips||[]).length ? `<div class="tr-list" data-testid="bench-tips-list">
          ${state.data.benchTips.map(t=>`
            <div class="tr-list-item" style="align-items:flex-start">
              <div class="tr-list-icon">✎</div>
              <div class="tr-list-body">
                <div class="tr-list-title" style="white-space:normal">${escapeHtml(t.text)}</div>
                <div class="tr-list-sub">${fmtDate(t.date)}</div>
              </div>
              <button type="button" class="tr-btn tr-btn-sm tr-btn-ghost" data-remove-tip="${t.id}" data-testid="remove-tip-${t.id}">✕</button>
            </div>`).join("")}
        </div>` : `<div class="tr-empty" style="padding:20px">No notes yet.</div>`}
        <div class="tr-row tr-mt">
          <input type="text" class="tr-input" placeholder="Add a tip or note..." data-bench-tip-input data-testid="bench-tip-input">
          <button type="button" class="tr-btn tr-btn-primary" style="flex:0" data-action="add-bench-tip" data-testid="add-bench-tip-btn">Add</button>
        </div>
      </div>
    `;
  }

  // ============ CALENDAR ============
  function renderCalendar(){
    // Year heatmap: last 52 weeks, week columns Mon..Sun
    const today0 = new Date(); today0.setHours(0,0,0,0);
    // start = 52 weeks ago, aligned to Monday
    const start = new Date(today0);
    const dow = (start.getDay()+6)%7;
    start.setDate(start.getDate() - dow - 51*7);

    const doneMap = new Map();
    state.data.workouts.forEach(w => doneMap.set(w.date, w));
    const restDays = new Set();
    state.data.programs.forEach((p,i)=>{ if(p.rest) restDays.add(i); });

    const weeks = [];
    let cur = new Date(start);
    for(let w=0; w<53; w++){
      const week = [];
      for(let d=0; d<7; d++){
        const iso = toISO(cur);
        const isFuture = cur > today0;
        const isDone = doneMap.has(iso);
        const dowIdx = (cur.getDay()+6)%7;
        const isRest = restDays.has(dowIdx);
        const isToday = iso === today();
        week.push({ iso, isDone, isFuture, isRest, isToday });
        cur.setDate(cur.getDate()+1);
      }
      weeks.push(week);
    }

    const total = state.data.workouts.length;
    const streak = getStreak();

    // month labels (approx: label first week of each month)
    return `
      <div class="tr-grid-3">
        <div class="tr-stat" data-testid="stat-total"><div class="tr-stat-label">Total sessions</div><div class="tr-stat-value">${total}</div><div class="tr-stat-sub neu">Lifetime</div></div>
        <div class="tr-stat" data-testid="stat-streak"><div class="tr-stat-label">Current streak</div><div class="tr-stat-value">${streak}</div><div class="tr-stat-sub">days</div></div>
        <div class="tr-stat" data-testid="stat-this-month"><div class="tr-stat-label">This month</div><div class="tr-stat-value">${monthCount()}</div><div class="tr-stat-sub neu">workouts</div></div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Year heatmap</div>
        <div class="tr-heatmap" data-testid="heatmap">
          ${weeks.map(week => `<div class="tr-heatmap-week">${week.map(d => {
            if(d.isFuture) return `<div class="tr-heat-cell" style="opacity:0.35" title="${d.iso}"></div>`;
            const cls = d.isDone?"done":d.isRest?"rest":"";
            const today0 = d.isToday?"today":"";
            return `<div class="tr-heat-cell ${cls} ${today0}" data-day-cell="${d.iso}" title="${d.iso}${d.isDone?" · Trained":""}"></div>`;
          }).join("")}</div>`).join("")}
        </div>
        <div class="tr-flex tr-mt" style="font-size:11px;color:var(--tr-text-3);gap:12px;flex-wrap:wrap">
          <div class="tr-flex" style="gap:6px"><div class="tr-heat-cell"></div> None</div>
          <div class="tr-flex" style="gap:6px"><div class="tr-heat-cell rest"></div> Rest</div>
          <div class="tr-flex" style="gap:6px"><div class="tr-heat-cell done"></div> Trained</div>
        </div>
      </div>

      <div class="tr-card tr-mt-lg">
        <div class="tr-card-title">Full history</div>
        ${state.data.workouts.length ? `<div class="tr-list" data-testid="full-history">
          ${state.data.workouts.slice().sort((a,b)=> b.date.localeCompare(a.date)).map(w=>{
            const vol = totalVolume(w);
            return `<div class="tr-list-item" data-view-workout="${w.id}">
              <div class="tr-list-icon">${escapeHtml((w.name||"?").slice(0,1).toUpperCase())}</div>
              <div class="tr-list-body">
                <div class="tr-list-title">${escapeHtml(w.name||"Workout")}</div>
                <div class="tr-list-sub">${fmtDate(w.date)} · ${w.exercises.length} exercises</div>
              </div>
              <div class="tr-list-value">${vol?vol+" "+state.data.prefs.unit:"—"}</div>
            </div>`;
          }).join("")}
        </div>` : `<div class="tr-empty">Your training history will build here.</div>`}
      </div>
    `;
  }

  function getStreak(){
    if(!state.data.workouts.length) return 0;
    const dates = new Set(state.data.workouts.map(w => w.date));
    let streak = 0;
    const d = new Date();
    // walk backwards from today counting consecutive done or rest days per program
    const restDays = new Set();
    state.data.programs.forEach((p,i)=>{ if(p.rest) restDays.add(i); });
    while(true){
      const iso = toISO(d);
      const dow = (d.getDay()+6)%7;
      if(dates.has(iso)){ streak++; }
      else if(restDays.has(dow)){ /* rest doesn't break */ }
      else break;
      d.setDate(d.getDate()-1);
      if(streak > 400) break;
    }
    return streak;
  }

  function monthCount(){
    const now = new Date();
    const prefix = now.toISOString().slice(0,7);
    return state.data.workouts.filter(w => w.date.startsWith(prefix)).length;
  }

  // ============ HANDLERS ============
  function attachHandlers(root){
    // Tab switching
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      render();
    }));

    // Nav cards
    root.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => {
      state.tab = b.dataset.nav;
      render();
      window.scrollTo({top:0,behavior:"smooth"});
    }));

    // Date pills
    root.querySelectorAll("[data-date]").forEach(b => b.addEventListener("click", () => {
      state.selectedDate = b.dataset.date;
      render();
    }));

    // Actions
    root.querySelectorAll("[data-action]").forEach(b => b.addEventListener("click", () => handleAction(b.dataset.action, b)));

    // Workout name
    root.querySelectorAll("[data-workout-name]").forEach(i => i.addEventListener("input", (e) => {
      if(state.data.current){ state.data.current.name = e.target.value; save("current"); }
    }));

    // Exercise name
    root.querySelectorAll("[data-ex-name]").forEach(i => i.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.exName);
      if(state.data.current && state.data.current.exercises[idx]){
        state.data.current.exercises[idx].name = e.target.value;
        save("current");
      }
    }));
    root.querySelectorAll("[data-ex-name]").forEach(i => i.addEventListener("blur", () => render()));

    // Set input
    root.querySelectorAll("[data-set-field]").forEach(i => i.addEventListener("input", (e) => {
      const ei = Number(e.target.dataset.exIdx);
      const si = Number(e.target.dataset.setIdx);
      const field = e.target.dataset.setField;
      const set = state.data.current?.exercises?.[ei]?.sets?.[si];
      if(set){ set[field] = e.target.value; save("current"); }
    }));

    // Toggle set done
    root.querySelectorAll("[data-toggle-set]").forEach(b => b.addEventListener("click", (e) => {
      const ei = Number(b.dataset.exIdx);
      const si = Number(b.dataset.toggleSet);
      const set = state.data.current?.exercises?.[ei]?.sets?.[si];
      if(set){ set.done = !set.done; save("current"); render(); }
    }));

    // Remove set
    root.querySelectorAll("[data-remove-set]").forEach(b => b.addEventListener("click", () => {
      const ei = Number(b.dataset.exIdx);
      const si = Number(b.dataset.removeSet);
      const ex = state.data.current?.exercises?.[ei];
      if(ex){ ex.sets.splice(si,1); save("current"); render(); }
    }));

    // Add set
    root.querySelectorAll("[data-add-set]").forEach(b => b.addEventListener("click", () => {
      const ei = Number(b.dataset.addSet);
      const ex = state.data.current?.exercises?.[ei];
      if(ex){ ex.sets = ex.sets || []; ex.sets.push({ reps:"", weight:"", done:false }); save("current"); render(); }
    }));

    // Remove exercise
    root.querySelectorAll("[data-remove-ex]").forEach(b => b.addEventListener("click", () => {
      const ei = Number(b.dataset.removeEx);
      if(state.data.current){ state.data.current.exercises.splice(ei,1); save("current"); render(); }
    }));

    // View workout
    root.querySelectorAll("[data-view-workout]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.viewWorkout;
      viewWorkoutModal(id);
    }));

    // Program day toggle rest
    root.querySelectorAll("[data-toggle-rest]").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.toggleRest);
      state.data.programs[i].rest = !state.data.programs[i].rest;
      save("programs");
      render();
    }));

    // Program day name
    root.querySelectorAll("[data-day-name]").forEach(i => i.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.dayName);
      state.data.programs[idx].name = e.target.value;
      save("programs");
    }));

    // Add day exercise
    root.querySelectorAll("[data-add-day-ex]").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.addDayEx);
      const input = root.querySelector(`[data-day-add-input="${i}"]`);
      const val = (input?.value || "").trim();
      if(!val) return;
      state.data.programs[i].exercises.push(val);
      save("programs");
      render();
    }));

    // Remove day exercise
    root.querySelectorAll("[data-remove-day-ex]").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.removeDayEx);
      const ei = Number(b.dataset.exI);
      state.data.programs[i].exercises.splice(ei,1);
      save("programs");
      render();
    }));

    // Progress photos
    root.querySelectorAll("[data-photo-view]").forEach(input => input.addEventListener("change", (e) => {
      const view = input.dataset.photoView;
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const iso = today();
        let entry = state.data.photos.find(p => p.date === iso);
        if(!entry){ entry = { date: iso }; state.data.photos.unshift(entry); }
        entry[view] = reader.result;
        save("photos");
        toast("Photo saved");
        render();
      };
      reader.readAsDataURL(file);
    }));

    // Bench tip input add on Enter
    const benchInput = root.querySelector("[data-bench-tip-input]");
    if(benchInput){
      benchInput.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){ e.preventDefault(); addBenchTip(); }
      });
    }
    // Remove bench tip
    root.querySelectorAll("[data-remove-tip]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.removeTip;
      state.data.benchTips = state.data.benchTips.filter(t => t.id !== id);
      save("benchTips"); render();
    }));

    // Remove goal
    root.querySelectorAll("[data-remove-goal]").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.dataset.removeGoal);
      state.data.goals.splice(i,1);
      save("goals"); render();
    }));

    // Strength chart
    const sel = root.querySelector("[data-strength-select]");
    if(sel){
      drawStrengthChart(sel.value);
      sel.addEventListener("change", () => drawStrengthChart(sel.value));
    }

    // Bench chart
    if(root.querySelector("#benchChart")){
      drawBenchChart();
    }

    // Day cell click → history
    root.querySelectorAll("[data-day-cell]").forEach(c => c.addEventListener("click", () => {
      const iso = c.dataset.dayCell;
      const w = state.data.workouts.find(w => w.date === iso);
      if(w) viewWorkoutModal(w.id);
      else toast("No workout on "+fmtDate(iso));
    }));
  }

  function handleAction(action, btn){
    if(action === "start-workout"){ startWorkout(false); }
    else if(action === "start-from-plan"){ startWorkout(true); }
    else if(action === "add-exercise"){
      if(!state.data.current){ startWorkout(false); }
      state.data.current.exercises.push({ id: uid(), name:"", sets:[{ reps:"", weight:"", done:false }] });
      save("current"); render();
    }
    else if(action === "finish-workout"){ finishWorkout(); }
    else if(action === "cancel-workout"){
      openModal("Discard workout?","This will remove your current session without saving.","", [
        { id:"cancel", label:"Keep" },
        { id:"confirm", label:"Discard", primary:true }
      ]).then(res => {
        if(res?.action === "confirm"){
          state.data.current = null;
          save("current");
          state.tab = "home";
          toast("Workout discarded");
          render();
        }
      });
    }
    else if(action === "resume-workout"){ state.tab = "workouts"; render(); }
    else if(action === "go-programs"){ state.tab = "programs"; render(); }
    else if(action === "log-weight"){
      openModal("Log bodyweight","Enter today's weight.",`
        <div class="tr-field">
          <label class="tr-label">Weight (${state.data.prefs.unit})</label>
          <input type="number" step="0.1" class="tr-input" data-modal-field="weight" placeholder="e.g. 78.5" data-testid="modal-weight-input" autofocus>
        </div>
      `, [
        { id:"cancel", label:"Cancel" },
        { id:"confirm", label:"Save", primary:true }
      ]).then(res => {
        if(res?.action === "confirm" && res.inputs.weight){
          const iso = today();
          state.data.weights = state.data.weights.filter(w => w.date !== iso);
          state.data.weights.unshift({ date: iso, weight: Number(res.inputs.weight) });
          save("weights");
          toast("Weight logged");
          render();
        }
      });
    }
    else if(action === "add-goal"){
      const exercises = getUniqueExercises();
      openModal("Add a goal","Set a target weight for any exercise.",`
        <div class="tr-field">
          <label class="tr-label">Exercise</label>
          <input type="text" class="tr-input" data-modal-field="exercise" placeholder="e.g. Bench press" list="tr-goal-ex-list" data-testid="modal-goal-exercise" autofocus>
          <datalist id="tr-goal-ex-list">${exercises.map(e=>`<option value="${escapeHtml(e)}">`).join("")}</datalist>
        </div>
        <div class="tr-field">
          <label class="tr-label">Target weight (${state.data.prefs.unit})</label>
          <input type="number" step="0.5" class="tr-input" data-modal-field="target" placeholder="e.g. 100" data-testid="modal-goal-target">
        </div>
      `, [
        { id:"cancel", label:"Cancel" },
        { id:"confirm", label:"Add goal", primary:true }
      ]).then(res => {
        if(res?.action === "confirm" && res.inputs.exercise && res.inputs.target){
          state.data.goals.push({ exercise: res.inputs.exercise, target: Number(res.inputs.target) });
          save("goals");
          render();
        }
      });
    }
    else if(action === "add-bench-tip"){ addBenchTip(); }
  }

  function addBenchTip(){
    const input = document.querySelector("[data-bench-tip-input]");
    const val = (input?.value || "").trim();
    if(!val) return;
    state.data.benchTips.unshift({ id: uid(), date: today(), text: val });
    save("benchTips"); render();
  }

  function viewWorkoutModal(id){
    const w = state.data.workouts.find(x => x.id === id);
    if(!w) return;
    const body = `
      <div style="margin-bottom:12px;font-size:13px;color:var(--tr-text-2)">${fmtDate(w.date)} · Total: ${totalVolume(w)} ${state.data.prefs.unit}</div>
      ${(w.exercises||[]).map(ex => `
        <div style="padding:12px;background:var(--tr-surface-3);border-radius:12px;margin-bottom:8px">
          <div style="font-weight:700;color:#fff;margin-bottom:6px">${escapeHtml(ex.name||"—")}</div>
          <div style="font-size:12px;color:var(--tr-text-2)">
            ${(ex.sets||[]).filter(s=>s.done).map(s=> `${s.weight}${state.data.prefs.unit} × ${s.reps}`).join("  ·  ") || "No sets logged"}
          </div>
        </div>
      `).join("")}
    `;
    openModal(w.name || "Workout", "", body, [
      { id:"delete", label:"Delete" },
      { id:"close", label:"Close", primary:true },
    ]).then(res => {
      if(res?.action === "delete"){
        state.data.workouts = state.data.workouts.filter(x => x.id !== id);
        save("workouts");
        toast("Workout deleted");
        render();
      }
    });
  }

  // ============ CHARTS ============
  function drawStrengthChart(exName){
    const canvas = document.getElementById("strengthChart");
    if(!canvas) return;
    const points = [];
    state.data.workouts.slice().sort((a,b)=> a.date.localeCompare(b.date)).forEach(w => {
      (w.exercises||[]).forEach(ex => {
        if((ex.name||"").toLowerCase() !== (exName||"").toLowerCase()) return;
        const best = (ex.sets||[]).filter(s => s.done).reduce((a,s)=> Number(s.weight)>Number(a?.weight||0)?s:a, null);
        if(best) points.push({ date: w.date, weight: Number(best.weight) });
      });
    });
    drawLineChart(canvas, points);
  }

  function drawBenchChart(){
    const canvas = document.getElementById("benchChart");
    if(!canvas) return;
    const aliases = ["bench","bench press","barbell bench","flat bench"];
    const points = [];
    state.data.workouts.slice().sort((a,b)=> a.date.localeCompare(b.date)).forEach(w => {
      (w.exercises||[]).forEach(ex => {
        if(!aliases.includes((ex.name||"").toLowerCase())) return;
        const best = (ex.sets||[]).filter(s => s.done).reduce((a,s)=> Number(s.weight)>Number(a?.weight||0)?s:a, null);
        if(best) points.push({ date: w.date, weight: Number(best.weight) });
      });
    });
    drawLineChart(canvas, points);
  }

  function drawLineChart(canvas, points){
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);

    if(!points.length){
      ctx.fillStyle = "#6b6a65"; ctx.font = "13px -apple-system,Inter,sans-serif";
      ctx.textAlign = "center"; ctx.fillText("No data yet", W/2, H/2);
      return;
    }

    const pad = 20;
    const maxW = Math.max(...points.map(p=>p.weight));
    const minW = Math.min(...points.map(p=>p.weight));
    const range = Math.max(1, maxW - minW);
    const yMax = maxW + range*0.15;
    const yMin = Math.max(0, minW - range*0.15);
    const x = (i) => pad + (points.length === 1 ? (W-2*pad)/2 : (i * (W-2*pad)/(points.length-1)));
    const y = (v) => H - pad - ((v - yMin) / Math.max(1, yMax - yMin)) * (H - 2*pad);

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, "rgba(94,234,212,0.35)");
    grad.addColorStop(1, "rgba(94,234,212,0)");

    ctx.beginPath();
    points.forEach((p,i) => { if(i===0) ctx.moveTo(x(i), y(p.weight)); else ctx.lineTo(x(i), y(p.weight)); });
    ctx.lineTo(x(points.length-1), H-pad);
    ctx.lineTo(x(0), H-pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p,i) => { if(i===0) ctx.moveTo(x(i), y(p.weight)); else ctx.lineTo(x(i), y(p.weight)); });
    ctx.strokeStyle = "#5eead4";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Points
    points.forEach((p,i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.weight), 4, 0, Math.PI*2);
      ctx.fillStyle = "#5eead4";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x(i), y(p.weight), 4, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Y labels
    ctx.fillStyle = "#6b6a65"; ctx.font = "11px -apple-system,Inter,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(yMax) + " " + state.data.prefs.unit, W - 4, 12);
    ctx.textAlign = "right";
    ctx.fillText(Math.round(yMin) + "", W - 4, H - 4);
  }

  // ============ EXPORT ============
  window.Training = { render, state };

  // Initial render if training tab is active on load
  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(()=> {
      if(document.getElementById("trainingRoot")) render();
    }, 100);
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(render, 100));
  }
})();
