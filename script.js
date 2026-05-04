/* START WORK PRO by AskCreate - MVP v1
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";
const APP_VERSION = "1.12.7";


let sb = null;
let currentCompany = null;
let editingPersonId = null;
let editingAssetId = null;
let editingMaterialId = null;
let currentWorker = null;
let workerAssetOptions = [];

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
  // Login kodovi ne smeju da padnu zbog velikih/malih slova ili slučajnog razmaka.
  // Primer: " FIRMA01 " i "firma01" tretiramo isto.
  return String(code || "").trim().toLowerCase().replace(/\s+/g, "");
}

function readRpcSingleRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === "object") return data;
  return null;
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
  refreshPersonMaterialPermissions();
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
    const selectedMaterialIds = new Set((permissions.allowed_material_ids || []).map(String));
    await refreshPersonMaterialPermissions(selectedMaterialIds);

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

function setAssetFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = document.querySelector("#assetFormTitle");
  const btn = document.querySelector("#addAssetBtn");
  const cancel = document.querySelector("#cancelEditAssetBtn");
  if (title) title.textContent = editing ? "✏️ Uredi mašinu / vozilo" : "+ Dodaj mašinu / vozilo";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearAssetForm() {
  ["assetName", "assetReg", "assetCapacity"].forEach(id => {
    const el = document.querySelector("#" + id);
    if (el) el.value = "";
  });
  const type = document.querySelector("#assetType");
  if (type) type.value = "machine";
  editingAssetId = null;
  setAssetFormMode("add");
}

window.editAsset = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data: asset, error } = await sb
      .from("assets")
      .select("*")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) throw new Error("Mašina/vozilo nije pronađeno.");

    editingAssetId = asset.id;
    document.querySelector("#assetName").value = asset.name || "";
    document.querySelector("#assetType").value = asset.asset_type || "machine";
    document.querySelector("#assetReg").value = asset.registration || "";
    document.querySelector("#assetCapacity").value = asset.capacity || "";
    setAssetFormMode("edit");
    toast("Mašina/vozilo je otvoreno za izmenu.");
    const title = document.querySelector("#assetFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    toast(e.message, true);
  }
};

async function saveAssetForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const name = document.querySelector("#assetName").value.trim();
    const assetType = document.querySelector("#assetType").value;
    const registration = document.querySelector("#assetReg").value.trim();
    const capacity = document.querySelector("#assetCapacity").value.trim();

    if (!name) throw new Error("Upiši naziv mašine/vozila.");

    const payload = {
      company_id: currentCompany.id,
      name,
      asset_type: assetType,
      registration,
      capacity
    };

    if (editingAssetId) {
      const { error } = await sb
        .from("assets")
        .update(payload)
        .eq("id", editingAssetId)
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      toast("Mašina/vozilo je izmenjeno.");
    } else {
      const { error } = await sb.from("assets").insert(payload);
      if (error) throw error;
      toast("Mašina/vozilo dodato.");
    }

    clearAssetForm();
    loadAssets();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
}

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
        <button class="danger-btn" type="button" onclick="deletePersonPermanently('${p.id}')">🔥 Trajno obriši iz baze</button>
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
      <div class="management-actions asset-actions-v1117">
        <button class="edit-btn" type="button" onclick="editAsset('${a.id}')">✏️ Uredi</button>
        <button class="danger-btn" type="button" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">🔥 Trajno obriši iz baze</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema mašina/vozila.</p>`;
}


async function loadMaterials() {
  if (!currentCompany) return;
  const list = $("#materialsList");
  const datalist = $("#materialsDatalist");

  const { data, error } = await sb.rpc("director_list_materials", {
    p_company_id: currentCompany.id
  });

  if (error) {
    if (list) list.innerHTML = `<p class="muted">Materijali se ne mogu učitati: ${escapeHtml(error.message)}. Pokreni SQL dopunu za v1.12.0.</p>`;
    const box = $("#personMaterialPermissions");
    if (box) box.innerHTML = `<p class="muted tiny">Materijali nisu učitani.</p>`;
    return;
  }

  if (list) {
    list.innerHTML = (data || []).map(m => `
      <div class="item management-item material-card-v1119">
        <div class="item-main">
          <strong>${escapeHtml(m.name)}</strong>
          <small>${escapeHtml(m.unit || "")} ${m.category ? "· " + escapeHtml(m.category) : ""}</small>
        </div>
        <div class="management-actions material-actions-v1119">
          <button class="edit-btn" type="button" onclick="editMaterial('${m.id}')">✏️ Uredi</button>
          <button class="danger-btn" type="button" onclick="deleteMaterial('${m.id}', '${escapeHtml(m.name || '')}')">🔥 Trajno obriši iz baze</button>
        </div>
      </div>
    `).join("") || `<p class="muted">Nema dodatih materijala.</p>`;
  }

  if (datalist) {
    datalist.innerHTML = (data || []).map(m => `<option value="${escapeHtml(m.name)}"></option>`).join("");
  }

  renderPersonMaterialPermissions(data || []);
}

function setMaterialFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = $("#materialFormTitle");
  const btn = $("#addMaterialBtn");
  const cancel = $("#cancelEditMaterialBtn");
  if (title) title.textContent = editing ? "✏️ Uredi materijal" : "+ Dodaj materijal";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj materijal";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearMaterialForm() {
  const name = $("#materialName");
  const category = $("#materialCategory");
  const unit = $("#materialUnit");
  if (name) name.value = "";
  if (category) category.value = "";
  if (unit) unit.value = "m3";
  editingMaterialId = null;
  setMaterialFormMode("add");
}

window.editMaterial = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data, error } = await sb.rpc("director_get_material", {
      p_company_id: currentCompany.id,
      p_material_id: id
    });
    if (error) throw error;
    const material = Array.isArray(data) ? data[0] : data;
    if (!material) throw new Error("Materijal nije pronađen.");

    editingMaterialId = material.id;
    $("#materialName").value = material.name || "";
    $("#materialUnit").value = material.unit || "m3";
    $("#materialCategory").value = material.category || "";
    setMaterialFormMode("edit");
    toast("Materijal je otvoren za izmenu.");
    const title = $("#materialFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch(e) {
    toast(e.message, true);
  }
};

async function saveMaterialForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const name = $("#materialName").value.trim();
    if (!name) throw new Error("Upiši naziv materijala.");

    const { error } = await sb.rpc("director_upsert_material", {
      p_company_id: currentCompany.id,
      p_material_id: editingMaterialId || null,
      p_name: name,
      p_unit: $("#materialUnit").value,
      p_category: $("#materialCategory").value.trim()
    });

    if (error) throw error;
    toast(editingMaterialId ? "Materijal je izmenjen." : "Materijal je dodat.");

    clearMaterialForm();
    await loadMaterials();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch(e) {
    toast(e.message, true);
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

window.deletePersonPermanently = async (id, name = "") => {
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
    if (!confirm("TRAJNO obrisati radnika iz baze" + label + "?\n\nOvo se ne može vratiti. Ako Supabase odbije brisanje zbog povezanih izveštaja, prvo koristi ❌ Obriši iz spiska.")) return;
    if (!confirm("Još jednom potvrdi: radnik će biti trajno obrisan iz company_users tabele.")) return;

    const { error } = await sb
      .from("company_users")
      .delete()
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (error) throw error;
    toast("Radnik je trajno obrisan iz baze.");
    if (editingPersonId === id) clearPersonForm();
    loadPeople();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
};

window.deleteAsset = async (id, name = "") => {
  const label = name ? ` (${name})` : "";
  if (!confirm("TRAJNO obrisati ovu mašinu/vozilo iz baze" + label + "?\n\nOvo se ne može vratiti.")) return;

  const { error } = await sb
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Mašina/vozilo je trajno obrisano iz baze.");
  if (editingAssetId === id) clearAssetForm();
  loadAssets();
  if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
};

window.deleteMaterial = async (id, name = "") => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const label = name ? ` (${name})` : "";
    if (!confirm("TRAJNO obrisati ovaj materijal iz baze" + label + "?\n\nOvo se ne može vratiti.")) return;

    const { error } = await sb.rpc("director_delete_material", {
      p_company_id: currentCompany.id,
      p_material_id: id
    });

    if (error) throw error;
    toast("Materijal je trajno obrisan iz baze.");
    if (editingMaterialId === id) clearMaterialForm();
    await loadMaterials();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch(e) {
    toast(e.message, true);
  }
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
        actions:`${p.active ? `<button class="edit-btn" onclick="editPerson('${p.id}')">✏️ Uredi profil</button><button class="delete-btn" onclick="deletePerson('${p.id}')">❌ Obriši iz spiska</button><button class="danger-btn" onclick="deletePersonPermanently('${p.id}')">🔥 Trajno obriši iz baze</button>` : `<button class="danger-btn" onclick="deletePersonPermanently('${p.id}')">🔥 Trajno obriši iz baze</button>`}`
      });
    });

    if (assetsRes.data) assetsRes.data.forEach(a => {
      const text = `${a.name} ${a.asset_type} ${a.registration || ""} ${a.capacity || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Mašina / vozilo",
        title:a.name,
        subtitle:`${a.asset_type} · ${a.registration || ""} · ${a.capacity || ""}`,
        actions:`<button class="edit-btn" onclick="editAsset('${a.id}')">✏️ Uredi</button><button class="danger-btn" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">🔥 Trajno obriši iz baze</button>`
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

let directorReportsCache = [];

function isDefectOnlyReport(r) {
  const d = r?.data || {};
  return d.report_type === "defect_record" || d.report_type === "defect_alert" || d.sent_immediately === true;
}

function hasDefectData(r) {
  const d = r?.data || {};
  return isDefectOnlyReport(r) ||
    d.defect_exists === "da" ||
    !!d.defect ||
    !!d.defect_status ||
    !!d.defect_urgency ||
    !!d.defect_asset_name ||
    !!d.defect_machine;
}

function hasDailyReportData(r) {
  const d = r?.data || {};
  const hasMachines = Array.isArray(d.machines) && d.machines.some(m => m && Object.values(m).some(Boolean));
  const hasVehicles = Array.isArray(d.vehicles) && d.vehicles.some(v => v && Object.values(v).some(Boolean));
  const hasFuel = Array.isArray(d.fuel_entries) && d.fuel_entries.some(f => f && Object.values(f).some(Boolean));
  const hasMaterial = !!(d.material || d.quantity || d.unit || d.warehouse_type || d.warehouse_item || d.warehouse_qty);
  return !!(d.description || d.hours || d.site_name || hasMachines || hasVehicles || hasFuel || hasMaterial || d.note);
}

function formatDateTimeLocal(value) {
  if (!value) return "—";
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" });
  } catch(e) {
    return String(value);
  }
}

async function loadReports() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("reports").select("*, company_users(first_name,last_name,function_title)").eq("company_id", currentCompany.id).neq("status", "archived").order("submitted_at", { ascending:false });
  if (error) return toast(error.message, true);
  directorReportsCache = data || [];
  const dailyReports = directorReportsCache.filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r));
  $("#reportsList").innerHTML = dailyReports.map(r => reportHtml(r)).join("") || `<p class="muted">Nema dnevnih izveštaja. Ako je radnik poslao kvar, pogledaj tab Kvarovi.</p>`;
  renderDefectsList();
  renderExportPanel();
}

function defectHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : (d.created_by_worker || "Nepoznat radnik");
  const status = d.defect_status || "prijavljen";
  const reportedAt = d.defect_reported_at || r.submitted_at || r.created_at;
  const assetName = d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || (Array.isArray(d.machines) && d.machines[0]?.name) || (Array.isArray(d.vehicles) && d.vehicles[0]?.name) || "—";

  return `
    <div class="item report-item defect-item">
      <strong>🚨 KVAR · ${escapeHtml(d.defect_urgency || "prijavljen")}</strong>
      <small>${escapeHtml(person)} · ${escapeHtml(r.company_users?.function_title || d.function_title || "")} · ${escapeHtml(r.report_date || "")}</small><br/>
      <span class="pill">Prijavljeno: ${escapeHtml(formatDateTimeLocal(reportedAt))}</span>
      <span class="pill">Status: ${escapeHtml(status)}</span>
      <span class="pill">Gradilište/lokacija: ${escapeHtml(d.defect_site_name || d.site_name || "bez gradilišta")}</span>
      <span class="pill">Mašina/vozilo: ${escapeHtml(assetName)}</span>
      ${d.defect_stops_work ? `<span class="pill">Zaustavlja rad: ${escapeHtml(d.defect_stops_work)}</span>` : ""}
      ${d.defect_can_continue ? `<span class="pill">Može nastaviti: ${escapeHtml(d.defect_can_continue)}</span>` : ""}
      ${d.called_mechanic_by_phone ? `<span class="pill">Šef pozvan: ${escapeHtml(d.called_mechanic_by_phone)}</span>` : ""}
      <p>${escapeHtml(d.defect || "Bez opisa kvara")}</p>
      <div class="report-kv">
        <b>Primljeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_received_at))}</span>
        <b>Početak popravke</b><span>${escapeHtml(formatDateTimeLocal(d.defect_repair_started_at))}</span>
        <b>Rešeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_resolved_at))}</span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','primljeno')">Primljeno</button>
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','u_popravci')">U popravci</button>
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','reseno')">Rešeno</button>
        <button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj kvar</button>
        <button class="hard-delete-report-btn" onclick="deleteReportPermanently('${r.id}')">🔥 Obriši iz baze</button>
      </div>
    </div>`;
}

function renderDefectsList() {
  const box = $("#defectsList");
  if (!box) return;
  const defects = directorReportsCache.filter(hasDefectData);
  box.innerHTML = defects.map(defectHtml).join("") || `<p class="muted">Nema prijavljenih kvarova.</p>`;
}


function renderReportReadableDetails(d = {}, options = {}) {
  const esc = escapeHtml;
  const safe = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
  const val = (x) => safe(x) ? esc(safe(x)) : "<span class='report-empty'>—</span>";
  const rows = (pairs) => pairs.map(([k, v]) => `<b>${esc(k)}</b><span>${val(v)}</span>`).join("");

  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);

  const reportRows = [];

  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, fuels.length, fieldTankers.length)
  for (let i = 0; i < maxRows; i++) {
    const w = workers[i] || {};
    const m = machines[i] || {};
    const v = vehicles[i] || {};
    const ll = lowloaders[i] || {};
    const f = fuels[i] || {};
    const ft = fieldTankers[i] || {};
    reportRows.push(`
      <tr>
        <td>${i + 1}</td>
        <td>${val(d.site_name)}</td>
        <td>${val(d.hours)}</td>
        <td>${val(d.description)}</td>
        <td>${val(w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" "))}</td>
        <td>${val(w.hours)}</td>
        <td>${val(m.name)}</td>
        <td>${val(m.start)}</td>
        <td>${val(m.end)}</td>
        <td>${val(m.hours)}</td>
        <td>${val(m.work)}</td>
        <td>${val(v.name || v.vehicle)}</td>
        <td>${val(v.registration)}</td>
        <td>${val(v.capacity)}</td>
        <td>${val(v.km_start)}</td>
        <td>${val(v.km_end)}</td>
        <td>${val(v.route)}</td>
        <td>${val(v.tours)}</td>
        <td>${val(v.cubic_m3 || v.cubic_auto)}</td>
        <td>${val(v.cubic_manual)}</td>
        <td>${val(ll.plates || ll.registration)}</td>
        <td>${val(ll.from_address)}</td>
        <td>${val(ll.to_address)}</td>
        <td>${val(ll.km_total)}</td>
        <td>${val(ll.machine)}</td>
        <td>${val(f.machine)}</td>
        <td>${val(f.liters)}</td>
        <td>${val(f.reading)}</td>
        <td>${val(f.by)}</td>
        <td>${val(f.receiver || d.fuel_receiver)}</td>
        <td>${val(ft.site_name)}</td>
        <td>${val(ft.asset_name || ft.machine)}</td>
        <td>${val(ft.reading || ft.mtc_km)}</td>
        <td>${val(ft.liters)}</td>
        <td>${val(ft.receiver || ft.received_by)}</td>
      </tr>
    `);
  }

  const excelTable = `
    <div class="report-excel-wrap">
      <table class="report-excel-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Gradilište</th>
            <th>Sati radnika</th>
            <th>Opis rada</th>
            <th>Radnik u ekipi</th>
            <th>Sati radnika u ekipi</th>
            <th>Mašina</th>
            <th>MTČ/KM početak</th>
            <th>MTČ/KM kraj</th>
            <th>Sati mašine</th>
            <th>Rad mašine</th>
            <th>Vozilo</th>
            <th>Registracija</th>
            <th>Kapacitet m³</th>
            <th>KM početak</th>
            <th>KM kraj</th>
            <th>Relacija</th>
            <th>Ture</th>
            <th>m³ ukupno</th>
            <th>Ručno m³</th>
            <th>Labudica tablice</th>
            <th>Početna adresa</th>
            <th>Završna adresa</th>
            <th>Ukupno km</th>
            <th>Mašina koja se seli</th>
            <th>Gorivo za</th>
            <th>Litara</th>
            <th>MTČ/KM gorivo</th>
            <th>Sipao</th>
            <th>Primio</th>
            <th>Cisterna gradilište</th>
            <th>Cisterna mašina/vozilo</th>
            <th>Cisterna MTČ/KM</th>
            <th>Cisterna litara</th>
            <th>Gorivo primio</th>
          </tr>
        </thead>
        <tbody>${reportRows.join("")}</tbody>
      </table>
    </div>`;

  const workerTable = workers.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ime i prezime</th>
          <th>Sati rada</th>
        </tr>
      </thead>
      <tbody>
        ${workers.map((w, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" "))}</td>
            <td>${val(w.hours)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema dodatih radnika u ekipi.</p>`;

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

  const vehicleTable = vehicles.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Vozilo</th>
          <th>Reg.</th>
          <th>Kapacitet</th>
          <th>KM početak</th>
          <th>KM kraj</th>
          <th>Relacija</th>
          <th>Ture</th>
          <th>m³ ukupno</th>
          <th>Ručno m³</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map((v, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(v.name || v.vehicle)}</td>
            <td>${val(v.registration)}</td>
            <td>${val(v.capacity)}</td>
            <td>${val(v.km_start)}</td>
            <td>${val(v.km_end)}</td>
            <td>${val(v.route)}</td>
            <td>${val(v.tours)}</td>
            <td>${val(v.cubic_m3 || v.cubic_auto)}</td>
            <td>${val(v.cubic_manual)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih vozila.</p>`;

  const lowloaderTable = lowloaders.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tablice labudice</th>
          <th>Početna adresa</th>
          <th>Završna adresa</th>
          <th>Ukupno km</th>
          <th>Mašina koja se seli</th>
        </tr>
      </thead>
      <tbody>
        ${lowloaders.map((ll, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ll.plates || ll.registration)}</td>
            <td>${val(ll.from_address)}</td>
            <td>${val(ll.to_address)}</td>
            <td>${val(ll.km_total)}</td>
            <td>${val(ll.machine)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih selidbi labudicom.</p>`;

  const fuelTable = fuels.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Mašina/vozilo</th>
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

  const fieldTankerTable = fieldTankers.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Gradilište</th>
          <th>Mašina/vozilo</th>
          <th>Trenutni MTČ/KM</th>
          <th>Sipano litara</th>
          <th>Gorivo primio</th>
        </tr>
      </thead>
      <tbody>
        ${fieldTankers.map((ft, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ft.site_name)}</td>
            <td>${val(ft.asset_name || ft.machine)}</td>
            <td>${val(ft.reading || ft.mtc_km)}</td>
            <td>${val(ft.liters)}</td>
            <td>${val(ft.receiver || ft.received_by)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema terenskih sipanja cisternom.</p>`;

  const showDefectSection = options.showDefect === true;
  const hasDefect = showDefectSection && (safe(d.defect) || safe(d.defect_exists) === "da" || safe(d.defect_urgency) || safe(d.defect_status));
  const hasMaterial = safe(d.material) || safe(d.quantity) || safe(d.unit) || safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);

  return `
    <div class="report-readable">
      <div class="report-section report-excel-section">
        <h4>Excel pregled izveštaja</h4>
        <p class="field-hint">Tabela je namerno složena kao Excel: jedan red može sadržati mašinu, vozilo i gorivo za isti dnevni izveštaj. Ako ima više vozila/mašina, prikazuju se u dodatnim redovima.</p>
        ${excelTable}
      </div>

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

      ${workers.length ? `<div class="report-section">
        <h4>Radnici / sati po radniku</h4>
        ${workerTable}
      </div>` : ""}

      <div class="report-section">
        <h4>Mašine</h4>
        ${machineTable}
      </div>

      <div class="report-section">
        <h4>Vozila / ture / m³</h4>
        ${vehicleTable}
      </div>

      ${lowloaders.length ? `<div class="report-section">
        <h4>Vozilo labudica / selidba mašine</h4>
        ${lowloaderTable}
      </div>` : ""}

      <div class="report-section">
        <h4>Gorivo</h4>
        ${fuelTable}
      </div>

      ${fieldTankers.length ? `<div class="report-section">
        <h4>Cisterna / tankanje goriva na terenu</h4>
        ${fieldTankerTable}
      </div>` : ""}

      ${hasDefect ? `
        <div class="report-section">
          <h4>Kvar</h4>
          <div class="report-kv">
            ${rows([
              ["Mašina/vozilo u kvaru", d.defect_asset_name || d.defect_machine || d.machine || d.vehicle],
              ["Gradilište/lokacija mašine", d.defect_site_name || d.site_name],
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
          <h4>Materijal / magacin</h4>
          <div class="report-kv">
            ${rows([
              ["Materijal", d.material],
              ["Količina", d.quantity],
              ["Jedinica", d.unit],
              ["Magacin tip", d.warehouse_type],
              ["Magacin stavka", d.warehouse_item],
              ["Magacin količina", d.warehouse_qty]
            ])}
          </div>
        </div>` : ""}
    </div>
  `;
}

function reportHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : "Nepoznat korisnik";

  const checked = getExportSelectedIds().includes(r.id) ? "checked" : "";

  return `
    <div class="item report-item">
      <label class="export-select-row">
        <input type="checkbox" class="report-export-check" ${checked} onchange="toggleReportExportSelection('${r.id}', this.checked)" />
        <span>✅ Izaberi ovaj izveštaj za Excel export</span>
      </label>
      <strong>${isDefectOnlyReport(r) ? "🚨 EVIDENCIJA KVARA" : "📄 DNEVNI IZVEŠTAJ"} · ${escapeHtml(r.report_date)}</strong>
      <small>${escapeHtml(person)} · ${escapeHtml(r.company_users?.function_title || "")} · status: ${escapeHtml(r.status)}</small><br/>

      <span class="pill">${escapeHtml(d.site_name || "bez gradilišta")}</span>
      ${d.hours ? `<span class="pill">${escapeHtml(String(d.hours))} h</span>` : ""}
      ${d.fuel_liters ? `<span class="pill">${escapeHtml(String(d.fuel_liters))} L</span>` : ""}
      <p>${escapeHtml(d.description || d.note || "")}</p>
      ${r.returned_reason ? `<p class="muted">Razlog vraćanja: ${escapeHtml(r.returned_reason)}</p>` : ""}
      ${renderReportReadableDetails(d)}

      <div class="actions">
        ${isDefectOnlyReport(r) ? `
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
  if (!reason || !reason.trim()) return;
  const { error } = await sb
    .from("reports")
    .update({
      status: "returned",
      returned_reason: reason.trim()
    })
    .eq("id", id)
    .eq("company_id", currentCompany.id);
  if (error) return toast(error.message, true);
  toast("Izveštaj je vraćen radniku na dopunu.");
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

  // v1.11.9: posebna prava po materijalu.
  // Ovo ne ruši stari login: ako nema izabranih materijala, radnik i dalje ima/ili nema osnovnu rubriku "Materijal" preko obj.materials.
  obj.allowed_material_ids = $$(".material-perm:checked").map(ch => ch.value);
  obj.allowed_material_names = $$(".material-perm:checked").map(ch => ch.dataset.name || "").filter(Boolean);
  return obj;
}

function getCheckedMaterialPermissionIdsFromForm() {
  return new Set($$(".material-perm:checked").map(ch => ch.value));
}

function renderPersonMaterialPermissions(materials = [], selectedIds = null) {
  const box = $("#personMaterialPermissions");
  if (!box) return;

  const checkedNow = selectedIds || getCheckedMaterialPermissionIdsFromForm();
  if (!materials.length) {
    box.innerHTML = `<p class="muted tiny">Nema dodatih materijala. Dodaj materijal u tabu Materijali pa će se pojaviti ovde za štikliranje.</p>`;
    return;
  }

  box.innerHTML = materials.map(m => {
    const id = String(m.id || "");
    const checked = checkedNow.has(id) ? "checked" : "";
    const label = `${m.name || "Materijal"}${m.unit ? " · " + m.unit : ""}`;
    return `
      <label class="material-permission-option">
        <input type="checkbox" class="material-perm" value="${escapeHtml(id)}" data-name="${escapeHtml(m.name || "")}" ${checked} />
        ${escapeHtml(label)}
      </label>
    `;
  }).join("");
}

async function refreshPersonMaterialPermissions(selectedIds = null) {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("materials")
    .select("id,name,unit,category")
    .eq("company_id", currentCompany.id)
    .order("created_at", { ascending:false });

  if (error) {
    const box = $("#personMaterialPermissions");
    if (box) box.innerHTML = `<p class="muted tiny">Materijali nisu učitani: ${escapeHtml(error.message)}</p>`;
    return;
  }
  renderPersonMaterialPermissions(data || [], selectedIds);
}


function getSelectedWorkerSite() {
  const el = $("#wrSiteName");
  if (!el) return { site_id: null, site_name: "" };
  const option = el.options ? el.options[el.selectedIndex] : null;
  return {
    site_id: option?.dataset?.siteId || null,
    site_name: (el.value || "").trim()
  };
}


function normalizeAssetType(type) {
  return String(type || "").trim().toLowerCase();
}

function isVehicleAsset(asset) {
  const t = normalizeAssetType(asset?.asset_type || asset?.type);
  return ["vehicle", "vozilo", "truck", "kamion", "kiper", "cisterna", "lowloader", "labudica"].includes(t);
}

function formatAssetLabel(asset) {
  const parts = [asset?.name || "Vozilo"];
  if (asset?.registration) parts.push(asset.registration);
  if (asset?.capacity) parts.push(asset.capacity);
  return parts.filter(Boolean).join(" · ");
}

async function loadWorkerAssets() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  workerAssetOptions = [];

  if (!worker) return;

  try {
    const { data, error } = await sb.rpc("worker_list_assets", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code
    });
    if (error) throw error;

    workerAssetOptions = (Array.isArray(data) ? data : []).map(a => ({
      ...a,
      asset_type: a.asset_type || a.type || "",
      type: a.type || a.asset_type || ""
    }));
    refreshVehicleSelects();
  } catch (e) {
    workerAssetOptions = [];
    refreshVehicleSelects();
    toast("Vozila za radnika nisu učitana. Pokreni SQL za v1.12.2/v1.12.4: worker_list_assets. Detalj: " + (e.message || e), true);
  }
}

function normalizeVehicleSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9čćžšđ]/gi, "")
    .trim();
}

function vehicleMatchesSearch(asset, searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return true;
  const haystack = normalizeVehicleSearch([
    asset?.name,
    asset?.registration,
    asset?.capacity,
    asset?.type || asset?.asset_type
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

function buildVehicleOptionsHtml(selectedValue = "", searchValue = "") {
  const allVehicles = workerAssetOptions.filter(isVehicleAsset);
  const vehicles = allVehicles.filter(v => vehicleMatchesSearch(v, searchValue));
  const selected = String(selectedValue || "").trim();

  if (!allVehicles.length) {
    return `<option value="">Nema vozila iz Direkcije</option>`;
  }
  if (!vehicles.length) {
    return `<option value="">Nema vozila za tu pretragu</option>`;
  }

  return `<option value="">Odaberi vozilo</option>` + vehicles.map(v => {
    const name = v.name || "Vozilo";
    const label = formatAssetLabel(v);
    const type = v.asset_type || v.type || "";
    const isSelected = selected && (selected === name || selected === String(v.id || "")) ? "selected" : "";
    return `<option value="${escapeHtml(name)}" data-asset-id="${escapeHtml(v.id || "")}" data-registration="${escapeHtml(v.registration || "")}" data-capacity="${escapeHtml(v.capacity || "")}" data-asset-type="${escapeHtml(type)}" ${isSelected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function refreshOneVehicleSelect(entryEl) {
  const sel = entryEl.querySelector(".v-name");
  if (!sel) return;
  const old = sel.value;
  const search = entryEl.querySelector(".v-search")?.value || "";
  sel.innerHTML = buildVehicleOptionsHtml(old, search);
  if (old && Array.from(sel.options).some(o => o.value === old)) sel.value = old;
}

function refreshVehicleSelects() {
  $$("#vehicleEntries .vehicle-entry").forEach(entry => refreshOneVehicleSelect(entry));
}

function getSelectedVehicleFromEntry(el) {
  const select = el.querySelector(".v-name");
  const option = select?.options ? select.options[select.selectedIndex] : null;
  const custom = el.querySelector(".v-custom")?.value.trim() || "";
  return {
    asset_id: custom ? null : (option?.dataset?.assetId || null),
    name: custom || (select?.value || ""),
    registration: custom ? "" : (option?.dataset?.registration || ""),
    capacity: custom ? "" : (option?.dataset?.capacity || "")
  };
}

function parseDecimal(value) {
  const n = Number(String(value || "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function calculateVehicleCubic(capacity, tours) {
  const cap = parseDecimal(capacity);
  const t = parseDecimal(tours);
  if (!cap || !t) return "";
  const total = cap * t;
  return Number.isInteger(total) ? String(total) : String(Math.round(total * 100) / 100);
}

function updateVehicleCubic(entryEl) {
  const selected = getSelectedVehicleFromEntry(entryEl);
  const tours = entryEl.querySelector(".v-tours")?.value || "";
  const auto = calculateVehicleCubic(selected.capacity, tours);
  const autoEl = entryEl.querySelector(".v-cubic-auto");
  if (autoEl) autoEl.value = auto;
  const hint = entryEl.querySelector(".v-cubic-hint");
  if (hint) {
    hint.textContent = auto
      ? `Automatski: ${selected.capacity || 0} m³ × ${tours || 0} tura = ${auto} m³`
      : "Ako vozilo ima kapacitet i upišeš broj tura, aplikacija računa m³ automatski.";
  }
}

function addVehicleEntry(values = {}) {
  const list = $("#vehicleEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".vehicle-entry").length + 1;
  const selectedName = values.name || values.vehicle || values.asset_id || "";
  const div = document.createElement("div");
  div.className = "entry-card vehicle-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Vozilo ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Pronađi vozilo po registraciji ili nazivu</label>
    <input class="v-search" placeholder="npr. BG123AA, DAF, MAN..." value="" />

    <label>Vozilo iz Direkcije</label>
    <select class="v-name">${buildVehicleOptionsHtml(selectedName)}</select>
    <p class="field-hint">Ako je lista prazna, proveri: Direkcija → Mašine/vozila → Tip mora biti Vozilo i SQL worker_list_assets mora biti ažuriran.</p>

    <label>Ako vozilo nije u listi, upiši ručno</label>
    <input class="v-custom" placeholder="npr. zamensko vozilo" value="${escapeHtml(values.custom || values.vehicle_custom || "")}" />

    <div class="mini-grid">
      <div>
        <label>KM početak</label>
        <input class="v-km-start" type="number" step="1" value="${escapeHtml(values.km_start || values.start || "")}" />
      </div>
      <div>
        <label>KM kraj</label>
        <input class="v-km-end" type="number" step="1" value="${escapeHtml(values.km_end || values.end || "")}" />
      </div>
    </div>

    <label>Relacija</label>
    <input class="v-route" placeholder="Od - do" value="${escapeHtml(values.route || "")}" />

    <div class="mini-grid">
      <div>
        <label>Broj tura</label>
        <input class="v-tours" type="number" step="0.5" value="${escapeHtml(values.tours || "")}" />
      </div>
      <div>
        <label>Automatski m³</label>
        <input class="v-cubic-auto" type="number" step="0.01" readonly value="${escapeHtml(values.cubic_auto || values.cubic_m3 || "")}" />
      </div>
    </div>
    <p class="field-hint v-cubic-hint">Ako vozilo ima kapacitet i upišeš broj tura, aplikacija računa m³ automatski.</p>

    <label>Upiši ručno m³ ako nije puna tura</label>
    <input class="v-cubic-manual" type="number" step="0.01" placeholder="npr. 9 ako je pola ture od 18 m³" value="${escapeHtml(values.cubic_manual || "")}" />
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-search").addEventListener("input", () => {
    refreshOneVehicleSelect(div);
    updateVehicleCubic(div);
  });
  div.querySelector(".v-name").addEventListener("change", () => {
    updateVehicleCubic(div);
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-custom").addEventListener("input", refreshFuelMachineOptions);
  div.querySelector(".v-tours").addEventListener("input", () => updateVehicleCubic(div));
  list.appendChild(div);
  refreshOneVehicleSelect(div);
  updateVehicleCubic(div);
  refreshFuelMachineOptions();
}

function getVehicleEntries() {
  return $$("#vehicleEntries .vehicle-entry").map((el, i) => {
    const selected = getSelectedVehicleFromEntry(el);
    const tours = el.querySelector(".v-tours")?.value || "";
    const autoCubic = calculateVehicleCubic(selected.capacity, tours);
    const manualCubic = el.querySelector(".v-cubic-manual")?.value || "";
    const finalCubic = manualCubic || autoCubic;
    return {
      no: i + 1,
      asset_id: selected.asset_id,
      name: selected.name,
      vehicle: selected.name,
      registration: selected.registration,
      capacity: selected.capacity,
      vehicle_custom: el.querySelector(".v-custom")?.value.trim() || "",
      km_start: el.querySelector(".v-km-start")?.value || "",
      km_end: el.querySelector(".v-km-end")?.value || "",
      route: el.querySelector(".v-route")?.value.trim() || "",
      tours,
      cubic_auto: autoCubic,
      cubic_manual: manualCubic,
      cubic_m3: finalCubic
    };
  }).filter(v => v.name || v.km_start || v.km_end || v.route || v.tours || v.cubic_m3);
}

async function loadWorkerSites(selectedName = "") {
  const select = $("#wrSiteName");
  const hint = $("#workerSiteHint");
  if (!select) return;

  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  if (!worker) {
    select.innerHTML = `<option value="">Prvo se prijavi kao radnik</option>`;
    return;
  }

  select.innerHTML = `<option value="">Učitavam gradilišta...</option>`;
  if (hint) hint.textContent = "Gradilišta se učitavaju iz Direkcije.";

  try {
    const { data, error } = await sb.rpc("worker_list_sites", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code
    });

    if (error) throw error;

    const sites = Array.isArray(data) ? data : [];
    if (!sites.length) {
      select.innerHTML = `<option value="">Nema aktivnih gradilišta</option>`;
      if (hint) hint.textContent = "Direkcija još nije dodala aktivno gradilište ili je SQL za worker_list_sites star.";
      return;
    }

    select.innerHTML = `<option value="">Odaberi gradilište</option>` + sites.map(site => {
      const name = site.name || "Gradilište";
      const loc = site.location ? ` · ${site.location}` : "";
      return `<option value="${escapeHtml(name)}" data-site-id="${escapeHtml(site.id || "")}">${escapeHtml(name + loc)}</option>`;
    }).join("");

    if (selectedName) {
      const wanted = String(selectedName).trim().toLowerCase();
      const match = Array.from(select.options).find(o => String(o.value || "").trim().toLowerCase() === wanted);
      if (match) select.value = match.value;
    }

    if (hint) hint.textContent = "Odaberi aktivno gradilište koje je dodala Direkcija.";
  } catch (e) {
    select.innerHTML = `<option value="">Gradilišta nisu učitana</option>`;
    if (hint) hint.textContent = "Pokreni Supabase SQL za v1.12.1: worker_list_sites. Detalj: " + (e.message || e);
    toast("Gradilišta za radnika nisu učitana: " + (e.message || e), true);
  }
}

function workerSetSections(perms) {
  const map = {
    daily_work: "#secDailyWork",
    workers: "#secWorkers",
    machines: "#secMachines",
    vehicles: "#secVehicles",
    lowloader: "#secLowloader",
    fuel: "#secFuel",
    field_tanker: "#secFieldTanker",
    materials: "#secMaterials",
    warehouse: "#secWarehouse",
    defects: "#secDefects"
  };
  Object.entries(map).forEach(([key, sel]) => $(sel).classList.toggle("active", !!perms[key]));
}



function addWorkerEntry(values = {}) {
  const list = $("#workerEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".worker-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card worker-entry";
  div.innerHTML = `
    <h5>Radnik ${idx}</h5>
    <div class="grid two">
      <div>
        <label>Ime</label>
        <input class="worker-first" placeholder="Ime radnika" value="${escapeHtml(values.first_name || values.first || "")}" />
      </div>
      <div>
        <label>Prezime</label>
        <input class="worker-last" placeholder="Prezime radnika" value="${escapeHtml(values.last_name || values.last || "")}" />
      </div>
    </div>
    <label>Sati rada tog dana</label>
    <input class="worker-hours numeric-text" type="text" inputmode="decimal" placeholder="8" value="${escapeHtml(values.hours || "")}" />
    <button class="secondary small-btn" type="button" onclick="this.closest('.worker-entry').remove(); renumberWorkerEntries();">Ukloni radnika</button>
  `;
  list.appendChild(div);
}

function renumberWorkerEntries() {
  $$("#workerEntries .worker-entry").forEach((card, i) => {
    const h = card.querySelector("h5");
    if (h) h.textContent = `Radnik ${i + 1}`;
  });
}

function getWorkerEntries() {
  return $$("#workerEntries .worker-entry").map(card => {
    const first = card.querySelector(".worker-first")?.value.trim() || "";
    const last = card.querySelector(".worker-last")?.value.trim() || "";
    const hours = card.querySelector(".worker-hours")?.value.trim() || "";
    return {
      first_name: first,
      last_name: last,
      full_name: [first, last].filter(Boolean).join(" "),
      hours
    };
  }).filter(w => w.first_name || w.last_name || w.hours);
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
  preventNumberInputScrollChanges(div);
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


function addLowloaderEntry(values = {}) {
  const list = $("#lowloaderEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".lowloader-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card lowloader-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Selidba mašine ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Broj tablica labudice</label>
    <input class="ll-plates" placeholder="npr. BG-123-AA" value="${escapeHtml(values.plates || values.registration || "")}" />

    <div class="grid two">
      <div>
        <label>Početna adresa</label>
        <input class="ll-from" placeholder="odakle se preuzima mašina" value="${escapeHtml(values.from_address || values.from || "")}" />
      </div>
      <div>
        <label>Završna adresa</label>
        <input class="ll-to" placeholder="gde se istovara mašina" value="${escapeHtml(values.to_address || values.to || "")}" />
      </div>
    </div>

    <label>Ukupno kilometara</label>
    <input class="ll-km numeric-text" type="text" inputmode="decimal" placeholder="npr. 42" value="${escapeHtml(values.km_total || values.km || "")}" />

    <label>Koju mašinu seli</label>
    <input class="ll-machine" placeholder="npr. bager CAT 330, valjak, finišer..." value="${escapeHtml(values.machine || values.machine_name || "")}" />
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberLowloaderEntries();
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
}

function renumberLowloaderEntries() {
  $$("#lowloaderEntries .lowloader-entry").forEach((card, i) => {
    const h = card.querySelector("strong");
    if (h) h.textContent = `Selidba mašine ${i + 1}`;
  });
}

function getLowloaderEntries() {
  return $$("#lowloaderEntries .lowloader-entry").map((el, i) => {
    const plates = el.querySelector(".ll-plates")?.value.trim() || "";
    const from = el.querySelector(".ll-from")?.value.trim() || "";
    const to = el.querySelector(".ll-to")?.value.trim() || "";
    const km = el.querySelector(".ll-km")?.value.trim() || "";
    const machine = el.querySelector(".ll-machine")?.value.trim() || "";
    return {
      no: i + 1,
      plates,
      registration: plates,
      from_address: from,
      to_address: to,
      km_total: km,
      machine
    };
  }).filter(x => x.plates || x.from_address || x.to_address || x.km_total || x.machine);
}


function addFieldTankerEntry(values = {}) {
  const list = $("#fieldTankerEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".field-tanker-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card field-tanker-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje na terenu ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Ime gradilišta</label>
    <input class="ft-site" placeholder="npr. Zemun Zmaj" value="${escapeHtml(values.site_name || values.site || "")}" />

    <label>Mašina ili vozilo</label>
    <input class="ft-asset" placeholder="npr. CAT 330, valjak, kamion..." value="${escapeHtml(values.asset_name || values.machine || values.vehicle || "")}" />

    <label>Trenutni MTČ ili kilometraža</label>
    <input class="ft-reading numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250 ili 85320" value="${escapeHtml(values.reading || values.mtc_km || "")}" />

    <label>Sipano litara</label>
    <input class="ft-liters numeric-text" type="text" inputmode="decimal" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />

    <label>Gorivo primio</label>
    <input class="ft-receiver" placeholder="ime i prezime vozača / rukovaoca" value="${escapeHtml(values.receiver || values.received_by || "")}" />
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberFieldTankerEntries();
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
}

function renumberFieldTankerEntries() {
  $$("#fieldTankerEntries .field-tanker-entry").forEach((card, i) => {
    const h = card.querySelector("strong");
    if (h) h.textContent = `Sipanje na terenu ${i + 1}`;
  });
}

function getFieldTankerEntries() {
  return $$("#fieldTankerEntries .field-tanker-entry").map((el, i) => {
    const site = el.querySelector(".ft-site")?.value.trim() || "";
    const asset = el.querySelector(".ft-asset")?.value.trim() || "";
    const reading = el.querySelector(".ft-reading")?.value.trim() || "";
    const liters = el.querySelector(".ft-liters")?.value.trim() || "";
    const receiver = el.querySelector(".ft-receiver")?.value.trim() || "";
    return {
      no: i + 1,
      site_name: site,
      asset_name: asset,
      machine: asset,
      reading,
      mtc_km: reading,
      liters,
      receiver,
      received_by: receiver
    };
  }).filter(x => x.site_name || x.asset_name || x.reading || x.liters || x.receiver);
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
        <input class="f-liters" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />
      </div>
      <div>
        <label>MTČ / KM pri sipanju</label>
        <input class="f-reading" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 1255.0" value="${escapeHtml(values.reading || "")}" />
      </div>
    </div>

    <label>Ko je sipao</label>
    <input class="f-by" placeholder="npr. Marko" value="${escapeHtml(values.by || "")}" />

    <p class="hint">Primalac goriva je automatski prijavljeni radnik koji šalje izveštaj.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => div.remove());
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
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
  const vehicles = getVehicleEntries().map(v => v.name).filter(Boolean);
  const choices = [...machines, ...vehicles].filter(Boolean);
  $$("#fuelEntries .f-machine").forEach(sel => {
    const old = sel.value;
    sel.innerHTML = `<option value="">-- izaberi mašinu / vozilo --</option>` + choices.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    if (choices.includes(old)) sel.value = old;
  });
}


// Direktno izlaganje funkcija za onclick fallback
window.addMachineEntry = addMachineEntry;
window.addFuelEntry = addFuelEntry;
window.addVehicleEntry = addVehicleEntry;
window.addFieldTankerEntry = addFieldTankerEntry;
window.addLowloaderEntry = addLowloaderEntry;
window.renumberLowloaderEntries = renumberLowloaderEntries;
window.refreshFuelMachineOptions = refreshFuelMachineOptions;


async function loadWorkerReturnedReports() {
  const panel = $("#workerReturnedReports");
  const list = $("#workerReturnedList");
  if (!panel || !list || !currentWorker) return;

  list.innerHTML = "";
  panel.classList.add("hidden");

  try {
    const { data, error } = await sb.rpc("worker_list_returned_reports", {
      p_company_code: currentWorker.company_code,
      p_access_code: currentWorker.access_code
    });

    if (error) throw error;
    if (!data || !data.length) return;

    panel.classList.remove("hidden");

    list.innerHTML = data.map(r => {
      const d = r.data || {};
      const title = d.report_type === "defect_record" || d.report_type === "defect_alert" ? "Evidencija kvara" : "Dnevni izveštaj";
      const site = d.site_name || d.defect_site_name || "Bez gradilišta";
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
    toast("Vraćeni izveštaji se ne mogu učitati: " + e.message + " Pokreni Supabase SQL za v1.13.7.", true);
  }
}

async function getReturnedReportForWorker(reportId) {
  if (!currentWorker) throw new Error("Radnik nije prijavljen.");
  const { data, error } = await sb.rpc("worker_list_returned_reports", {
    p_company_code: currentWorker.company_code,
    p_access_code: currentWorker.access_code
  });
  if (error) throw error;
  return (data || []).find(r => r.id === reportId) || null;
}

window.loadReturnedReportIntoForm = async (reportId) => {
  try {
    if (!currentWorker) throw new Error("Radnik nije prijavljen.");

    const r = await getReturnedReportForWorker(reportId);
    if (!r) throw new Error("Izveštaj nije pronađen ili više nije vraćen na dopunu.");

    const d = r.data || {};
    $("#wrDate").value = r.report_date || today();

    if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";

    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
    (d.field_tanker_entries || d.tanker_fuel_entries || []).forEach(x => addFieldTankerEntry(x));
    if ((!d.vehicles || !d.vehicles.length) && (d.vehicle || d.km_start || d.km_end || d.route || d.tours)) {
      addVehicleEntry({ name: d.vehicle, km_start: d.km_start, km_end: d.km_end, route: d.route, tours: d.tours });
    }
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
      wrDefectAssetName:"defect_asset_name",
      wrDefectSiteName:"defect_site_name",
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
  const perms = currentWorker?.permissions || {};
  const machines = perms.machines ? getMachineEntries() : [];
  const vehicles = perms.vehicles ? getVehicleEntries() : [];
  const fuelEntries = perms.fuel ? getFuelEntries() : [];
  const selectedSite = getSelectedWorkerSite();
  const canDaily = !!perms.daily_work;
  const canWorkers = !!perms.workers;
  const canMaterials = !!perms.materials;
  const canWarehouse = !!perms.warehouse;
  const canDefects = !!perms.defects;
  const canLowloader = !!perms.lowloader;
  const canFieldTanker = !!perms.field_tanker;
  const lowloaderMoves = canLowloader ? getLowloaderEntries() : [];
  const fieldTankerEntries = canFieldTanker ? getFieldTankerEntries() : [];
  return {
    site_id: selectedSite.site_id,
    site_name: selectedSite.site_name,
    description: canDaily ? $("#wrDescription").value.trim() : "",
    hours: canDaily ? $("#wrHours").value : "",
    workers: canWorkers ? getWorkerEntries() : [],
    worker_entries: canWorkers ? getWorkerEntries() : [],
    workers_total_hours: canWorkers ? getWorkerEntries().reduce((sum, w) => sum + parseDecimalInput(w.hours), 0) || "" : "",
    machines,
    vehicles,
    lowloader_moves: lowloaderMoves,
    lowloader_entries: lowloaderMoves,
    field_tanker_entries: fieldTankerEntries,
    tanker_fuel_entries: fieldTankerEntries,
    fuel_entries: fuelEntries,

    // Summary fields for older report/CSV display
    machine: machines.map(m => m.name).filter(Boolean).join(" | "),
    mtc_start: machines.map(m => m.start).filter(Boolean).join(" | "),
    mtc_end: machines.map(m => m.end).filter(Boolean).join(" | "),
    machine_hours: machines.map(m => m.hours).filter(Boolean).join(" | "),
    fuel_liters: fuelEntries.reduce((sum, f) => sum + parseDecimalInput(f.liters), 0) || "",
    fuel_readings: fuelEntries.map(f => f.reading).filter(Boolean).join(" | "),
    fuel_by: fuelEntries.map(f => f.by).filter(Boolean).join(" | "),
    fuel_receiver: currentWorker?.full_name || "",

    vehicle: vehicles.map(v => v.name).filter(Boolean).join(" | "),
    km_start: vehicles.map(v => v.km_start).filter(Boolean).join(" | "),
    km_end: vehicles.map(v => v.km_end).filter(Boolean).join(" | "),
    route: vehicles.map(v => v.route).filter(Boolean).join(" | "),
    tours: vehicles.map(v => v.tours).filter(Boolean).join(" | "),
    cubic_m3: vehicles.map(v => v.cubic_m3).filter(Boolean).join(" | "),
    material: canMaterials ? $("#wrMaterial").value.trim() : "",
    quantity: canMaterials ? $("#wrQuantity").value : "",
    unit: canMaterials ? $("#wrUnit").value.trim() : "",
    warehouse_type: canWarehouse ? $("#wrWarehouseType").value : "",
    warehouse_item: canWarehouse ? $("#wrWarehouseItem").value.trim() : "",
    warehouse_qty: canWarehouse ? $("#wrWarehouseQty").value.trim() : "",
    defect_asset_name: canDefects ? ($("#wrDefectAssetName")?.value.trim() || "") : "",
    defect_machine: canDefects ? ($("#wrDefectAssetName")?.value.trim() || "") : "",
    defect_site_name: canDefects ? ($("#wrDefectSiteName")?.value.trim() || selectedSite.site_name || "") : "",
    defect_exists: canDefects ? ($("#wrDefectExists")?.value || "ne") : "ne",
    defect: canDefects ? $("#wrDefect").value.trim() : "",
    defect_stops_work: canDefects ? ($("#wrDefectStopsWork")?.value || "") : "",
    defect_can_continue: canDefects ? ($("#wrDefectCanContinue")?.value || "") : "",
    defect_urgency: canDefects ? $("#wrDefectUrgency").value : "",
    called_mechanic_by_phone: canDefects ? ($("#wrDefectCalledMechanic")?.value || "") : ""
  };
}

function clearWorkerForm() {
  ["wrSiteName","wrDescription","wrHours","wrVehicle","wrKmStart","wrKmEnd","wrRoute","wrTours","wrMaterial","wrQuantity","wrUnit","wrWarehouseType","wrWarehouseItem","wrWarehouseQty","wrDefectAssetName","wrDefectSiteName","wrDefectExists","wrDefect","wrDefectStopsWork","wrDefectCanContinue","wrDefectUrgency","wrDefectCalledMechanic"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
  if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
  if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
  if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
  if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
  if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
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

    if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
    if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
    (d.field_tanker_entries || d.tanker_fuel_entries || []).forEach(x => addFieldTankerEntry(x));
    if ((!d.vehicles || !d.vehicles.length) && (d.vehicle || d.km_start || d.km_end || d.route || d.tours)) {
      addVehicleEntry({ name: d.vehicle, km_start: d.km_start, km_end: d.km_end, route: d.route, tours: d.tours });
    }
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));

    Object.entries({
      wrSiteName:"site_name", wrDescription:"description", wrHours:"hours", wrVehicle:"vehicle", wrKmStart:"km_start", wrKmEnd:"km_end", wrRoute:"route", wrTours:"tours", wrMaterial:"material", wrQuantity:"quantity", wrUnit:"unit", wrWarehouseType:"warehouse_type", wrWarehouseItem:"warehouse_item", wrWarehouseQty:"warehouse_qty", wrDefectAssetName:"defect_asset_name", wrDefectSiteName:"defect_site_name", wrDefectExists:"defect_exists", wrDefect:"defect", wrDefectStopsWork:"defect_stops_work", wrDefectCanContinue:"defect_can_continue", wrDefectUrgency:"defect_urgency", wrDefectCalledMechanic:"called_mechanic_by_phone"
    }).forEach(([id,key]) => { if ($("#"+id)) $("#"+id).value = d[key] || ""; });
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function csvEscape(v) {
  return `"${String(v ?? "").replaceAll('"','""')}"`;
}

function parseDecimalInput(value) {
  const cleaned = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function preventNumberInputScrollChanges(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(input => {
    if (input.dataset.noWheelBound === "1") return;
    input.dataset.noWheelBound = "1";
    input.addEventListener("wheel", (event) => {
      event.preventDefault();
      input.blur();
    }, { passive: false });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
    });
  });
}

function excelCellText(v) {
  return String(v ?? "").replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
}

function downloadBlob(blob, fileName) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

const EXPORT_SELECTION_KEY = "swp_export_report_ids";
const EXPORT_COLUMN_KEY = "swp_export_columns";

const EXPORT_COLUMNS = [
  { key:"date", label:"Datum" },
  { key:"worker", label:"Radnik" },
  { key:"function", label:"Funkcija" },
  { key:"site", label:"Gradilište" },
  { key:"hours", label:"Sati rada" },
  { key:"description", label:"Opis rada" },
  { key:"crew_worker", label:"Radnik u ekipi" },
  { key:"crew_hours", label:"Sati radnika u ekipi" },
  { key:"machine", label:"Mašina" },
  { key:"machine_start", label:"MTČ/KM početak" },
  { key:"machine_end", label:"MTČ/KM kraj" },
  { key:"machine_hours", label:"Sati mašine" },
  { key:"machine_work", label:"Rad mašine" },
  { key:"vehicle", label:"Vozilo" },
  { key:"registration", label:"Registracija" },
  { key:"capacity", label:"Kapacitet m³" },
  { key:"km_start", label:"KM početak" },
  { key:"km_end", label:"KM kraj" },
  { key:"route", label:"Relacija" },
  { key:"tours", label:"Ture" },
  { key:"cubic", label:"m³ ukupno" },
  { key:"manual_cubic", label:"Ručno m³" },
  { key:"lowloader_plates", label:"Labudica tablice" },
  { key:"lowloader_from", label:"Labudica početna adresa" },
  { key:"lowloader_to", label:"Labudica završna adresa" },
  { key:"lowloader_km", label:"Labudica ukupno km" },
  { key:"lowloader_machine", label:"Mašina koja se seli" },
  { key:"fuel_for", label:"Gorivo za" },
  { key:"fuel_liters", label:"Gorivo litara" },
  { key:"fuel_reading", label:"MTČ/KM pri sipanju" },
  { key:"fuel_by", label:"Sipao" },
  { key:"fuel_receiver", label:"Primio" },
  { key:"field_tanker_site", label:"Cisterna gradilište" },
  { key:"field_tanker_asset", label:"Cisterna mašina/vozilo" },
  { key:"field_tanker_reading", label:"Cisterna MTČ/KM" },
  { key:"field_tanker_liters", label:"Cisterna litara" },
  { key:"field_tanker_receiver", label:"Cisterna gorivo primio" },
  { key:"material", label:"Materijal" },
  { key:"quantity", label:"Količina" },
  { key:"unit", label:"Jedinica" },
  { key:"defect", label:"Kvar" },
  { key:"status", label:"Status" },
  { key:"note", label:"Napomena" }
];

function getExportSelectedIds() {
  try { return JSON.parse(localStorage.getItem(EXPORT_SELECTION_KEY) || "[]"); }
  catch { return []; }
}

function setExportSelectedIds(ids) {
  const clean = Array.from(new Set((ids || []).filter(Boolean)));
  localStorage.setItem(EXPORT_SELECTION_KEY, JSON.stringify(clean));
  return clean;
}

function getExportColumnKeys() {
  try {
    const raw = localStorage.getItem(EXPORT_COLUMN_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) return saved;
    }
  } catch {}
  return EXPORT_COLUMNS.map(c => c.key);
}

function setExportColumnKeys(keys) {
  localStorage.setItem(EXPORT_COLUMN_KEY, JSON.stringify(keys || []));
}

window.toggleReportExportSelection = (id, checked) => {
  const ids = getExportSelectedIds();
  const next = checked ? [...ids, id] : ids.filter(x => x !== id);
  setExportSelectedIds(next);
  renderExportPanel();
};

window.selectAllReportsForExport = () => {
  const ids = directorReportsCache.map(r => r.id);
  setExportSelectedIds(ids);
  $$(".report-export-check").forEach(cb => cb.checked = true);
  renderExportPanel();
  toast("Svi prikazani izveštaji su označeni za Excel export.");
};

window.clearReportsForExport = () => {
  setExportSelectedIds([]);
  $$(".report-export-check").forEach(cb => cb.checked = false);
  renderExportPanel();
  toast("Označeni izveštaji su poništeni.");
};

window.goToExportTab = () => {
  const tab = document.querySelector('.tab[data-tab="export"]');
  if (tab) tab.click();
  renderExportPanel();
};

window.toggleExportColumn = (key, checked) => {
  const keys = getExportColumnKeys();
  const next = checked ? [...keys, key] : keys.filter(k => k !== key);
  setExportColumnKeys(Array.from(new Set(next)));
};

window.selectAllExportColumns = () => {
  setExportColumnKeys(EXPORT_COLUMNS.map(c => c.key));
  renderExportPanel();
  toast("Sve rubrike za Excel su označene.");
};

window.clearExportColumns = () => {
  setExportColumnKeys([]);
  $$("#exportColumnsBox input[type='checkbox']").forEach(cb => cb.checked = false);
  renderExportPanel();
  toast("Sve rubrike za Excel su poništene.");
};

function getSelectedReportsForExport() {
  const ids = getExportSelectedIds();
  if (!ids.length) return [];
  const set = new Set(ids);
  return directorReportsCache.filter(r => set.has(r.id));
}

function reportPersonName(r) {
  return r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : "";
}

function flattenReportRowsForExport(r) {
  const d = r.data || {};
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, fuels.length, fieldTankers.length);
  const rows = [];

  for (let i = 0; i < maxRows; i++) {
    const w = workers[i] || {};
    const m = machines[i] || {};
    const v = vehicles[i] || {};
    const ll = lowloaders[i] || {};
    const f = fuels[i] || {};
    const ft = fieldTankers[i] || {};
    rows.push({
      date: r.report_date || "",
      worker: reportPersonName(r),
      function: r.company_users?.function_title || "",
      site: d.site_name || "",
      hours: d.hours || "",
      description: d.description || "",
      crew_worker: w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || "",
      crew_hours: w.hours || "",
      machine: m.name || d.machine || "",
      machine_start: m.start || d.mtc_start || "",
      machine_end: m.end || d.mtc_end || "",
      machine_hours: m.hours || d.machine_hours || "",
      machine_work: m.work || "",
      vehicle: v.name || v.vehicle || d.vehicle || "",
      registration: v.registration || "",
      capacity: v.capacity || "",
      km_start: v.km_start || d.km_start || "",
      km_end: v.km_end || d.km_end || "",
      route: v.route || d.route || "",
      tours: v.tours || d.tours || "",
      cubic: v.cubic_m3 || v.cubic_auto || "",
      manual_cubic: v.cubic_manual || "",
      lowloader_plates: ll.plates || ll.registration || "",
      lowloader_from: ll.from_address || "",
      lowloader_to: ll.to_address || "",
      lowloader_km: ll.km_total || "",
      lowloader_machine: ll.machine || "",
      fuel_for: f.machine || "",
      fuel_liters: f.liters || d.fuel_liters || "",
      fuel_reading: f.reading || d.fuel_readings || "",
      fuel_by: f.by || "",
      fuel_receiver: f.receiver || d.fuel_receiver || "",
      field_tanker_site: ft.site_name || "",
      field_tanker_asset: ft.asset_name || ft.machine || "",
      field_tanker_reading: ft.reading || ft.mtc_km || "",
      field_tanker_liters: ft.liters || "",
      field_tanker_receiver: ft.receiver || ft.received_by || "",
      material: d.material || "",
      quantity: d.quantity || "",
      unit: d.unit || "",
      defect: d.defect || "",
      status: r.status || "",
      note: d.note || ""
    });
  }

  return rows;
}

function getExportRowsAndColumns() {
  const reports = getSelectedReportsForExport();
  const keys = getExportColumnKeys();
  const columns = EXPORT_COLUMNS.filter(c => keys.includes(c.key));
  const rows = reports.flatMap(flattenReportRowsForExport);
  return { reports, columns, rows };
}

function renderExportPanel() {
  const box = $("#exportSelectedReportsBox");
  const colsBox = $("#exportColumnsBox");
  const countBox = $("#exportSelectedCount");
  if (!box || !colsBox) return;

  const selected = getSelectedReportsForExport();
  const selectedIds = new Set(selected.map(r => r.id));
  const keys = getExportColumnKeys();

  if (countBox) countBox.textContent = `${selected.length} izveštaja označeno za export`;

  box.innerHTML = selected.length ? selected.map(r => {
    const d = r.data || {};
    return `<div class="export-selected-item">
      <b>${escapeHtml(r.report_date || "bez datuma")}</b>
      <span>${escapeHtml(reportPersonName(r) || "Nepoznat radnik")}</span>
      <small>${escapeHtml(d.site_name || "bez gradilišta")} · ${escapeHtml(r.status || "")}</small>
      <button class="secondary small-btn" type="button" onclick="toggleReportExportSelection('${r.id}', false); const cb=document.querySelector('[onchange*=\'${r.id}\']'); if(cb) cb.checked=false;">Ukloni</button>
    </div>`;
  }).join("") : `<p class="muted">Nema izabranih izveštaja. Idi u tab Izveštaji i štikliraj šta želiš za Excel.</p>`;

  colsBox.innerHTML = EXPORT_COLUMNS.map(c => `
    <label class="export-column-check">
      <input type="checkbox" ${keys.includes(c.key) ? "checked" : ""} onchange="toggleExportColumn('${c.key}', this.checked)" />
      ${escapeHtml(c.label)}
    </label>
  `).join("");

  $$(".report-export-check").forEach(cb => {
    const m = cb.getAttribute("onchange") || "";
    const id = (m.match(/toggleReportExportSelection\('([^']+)'/) || [])[1];
    if (id) cb.checked = selectedIds.has(id);
  });
}

function buildCsvContent(delimiter = ";") {
  const { columns, rows } = getExportRowsAndColumns();
  if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za Excel export.");
  if (!rows.length) throw new Error("Nema izabranih izveštaja za export.");
  const header = columns.map(c => csvEscape(c.label)).join(delimiter);
  const body = rows.map(row => columns.map(c => csvEscape(excelCellText(row[c.key]))).join(delimiter));
  return [header, ...body].join("\r\n");
}

function buildExcelHtmlTable() {
  const { columns, rows } = getExportRowsAndColumns();
  if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za Excel export.");
  if (!rows.length) throw new Error("Nema izabranih izveštaja za export.");

  const head = `<tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row, index) => `<tr class="${index % 2 ? "even" : "odd"}">${columns.map(c => `<td>${escapeHtml(excelCellText(row[c.key]))}</td>`).join("")}</tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th {
    background: #0f7a3b;
    color: #ffffff;
    font-weight: 700;
    border: 1px solid #0b5f2e;
    padding: 8px 10px;
    text-align: left;
    white-space: nowrap;
  }
  td {
    border: 1px solid #cfd8dc;
    padding: 7px 9px;
    vertical-align: top;
    mso-number-format: "\@";
  }
  tr.odd td { background: #ffffff; }
  tr.even td { background: #f6fbf7; }
</style>
</head>
<body>
<table>
  ${head}
  ${body}
</table>
</body>
</html>`;
}

async function exportCsv() {
  try {
    const csv = buildCsvContent(";");
    const blob = new Blob(["﻿" + csv], {type:"text/csv;charset=utf-8"});
    downloadBlob(blob, `dnevni-izvestaji-${today()}.csv`);
    toast("CSV fajl je preuzet. Za tvoj Excel koristi se tačka-zarez da kolone budu lepo razdvojene.");
  } catch(e) {
    toast(e.message, true);
  }
}

async function exportExcelFile() {
  try {
    const html = buildExcelHtmlTable();
    const blob = new Blob(["﻿" + html], {type:"application/vnd.ms-excel;charset=utf-8"});
    downloadBlob(blob, `dnevni-izvestaji-${today()}.xls`);
    toast("Excel tabela je preuzeta. Otvori fajl u Excelu.");
  } catch(e) {
    toast(e.message, true);
  }
}

async function copyExportTableForExcel() {
  try {
    const { columns, rows } = getExportRowsAndColumns();
    if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za kopiranje.");
    if (!rows.length) throw new Error("Nema izabranih izveštaja za kopiranje.");
    const text = [
      columns.map(c => c.label).join("\t"),
      ...rows.map(row => columns.map(c => excelCellText(row[c.key])).join("\t"))
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast("Tabela je kopirana. Otvori Excel i pritisni Ctrl + V.");
  } catch(e) {
    toast(e.message, true);
  }
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
    const defectAssetName = $("#wrDefectAssetName")?.value.trim() || "";
    const selectedDefectSite = getSelectedWorkerSite ? getSelectedWorkerSite() : {};
    const defectSiteName = $("#wrDefectSiteName")?.value.trim() || selectedDefectSite.site_name || "";
    const exists = $("#wrDefectExists")?.value || "ne";

    if (exists !== "da" && !defectText) {
      throw new Error("Prvo označi da ima kvar ili upiši opis kvara.");
    }

    const machines = getMachineEntries ? getMachineEntries() : [];
    const firstMachine = defectAssetName || machines[0]?.name || "";

    const urgentData = {
      report_type: "defect_record",
      sent_immediately: true,
      defect_status: "prijavljen",
      defect_reported_at: new Date().toISOString(),
      site_id: selectedDefectSite.site_id || getSelectedWorkerSite().site_id,
      site_name: defectSiteName || getSelectedWorkerSite().site_name,
      defect_site_name: defectSiteName || getSelectedWorkerSite().site_name,
      machine: firstMachine,
      defect_asset_name: defectAssetName,
      defect_machine: defectAssetName,
      defect_site_name: defectSiteName,
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
      p_site_id: getSelectedWorkerSite().site_id,
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

    // Radnik se ne loguje emailom. Login mora proći samo preko para:
    // šifra firme + šifra radnika. Ovo ide kroz Supabase RPC worker_login.
    const { data, error } = await sb.rpc("worker_login", {
      p_company_code: companyCode,
      p_access_code: accessCode
    });

    if (error) {
      throw new Error("Worker login SQL nije aktivan ili je star. Pokreni SQL dopunu iz ZIP-a, pa probaj opet. Detalj: " + error.message);
    }

    const row = readRpcSingleRow(data);
    if (!row || !row.user_id || !row.company_id) {
      throw new Error("Neispravna šifra firme ili šifra radnika. Proveri da je radnik AKTIVAN i da unosiš baš šifru firme + šifru radnika.");
    }

    currentWorker = {
      ...row,
      company_code: row.company_code || companyCode,
      access_code: row.access_code || accessCode
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
  preventNumberInputScrollChanges(document);

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
    if (btn.dataset.tab === "export") renderExportPanel();
    if (btn.dataset.tab === "defects") renderDefectsList();
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

  $("#addAssetBtn").addEventListener("click", saveAssetForm);
  if ($("#cancelEditAssetBtn")) $("#cancelEditAssetBtn").addEventListener("click", clearAssetForm);


  if ($("#directorSearchBtn")) $("#directorSearchBtn").addEventListener("click", () => runDirectorGlobalSearch(true));
  if ($("#directorClearSearchBtn")) $("#directorClearSearchBtn").addEventListener("click", () => {
    $("#directorGlobalSearch").value = "";
    $("#directorSearchResults").classList.add("hidden");
    $("#directorSearchResultsList").innerHTML = "";
  });
  if ($("#directorGlobalSearch")) $("#directorGlobalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runDirectorGlobalSearch(true);
  });

  if ($("#addMaterialBtn")) $("#addMaterialBtn").addEventListener("click", saveMaterialForm);
  if ($("#cancelEditMaterialBtn")) $("#cancelEditMaterialBtn").addEventListener("click", clearMaterialForm);

  if ($("#selectAllReportsBtn")) $("#selectAllReportsBtn").addEventListener("click", selectAllReportsForExport);
  if ($("#clearReportsBtn")) $("#clearReportsBtn").addEventListener("click", clearReportsForExport);
  if ($("#goExportBtn")) $("#goExportBtn").addEventListener("click", goToExportTab);
  if ($("#refreshDefectsBtn")) $("#refreshDefectsBtn").addEventListener("click", loadReports);
  if ($("#exportCsvBtn")) $("#exportCsvBtn").addEventListener("click", exportCsv);
  if ($("#exportXlsBtn")) $("#exportXlsBtn").addEventListener("click", exportExcelFile);
  if ($("#copyExcelBtn")) $("#copyExcelBtn").addEventListener("click", copyExportTableForExcel);
  if ($("#selectAllColumnsBtn")) $("#selectAllColumnsBtn").addEventListener("click", selectAllExportColumns);
  if ($("#clearColumnsBtn")) $("#clearColumnsBtn").addEventListener("click", clearExportColumns);

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
      if (!data.site_name) throw new Error("Odaberi gradilište iz liste. Gradilište prvo dodaje Direkcija.");
    if (await submitReturnedCorrectionIfNeeded(data)) return;
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: $("#wrDate").value || today(),
        p_site_id: data.site_id || null,
        p_data: data
      });
      if (error) throw error;
      clearWorkerForm();
      $("#wrDate").value = today();
      toast("Izveštaj je poslat Direkciji ✅ Forma je očišćena.");
    } catch(e) { toast(e.message, true); }
  });
}

async function openWorkerForm() {
  $("#wrDate").value = today();
  $("#workerHello").textContent = `Dobrodošli, ${currentWorker.full_name}`;
  $("#workerCompanyLabel").textContent = `${currentWorker.company_name} · ${currentWorker.function_title}`;
  workerSetSections(currentWorker.permissions || {});
  setInternalHeader("Dnevni izveštaj", `${currentWorker?.full_name || "Radnik"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  show("WorkerForm");
  await Promise.all([loadWorkerSites(), loadWorkerAssets()]);
  loadDraft();
  loadWorkerReturnedReports();
  if ($("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if ($("#vehicleEntries") && !$("#vehicleEntries").children.length) addVehicleEntry();
  if ($("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
  if ((currentWorker.permissions || {}).field_tanker && $("#fieldTankerEntries") && !$("#fieldTankerEntries").children.length) addFieldTankerEntry();
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

  const { error } = await sb.rpc("worker_resubmit_returned_report", {
    p_company_code: currentWorker.company_code,
    p_access_code: currentWorker.access_code,
    p_report_id: returnedId,
    p_report_date: $("#wrDate").value || today(),
    p_site_id: reportData.site_id || null,
    p_data: reportData
  });

  if (error) throw error;

  localStorage.removeItem("swp_returned_report_id");
  toast("Ispravljen izveštaj je ponovo poslat Direkciji ✅");
  clearWorkerForm();
  loadWorkerReturnedReports();
  return true;
}
