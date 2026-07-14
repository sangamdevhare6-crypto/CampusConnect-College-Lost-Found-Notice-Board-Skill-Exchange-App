// ============================================================
// CampusConnect frontend logic
// Backend base URL — Flask localhost:5000 var chalto
// ============================================================

const API_BASE = "http://localhost:5000/api";

// ---------------- Utilities ----------------

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Kahi tari chuk zali");
  }
  return data;
}

function timeAgo(dateStr) {
  const then = new Date(dateStr.replace(" ", "T"));
  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------------- Tabs ----------------

$all(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $all(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $all(".panel").forEach((p) => p.classList.remove("active"));
    $(`#panel-${tab}`).classList.add("active");
  });
});

// ---------------- Modals ----------------

$all("[data-open-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $(`#${btn.dataset.openModal}`).classList.add("open");
  });
});

$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".modal-overlay").classList.remove("open");
  });
});

$all(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ================================================================
// LOST & FOUND
// ================================================================

const lfAccent = { lost: "var(--red)", found: "var(--green)" };

function renderLostFound(items) {
  const grid = $("#lfGrid");
  if (!items.length) {
    grid.innerHTML = `<p class="empty-state">Kahich sapadla nahi — pahilya post cha maan tumcha! 📌</p>`;
    return;
  }
  grid.innerHTML = items.map((item) => `
    <div class="pin-card ${item.status === 'resolved' ? 'resolved' : ''}" style="--card-accent:${lfAccent[item.type]}">
      <div class="card-top-row">
        <span class="badge" style="background:${lfAccent[item.type]}">${item.type}</span>
        ${item.status === 'resolved' ? '<span class="badge" style="background:#8a8f9c">resolved</span>' : ''}
      </div>
      <h4 class="card-title">${escapeHtml(item.item_name)}</h4>
      ${item.description ? `<p class="card-desc">${escapeHtml(item.description)}</p>` : ''}
      <div class="card-meta">
        ${item.location ? `<span>📍 <b>${escapeHtml(item.location)}</b></span>` : ''}
        <span>☎ ${escapeHtml(item.contact)}</span>
        <span>${escapeHtml(item.posted_by || 'Anonymous')} · ${timeAgo(item.created_at)}</span>
      </div>
      <div class="card-actions">
        ${item.status === 'open' ? `<button class="btn-mini success" data-resolve="${item.id}">Mark resolved</button>` : ''}
        <button class="btn-mini danger" data-delete-lf="${item.id}">Delete</button>
      </div>
    </div>
  `).join("");

  $all("[data-resolve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiRequest(`/lostfound/${btn.dataset.resolve}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "resolved" }),
        });
        showToast("Item resolved mhanun mark zala ✔");
        loadLostFound();
        loadStats();
      } catch (err) { showToast(err.message); }
    });
  });

  $all("[data-delete-lf]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Ha post delete karायचा?")) return;
      try {
        await apiRequest(`/lostfound/${btn.dataset.deleteLf}`, { method: "DELETE" });
        showToast("Delete zala");
        loadLostFound();
        loadStats();
      } catch (err) { showToast(err.message); }
    });
  });
}

async function loadLostFound() {
  const q = $("#lfSearch").value.trim();
  const type = $("#lfTypeFilter").value;
  const status = $("#lfStatusFilter").value;
  const params = new URLSearchParams({ q, type, status });
  try {
    const items = await apiRequest(`/lostfound?${params}`);
    renderLostFound(items);
  } catch (err) {
    $("#lfGrid").innerHTML = `<p class="empty-state">Backend connect nahi zala. Flask server (python app.py) chalu aahe ka check kara.</p>`;
  }
}

$("#lfSearch").addEventListener("input", debounce(loadLostFound, 300));
$("#lfTypeFilter").addEventListener("change", loadLostFound);
$("#lfStatusFilter").addEventListener("change", loadLostFound);

// segmented control (lost/found) inside modal
$all("#lfTypeSegment .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $all("#lfTypeSegment .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $("#lfType").value = btn.dataset.value;
  });
});

$("#formLostFound").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = $("#lfFormMsg");
  msgEl.textContent = "";
  msgEl.className = "form-msg";
  try {
    await apiRequest("/lostfound", {
      method: "POST",
      body: JSON.stringify({
        type: $("#lfType").value,
        item_name: $("#lfItemName").value.trim(),
        description: $("#lfDescription").value.trim(),
        location: $("#lfLocation").value.trim(),
        posted_by: $("#lfPostedBy").value.trim(),
        contact: $("#lfContact").value.trim(),
      }),
    });
    msgEl.textContent = "Board var pin zala!";
    msgEl.classList.add("success");
    e.target.reset();
    $("#modal-lostfound").classList.remove("open");
    loadLostFound();
    loadStats();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.classList.add("error");
  }
});

// ================================================================
// NOTICE BOARD
// ================================================================

const noticeAccent = {
  urgent: "var(--red)", event: "var(--amber)", exam: "var(--navy-soft)", general: "var(--cork)"
};

