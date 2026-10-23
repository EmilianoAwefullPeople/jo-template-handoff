(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const label = d => (/^\d+$/.test(d.id) ? "#" + d.id : d.id);

  const STATUS_ORDER = ["ready-for-dev", "in-build", "spec-ready", "design-done", "shipped"];
  const STATUS_LABEL = {
    "design-done": "Design done",
    "spec-ready": "Spec ready",
    "ready-for-dev": "Ready for dev",
    "in-build": "In build",
    "shipped": "Shipped"
  };
  const GROUP_LABEL = { postcards: "Postcards", recap: "Trip recap slides", format3: "Format 3" };
  const FILLEDBY_LABEL = { ai: "AI", software: "Software", static: "Static", user: "User" };

  let DATA = null;
  let FAMILY_BY_ID = {};
  let state = { status: "all", group: "all", type: "all", family: "all", query: "" };
  let visible = [];
  let openIndex = -1;
  let previewIndex = 0;

  fetch("templates.json")
    .then(r => r.json())
    .then(data => { DATA = data; init(); })
    .catch(err => {
      $("content").innerHTML = `<p class="empty">Could not load templates.json (${esc(err.message)}). If you're previewing locally, serve this folder with a simple server, e.g. <code>python3 -m http.server</code>.</p>`;
    });

  function init() {
    $("updated").textContent = `Version ${DATA.version} · last updated ${formatDate(DATA.updated)}`;
    $("trackerLink").href = DATA.trackerUrl;
    $("jsonLink").textContent = location.origin + location.pathname.replace(/index\.html$/, "") + "templates.json";

    $("rulesList").innerHTML = DATA.rules.map(r => `<li>${esc(r)}</li>`).join("");
    $("checklistList").innerHTML = DATA.readyForDevChecklist.map(c => `<li>${esc(c)}</li>`).join("");

    (DATA.families || []).forEach(f => { FAMILY_BY_ID[f.id] = f; });
    if ($("setRulesList")) $("setRulesList").innerHTML = (DATA.setRules || []).map(r => `<li>${esc(r)}</li>`).join("");
    if ($("photoSelectionList")) $("photoSelectionList").innerHTML = (DATA.photoSelectionRules || []).map(r => `<li>${esc(r)}</li>`).join("");
    if ($("formattingList")) $("formattingList").innerHTML = (DATA.formattingRules || []).map(r => `<li>${esc(r)}</li>`).join("");
    if ($("renderingRulesList")) $("renderingRulesList").innerHTML = (DATA.renderingRules || []).map(r => `<li>${esc(r)}</li>`).join("");
    if ($("manualRulesList")) $("manualRulesList").innerHTML = (DATA.manualCreationRules || []).map(r => `<li>${esc(r)}</li>`).join("");
    if ($("familiesList")) $("familiesList").innerHTML = (DATA.families || []).map(f =>
      `<li><strong>${esc(f.id)} · ${esc(f.name)}</strong>: ${esc(f.summary)}</li>`).join("");
    if ($("priorityNote")) $("priorityNote").textContent = DATA.priorityNote || "";

    $("changelogList").innerHTML = DATA.changelog.map(c => `<li><strong>${esc(c.version)}</strong> (${formatDate(c.date)}) — ${esc(c.note)}</li>`).join("");

    renderSummaryBar();
    renderTabs();
    renderFilterSelects();
    renderContent();
    bindEvents();

    if (location.hash.startsWith("#t-")) openDetail(location.hash.slice(3));
  }

  function formatDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  // ── Summary bar ──────────────────────────────────
  function renderSummaryBar() {
    const counts = {};
    DATA.templates.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    $("summaryBar").innerHTML = STATUS_ORDER.filter(s => counts[s]).map(s =>
      `<span class="summary-chip"><strong>${counts[s]}</strong> ${esc(STATUS_LABEL[s].toLowerCase())}</span>`
    ).join("");
  }

  // ── Toolbar ──────────────────────────────────────
  function renderTabs() {
    const tabs = [{ id: "all", name: "All", n: DATA.templates.length }]
      .concat(STATUS_ORDER.filter(s => DATA.templates.some(t => t.status === s))
        .map(s => ({ id: s, name: STATUS_LABEL[s], n: DATA.templates.filter(t => t.status === s).length })));
    $("statusTabs").innerHTML = tabs.map(t =>
      `<button class="tab${state.status === t.id ? " active" : ""}" role="tab" data-status="${t.id}" aria-selected="${state.status === t.id}">
        ${esc(t.name)} <span class="n">${t.n}</span>
      </button>`).join("");
  }

  function renderFilterSelects() {
    const groups = [...new Set(DATA.templates.map(t => t.group))];
    $("groupFilter").innerHTML = `<option value="all">All groups</option>` +
      groups.map(g => `<option value="${esc(g)}">${esc(GROUP_LABEL[g] || g)}</option>`).join("");
    const types = [...new Set(DATA.templates.map(t => t.type))].sort();
    $("typeFilter").innerHTML = `<option value="all">All types</option>` +
      types.map(t => `<option value="${esc(t)}">${esc(typeLabel(t))}</option>`).join("");
    if ($("familyFilter")) {
      const families = (DATA.families || []).filter(f => DATA.templates.some(t => t.family === f.id));
      $("familyFilter").innerHTML = `<option value="all">All families</option>` +
        families.map(f => `<option value="${esc(f.id)}">${esc(f.id)} · ${esc(f.name)}</option>`).join("");
    }
  }

  function typeLabel(t) {
    return t.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  }

  function setActiveTabs() {
    document.querySelectorAll("#statusTabs .tab").forEach(b => b.classList.toggle("active", b.dataset.status === state.status));
  }

  // ── Cards ──────────────────────────────────────────
  function cardHTML(d) {
    const imgs = d.previews || [];
    const flagCount = (d.blockers || []).length + (d.followUps || []).length;
    let cover;
    if (imgs.length) {
      cover = `<div class="cover"><img src="${esc(imgs[0])}" alt="${esc(d.name)}" loading="lazy"></div>`;
    } else {
      cover = `<div class="cover placeholder"><div class="placeholder-inner"><div class="pid">${esc(label(d))}</div><div class="ptxt">No preview yet</div></div></div>`;
    }
    const sizes = (d.outputSizes || []).map(s => s.label).join(", ") || "—";
    const fam = d.family && FAMILY_BY_ID[d.family];
    return `<button class="card" data-id="${esc(d.id)}">
      ${cover}
      <div class="card-body">
        <span class="card-id">${esc(label(d))} · ${esc(sizes)}</span>
        <span class="card-name">${esc(d.name)}</span>
        <span class="card-meta">
          <span class="card-type">${esc(typeLabel(d.type))}</span>
          ${fam ? `<span class="card-family">${esc(fam.id)} · ${esc(fam.name)}</span>` : ""}
          ${pill(d)}
        </span>
        ${flagCount ? `<span class="card-flags">${flagCount} blocker${flagCount > 1 ? "s" : ""}/follow-up${flagCount > 1 ? "s" : ""}</span>` : ""}
      </div>
    </button>`;
  }

  const pill = d => `<span class="pill pill-${d.status}">${esc(STATUS_LABEL[d.status] || d.status)}</span>`;

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return DATA.templates.filter(d =>
      (state.status === "all" || d.status === state.status) &&
      (state.group === "all" || d.group === state.group) &&
      (state.type === "all" || d.type === state.type) &&
      (state.family === "all" || d.family === state.family) &&
      (!q || [d.id, label(d), d.name, d.type, d.summary || ""].join(" ").toLowerCase().includes(q))
    );
  }

  function renderContent() {
    const items = filtered();
    const content = $("content");
    if (!items.length) {
      visible = [];
      content.innerHTML = `<p class="empty">No templates match these filters.</p>`;
      return;
    }
    // ready-for-dev first, then by group order, then numeric/alpha id
    const sorted = items.slice().sort((a, b) => {
      const ra = a.status === "ready-for-dev" ? 0 : 1;
      const rb = b.status === "ready-for-dev" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return idSort(a.id) - idSort(b.id);
    });
    visible = sorted;
    content.innerHTML = `<div class="grid">${sorted.map(cardHTML).join("")}</div>`;
  }

  function idSort(id) {
    const n = parseInt(id.replace(/\D/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  // ── Detail dialog ──────────────────────────────────
  const dialog = $("detail");

  function openDetail(id) {
    const idx = visible.findIndex(d => d.id === id);
    openIndex = idx >= 0 ? idx : (visible = DATA.templates, visible.findIndex(d => d.id === id));
    if (openIndex < 0) return;
    previewIndex = 0;
    fillDetail();
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, "", "#t-" + id);
  }

  function fillDetail() {
    const d = visible[openIndex];
    const imgs = d.previews || [];

    $("detailId").textContent = label(d);
    $("detailTitle").textContent = d.name;
    $("detailStatus").innerHTML = pill(d);
    $("detailGroup").textContent = GROUP_LABEL[d.group] || d.group;
    $("detailType").textContent = typeLabel(d.type);
    $("detailSizes").textContent = (d.outputSizes || []).map(s => `${s.label} (${s.w}×${s.h}${s.priority ? ", " + s.priority : ""})`).join("; ") || "—";
    $("detailTracker").innerHTML = `<a href="${esc(DATA.trackerUrl)}#t-${esc(d.trackerId)}" target="_blank" rel="noopener">#${esc(d.trackerId)} on the design tracker</a>`;

    $("detailMedia").innerHTML = imgs.length
      ? `<div class="main"><img src="${esc(imgs[previewIndex])}" alt="${esc(d.name)}"></div>
         ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) =>
            `<button data-preview="${i}" class="${i === previewIndex ? "active" : ""}" aria-label="Preview ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}`
      : `<div class="main placeholder"><div class="placeholder-inner"><div class="pid">${esc(label(d))}</div><div class="ptxt">No preview yet</div></div></div>`;

    $("detailBody").innerHTML = detailBodyHTML(d);

    $("prevItem").style.visibility = openIndex === 0 ? "hidden" : "";
    $("nextItem").style.visibility = openIndex === visible.length - 1 ? "hidden" : "";

    $("copySpec").classList.remove("copied");
    $("copySpec").textContent = "Copy spec for Claude Code";
  }

  function detailBodyHTML(d) {
    const sec = (title, inner, cls = "") => inner ? `<div class="detail-section ${cls}"><h3>${esc(title)}</h3>${inner}</div>` : "";

    const overview = d.summary ? `<p>${esc(d.summary)}</p>` : "";

    let family = "";
    if (d.family && FAMILY_BY_ID[d.family]) {
      const f = FAMILY_BY_ID[d.family];
      family = `<p><strong>${esc(f.id)} · ${esc(f.name)}</strong></p><p>${esc(f.summary)}</p>` +
        (f.sharedRules && f.sharedRules.length ? `<ul>${f.sharedRules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : "");
    }

    let variants = "";
    if (d.variants && d.variants.length) {
      variants = `<div class="variant-grid">${d.variants.map(v => `
        <div class="variant-card">
          ${v.preview ? `<img src="${esc(v.preview)}" alt="${esc(v.name)}">` : ""}
          <span class="variant-name">${esc(v.id)} · ${esc(v.name)}</span>
          ${v.figmaUrl ? `<a href="${esc(v.figmaUrl)}" target="_blank" rel="noopener">Open in Figma →</a>` : ""}
        </div>`).join("")}</div>`;
    }

    let assetsSec = "";
    if (d.assets && d.assets.length) {
      assetsSec = `<ul class="asset-list">${d.assets.map(a => `<li>
        <a href="${esc(a.path)}" target="_blank" rel="noopener">${esc(a.path.split("/").pop())}</a>
        <span class="muted">${esc(a.what)}${a.blendMode ? ` · ${esc(a.blendMode)}${a.opacity != null ? ` ${Math.round(a.opacity * 100)}%` : ""}` : ""}</span>
      </li>`).join("")}</ul>`;
    }

    let figma = "";
    if (d.figma) {
      figma = `<p><a href="${esc(d.figma.url)}" target="_blank" rel="noopener">Open Figma section →</a></p>` +
        (d.outputSizes && d.outputSizes.length ? `<p>${d.outputSizes.map(s => `${esc(s.label)} · ${s.w}×${s.h} · node ${esc(s.figmaNode)} · ${esc(s.priority)}`).join("<br>")}</p>` : "") +
        (d.figma.layers && d.figma.layers.length ? `<table class="layer-map">${d.figma.layers.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.what)}</td></tr>`).join("")}</table>` : "");
    } else if (d.status === "design-done") {
      figma = `<p class="muted">No engineering spec yet. See the design tracker for status.</p>`;
    }

    const previews = (d.previews || []).length > 1
      ? `<p>${d.previews.length} preview image(s), shown above.</p>` : "";

    let photos = "";
    if (d.photos) {
      photos = `<dl class="props" style="grid-template-columns:140px 1fr;margin-top:0">
        <dt>Count</dt><dd>${esc(d.photos.count)}</dd>
        <dt>Orientation</dt><dd>${esc(d.photos.preferredOrientation)}</dd>
        <dt>Crop</dt><dd>${esc(d.photos.crop)}</dd>
        <dt>Group selection</dt><dd>${esc(d.photos.groupSelection)}</dd>
      </dl>`;
    }

    let fields = "";
    if (d.fields && d.fields.length) {
      fields = `<div class="table-wrap"><table class="data-contract">
        <thead><tr><th>Field</th><th>Example</th><th>Filled by</th><th>Source</th><th>Constraints</th><th>Fallback</th></tr></thead>
        <tbody>${d.fields.map(f => `<tr>
          <td>${esc(f.key)}</td>
          <td>${esc(f.example)}</td>
          <td><span class="badge-filledby badge-${esc(f.filledBy)}">${esc(FILLEDBY_LABEL[f.filledBy] || f.filledBy)}</span></td>
          <td>${esc(f.source)}</td>
          <td>${esc(f.constraints)}${f.aiGuidance ? `<br><em>${esc(f.aiGuidance)}</em>` : ""}${f.safetyNet ? `<br><span class="muted">Safety net: ${esc(f.safetyNet)}</span>` : ""}</td>
          <td>${esc(f.fallback)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`;
    }

    let autoGen = "";
    if (d.autoGeneration) {
      autoGen = `<p><strong>Eligible when:</strong> ${esc(d.autoGeneration.eligibleWhen)}</p>
        <p><strong>Priority:</strong> ${esc(d.autoGeneration.priority)}</p>
        ${d.autoGeneration.maxPerOutputSet != null ? `<p><strong>Max per output set:</strong> ${esc(d.autoGeneration.maxPerOutputSet)}</p>` : ""}
        ${d.autoGeneration.notes && d.autoGeneration.notes.length ? `<ul>${d.autoGeneration.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}`;
    }

    let fallbacks = "";
    if (d.fallbackCases && d.fallbackCases.length) {
      fallbacks = `<div class="table-wrap"><table class="data-contract">
        <thead><tr><th>When</th><th>Then</th></tr></thead>
        <tbody>${d.fallbackCases.map(c => `<tr><td>${esc(c.when)}</td><td>${esc(c.then)}</td></tr>`).join("")}</tbody>
      </table></div>`;
    }

    const rendering = (d.rendering && d.rendering.length) ? `<ul>${d.rendering.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : "";

    let manual = "";
    if (d.manualCreation) {
      const sharedRules = DATA.manualCreationRules || [];
      manual = `<p><strong>${d.manualCreation.final ? "Final" : "Preliminary, not final"}</strong></p>
        ${sharedRules.length ? `<p class="muted">Shared manual-creation rules (apply to every template):</p><ul>${sharedRules.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        <p class="muted">This template:</p>
        <ul>${(d.manualCreation.notes || []).map(n => `<li>${esc(n)}</li>`).join("")}</ul>`;
    }

    let engineDeps = "";
    if (d.engineDependencies && d.engineDependencies.length) {
      engineDeps = `<ul>${d.engineDependencies.map(e => `<li>${esc(e.change)} <span class="muted">(${esc(e.specRef)})</span></li>`).join("")}</ul>`;
    }

    let flags = "";
    const blockers = d.blockers || [], followUps = d.followUps || [], openQ = d.openQuestions || [];
    if (blockers.length || followUps.length || openQ.length) {
      flags = (blockers.length ? `<p><strong>Blockers</strong></p><ul>${blockers.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : `<p><strong>Blockers:</strong> none.</p>`) +
        (followUps.length ? `<p><strong>Follow-ups</strong></p><ul>${followUps.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "") +
        (openQ.length ? `<p><strong>Open questions</strong></p><ul>${openQ.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : "");
    } else {
      flags = `<p><strong>Blockers:</strong> none.</p>`;
    }

    return sec("Overview", overview) +
      sec("Family", family) +
      sec("Figma", figma) +
      sec("Variants", variants) +
      sec("Previews", previews) +
      sec("Photo input", photos) +
      sec("Data contract", fields) +
      sec("Auto-generation", autoGen) +
      sec("Fallbacks", fallbacks) +
      sec("Rendering", rendering) +
      sec("Assets", assetsSec) +
      (d.manualCreation ? sec("Manual creation", manual, d.manualCreation.final ? "" : "preliminary") : "") +
      sec("Engine dependencies", engineDeps) +
      sec("Blockers / follow-ups / open questions", flags);
  }

  function step(delta) {
    const next = openIndex + delta;
    if (next < 0 || next >= visible.length) return;
    openIndex = next;
    previewIndex = 0;
    fillDetail();
    history.replaceState(null, "", "#t-" + visible[openIndex].id);
  }

  // ── Markdown export ──────────────────────────────────
  function markdownFor(d) {
    const lines = [];
    lines.push(`# ${label(d)} · ${d.name}`);
    lines.push("");
    lines.push("## Foundational rules (apply to every template)");
    DATA.rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("");
    lines.push("## Ready-for-dev checklist");
    DATA.readyForDevChecklist.forEach(c => lines.push(`- [ ] ${c}`));
    lines.push("");
    lines.push(`## ${d.name}`);
    lines.push("");
    lines.push(`Status: **${STATUS_LABEL[d.status] || d.status}** · Group: ${GROUP_LABEL[d.group] || d.group} · Type: ${typeLabel(d.type)} · Tracker: #${d.trackerId}`);
    lines.push("");
    if (d.summary) lines.push(d.summary, "");
    if (d.figma) {
      lines.push(`Figma section: ${d.figma.url}`);
      lines.push("");
    }
    lines.push("## Full template JSON");
    lines.push("```json");
    lines.push(JSON.stringify(d, null, 2));
    lines.push("```");
    lines.push("");
    lines.push(`Figma file: ${DATA.figmaFile.url}`);
    lines.push(`Tracker: ${DATA.trackerUrl}`);
    return lines.join("\n");
  }

  // ── Events ─────────────────────────────────────────
  function bindEvents() {
    $("statusTabs").addEventListener("click", e => {
      const b = e.target.closest("[data-status]");
      if (!b) return;
      state.status = b.dataset.status;
      setActiveTabs();
      renderContent();
    });
    $("groupFilter").addEventListener("change", e => { state.group = e.target.value; renderContent(); });
    $("typeFilter").addEventListener("change", e => { state.type = e.target.value; renderContent(); });
    if ($("familyFilter")) $("familyFilter").addEventListener("change", e => { state.family = e.target.value; renderContent(); });
    $("search").addEventListener("input", e => { state.query = e.target.value; renderContent(); });

    $("content").addEventListener("click", e => {
      const card = e.target.closest(".card");
      if (card) openDetail(card.dataset.id);
    });

    $("detailMedia").addEventListener("click", e => {
      const b = e.target.closest("[data-preview]");
      if (!b) return;
      previewIndex = Number(b.dataset.preview);
      fillDetail();
    });

    $("closeDetail").addEventListener("click", () => { dialog.close(); history.replaceState(null, "", location.pathname + location.search); });
    $("prevItem").addEventListener("click", () => step(-1));
    $("nextItem").addEventListener("click", () => step(1));
    dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
    document.addEventListener("keydown", e => {
      if (!dialog.open) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });

    $("copySpec").addEventListener("click", () => {
      const d = visible[openIndex];
      const md = markdownFor(d);
      navigator.clipboard.writeText(md).then(() => {
        $("copySpec").classList.add("copied");
        $("copySpec").textContent = "Copied ✓";
        setTimeout(() => { $("copySpec").classList.remove("copied"); $("copySpec").textContent = "Copy spec for Claude Code"; }, 1800);
      });
    });

    $("downloadJson").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "templates.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    window.addEventListener("hashchange", () => {
      if (location.hash.startsWith("#t-")) openDetail(location.hash.slice(3));
    });
  }
})();
