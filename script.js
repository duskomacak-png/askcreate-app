/* START WORK PRO by AskCreate - MVP v1
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";
const APP_VERSION = "1.11.6";


let sb = null;
let currentCompany = null;
let editingPersonId = null;
let currentWorker = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function initSupabase() {
  if (!SUPABASE_KEY || SUPABASE_KEY.includes("OVDE_NALEPI")) {
    toast("Nije ubačen Supabase Publishable key u script.js. Otvori script.js i zameni placeholder.", true);
    return false;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.borderColor = isError ? "rgba(211,47,47,.65)" : "rgba(245,185,66,.35)";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4500);
}



function ensureDirectorTopLogoutButton() {
  const dash = $("#viewDirectorDashboard");
  if (!dash || $("#directorTopLogoutBtn")) return;
  const head = dash.querySelector(".dashboard-head");
  if (!head) return;
  let actions = head.querySelector(".actions") || head.querySelector(".top-actions") || head.querySelector(".head-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "actions head-actions";
    head.appendChild(actions);
  }
  const btn = document.createElement("button");
  btn.id = "directorTopLogoutBtn";
  btn.className = "secondary";
  btn.type = "button";
  btn.textContent = "Odjavi se";
  btn.addEventListener("click", signOut);
  actions.appendChild(btn);
}



function showCurrentCompanyLoginInfo() {
  const box = $("#directorWorkerCodeHelpBox");
  if (!box || !currentCompany) return;
  const companyCode = currentCompany.code || currentCompany.company_code || "";
  box.innerHTML = `
    <b>Prijava radnika:</b>
    <span>Šifra firme je <strong>${escapeHtml(companyCode)}</strong>. Ovde upisuješ samo ličnu šifru radnika.</span>
  `;
}

function normalizeLoginCode(code) {
  return String(code || "").trim().toLowerCase();
}

function setInternalHeader(title = "", subtitle = "", showHeader = true) {
  const header = $("#internalHeader");
  if (!header) return;
  const titleEl = $("#internalTitle");
  const subtitleEl = $("#internalSubtitle");
  if (titleEl) titleEl.textContent = title || "Radni prostor";
  if (subtitleEl) subtitleEl.textContent = subtitle || "";
  header.classList.toggle("hidden", !showHeader);
  document.body.classList.toggle("in-app", !!showHeader);
}

function show(view) {
  const publicViews = ["Home", "AdminLogin", "DirectorLogin", "WorkerLogin"];
  if (publicViews.includes(view)) {
    setInternalHeader("", "", false);
  }

  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $("#view" + view);
  if (el) el.classList.add("active");
  $("#logoutBtn").classList.toggle("hidden", !["AdminDashboard", "DirectorDashboard"].includes(view));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCode(s) {
  return String(s || "").trim().toLowerCase();
}

async function signUp(email, password) {
  if (!initSupabase()) return null;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  if (!initSupabase()) return null;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  if (sb) await sb.auth.signOut();
  currentCompany = null;
  localStorage.removeItem("swp_worker");
  setInternalHeader("", "", false);
  show("Home");
}

async function ensureAdmin() {
  const { data, error } = await sb.from("app_admins").select("*").eq("email", "duskomacak@gmail.com").maybeSingle();
  if (error || !data || !data.active) throw new Error("Ovaj nalog nema Super Admin dozvolu.");
  return true;
}

async function loadAdmin() {
  await ensureAdmin();
  setInternalHeader("Admin soba", "Odobravanje firmi", true);
  show("AdminDashboard");
  await Promise.all([loadApprovedCompanies(), loadCompanies()]);
}

async function loadApprovedCompanies() {
  const { data, error } = await sb.from("approved_companies").select("*").order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#approvedCompaniesList").innerHTML = (data || []).map(c => `
    <div class="item">
      <strong>${escapeHtml(c.company_name)}</strong>
      <small>${escapeHtml(c.approved_email)} · šifra: ${escapeHtml(c.company_code)} · pozivni: ${escapeHtml(c.invite_code)}</small><br/>
      <span class="pill">${escapeHtml(c.status)}</span>
      <span class="pill">registrovana: ${c.registered ? "DA" : "NE"}</span>
      <div class="actions">
        <button class="secondary" onclick="adminSetApprovedStatus('${c.id}','active')">Aktiviraj</button>
        <button class="secondary" onclick="adminSetApprovedStatus('${c.id}','blocked')">Blokiraj</button>
      </div>
    </div>`).join("") || `<p class="muted">Nema odobrenih firmi.</p>`;
}

async function loadCompanies() {
  const { data, error } = await sb.from("companies").select("*").order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#companiesList").innerHTML = (data || []).map(c => `
    <div class="item">
      <strong>${escapeHtml(c.name)}</strong>
      <small>${escapeHtml(c.owner_email)} · šifra: ${escapeHtml(c.company_code)}</small><br/>
      <span class="pill">${escapeHtml(c.status)}</span>
      <span class="pill">${escapeHtml(c.plan)}</span>
      <div class="actions">
        <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','active')">Active</button>
        <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','expired')">Expired</button>
        <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','blocked')">Blocked</button>
      </div>
    </div>`).join("") || `<p class="muted">Još nema registrovanih firmi.</p>`;
}

window.adminSetApprovedStatus = async (id, status) => {
  const { error } = await sb.from("approved_companies").update({ status }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status promenjen.");
  loadApprovedCompanies();
};

window.adminSetCompanyStatus = async (id, status) => {
  const { error } = await sb.from("companies").update({ status }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status firme promenjen.");
  loadCompanies();
};

async function loadDirectorCompany() {
  const { data: userData } = await sb.auth.getUser();
  const email = userData?.user?.email;
  if (!email) throw new Error("Nema aktivnog Direkcija login-a.");

  const { data, error } = await sb.from("companies").select("*").eq("owner_email", email).maybeSingle();
  if (error) throw error;
  if (!data) {
    show("DirectorLogin");
    toast("Email je prijavljen, ali firma još nije aktivirana. Unesi šifru firme i pozivni kod.");
    return null;
  }
  currentCompany = data;
  $("#directorCompanyLabel").textContent = `${data.name} · ${data.company_code} · ${data.status}`;
  setInternalHeader("Direkcija", (currentCompany?.name || activeCompany?.name || "Firma"), true);
  show("DirectorDashboard");
  ensureDirectorTopLogoutButton();
  showCurrentCompanyLoginInfo();
  await Promise.all([loadPeople(), loadSites(), loadAssets(), loadMaterials(), loadReports()]);
  return data;
}











function setPersonFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = $("#personFormTitle");
  const btn = $("#addPersonBtn");
  const cancel = $("#cancelEditPersonBtn");
  if (title) title.textContent = editing ? "✏️ Uredi profil radnika" : "+ Dodaj osobu";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj osobu";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearPersonForm() {
  ["personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  $$(".perm").forEach(ch => { ch.checked = ch.value === "daily_work"; });
  editingPersonId = null;
  setPersonFormMode("add");
}

window.editPerson = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data: person, error } = await sb
      .from("company_users")
      .select("*")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();
    if (error) throw error;
    if (!person) throw new Error("Radnik nije pronađen.");

    editingPersonId = person.id;
    $("#personFirst").value = person.first_name || "";
    $("#personLast").value = person.last_name || "";
    $("#personFunction").value = person.function_title || "";
    $("#personCode").value = person.access_code || "";

    const permissions = person.permissions || {};
    $$(".perm").forEach(ch => { ch.checked = !!permissions[ch.value]; });

    setPersonFormMode("edit");
    toast("Profil radnika je otvoren za izmenu.");
    const title = $("#personFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    toast(e.message, true);
  }
};

async function savePersonForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");

    const firstName = $("#personFirst").value.trim();
    const lastName = $("#personLast").value.trim();
    const functionTitle = $("#personFunction").value.trim();
    const code = normalizeLoginCode($("#personCode").value);

    if (!firstName) throw new Error("Upiši ime radnika.");
    if (!lastName) throw new Error("Upiši prezime radnika.");
    if (!functionTitle) throw new Error("Upiši funkciju radnika.");
    if (code.length < 4) throw new Error("Šifra radnika mora imati najmanje 4 karaktera.");

    let duplicateQuery = sb
      .from("company_users")
      .select("id")
      .eq("company_id", currentCompany.id)
      .eq("access_code", code)
      .eq("active", true);
    if (editingPersonId) duplicateQuery = duplicateQuery.neq("id", editingPersonId);

    const { data: existingCode, error: existingCodeError } = await duplicateQuery.maybeSingle();
    if (existingCodeError) throw existingCodeError;
    if (existingCode) throw new Error("U ovoj firmi već postoji aktivan radnik sa tom šifrom. Izaberi drugu šifru radnika.");

    const payload = {
      company_id: currentCompany.id,
      first_name: firstName,
      last_name: lastName,
      function_title: functionTitle,
      access_code: code,
      permissions: collectPermissions(),
      active: true
    };

    if (editingPersonId) {
      const { error } = await sb
        .from("company_users")
        .update(payload)
        .eq("id", editingPersonId)
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      toast("Profil radnika je sačuvan.");
    } else {
      const { error } = await sb.from("company_users").insert(payload);
      if (error) throw error;
      toast("Radnik je dodat.");
    }

    clearPersonForm();
    loadPeople();
  } catch (e) {
    toast(e.message, true);
  }
}

window.deleteReportPermanently = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    if (!confirm("TRAJNO obrisati ovaj izveštaj iz baze?\n\nOvo se ne može vratiti.")) return;

    const { error } = await sb
      .from("reports")
      .delete()
      .eq("id", id)
      .eq("company_id", currentCompany.id);
    if (error) throw error;

    toast("Izveštaj je trajno obrisan iz baze.");
    loadReports();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
};

function renderPersonItem(p) {
  const permissionCount = Object.keys(p.permissions || {}).filter(k => p.permissions[k]).length;
  return `
    <div class="item person-card-v1116" data-person-id="${escapeHtml(p.id)}">
      <div class="item-main">
        <strong>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</strong>
        <small>${escapeHtml(p.function_title)} · šifra radnika: ${escapeHtml(p.access_code)}</small><br/>
        <span class="pill">Aktivan</span>
        <span class="pill">${permissionCount} rubrika</span>
      </div>
      <div class="person-actions-v1116">
        <button class="edit-btn" type="button" onclick="editPerson('${p.id}')">✏️ Uredi profil</button>
        <button class="delete-btn" type="button" onclick="deletePerson('${p.id}')">❌ Obriši iz spiska</button>
      </div>
    </div>
  `;
}

async function loadPeople() {
  if (!currentCompany) return;

  const { data, error } = await sb
    .from("company_users")
    .select("*")
    .eq("company_id", currentCompany.id)
    .eq("active", true)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  const list = $("#peopleList");
  if (!list) return;
  list.innerHTML = (data || []).map(renderPersonItem).join("") || `<p class="muted">Nema dodatih osoba.</p>`;
}

async function loadSites() {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("sites")
    .select("*")
    .eq("company_id", currentCompany.id)
    .eq("active", true)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  $("#sitesList").innerHTML = (data || []).map(s => `
    <div class="item management-item">
      <div class="item-main">
        <strong>${escapeHtml(s.name)}</strong>
        <small>${escapeHtml(s.location || "")}</small><br/>
        <span class="pill">Aktivno gradilište</span>
      </div>
      <div class="management-actions">
        <button class="archive-btn" type="button" onclick="archiveSite('${s.id}', '${escapeHtml(s.name || '')}')">✅ Završi / skloni gradilište</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema aktivnih gradilišta.</p>`;
}

async function loadAssets() {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("assets")
    .select("*")
    .eq("company_id", currentCompany.id)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  $("#assetsList").innerHTML = (data || []).map(a => `
    <div class="item management-item">
      <div class="item-main">
        <strong>${escapeHtml(a.name)}</strong>
        <small>${escapeHtml(a.asset_type)} · ${escapeHtml(a.registration || "")} · ${escapeHtml(a.capacity || "")}</small>
      </div>
      <div class="management-actions">
        <button class="delete-btn" type="button" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">❌ Obriši ovu mašinu/vozilo</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema mašina/vozila.</p>`;
}


async function loadMaterials() {
  if (!currentCompany) return;
  const list = $("#materialsList");
  const datalist = $("#materialsDatalist");

  const { data, error } = await sb
    .from("materials")
    .select("*")
    .eq("company_id", currentCompany.id)
    .order("created_at", { ascending:false });

  if (error) {
    if (list) list.innerHTML = `<p class="muted">Tabela materials još nije dodata u Supabase. Pokreni SQL dopunu iz supabase-dopuna-v2.sql.</p>`;
    return;
  }

  if (list) {
    list.innerHTML = (data || []).map(m => `
      <div class="item management-item">
        <div class="item-main">
          <strong>${escapeHtml(m.name)}</strong>
          <small>${escapeHtml(m.unit || "")} ${m.category ? "· " + escapeHtml(m.category) : ""}</small>
        </div>
        <div class="management-actions">
          <button class="delete-btn" type="button" onclick="deleteMaterial('${m.id}', '${escapeHtml(m.name || '')}')">❌ Obriši materijal</button>
        </div>
      </div>
    `).join("") || `<p class="muted">Nema dodatih materijala.</p>`;
  }

  if (datalist) {
    datalist.innerHTML = (data || []).map(m => `<option value="${escapeHtml(m.name)}"></option>`).join("");
  }
}


window.archiveSite = async (id, name = "") => {
  const label = name ? ` (${name})` : "";
  if (!confirm("Skloniti gradilište iz aktivnog spiska" + label + "?\\n\\nStari izveštaji ostaju sačuvani zbog evidencije.")) return;

  const { error } = await sb
    .from("sites")
    .update({ active: false })
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Gradilište je sklonjeno iz aktivnog spiska.");
  loadSites();
};

window.deletePerson = async (id, name = "") => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");

    if (!name) {
      const { data: person, error: readError } = await sb
        .from("company_users")
        .select("first_name,last_name")
        .eq("id", id)
        .eq("company_id", currentCompany.id)
        .maybeSingle();
      if (readError) throw readError;
      if (person) name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    }

    const label = name ? ` (${name})` : "";
    if (!confirm("Obrisati osobu/radnika iz aktivnog spiska" + label + "?\n\nStari izveštaji ostaju sačuvani zbog evidencije.")) return;

    const { error } = await sb
      .from("company_users")
      .update({ active: false })
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (error) throw error;
    toast("Osoba je obrisana iz aktivnog spiska.");
    clearPersonForm();
    loadPeople();
  } catch (e) {
    toast(e.message, true);
  }
};

window.deleteAsset = async (id, name = "") => {
  const label = name ? ` (${name})` : "";
  if (!confirm("Obrisati ovu mašinu/vozilo iz spiska" + label + "?")) return;

  const { error } = await sb
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Mašina/vozilo je obrisano iz spiska.");
  loadAssets();
};

window.deleteMaterial = async (id, name = "") => {
  const label = name ? ` (${name})` : "";
  if (!confirm("Obrisati ovaj materijal iz spiska" + label + "?")) return;

  const { error } = await sb
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Materijal je obrisan iz spiska.");
  loadMaterials();
};


window.archiveReport = async (id) => {
  if (!confirm("Arhivirati/skloniti ovaj izveštaj iz glavnog inbox-a?\\n\\nIzveštaj ostaje u bazi kao evidencija.")) return;
  const { error } = await sb
    .from("reports")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Izveštaj je arhiviran i sklonjen iz inbox-a.");
  loadReports();
  runDirectorGlobalSearch(false);
};

function searchMatch(text, q) {
  return String(text || "").toLowerCase().includes(String(q || "").toLowerCase());
}

async function runDirectorGlobalSearch(showEmptyMessage = true) {
  const input = $("#directorGlobalSearch");
  const box = $("#directorSearchResults");
  const list = $("#directorSearchResultsList");
  if (!input || !box || !list || !currentCompany) return;

  const q = input.value.trim().toLowerCase();
  list.innerHTML = "";
  box.classList.add("hidden");

  if (!q) {
    if (showEmptyMessage) toast("Upiši pojam za pretragu.");
    return;
  }

  box.classList.remove("hidden");

  const results = [];

  try {
    const [peopleRes, assetsRes, sitesRes, materialsRes, reportsRes] = await Promise.all([
      sb.from("company_users").select("*").eq("company_id", currentCompany.id),
      sb.from("assets").select("*").eq("company_id", currentCompany.id),
      sb.from("sites").select("*").eq("company_id", currentCompany.id),
      sb.from("materials").select("*").eq("company_id", currentCompany.id),
      sb.from("reports").select("id, report_date, status, returned_reason, data, company_users(first_name,last_name,function_title)").eq("company_id", currentCompany.id).neq("status", "archived").order("created_at", { ascending:false }).limit(150)
    ]);

    if (peopleRes.data) peopleRes.data.forEach(p => {
      const text = `${p.first_name} ${p.last_name} ${p.function_title} ${p.access_code} ${p.active ? "aktivan" : "neaktivan"}`;
      if (searchMatch(text, q)) results.push({
        type:"Radnik / osoba",
        title:`${p.first_name} ${p.last_name}`,
        subtitle:`${p.function_title} · kod: ${p.access_code} · ${p.active ? "aktivan" : "neaktivan"}`,
        actions:`${p.active ? `<button class="edit-btn" onclick="editPerson('${p.id}')">✏️ Uredi profil</button><button class="delete-btn" onclick="deletePerson('${p.id}')">❌ Obriši iz spiska</button>` : `<span class="pill">već sklonjen</span>`}`
      });
    });

    if (assetsRes.data) assetsRes.data.forEach(a => {
      const text = `${a.name} ${a.asset_type} ${a.registration || ""} ${a.capacity || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Mašina / vozilo",
        title:a.name,
        subtitle:`${a.asset_type} · ${a.registration || ""} · ${a.capacity || ""}`,
        actions:`<button class="delete-btn" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">❌ Obriši ovu mašinu/vozilo</button>`
      });
    });

    if (sitesRes.data) sitesRes.data.forEach(s => {
      const text = `${s.name} ${s.location || ""} ${s.active ? "aktivno" : "završeno sklonjeno"}`;
      if (searchMatch(text, q)) results.push({
        type:"Gradilište",
        title:s.name,
        subtitle:`${s.location || ""} · ${s.active ? "aktivno" : "završeno/sklonjeno"}`,
        actions:`${s.active ? `<button class="archive-btn" onclick="archiveSite('${s.id}', '${escapeHtml(s.name || '')}')">✅ Završi / skloni gradilište</button>` : `<span class="pill">već sklonjeno</span>`}`
      });
    });

    if (materialsRes.data) materialsRes.data.forEach(m => {
      const text = `${m.name} ${m.unit || ""} ${m.category || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Materijal",
        title:m.name,
        subtitle:`${m.unit || ""} ${m.category ? "· " + m.category : ""}`,
        actions:`<button class="delete-btn" onclick="deleteMaterial('${m.id}', '${escapeHtml(m.name || '')}')">❌ Obriši materijal</button>`
      });
    });

    if (reportsRes.data) reportsRes.data.forEach(r => {
      const d = r.data || {};
      const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : "";
      const text = `${person} ${r.status} ${r.report_date} ${d.site_name || ""} ${d.description || ""} ${d.machine || ""} ${d.vehicle || ""} ${d.material || ""} ${d.defect || ""} ${d.note || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Izveštaj",
        title:`${person || "Izveštaj"} · ${r.report_date || ""}`,
        subtitle:`status: ${r.status} · ${d.site_name || "bez gradilišta"} ${d.defect ? "· kvar: " + d.defect : ""}`,
        actions:`${r.status !== "archived" ? `<button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj izveštaj</button>` : `<span class="pill">arhivirano</span>`}`
      });
    });

    list.innerHTML = results.length ? results.map(r => `
      <div class="item management-item">
        <div class="item-main">
          <span class="search-result-type">${escapeHtml(r.type)}</span>
          <strong>${escapeHtml(r.title)}</strong>
          <small>${escapeHtml(r.subtitle || "")}</small>
        </div>
        <div class="management-actions">${r.actions}</div>
      </div>
    `).join("") : `<p class="muted">Nema rezultata za: ${escapeHtml(q)}</p>`;
  } catch(e) {
    list.innerHTML = `<p class="muted">Greška pretrage: ${escapeHtml(e.message)}</p>`;
  }
}

async function loadReports() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("reports").select("*, company_users(first_name,last_name,function_title)").eq("company_id", currentCompany.id).neq("status", "archived").order("submitted_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#reportsList").innerHTML = (data || []).map(r => reportHtml(r)).join("") || `<p class="muted">Nema poslatih izveštaja.</p>`;
}


function renderReportReadableDetails(d = {}) {
  const esc = escapeHtml;
  const safe = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
  const val = (x) => safe(x) ? esc(safe(x)) : "<span class='report-empty'>—</span>";

  const rows = (pairs) => pairs.map(([k, v]) => `<b>${esc(k)}</b><span>${val(v)}</span>`).join("");

  const machines = Array.isArray(d.machines) ? d.machines : [];
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];

  const machineTable = machines.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Mašina</th>
          <th>Početak MTČ/KM</th>
          <th>Kraj MTČ/KM</th>
          <th>Sati</th>
          <th>Rad</th>
        </tr>
      </thead>
      <tbody>
        ${machines.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(m.name)}</td>
            <td>${val(m.start)}</td>
            <td>${val(m.end)}</td>
            <td>${val(m.hours)}</td>
            <td>${val(m.work)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih mašina.</p>`;

  const fuelTable = fuels.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Mašina</th>
          <th>Litara</th>
          <th>MTČ/KM pri sipanju</th>
          <th>Sipao</th>
          <th>Primio</th>
        </tr>
      </thead>
      <tbody>
        ${fuels.map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(f.machine)}</td>
            <td>${val(f.liters)}</td>
            <td>${val(f.reading)}</td>
            <td>${val(f.by)}</td>
            <td>${val(f.receiver || d.fuel_receiver)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema sipanja goriva.</p>`;

  const hasDefect = safe(d.defect) || safe(d.defect_exists) === "da" || safe(d.defect_urgency) || safe(d.defect_status);
  const hasMaterial = safe(d.material) || safe(d.quantity) || safe(d.warehouse_item) || safe(d.route) || safe(d.tours);

  return `
    <div class="report-readable">
      <div class="report-section">
        <h4>Osnovno</h4>
        <div class="report-kv">
          ${rows([
            ["Gradilište", d.site_name],
            ["Opis rada", d.description],
            ["Sati rada", d.hours],
            ["Napomena", d.note]
          ])}
        </div>
      </div>

      <div class="report-section">
        <h4>Mašine / vozila</h4>
        ${machineTable}
      </div>

      <div class="report-section">
        <h4>Gorivo</h4>
        ${fuelTable}
      </div>

      ${hasDefect ? `
        <div class="report-section">
          <h4>Kvar</h4>
          <div class="report-kv">
            ${rows([
              ["Ima kvar", d.defect_exists],
              ["Opis kvara", d.defect],
              ["Hitnost", d.defect_urgency],
              ["Zaustavlja rad", d.defect_stops_work],
              ["Može nastaviti rad", d.defect_can_continue],
              ["Šef mehanizacije pozvan", d.called_mechanic_by_phone],
              ["Status kvara", d.defect_status]
            ])}
          </div>
        </div>` : ""}

      ${hasMaterial ? `
        <div class="report-section">
          <h4>Materijal / magacin / ture</h4>
          <div class="report-kv">
            ${rows([
              ["Materijal", d.material],
              ["Količina", d.quantity],
              ["Jedinica", d.unit],
              ["Magacin tip", d.warehouse_type],
              ["Magacin stavka", d.warehouse_item],
              ["Magacin količina", d.warehouse_qty],
              ["Relacija", d.route],
              ["Ture", d.tours]
            ])}
          </div>
        </div>` : ""}
    </div>
  `;
}

function reportHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : "Nepoznat korisnik";

  return `
    <div class="item report-item">
      <strong>${d.report_type === "defect_record" || d.report_type === "defect_alert" ? "🚨 EVIDENCIJA KVARA" : "📄 DNEVNI IZVEŠTAJ"} · ${escapeHtml(r.report_date)}</strong>
      <small>${escapeHtml(person)} · ${escapeHtml(r.company_users?.function_title || "")} · status: ${escapeHtml(r.status)}</small><br/>

      <span class="pill">${escapeHtml(d.site_name || "bez gradilišta")}</span>
      ${d.hours ? `<span class="pill">${escapeHtml(String(d.hours))} h</span>` : ""}
      ${d.fuel_liters ? `<span class="pill">${escapeHtml(String(d.fuel_liters))} L</span>` : ""}
      ${d.defect_exists === "da" ? `<span class="pill">Kvar: ${escapeHtml(d.defect_urgency || "prijavljen")}</span>` : ""}
      ${d.defect_stops_work ? `<span class="pill">Zaustavlja rad: ${escapeHtml(d.defect_stops_work)}</span>` : ""}
      ${d.defect_status ? `<span class="pill">Status kvara: ${escapeHtml(d.defect_status)}</span>` : ""}
      ${d.called_mechanic_by_phone ? `<span class="pill">Šef pozvan: ${escapeHtml(d.called_mechanic_by_phone)}</span>` : ""}

      <p>${escapeHtml(d.defect || d.description || d.note || "")}</p>
      ${r.returned_reason ? `<p class="muted">Razlog vraćanja: ${escapeHtml(r.returned_reason)}</p>` : ""}
      ${renderReportReadableDetails(d)}

      <div class="actions">
        ${d.report_type === "defect_record" || d.report_type === "defect_alert" ? `
          <button class="secondary" onclick="setDefectRecordStatus('${r.id}','primljeno')">Primljeno</button>
          <button class="secondary" onclick="setDefectRecordStatus('${r.id}','u_popravci')">U popravci</button>
          <button class="secondary" onclick="setDefectRecordStatus('${r.id}','reseno')">Rešeno</button>
        ` : ""}

        <button class="secondary" onclick="setReportStatus('${r.id}','approved')">Odobri</button>
        <button class="secondary" onclick="returnReport('${r.id}')">Vrati na dopunu</button>
        <button class="secondary" onclick="setReportStatus('${r.id}','exported')">Označi izvezeno</button>
        <button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj</button>
        <button class="hard-delete-report-btn" onclick="deleteReportPermanently('${r.id}')">🔥 Obriši iz baze</button>
      </div>
    </div>`;
}

window.setReportStatus = async (id, status) => {
  const patch = { status };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  if (status === "exported") patch.exported_at = new Date().toISOString();
  const { error } = await sb.from("reports").update(patch).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status izveštaja promenjen.");
  loadReports();
};

window.returnReport = async (id) => {
  const reason = prompt("Razlog vraćanja radniku na dopunu/ispravku:");
  if (!reason) return;
  const { error } = await sb.from("reports").update({ status:"returned", returned_reason:reason }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Izveštaj vraćen.");
  loadReports();
};

window.setDefectRecordStatus = async (id, newStatus) => {
  const { data: row, error: readError } = await sb.from("reports").select("data").eq("id", id).maybeSingle();
  if (readError) return toast(readError.message, true);
  const d = row?.data || {};
  d.defect_status = newStatus;
  if (newStatus === "primljeno") d.defect_received_at = new Date().toISOString();
  if (newStatus === "u_popravci") d.defect_repair_started_at = new Date().toISOString();
  if (newStatus === "reseno") d.defect_resolved_at = new Date().toISOString();
  const { error } = await sb.from("reports").update({ data: d }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status kvara promenjen.");
  loadReports();
};

function collectPermissions() {
  const obj = {};
  $$(".perm").forEach(ch => obj[ch.value] = ch.checked);
  return obj;
}

function workerSetSections(perms) {
  const map = {
    daily_work: "#secDailyWork",
    machines: "#secMachines",
    vehicles: "#secVehicles",
    fuel: "#secFuel",
    materials: "#secMaterials",
    warehouse: "#secWarehouse",
    defects: "#secDefects"
  };
  Object.entries(map).forEach(([key, sel]) => $(sel).classList.toggle("active", !!perms[key]));
}


function addMachineEntry(values = {}) {
  const list = $("#machineEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".machine-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card machine-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Mašina ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Mašina / vozilo</label>
    <input class="m-name" placeholder="npr. CAT 330, D6R, MAN kiper" value="${escapeHtml(values.name || "")}" />

    <div class="mini-grid">
      <div>
        <label>Početni sati / MTČ</label>
        <input class="m-start" type="number" step="0.1" placeholder="npr. 1250.5" value="${escapeHtml(values.start || "")}" />
      </div>
      <div>
        <label>Završni sati / MTČ</label>
        <input class="m-end" type="number" step="0.1" placeholder="npr. 1258.5" value="${escapeHtml(values.end || "")}" />
      </div>
    </div>

    <label>Ukupno sati rada</label>
    <input class="m-hours" type="number" step="0.1" placeholder="automatski ili ručno" value="${escapeHtml(values.hours || "")}" />

    <label>Opis rada za ovu mašinu</label>
    <input class="m-work" placeholder="iskop, utovar, ravnanje..." value="${escapeHtml(values.work || "")}" />
  `;

  const startEl = div.querySelector(".m-start");
  const endEl = div.querySelector(".m-end");
  const hoursEl = div.querySelector(".m-hours");

  function calcHours() {
    const s = parseFloat(startEl.value);
    const e = parseFloat(endEl.value);
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
      hoursEl.value = (Math.round((e - s) * 10) / 10).toString();
    }
  }

  startEl.addEventListener("input", calcHours);
  endEl.addEventListener("input", calcHours);

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    refreshFuelMachineOptions();
  });

  div.querySelector(".m-name").addEventListener("input", refreshFuelMachineOptions);
  list.appendChild(div);
  refreshFuelMachineOptions();
}

function getMachineEntries() {
  return $$("#machineEntries .machine-entry").map((el, i) => ({
    no: i + 1,
    name: el.querySelector(".m-name")?.value.trim() || "",
    start: el.querySelector(".m-start")?.value || "",
    end: el.querySelector(".m-end")?.value || "",
    hours: el.querySelector(".m-hours")?.value || "",
    work: el.querySelector(".m-work")?.value.trim() || ""
  })).filter(m => m.name || m.start || m.end || m.hours || m.work);
}

function addFuelEntry(values = {}) {
  const list = $("#fuelEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".fuel-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card fuel-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje goriva ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Za koju mašinu / vozilo</label>
    <select class="f-machine"></select>

    <label>Ako mašina nije gore dodata, upiši ručno</label>
    <input class="f-machine-custom" placeholder="npr. agregat / druga mašina" value="${escapeHtml(values.machine_custom || "")}" />

    <div class="mini-grid">
      <div>
        <label>Litara</label>
        <input class="f-liters" type="number" step="0.1" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />
      </div>
      <div>
        <label>MTČ / KM pri sipanju</label>
        <input class="f-reading" type="number" step="0.1" placeholder="npr. 1255.0" value="${escapeHtml(values.reading || "")}" />
      </div>
    </div>

    <label>Ko je sipao</label>
    <input class="f-by" placeholder="npr. Marko" value="${escapeHtml(values.by || "")}" />

    <p class="hint">Primalac goriva je automatski prijavljeni radnik koji šalje izveštaj.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => div.remove());
  list.appendChild(div);
  refreshFuelMachineOptions();

  if (values.machine) div.querySelector(".f-machine").value = values.machine;
}

function getFuelEntries() {
  return $$("#fuelEntries .fuel-entry").map((el, i) => {
    const selected = el.querySelector(".f-machine")?.value || "";
    const custom = el.querySelector(".f-machine-custom")?.value.trim() || "";
    return {
      no: i + 1,
      machine: custom || selected,
      machine_custom: custom,
      liters: el.querySelector(".f-liters")?.value || "",
      reading: el.querySelector(".f-reading")?.value || "",
      by: el.querySelector(".f-by")?.value.trim() || "",
      receiver: currentWorker?.full_name || ""
    };
  }).filter(f => f.machine || f.liters || f.reading || f.by);
}

function refreshFuelMachineOptions() {
  const machines = getMachineEntries().map(m => m.name).filter(Boolean);
  $$("#fuelEntries .f-machine").forEach(sel => {
    const old = sel.value;
    sel.innerHTML = `<option value="">-- izaberi mašinu --</option>` + machines.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    if (machines.includes(old)) sel.value = old;
  });
}


// Direktno izlaganje funkcija za onclick fallback
window.addMachineEntry = addMachineEntry;
window.addFuelEntry = addFuelEntry;
window.refreshFuelMachineOptions = refreshFuelMachineOptions;


async function loadWorkerReturnedReports() {
  const panel = $("#workerReturnedReports");
  const list = $("#workerReturnedList");
  if (!panel || !list || !currentWorker) return;

  list.innerHTML = "";
  panel.classList.add("hidden");

  try {
    const { data, error } = await sb
      .from("reports")
      .select("id, report_date, status, returned_reason, data, created_at")
      .eq("company_id", currentWorker.company_id)
      .eq("user_id", currentWorker.user_id)
      .eq("status", "returned")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || !data.length) return;

    panel.classList.remove("hidden");

    list.innerHTML = data.map(r => {
      const d = r.data || {};
      const title = d.report_type === "defect_record" || d.report_type === "defect_alert" ? "Evidencija kvara" : "Dnevni izveštaj";
      const site = d.site_name || "Bez gradilišta";
      const reason = r.returned_reason || "Direkcija nije upisala razlog.";
      const opis = d.defect || d.description || d.note || "";
      return `
        <div class="returned-item">
          <strong>↩️ ${escapeHtml(title)} — ${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(site)} ${opis ? "· " + escapeHtml(opis) : ""}</small>
          <div class="returned-reason"><b>Razlog dopune:</b> ${escapeHtml(reason)}</div>
          <div class="returned-actions">
            <button class="secondary" type="button" onclick="loadReturnedReportIntoForm('${r.id}')">Otvori za ispravku</button>
          </div>
        </div>
      `;
    }).join("");
  } catch(e) {
    toast(e.message, true);
  }
}

window.loadReturnedReportIntoForm = async (reportId) => {
  try {
    if (!currentWorker) throw new Error("Radnik nije prijavljen.");

    const { data: r, error } = await sb
      .from("reports")
      .select("id, report_date, data")
      .eq("id", reportId)
      .eq("company_id", currentWorker.company_id)
      .eq("user_id", currentWorker.user_id)
      .maybeSingle();

    if (error) throw error;
    if (!r) throw new Error("Izveštaj nije pronađen.");

    const d = r.data || {};
    $("#wrDate").value = r.report_date || today();

    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";

    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));

    Object.entries({
      wrSiteName:"site_name",
      wrDescription:"description",
      wrHours:"hours",
      wrVehicle:"vehicle",
      wrKmStart:"km_start",
      wrKmEnd:"km_end",
      wrRoute:"route",
      wrTours:"tours",
      wrMaterial:"material",
      wrQuantity:"quantity",
      wrUnit:"unit",
      wrWarehouseType:"warehouse_type",
      wrWarehouseItem:"warehouse_item",
      wrWarehouseQty:"warehouse_qty",
      wrDefectExists:"defect_exists",
      wrDefect:"defect",
      wrDefectStopsWork:"defect_stops_work",
      wrDefectCanContinue:"defect_can_continue",
      wrDefectUrgency:"defect_urgency",
      wrDefectCalledMechanic:"called_mechanic_by_phone",}).forEach(([id,key]) => {
      const el = $("#" + id);
      if (el) el.value = d[key] || "";
    });

    localStorage.setItem("swp_returned_report_id", reportId);
    toast("Izveštaj je otvoren. Ispravi ga i pošalji ponovo Direkciji.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch(e) {
    toast(e.message, true);
  }
};

function collectWorkerData() {
  const machines = getMachineEntries();
  const fuelEntries = getFuelEntries();
  return {
    site_name: $("#wrSiteName").value.trim(),
    description: $("#wrDescription").value.trim(),
    hours: $("#wrHours").value,
    machines,
    fuel_entries: fuelEntries,

    // Summary fields for older report/CSV display
    machine: machines.map(m => m.name).filter(Boolean).join(" | "),
    mtc_start: machines.map(m => m.start).filter(Boolean).join(" | "),
    mtc_end: machines.map(m => m.end).filter(Boolean).join(" | "),
    machine_hours: machines.map(m => m.hours).filter(Boolean).join(" | "),
    fuel_liters: fuelEntries.reduce((sum, f) => sum + (parseFloat(f.liters) || 0), 0) || "",
    fuel_readings: fuelEntries.map(f => f.reading).filter(Boolean).join(" | "),
    fuel_by: fuelEntries.map(f => f.by).filter(Boolean).join(" | "),
    fuel_receiver: currentWorker?.full_name || "",

    vehicle: $("#wrVehicle").value.trim(),
    km_start: $("#wrKmStart").value,
    km_end: $("#wrKmEnd").value,
    route: $("#wrRoute").value.trim(),
    tours: $("#wrTours").value,
    material: $("#wrMaterial").value.trim(),
    quantity: $("#wrQuantity").value,
    unit: $("#wrUnit").value.trim(),
    warehouse_type: $("#wrWarehouseType").value,
    warehouse_item: $("#wrWarehouseItem").value.trim(),
    warehouse_qty: $("#wrWarehouseQty").value.trim(),
    defect_exists: $("#wrDefectExists")?.value || "ne",
    defect: $("#wrDefect").value.trim(),
    defect_stops_work: $("#wrDefectStopsWork")?.value || "",
    defect_can_continue: $("#wrDefectCanContinue")?.value || "",
    defect_urgency: $("#wrDefectUrgency").value,
    called_mechanic_by_phone: $("#wrDefectCalledMechanic")?.value || ""
  };
}

function clearWorkerForm() {
  ["wrSiteName","wrDescription","wrHours","wrVehicle","wrKmStart","wrKmEnd","wrRoute","wrTours","wrMaterial","wrQuantity","wrUnit","wrWarehouseType","wrWarehouseItem","wrWarehouseQty","wrDefectExists","wrDefect","wrDefectStopsWork","wrDefectCanContinue","wrDefectUrgency","wrDefectCalledMechanic"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
  if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
  if ($("#wrDefectExists")) $("#wrDefectExists").value = "ne";
  localStorage.removeItem("swp_draft");
  localStorage.removeItem("swp_returned_report_id");
}

function saveDraft() {
  const draft = {
    date: $("#wrDate").value,
    data: collectWorkerData()
  };
  localStorage.setItem("swp_draft", JSON.stringify(draft));
  toast("Nacrt je sačuvan na ovom uređaju.");
}

function loadDraft() {
  try {
    const raw = localStorage.getItem("swp_draft");
    if (!raw) return;
    const draft = JSON.parse(raw);
    $("#wrDate").value = draft.date || today();
    const d = draft.data || {};

    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));

    Object.entries({
      wrSiteName:"site_name", wrDescription:"description", wrHours:"hours", wrVehicle:"vehicle", wrKmStart:"km_start", wrKmEnd:"km_end", wrRoute:"route", wrTours:"tours", wrMaterial:"material", wrQuantity:"quantity", wrUnit:"unit", wrWarehouseType:"warehouse_type", wrWarehouseItem:"warehouse_item", wrWarehouseQty:"warehouse_qty", wrDefectExists:"defect_exists", wrDefect:"defect", wrDefectStopsWork:"defect_stops_work", wrDefectCanContinue:"defect_can_continue", wrDefectUrgency:"defect_urgency", wrDefectCalledMechanic:"called_mechanic_by_phone"
    }).forEach(([id,key]) => { if ($("#"+id)) $("#"+id).value = d[key] || ""; });
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function csvEscape(v) {
  return `"${String(v ?? "").replaceAll('"','""')}"`;
}

async function exportCsv() {
  if (!currentCompany) return;
  let q = sb.from("reports").select("*, company_users(first_name,last_name,function_title)").eq("company_id", currentCompany.id);
  const from = $("#exportFrom").value;
  const to = $("#exportTo").value;
  if (from) q = q.gte("report_date", from);
  if (to) q = q.lte("report_date", to);
  const { data, error } = await q.order("report_date", { ascending: true });
  if (error) return toast(error.message, true);

  const headers = ["Datum","Ime","Funkcija","Gradiliste","Sati","Masina","MTC pocetak","MTC kraj","Sati masine","Vozilo","KM pocetak","KM kraj","Relacija","Ture","Gorivo L","MTC/KM pri sipanju","Materijal","Kolicina","Jedinica","Kvar","Status","Napomena"];
  const rows = (data || []).map(r => {
    const d = r.data || {};
    return [
      r.report_date,
      r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : "",
      r.company_users?.function_title || "",
      d.site_name,
      d.hours,
      d.machine,
      d.mtc_start,
      d.mtc_end,
      d.machine_hours,
      d.vehicle,
      d.km_start,
      d.km_end,
      d.route,
      d.tours,
      d.fuel_liters,
      d.fuel_readings,
      d.material,
      d.quantity,
      d.unit,
      d.defect,
      r.status,
      d.note || d.description
    ].map(csvEscape).join(",");
  });
  const csv = [headers.map(csvEscape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `startwork-export-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV export je preuzet.");
}


async function sendDefectNow() {
  try {
    if (!navigator.onLine) {
      saveDraft();
      throw new Error("Nema interneta. Kvar nije poslat, nacrt je sačuvan na ovom uređaju.");
    }

    const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
    if (!worker) throw new Error("Radnik nije prijavljen.");

    const defectText = $("#wrDefect")?.value.trim() || "";
    const exists = $("#wrDefectExists")?.value || "ne";

    if (exists !== "da" && !defectText) {
      throw new Error("Prvo označi da ima kvar ili upiši opis kvara.");
    }

    const machines = getMachineEntries ? getMachineEntries() : [];
    const firstMachine = machines[0]?.name || "";

    const urgentData = {
      report_type: "defect_record",
      sent_immediately: true,
      defect_status: "prijavljen",
      defect_reported_at: new Date().toISOString(),
      site_name: $("#wrSiteName")?.value.trim() || "",
      machine: firstMachine,
      machines,
      defect_exists: "da",
      defect: defectText,
      defect_stops_work: $("#wrDefectStopsWork")?.value || "",
      defect_can_continue: $("#wrDefectCanContinue")?.value || "",
      defect_urgency: $("#wrDefectUrgency")?.value || "",
      created_by_worker: worker.full_name,
      function_title: worker.function_title,
      called_mechanic_by_phone: $("#wrDefectCalledMechanic")?.value || "",
      sent_to: "direkcija_mehanizacija_direktor"
    };

    const { error } = await sb.rpc("submit_worker_report", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code,
      p_report_date: $("#wrDate").value || today(),
      p_site_id: null,
      p_data: urgentData
    });

    if (error) throw error;

    toast("Kvar je evidentiran odmah 🚨 Direkcija i direktor mogu pratiti vreme rešavanja.");
  } catch(e) {
    toast(e.message, true);
  }
}


async function loginWorkerByCode() {
  try {
    if (!initSupabase()) return;

    const companyInput = $("#workerCompanyCode");
    const codeInput = $("#workerAccessCode");

    if (!companyInput) throw new Error("Nedostaje polje Šifra firme.");
    if (!codeInput) throw new Error("Nedostaje polje Šifra radnika.");

    const companyCode = normalizeLoginCode(companyInput.value);
    const accessCode = normalizeLoginCode(codeInput.value);

    if (!companyCode) throw new Error("Unesi šifru firme.");
    if (!accessCode) throw new Error("Unesi šifru radnika.");

    const { data, error } = await sb.rpc("worker_login", {
      p_company_code: companyCode,
      p_access_code: accessCode
    });

    if (error) throw error;
    if (!data || !data.length) throw new Error("Neispravna šifra firme ili šifra radnika. Proveri oba polja tačno kako ih je dala Direkcija.");

    currentWorker = {
      ...data[0],
      company_code: companyCode,
      access_code: accessCode
    };

    localStorage.setItem("swp_worker", JSON.stringify(currentWorker));
    openWorkerForm();
    toast("Radnik je prijavljen.");
  } catch(e) {
    toast(e.message, true);
  }
}


function installNavigationFallback() {
  if (window.__swpNavFallbackInstalled) return;
  window.__swpNavFallbackInstalled = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-goto]");
    if (!btn) return;
    e.preventDefault();
    show(btn.dataset.goto);
  });
}

function bindEvents() {

  ["workerCompanyCode","workerAccessCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("keydown", e => {
      if (e.key === "Enter") loginWorkerByCode();
    });
  });

  if ($("#internalLogoutBtn")) $("#internalLogoutBtn").addEventListener("click", signOut);
  $$("[data-goto]").forEach(btn => btn.addEventListener("click", () => show(btn.dataset.goto)));
  if ($("#logoutBtn")) $("#logoutBtn").addEventListener("click", signOut);
  if ($("#directorTopLogoutBtn")) $("#directorTopLogoutBtn").addEventListener("click", signOut);

  $("#adminSignupBtn").addEventListener("click", async () => {
    try {
      await signUp($("#adminEmail").value.trim(), $("#adminPassword").value);
      toast("Admin nalog registrovan. Ako stigne email potvrda, potvrdi ga pa se prijavi.");
    } catch(e) { toast(e.message, true); }
  });
  $("#adminLoginBtn").addEventListener("click", async () => {
    try {
      await signIn($("#adminEmail").value.trim(), $("#adminPassword").value);
      await loadAdmin();
    } catch(e) { toast(e.message, true); }
  });
  $("#refreshAdminBtn").addEventListener("click", loadAdmin);
  $("#addApprovedCompanyBtn").addEventListener("click", async () => {
    try {
      const payload = {
        company_name: $("#acCompanyName").value.trim(),
        approved_email: $("#acEmail").value.trim(),
        company_code: $("#acCompanyCode").value.trim(),
        invite_code: $("#acInviteCode").value.trim(),
        status: "trial",
        plan: "trial",
        trial_until: $("#acTrialUntil").value || null,
        note: $("#acNote").value.trim()
      };
      if (!payload.company_name || !payload.approved_email || !payload.company_code || !payload.invite_code) throw new Error("Popuni naziv, email, šifru firme i pozivni kod.");
      const { error } = await sb.from("approved_companies").insert(payload);
      if (error) throw error;
      ["acCompanyName","acEmail","acCompanyCode","acInviteCode","acTrialUntil","acNote"].forEach(id => $("#"+id).value = "");
      toast("Firma je odobrena.");
      loadApprovedCompanies();
    } catch(e) { toast(e.message, true); }
  });

  $("#directorSignupBtn").addEventListener("click", async () => {
    try {
      await signUp($("#directorEmail").value.trim(), $("#directorPassword").value);
      toast("Direkcija email registrovan. Ako stigne potvrda, potvrdi email pa se prijavi.");
    } catch(e) { toast(e.message, true); }
  });
  $("#directorLoginBtn").addEventListener("click", async () => {
    try {
      await signIn($("#directorEmail").value.trim(), $("#directorPassword").value);
      await loadDirectorCompany();
    } catch(e) { toast(e.message, true); }
  });
  $("#activateCompanyBtn").addEventListener("click", async () => {
    try {
      if (!sb) initSupabase();
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) {
        await signIn($("#directorEmail").value.trim(), $("#directorPassword").value);
      }
      const { data, error } = await sb.rpc("activate_company", {
        p_company_code: $("#directorCompanyCode").value.trim(),
        p_invite_code: $("#directorInviteCode").value.trim()
      });
      if (error) throw error;
      toast("Firma je aktivirana.");
      await loadDirectorCompany();
    } catch(e) { toast(e.message, true); }
  });
  $("#refreshDirectorBtn").addEventListener("click", loadDirectorCompany);

  $$(".tab").forEach(btn => btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
  }));
  $("#addPersonBtn").addEventListener("click", savePersonForm);
  if ($("#cancelEditPersonBtn")) $("#cancelEditPersonBtn").addEventListener("click", clearPersonForm);

  $("#addSiteBtn").addEventListener("click", async () => {
    try {
      const { error } = await sb.from("sites").insert({ company_id: currentCompany.id, name: $("#siteName").value.trim(), location: $("#siteLocation").value.trim(), active: true });
      if (error) throw error;
      $("#siteName").value = ""; $("#siteLocation").value = "";
      toast("Gradilište dodato.");
      loadSites();
    } catch(e) { toast(e.message, true); }
  });

  $("#addAssetBtn").addEventListener("click", async () => {
    try {
      const { error } = await sb.from("assets").insert({ company_id: currentCompany.id, name: $("#assetName").value.trim(), asset_type: $("#assetType").value, registration: $("#assetReg").value.trim(), capacity: $("#assetCapacity").value.trim() });
      if (error) throw error;
      ["assetName","assetReg","assetCapacity"].forEach(id => $("#"+id).value = "");
      toast("Mašina/vozilo dodato.");
      loadAssets();
    } catch(e) { toast(e.message, true); }
  });


  if ($("#directorSearchBtn")) $("#directorSearchBtn").addEventListener("click", () => runDirectorGlobalSearch(true));
  if ($("#directorClearSearchBtn")) $("#directorClearSearchBtn").addEventListener("click", () => {
    $("#directorGlobalSearch").value = "";
    $("#directorSearchResults").classList.add("hidden");
    $("#directorSearchResultsList").innerHTML = "";
  });
  if ($("#directorGlobalSearch")) $("#directorGlobalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runDirectorGlobalSearch(true);
  });

  if ($("#addMaterialBtn")) $("#addMaterialBtn").addEventListener("click", async () => {
    try {
      if (!currentCompany) throw new Error("Nema aktivne firme.");
      const name = $("#materialName").value.trim();
      if (!name) throw new Error("Upiši naziv materijala.");
      const { error } = await sb.from("materials").insert({
        company_id: currentCompany.id,
        name,
        unit: $("#materialUnit").value,
        category: $("#materialCategory").value.trim()
      });
      if (error) throw error;
      ["materialName","materialCategory"].forEach(id => $("#"+id).value = "");
      toast("Materijal je dodat.");
      loadMaterials();
    } catch(e) { toast(e.message, true); }
  });

  $("#exportCsvBtn").addEventListener("click", exportCsv);

  // Add mašina / gorivo koriste onclick direktno u HTML-u zbog pouzdanosti na mobilnom/PWA cache-u.
  if ($("#sendDefectNowBtn")) $("#sendDefectNowBtn").addEventListener("click", sendDefectNow);

  if ($("#workerLoginBtn")) $("#workerLoginBtn").addEventListener("click", loginWorkerByCode);

  $("#workerLogoutBtn").addEventListener("click", () => {
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_draft");
    currentWorker = null;
    setInternalHeader("", "", false);
    show("WorkerLogin");
  });

  $("#saveDraftBtn").addEventListener("click", saveDraft);

  $("#submitReportBtn").addEventListener("click", async () => {
    try {
      if (!navigator.onLine) {
        saveDraft();
        throw new Error("Nema interneta. Nacrt je sačuvan na ovom telefonu.");
      }
      const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
      if (!worker) throw new Error("Radnik nije prijavljen.");
      const data = collectWorkerData();
    if (await submitReturnedCorrectionIfNeeded(data)) return;
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: $("#wrDate").value || today(),
        p_site_id: null,
        p_data: data
      });
      if (error) throw error;
      clearWorkerForm();
      $("#wrDate").value = today();
      toast("Izveštaj je poslat Direkciji ✅ Forma je očišćena.");
    } catch(e) { toast(e.message, true); }
  });
}

function openWorkerForm() {
  $("#wrDate").value = today();
  $("#workerHello").textContent = `Dobrodošli, ${currentWorker.full_name}`;
  $("#workerCompanyLabel").textContent = `${currentWorker.company_name} · ${currentWorker.function_title}`;
  workerSetSections(currentWorker.permissions || {});
  setInternalHeader("Dnevni izveštaj", `${currentWorker?.full_name || "Radnik"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  show("WorkerForm");
  loadDraft();
  loadWorkerReturnedReports();
  if ($("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if ($("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
}

async function boot() {
  installNavigationFallback();
  bindEvents();
  initSupabase();
  $("#wrDate").value = today();
  const stored = localStorage.getItem("swp_worker");
  if (stored) {
    try {
      currentWorker = JSON.parse(stored);
      openWorkerForm();
      return;
    } catch {}
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", boot);

// Default: public landing keeps big brand header.
try { setInternalHeader('', '', false); } catch(e) {}


async function submitReturnedCorrectionIfNeeded(reportData) {
  const returnedId = localStorage.getItem("swp_returned_report_id");
  if (!returnedId || !currentWorker) return false;

  const { error } = await sb
    .from("reports")
    .update({
      data: reportData,
      status: "sent",
      returned_reason: null
    })
    .eq("id", returnedId)
    .eq("company_id", currentWorker.company_id)
    .eq("user_id", currentWorker.user_id);

  if (error) throw error;

  localStorage.removeItem("swp_returned_report_id");
  toast("Ispravljen izveštaj je ponovo poslat Direkciji ✅");
  clearWorkerForm();
  loadWorkerReturnedReports();
  return true;
}