function renderNotices(items) {
  const grid = $("#noticeGrid");
  if (!items.length) {
    grid.innerHTML = `<p class="empty-state">Ajun koni notice pin keli nahi — sursurvat tumhi kara! 📣</p>`;
    return;
  }
  grid.innerHTML = items.map((n) => `
    <div class="pin-card" style="--card-accent:${noticeAccent[n.category] || 'var(--amber)'}">
      <div class="card-top-row">
        <span class="badge" style="background:${noticeAccent[n.category] || 'var(--amber)'}">${n.category}</span>
      </div>
      <h4 class="card-title">${escapeHtml(n.title)}</h4>
      ${n.description ? `<p class="card-desc">${escapeHtml(n.description)}</p>` : ''}
      <div class="card-meta">
        <span>${escapeHtml(n.posted_by || 'Anonymous')} · ${timeAgo(n.created_at)}</span>
      </div>
      <div class="card-actions">
        <button class="btn-mini danger" data-delete-notice="${n.id}">Delete</button>
      </div>
    </div>
  `).join("");

  $all("[data-delete-notice]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("ही notice delete karायची?")) return;
      try {
        await apiRequest(`/notices/${btn.dataset.deleteNotice}`, { method: "DELETE" });
        showToast("Delete zala");
        loadNotices();
        loadStats();
      } catch (err) { showToast(err.message); }
    });
  });
}

let activeNoticeCategory = "all";

async function loadNotices() {
  try {
    const items = await apiRequest(`/notices?category=${activeNoticeCategory}`);
    renderNotices(items);
  } catch (err) {
    $("#noticeGrid").innerHTML = `<p class="empty-state">Backend connect nahi zala. Flask server chalu aahe ka check kara.</p>`;
  }
}

$all("#noticeCategoryChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $all("#noticeCategoryChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeNoticeCategory = chip.dataset.cat;
    loadNotices();
  });
});

$("#formNotice").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = $("#noticeFormMsg");
  msgEl.textContent = "";
  msgEl.className = "form-msg";
  try {
    await apiRequest("/notices", {
      method: "POST",
      body: JSON.stringify({
        title: $("#noticeTitle").value.trim(),
        description: $("#noticeDescription").value.trim(),
        category: $("#noticeCategory").value,
        posted_by: $("#noticePostedBy").value.trim(),
      }),
    });
    msgEl.textContent = "Notice pin zali!";
    msgEl.classList.add("success");
    e.target.reset();
    $("#modal-notice").classList.remove("open");
    loadNotices();
    loadStats();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.classList.add("error");
  }
});

// ================================================================
// SKILL EXCHANGE
// ================================================================

function renderSkills(items) {
  const grid = $("#skillGrid");
  if (!items.length) {
    grid.innerHTML = `<p class="empty-state">Ajun koni skill list keli nahi — pahili post tumchi asu shakte! 🔁</p>`;
    return;
  }
  grid.innerHTML = items.map((s) => `
    <div class="pin-card" style="--card-accent:var(--green)">
      <div class="card-top-row">
        <span class="badge" style="background:var(--green)">offers</span>
      </div>
      <h4 class="card-title">${escapeHtml(s.skill_offered)}</h4>
      ${s.skill_wanted ? `<p class="card-desc">wants to learn: <b>${escapeHtml(s.skill_wanted)}</b></p>` : ''}
      ${s.description ? `<p class="card-desc">${escapeHtml(s.description)}</p>` : ''}
      <div class="card-meta">
        <span>${escapeHtml(s.name)} · ${timeAgo(s.created_at)}</span>
        <span>☎ ${escapeHtml(s.contact)}</span>
      </div>
      <div class="card-actions">
        <button class="btn-mini danger" data-delete-skill="${s.id}">Delete</button>
      </div>
    </div>
  `).join("");

  $all("[data-delete-skill]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hi listing delete karायची?")) return;
      try {
        await apiRequest(`/skills/${btn.dataset.deleteSkill}`, { method: "DELETE" });
        showToast("Delete zala");
        loadSkills();
        loadStats();
      } catch (err) { showToast(err.message); }
    });
  });
}

async function loadSkills() {
  const q = $("#skillSearch").value.trim();
  try {
    const items = await apiRequest(`/skills?q=${encodeURIComponent(q)}`);
    renderSkills(items);
  } catch (err) {
    $("#skillGrid").innerHTML = `<p class="empty-state">Backend connect nahi zala. Flask server chalu aahe ka check kara.</p>`;
  }
}

$("#skillSearch").addEventListener("input", debounce(loadSkills, 300));

$("#formSkill").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = $("#skillFormMsg");
  msgEl.textContent = "";
  msgEl.className = "form-msg";
  try {
    await apiRequest("/skills", {
      method: "POST",
      body: JSON.stringify({
        name: $("#skillName").value.trim(),
        skill_offered: $("#skillOffered").value.trim(),
        skill_wanted: $("#skillWanted").value.trim(),
        description: $("#skillDescription").value.trim(),
        contact: $("#skillContact").value.trim(),
      }),
    });
    msgEl.textContent = "Skill exchange var post zala!";
    msgEl.classList.add("success");
    e.target.reset();
    $("#modal-skill").classList.remove("open");
    loadSkills();
    loadStats();
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.classList.add("error");
  }
});

// ================================================================
// STATS
// ================================================================

async function loadStats() {
  try {
    const s = await apiRequest("/stats");
    $("#statLF").textContent = s.open_lost_found;
    $("#statNotices").textContent = s.notices;
    $("#statSkills").textContent = s.skills;
  } catch (err) {
    // backend down asel tar stats gappa gap raheel
  }
}

// ---------------- Debounce helper ----------------

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ---------------- Init ----------------

loadLostFound();
loadNotices();
loadSkills();
loadStats();
