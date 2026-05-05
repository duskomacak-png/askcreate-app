// v1.19.8_WORKER_ASSET_CODE_UNIVERSAL - broj sredstva bira mašinu/vozilo/ostalo i ne koči ga stari filter
/* START WORK PRO by AskCreate - MVP v1
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";
const APP_VERSION = "1.21.4";


let sb = null;
let currentCompany = null;
let editingPersonId = null;
let editingAssetId = null;
let editingMaterialId = null;
let currentWorker = null;
let workerAssetOptions = [];
let workerSiteOptions = [];
let workerMaterialOptions = [];

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
  $$(".perm").forEach(ch => { ch.checked = false; });
  editingPersonId = null;
  setPersonFormMode("add");
  refreshPersonMaterialPermissions();
  hideWorkerPreview();
}


const WORKER_PREVIEW_SECTIONS = [
  { key: "daily_work", title: "Ime gradilišta i datum/godina", lines: ["Datum / godina", "Gradilište iz liste Direkcije"] },
  { key: "workers", title: "Radnici na gradilištu", lines: ["Ime i prezime radnika", "Sati rada", "+ Dodaj radnika"] },
  { key: "machines", title: "Rad sa mašinom", lines: ["Mašina iz Direkcije ili ručni unos", "Početni i završni MTČ", "Sati rada"] },
  { key: "vehicles", title: "Rad sa kamionom / vozilom", lines: ["Vozilo / kamion", "Početna i završna kilometraža", "Ture / kubici"] },
  { key: "lowloader", title: "Prevoz mašine labudicom", lines: ["Tablice labudice", "Odakle i gde se vozi", "Mašina koju seli", "Početna / završna kilometraža"] },
  { key: "fuel", title: "Sipanje goriva u svoju mašinu", lines: ["Mašina ili vozilo", "KM posebno", "MTČ posebno", "Litara", "Ko je sipao / primio"] },
  { key: "field_tanker", title: "Tankanje goriva cisternom", lines: ["Gradilište", "Mašina ili vozilo", "Litara", "Gorivo primio"] },
  { key: "materials", title: "Materijal", lines: ["Ulaz / izlaz / ugradnja", "Vrsta materijala", "Količina i jedinica mere"] },
  { key: "leave_request", title: "Zahtev za slobodan dan / godišnji odmor", lines: ["Slobodan dan: jedan datum", "Godišnji odmor: datum od - do", "Napomena / razlog"] },
  { key: "warehouse", title: "Magacin", lines: ["Ulaz / izlaz", "Materijal", "Količina"] },
  { key: "defects", title: "Prijava kvara", lines: ["Mašina / vozilo", "Lokacija", "Opis kvara", "Hitnost"] },
  { key: "view_reports", title: "Pregled izveštaja", lines: ["Pregled odobrenih / vraćenih izveštaja ako je uključeno za ovog korisnika"] },
  { key: "approve_reports", title: "Odobravanje", lines: ["Odobravanje ili vraćanje izveštaja, samo za ovlašćene korisnike"] },
  { key: "excel_export", title: "Izvoz u Excel", lines: ["Priprema i preuzimanje Excel/CSV izvoza"] },
  { key: "manage_people", title: "Upravljanje osobama", lines: ["Dodavanje i izmena ljudi u firmi"] },
  { key: "settings", title: "Podešavanja firme", lines: ["Osnovna podešavanja firme"] }
];

function getPersonPreviewData() {
  const first = $("#personFirst")?.value.trim() || "Radnik";
  const last = $("#personLast")?.value.trim() || "";
  const role = $("#personFunction")?.value.trim() || "terenski unos";
  const code = $("#personCode")?.value.trim() || "šifra radnika";
  const selectedKeys = $$(".perm:checked").map(ch => ch.value);
  const materialNames = $$(".material-perm:checked").map(ch => ch.dataset.name || ch.value).filter(Boolean);
  return { first, last, role, code, selectedKeys, materialNames };
}

function renderWorkerPreview(show = true) {
  const card = $("#workerPreviewCard");
  const body = $("#workerPreviewBody");
  if (!card || !body) return;

  const d = getPersonPreviewData();
  const hasAnyFormValue = ["personFirst", "personLast", "personFunction", "personCode"].some(id => ($("#" + id)?.value || "").trim());
  const hasSelection = d.selectedKeys.length > 0 || d.materialNames.length > 0;

  if (!show || (!hasAnyFormValue && !hasSelection)) {
    card.classList.add("hidden");
    body.innerHTML = "";
    return;
  }

  const selected = WORKER_PREVIEW_SECTIONS.filter(s => d.selectedKeys.includes(s.key));
  const sectionHtml = selected.length ? selected.map(section => `
    <div class="worker-preview-section">
      <strong>${escapeHtml(section.title)}</strong>
      <ul>${section.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </div>
  `).join("") : `<p class="muted">Još nije štiklirana nijedna rubrika. Kad štikliraš rubriku levo, ovde se odmah vidi šta radnik dobija.</p>`;

  const materialsHtml = d.materialNames.length ? `
    <div class="worker-preview-section">
      <strong>Dozvoljeni materijali</strong>
      <ul>${d.materialNames.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
    </div>
  ` : "";

  body.innerHTML = `
    <div class="phone-preview-shell">
      <div class="phone-preview-topbar">Terenski unos</div>
      <div class="phone-preview-card">
        <h4>Dobrodošli, ${escapeHtml((d.first + " " + d.last).trim())}</h4>
        <p>${escapeHtml(currentCompany?.name || "Firma")} · ${escapeHtml(d.role)}</p>
        <small>Šifra radnika: ${escapeHtml(d.code)}</small>
      </div>
      <div class="phone-preview-card">
        <h4>Rubrike koje će radnik videti</h4>
        ${sectionHtml}
        ${materialsHtml}
      </div>
    </div>
  `;
  card.classList.remove("hidden");
}

function hideWorkerPreview() {
  renderWorkerPreview(false);
}

function bindPersonPreviewEvents() {
  ["personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", () => renderWorkerPreview(true));
  });
  document.addEventListener("change", (e) => {
    if (e.target?.classList?.contains("perm") || e.target?.classList?.contains("material-perm")) {
      renderWorkerPreview(true);
    }
  });
  const hideBtn = $("#hideWorkerPreviewBtn");
  if (hideBtn) hideBtn.addEventListener("click", hideWorkerPreview);
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
    renderWorkerPreview(true);
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
  ["assetCode", "assetName", "assetReg", "assetCapacity"].forEach(id => {
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
    document.querySelector("#assetCode").value = asset.asset_code || asset.internal_code || asset.code || "";
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
    const assetCode = document.querySelector("#assetCode")?.value.trim() || "";
    const name = document.querySelector("#assetName").value.trim();
    const assetType = document.querySelector("#assetType").value;
    const registration = document.querySelector("#assetReg").value.trim();
    const capacity = document.querySelector("#assetCapacity").value.trim();

    if (!name) throw new Error("Upiši naziv mašine/vozila.");

    const payload = {
      company_id: currentCompany.id,
      asset_code: assetCode,
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
        <strong>${escapeHtml(formatAssetTitleWithCode(a))}</strong>
        <small>${escapeHtml(a.asset_type)} · ${escapeHtml(a.registration || "")} · ${escapeHtml(formatCapacityM3(a.capacity))}</small>
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
      sb.from("reports").select("id, company_id, user_id, site_id, report_date, status, returned_reason, data, submitted_at, created_at, archived, deleted_at").eq("company_id", currentCompany.id).neq("status", "archived").order("created_at", { ascending:false }).limit(150)
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
      const text = `${a.asset_code || ""} ${a.internal_code || ""} ${a.code || ""} ${a.name} ${a.asset_type} ${a.registration || ""} ${a.capacity || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Mašina / vozilo",
        title:formatAssetTitleWithCode(a),
        subtitle:`broj: ${getAssetCode(a) || "—"} · ${a.asset_type} · ${a.registration || ""} · ${formatCapacityM3(a.capacity)}`,
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

    if (reportsRes.data) reportsRes.data = await enrichReportsWithUsers(reportsRes.data);
    if (reportsRes.data) reportsRes.data.forEach(r => {
      const d = r.data || {};
      const person = r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : (d.created_by_worker || d.worker_name || "");
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
  // v1.18.5: Direkcija ne sme da izgubi prikaz izveštaja zato što filter
  // ne prepoznaje novu rubriku. Sve što nije poseban kvar i nije arhivirano
  // mora ostati vidljivo u Dnevnim izveštajima.
  const d = r?.data || {};
  if (!d || typeof d !== "object") return true;

  const arraysToCheck = [
    d.workers, d.worker_entries, d.machines, d.vehicles,
    d.lowloader_moves, d.lowloader_entries,
    d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries,
    d.material_entries, d.material_movements
  ];
  const hasAnyArrayData = arraysToCheck.some(arr =>
    Array.isArray(arr) && arr.some(item => item && Object.values(item).some(Boolean))
  );

  const leave = d.leave_request || {};
  const hasLeave = !!(
    d.leave_type || d.leave_label || d.leave_date || d.leave_from || d.leave_to || d.leave_note ||
    leave.type || leave.label || leave.date || leave.date_from || leave.date_to || leave.note
  );

  const hasKnownField = !!(
    d.site_name || d.description || d.hours || d.note ||
    d.material || d.quantity || d.unit || d.warehouse_type || d.warehouse_item || d.warehouse_qty ||
    d.machine || d.vehicle || d.fuel_liters || d.tours || d.route ||
    hasLeave || hasAnyArrayData
  );

  // Ako ne prepoznamo strukturu, ipak prikaži izveštaj. Bolje je da Direkcija
  // vidi višak nego da joj nestane poslat izveštaj.
  return true || hasKnownField;
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


function reportUserFallback(r) {
  const d = r?.data || {};
  return {
    first_name: d.first_name || d.worker_first_name || d.created_by_first_name || (d.created_by_worker || d.worker_name || "").split(" ")[0] || "",
    last_name: d.last_name || d.worker_last_name || d.created_by_last_name || (d.created_by_worker || d.worker_name || "").split(" ").slice(1).join(" ") || "",
    function_title: d.function_title || d.worker_function || d.role || ""
  };
}

async function enrichReportsWithUsers(reports = []) {
  const list = Array.isArray(reports) ? reports : [];
  const ids = [...new Set(list.map(r => r && r.user_id).filter(Boolean))];
  if (!ids.length) {
    return list.map(r => ({ ...r, company_users: r.company_users || reportUserFallback(r) }));
  }

  try {
    const { data: users, error } = await sb
      .from("company_users")
      .select("id, first_name, last_name, function_title")
      .in("id", ids);

    if (error) throw error;
    const map = new Map((users || []).map(u => [u.id, u]));
    return list.map(r => ({ ...r, company_users: map.get(r.user_id) || r.company_users || reportUserFallback(r) }));
  } catch (e) {
    console.warn("Ne mogu da povežem reports sa company_users, koristim data fallback:", e);
    return list.map(r => ({ ...r, company_users: r.company_users || reportUserFallback(r) }));
  }
}

async function loadReports() {
  if (!currentCompany) return;

  // v1.18.8: ne koristimo Supabase embed reports -> company_users.
  // Baza ima duple FK veze, zato prvo čitamo reports, pa korisnike posebno kroz enrichReportsWithUsers().
  const { data, error } = await sb
    .from("reports")
    .select("id, company_id, user_id, site_id, report_date, status, data, returned_reason, submitted_at, approved_at, exported_at, created_at, archived, deleted_at, exported")
    .eq("company_id", currentCompany.id)
    .neq("status", "archived")
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  directorReportsCache = await enrichReportsWithUsers(data || []);
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
  const assetName = [d.defect_asset_code, d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || (Array.isArray(d.machines) && d.machines[0]?.name) || (Array.isArray(d.vehicles) && d.vehicles[0]?.name)].filter(Boolean).join(" · ") || "—";

  return `
    <div class="item report-item defect-item">
      <strong>🚨 KVAR · ${escapeHtml(d.defect_urgency || "prijavljen")}</strong>
      <small>${escapeHtml(person)} · ${escapeHtml(r.company_users?.function_title || d.function_title || "")} · ${escapeHtml(r.report_date || "")}</small><br/>
      <span class="pill">Prijavljeno: ${escapeHtml(formatDateTimeLocal(reportedAt))}</span>
      <span class="pill">Status: ${escapeHtml(status)}</span>
      <span class="pill">Gradilište/lokacija: ${escapeHtml(d.defect_site_name || d.site_name || "bez gradilišta")}</span>
      <span class="pill">Mašina/vozilo: ${escapeHtml(assetName)}</span>
      ${d.defect_work_impact ? `<span class="pill">Uticaj na rad: ${escapeHtml(d.defect_work_impact === "zaustavlja_rad" ? "Zaustavlja rad" : d.defect_work_impact === "moze_nastaviti" ? "Može nastaviti rad" : d.defect_work_impact)}</span>` : ""}
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

  // v1.18.9 — sigurnosna normalizacija materijala
  // Stari izveštaji mogu imati material_entries kao niz, objekat, tekst, boolean ili null.
  // .some() i .map() smeju da rade samo nad nizom.
  const normalizeReportArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  };
  const materialEntries =
    normalizeReportArray(d.material_entries).length ? normalizeReportArray(d.material_entries) :
    normalizeReportArray(d.material_movements).length ? normalizeReportArray(d.material_movements) :
    Array.isArray(d.materials) ? d.materials :
    [];

  const reportRows = [];
  const leaveRequest = d.leave_request || {};
  const previewLeaveRequest = leaveRequest;
  const previewHasLeave = !!(safe(d.leave_request_type) || safe(d.leave_type) || safe(d.leave_date) || safe(d.leave_from) || safe(d.leave_to) || safe(d.leave_note) || Object.values(previewLeaveRequest).some(v => v !== undefined && v !== null && String(v).trim() !== ""));
  const previewHasWarehouse = !!(safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty));

  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, fuels.length, fieldTankers.length, materialEntries.length, previewHasLeave ? 1 : 0, previewHasWarehouse ? 1 : 0)
  for (let i = 0; i < maxRows; i++) {
    const w = workers[i] || {};
    const m = machines[i] || {};
    const v = vehicles[i] || {};
    const ll = lowloaders[i] || {};
    const f = fuels[i] || {};
    const ft = fieldTankers[i] || {};
    const mat = materialEntries[i] || {};
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
        <td>${val(ll.from_site || ll.from_address)}</td>
        <td>${val(ll.to_site || ll.to_address)}</td>
        <td>${val(ll.km_start)}</td>
        <td>${val(ll.km_end)}</td>
        <td>${val(ll.km_total)}</td>
        <td>${val(ll.machine)}</td>
        <td>${val(f.asset_name || f.machine || f.vehicle || f.other)}</td>
        <td>${val(f.liters)}</td>
        <td>${val(f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""))}</td>
        <td>${val(f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""))}</td>
        <td>${val(f.by)}</td>
        <td>${val(f.receiver || d.fuel_receiver)}</td>
        <td>${val(ft.site_name)}</td>
        <td>${val(ft.asset_name || ft.machine)}</td>
        <td>${val(ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""))}</td>
        <td>${val(ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""))}</td>
        <td>${val(ft.liters)}</td>
        <td>${val(ft.receiver || ft.received_by)}</td>
        <td>${val(mat.action || mat.material_action)}</td>
        <td>${val(mat.material || mat.name || d.material)}</td>
        <td>${val(mat.quantity || mat.qty || d.quantity)}</td>
        <td>${val(mat.unit || d.unit)}</td>
        <td>${val(mat.note || d.material_note)}</td>
        <td>${val(d.leave_request_type || leaveRequest.leave_label || leaveRequest.label)}</td>
        <td>${val(d.leave_date || leaveRequest.leave_date || leaveRequest.date)}</td>
        <td>${val(d.leave_from || leaveRequest.date_from)}</td>
        <td>${val(d.leave_to || leaveRequest.date_to)}</td>
        <td>${val(d.leave_note || leaveRequest.leave_note || leaveRequest.note)}</td>
        <td>${val(d.warehouse_type)}</td>
        <td>${val(d.warehouse_item)}</td>
        <td>${val(d.warehouse_qty)}</td>
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
            <th>Gradilište preuzimanja</th>
            <th>Gradilište odvoza</th>
            <th>Početna km labudice</th>
            <th>Završna km labudice</th>
            <th>Ukupno km</th>
            <th>Mašina koja se seli</th>
            <th>Gorivo za</th>
            <th>Litara</th>
            <th>Gorivo KM</th>
            <th>Gorivo MTČ</th>
            <th>Sipao</th>
            <th>Primio</th>
            <th>Cisterna gradilište</th>
            <th>Cisterna mašina/vozilo</th>
            <th>Cisterna KM</th>
            <th>Cisterna MTČ</th>
            <th>Cisterna litara</th>
            <th>Gorivo primio</th>
            <th>Radnja materijala</th>
            <th>Materijal</th>
            <th>Količina</th>
            <th>Jedinica</th>
            <th>Napomena materijala</th>
            <th>Vrsta odsustva</th>
            <th>Datum slobodnog dana</th>
            <th>Godišnji od</th>
            <th>Godišnji do</th>
            <th>Napomena odsustva</th>
            <th>Magacin tip</th>
            <th>Magacin stavka</th>
            <th>Magacin količina</th>
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
          <th>Broj</th>
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
            <td>${val(m.asset_code || m.machine_code)}</td>
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
          <th>Broj</th>
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
            <td>${val(v.asset_code || v.vehicle_code)}</td>
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
          <th>Gradilište preuzimanja</th>
          <th>Gradilište odvoza</th>
          <th>Početna km</th>
          <th>Završna km</th>
          <th>Ukupno km</th>
          <th>Mašina koja se seli</th>
        </tr>
      </thead>
      <tbody>
        ${lowloaders.map((ll, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ll.plates || ll.registration)}</td>
            <td>${val(ll.from_site || ll.from_address)}</td>
            <td>${val(ll.to_site || ll.to_address)}</td>
            <td>${val(ll.km_start)}</td>
            <td>${val(ll.km_end)}</td>
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
          <th>Tip</th>
          <th>Broj</th>
          <th>Mašina/vozilo</th>
          <th>Litara</th>
          <th>KM pri sipanju</th>
          <th>MTČ pri sipanju</th>
          <th>Sipao</th>
          <th>Primio</th>
        </tr>
      </thead>
      <tbody>
        ${fuels.map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(assetKindLabel(f.asset_kind))}</td>
            <td>${val(f.asset_code)}</td>
            <td>${val(f.asset_name || f.machine || f.vehicle || f.other)}</td>
            <td>${val(f.liters)}</td>
            <td>${val(f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""))}</td>
            <td>${val(f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""))}</td>
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
          <th>Tip</th>
          <th>Broj</th>
          <th>Mašina/vozilo</th>
          <th>Trenutna kilometraža / KM</th>
          <th>Trenutni MTČ</th>
          <th>Sipano litara</th>
          <th>Gorivo primio</th>
        </tr>
      </thead>
      <tbody>
        ${fieldTankers.map((ft, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ft.site_name)}</td>
            <td>${val(assetKindLabel(ft.asset_kind))}</td>
            <td>${val(ft.asset_code)}</td>
            <td>${val(ft.asset_name || ft.machine || ft.vehicle || ft.other)}</td>
            <td>${val(ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""))}</td>
            <td>${val(ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""))}</td>
            <td>${val(ft.liters)}</td>
            <td>${val(ft.receiver || ft.received_by)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema terenskih sipanja cisternom.</p>`;

  const materialTable = materialEntries.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Radnja</th>
          <th>Materijal</th>
          <th>Količina</th>
          <th>Jedinica</th>
          <th>Napomena</th>
        </tr>
      </thead>
      <tbody>
        ${materialEntries.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(m.action || m.material_action)}</td>
            <td>${val(m.material || m.name)}</td>
            <td>${val(m.quantity || m.qty)}</td>
            <td>${val(m.unit)}</td>
            <td>${val(m.note)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : ``;



  const hasWarehouse = safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);
  const warehouseBox = hasWarehouse ? `<div class="report-kv report-sub-kv">
    ${rows([
      ["Magacin tip", d.warehouse_type],
      ["Magacin stavka", d.warehouse_item],
      ["Magacin količina", d.warehouse_qty]
    ])}
  </div>` : "";

  const showDefectSection = options.showDefect === true;
  const hasDefect = showDefectSection && (safe(d.defect) || safe(d.defect_exists) === "da" || safe(d.defect_urgency) || safe(d.defect_status));
  const hasMaterialEntries = materialEntries.some(entry => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== ""));
  const hasMaterial = hasMaterialEntries || safe(d.material) || safe(d.quantity) || safe(d.unit) || safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);
  const hasLeaveRequest = safe(d.leave_request_type) || safe(d.leave_type) || safe(d.leave_date) || safe(d.leave_from) || safe(d.leave_to) || safe(d.leave_note) || (leaveRequest && Object.values(leaveRequest).some(v => v !== undefined && v !== null && String(v).trim() !== ""));

  const hasUsefulEntry = (entry) => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== "");
  const hasWorkers = workers.some(hasUsefulEntry);
  const hasMachines = machines.some(hasUsefulEntry);
  const hasVehicles = vehicles.some(hasUsefulEntry);
  const hasLowloaders = lowloaders.some(hasUsefulEntry);
  const hasFuels = fuels.some(hasUsefulEntry);
  const hasFieldTankers = fieldTankers.some(hasUsefulEntry);
  const hasBasic = safe(d.site_name) || safe(d.description) || safe(d.hours) || safe(d.note);

  return `
    <div class="report-readable">
      ${hasBasic ? `<div class="report-section report-main-summary">
        <h4>Osnovno</h4>
        <div class="report-kv">
          ${rows([
            ["Gradilište", d.site_name],
            ["Opis rada", d.description],
            ["Sati rada", d.hours],
            ["Napomena", d.note]
          ])}
        </div>
      </div>` : ""}

      ${hasWorkers ? `<div class="report-section">
        <h4>Radnici / sati po radniku</h4>
        ${workerTable}
      </div>` : ""}

      ${hasMachines ? `<div class="report-section">
        <h4>Mašine</h4>
        ${machineTable}
      </div>` : ""}

      ${hasVehicles ? `<div class="report-section">
        <h4>Vozila / ture / m³</h4>
        ${vehicleTable}
      </div>` : ""}

      ${hasLowloaders ? `<div class="report-section">
        <h4>Vozilo labudica / selidba mašine</h4>
        ${lowloaderTable}
      </div>` : ""}

      ${hasFuels ? `<div class="report-section">
        <h4>Gorivo</h4>
        ${fuelTable}
      </div>` : ""}

      ${hasFieldTankers ? `<div class="report-section">
        <h4>Cisterna / tankanje goriva na terenu</h4>
        ${fieldTankerTable}
      </div>` : ""}

      ${hasDefect ? `
        <div class="report-section">
          <h4>Kvar</h4>
          <div class="report-kv">
            ${rows([
              ["Broj sredstva", d.defect_asset_code],
              ["Mašina/vozilo/oprema u kvaru", d.defect_asset_name || d.defect_machine || d.machine || d.vehicle],
              ["Registracija", d.defect_asset_registration],
              ["Gradilište/lokacija sredstva", d.defect_site_name || d.site_name],
              ["Opis kvara", d.defect],
              ["Hitnost", d.defect_urgency],
              ["Uticaj na rad", d.defect_work_impact === "zaustavlja_rad" ? "Zaustavlja rad" : d.defect_work_impact === "moze_nastaviti" ? "Može nastaviti rad" : d.defect_work_impact],
              ["Šef mehanizacije pozvan", d.called_mechanic_by_phone],
              ["Status kvara", d.defect_status]
            ])}
          </div>
        </div>` : ""}

      ${hasLeaveRequest ? `
        <div class="report-section">
          <h4>Zahtev za slobodan dan / godišnji odmor</h4>
          <div class="report-kv">
            ${rows([
              ["Vrsta zahteva", d.leave_request_type || leaveRequest.leave_label || leaveRequest.label],
              ["Datum", d.leave_date || leaveRequest.leave_date || leaveRequest.date],
              ["Od", d.leave_from || leaveRequest.date_from],
              ["Do", d.leave_to || leaveRequest.date_to],
              ["Napomena", d.leave_note || leaveRequest.leave_note || leaveRequest.note]
            ])}
          </div>
        </div>` : ""}

      ${hasMaterial ? `
        <div class="report-section">
          <h4>Materijal / magacin</h4>
          ${hasMaterialEntries ? materialTable + warehouseBox : `<div class="report-kv">
            ${rows([
              ["Materijal", d.material],
              ["Količina", d.quantity],
              ["Jedinica", d.unit],
              ["Magacin tip", d.warehouse_type],
              ["Magacin stavka", d.warehouse_item],
              ["Magacin količina", d.warehouse_qty]
            ])}
          </div>`}
        </div>` : ""}

      <details class="report-section report-excel-section report-excel-details">
        <summary>📊 Prikaži Excel pregled izveštaja</summary>
        <p class="field-hint">Ovo je samo širok Excel prikaz. Za čitanje koristi pregled iznad, a za firmu koristi export u Excel.</p>
        ${excelTable}
      </details>
    </div>
  `;
}

function reportHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : (d.created_by_worker || d.worker_name || "Nepoznat korisnik");

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
  renderWorkerPreview(true);
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
  return String(type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/š/g, "s")
    .replace(/đ/g, "dj")
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/ž/g, "z");
}

function getAssetName(asset) {
  return String(
    asset?.name ||
    asset?.asset_name ||
    asset?.assetName ||
    asset?.title ||
    asset?.label ||
    asset?.registration ||
    asset?.plate ||
    asset?.reg_no ||
    ""
  ).trim();
}

function getAssetCode(asset) {
  return String(
    asset?.asset_code ||
    asset?.internal_code ||
    asset?.code ||
    asset?.asset_number ||
    asset?.number ||
    asset?.inventory_number ||
    ""
  ).trim();
}

function formatAssetTitleWithCode(asset) {
  const code = getAssetCode(asset);
  const name = getAssetName(asset) || asset?.name || "Sredstvo";
  return code ? `${code} · ${name}` : name;
}

function getAssetType(asset) {
  // v1.19.7: worker_list_assets u nekim bazama vraća drugačije ime kolone
  // ili ne vrati asset_type za sva sredstva. Zato čitamo više mogućih naziva.
  return normalizeAssetType(
    asset?.asset_type ||
    asset?.type ||
    asset?.assetType ||
    asset?.asset_kind ||
    asset?.kind ||
    asset?.category ||
    asset?.asset_category ||
    asset?.group ||
    ""
  );
}

function getAssetRegistration(asset) {
  return String(asset?.registration || asset?.plate || asset?.plates || asset?.reg_no || asset?.oznaka || "").trim();
}

function inferAssetTypeFromText(asset) {
  const text = normalizeAssetType([
    getAssetName(asset),
    getAssetRegistration(asset),
    asset?.description,
    asset?.note,
    asset?.capacity ? "capacity" : ""
  ].filter(Boolean).join(" "));

  if (/\b(kamion|kiper|vozilo|cisterna|labudica|sleper|prikolica|kombi|auto|man|scania|mercedes|iveco|volvo|daf)\b/.test(text)) return "vehicle";
  if (/\b(agregat|vibro|vibroploca|vibro ploca|ploca|pumpa|kompresor|oprema|alat)\b/.test(text)) return "other";
  if (/\b(bager|dozer|buldozer|valjak|grader|utovarivac|finiser|masina|cat|komatsu|jcb|liebherr|volvo)\b/.test(text)) return "machine";
  return "";
}

function isVehicleAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  return ["vehicle", "vozilo", "vehicles", "vozila", "truck", "kamion", "kiper", "cisterna", "lowloader", "labudica", "sleper", "prikolica", "auto", "kombinovano vozilo"].includes(t);
}

function isOtherAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  return ["other", "ostalo", "alat", "tool", "tools", "oprema", "equipment", "agregat", "vibro", "vibro ploca", "vibroploca", "ploca", "pumpa", "kompresor"].includes(t);
}

function assetKindLabel(kind) {
  if (kind === "vehicle") return "Vozilo";
  if (kind === "other") return "Ostalo";
  return "Mašina";
}

function defectImpactLabel(value) {
  if (value === "zaustavlja_rad") return "Zaustavlja rad";
  if (value === "moze_nastaviti") return "Može nastaviti rad do popravke";
  return value || "";
}

function formatAssetLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Vozilo"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  if (asset?.capacity) parts.push(asset.capacity);
  return parts.filter(Boolean).join(" · ");
}

function isMachineAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  if (isVehicleAsset(asset) || isOtherAsset(asset)) return false;
  // Ako tip nije upisan, tretiramo kao mašinu da se stari podaci ne izgube,
  // ali vozila/oprema se sada prvo pokušavaju prepoznati po nazivu i drugim poljima.
  if (!t) return true;
  return ["machine", "machines", "machinery", "masina", "masine", "bager", "dozer", "buldozer", "bulldozer", "valjak", "grader", "utovarivac", "finiser", "cat", "komatsu", "jcb", "liebherr"].includes(t);
}

function formatMachineLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Mašina"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  return parts.filter(Boolean).join(" · ");
}

function formatOtherAssetLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Ostalo"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  return parts.filter(Boolean).join(" · ");
}

function filterAssetsByFuelKind(asset, kind) {
  if (kind === "vehicle") return isVehicleAsset(asset);
  if (kind === "other") return isOtherAsset(asset);
  return isMachineAsset(asset);
}

function fuelKindEmptyText(kind) {
  if (kind === "vehicle") return "Nema vozila iz Direkcije";
  if (kind === "other") return "Nema opreme / ostalog iz Direkcije";
  return "Nema mašina iz Direkcije";
}

function fuelKindChooseText(kind) {
  if (kind === "vehicle") return "Odaberi vozilo";
  if (kind === "other") return "Odaberi ostalo / opremu";
  return "Odaberi mašinu";
}

function formatFuelKindAssetLabel(asset, kind) {
  if (kind === "vehicle") return formatAssetLabel(asset);
  if (kind === "other") return formatOtherAssetLabel(asset);
  return formatMachineLabel(asset);
}

function machineMatchesSearch(asset, searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return true;
  const haystack = normalizeVehicleSearch([
    getAssetCode(asset),
    asset?.name,
    asset?.registration,
    asset?.capacity,
    asset?.type || asset?.asset_type
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

function autoSelectExactAssetCode(selectEl, searchValue) {
  if (!selectEl) return;
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return;
  const options = Array.from(selectEl.options || []).filter(o => o.value);
  const exact = options.find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === q);
  if (exact) {
    selectEl.value = exact.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function getCanonicalAssetKind(asset) {
  if (isVehicleAsset(asset)) return "vehicle";
  if (isOtherAsset(asset)) return "other";
  return "machine";
}

function findAssetByExactCode(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  return (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q) || null;
}

function findAssetsByUniversalSearch(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return [];
  return (workerAssetOptions || []).filter(asset => machineMatchesSearch(asset, searchValue));
}

function assetOptionHtml(asset, selectedValue = "", labelFormatter = formatMachineLabel) {
  const name = getAssetName(asset) || getAssetRegistration(asset) || "Sredstvo";
  const reg = getAssetRegistration(asset);
  const label = labelFormatter(asset) || formatAssetTitleWithCode(asset) || name;
  const type = asset.asset_type || asset.type || getCanonicalAssetKind(asset);
  const selected = String(selectedValue || "").trim();
  const isSelected = selected && (
    selected === name ||
    selected === getAssetCode(asset) ||
    selected === reg ||
    selected === String(asset.id || "")
  ) ? "selected" : "";
  return `<option value="${escapeHtml(name)}" data-asset-id="${escapeHtml(asset.id || "")}" data-asset-code="${escapeHtml(getAssetCode(asset) || "")}" data-registration="${escapeHtml(reg || "")}" data-capacity="${escapeHtml(asset.capacity || "")}" data-asset-type="${escapeHtml(type)}" ${isSelected}>${escapeHtml(label)}</option>`;
}

function getMachineAssetsFromDirection() {
  return workerAssetOptions
    .filter(isMachineAsset)
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
}

function buildMachineOptionsHtml(selectedValue = "", searchValue = "") {
  const allMachines = getMachineAssetsFromDirection();
  let machines = allMachines.filter(m => machineMatchesSearch(m, searchValue));
  const selected = String(selectedValue || "").trim();
  const q = normalizeVehicleSearch(searchValue);

  // v1.20.0: Interni broj ima prednost i kod rubrike "Rad sa mašinom".
  // Ranije je ovde stajao uslov getCanonicalAssetKind(exact) === "machine".
  // Ako RPC/Supabase vrati tip malo drugačije, mašina postoji ali se ne prikaže.
  // Sada, ako je broj tačan, prikaži sredstvo odmah, pa tek za običnu pretragu koristi filter tipa.
  const exact = findAssetByExactCode(searchValue);
  if (exact && !machines.some(m => String(m.id || "") === String(exact.id || ""))) {
    machines = [exact, ...machines];
  }
  if (q && !machines.length) {
    machines = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Direkcije</option>`;
  }
  if (!machines.length) {
    return q ? `<option value="">Nema mašine za taj broj/pretragu</option>` : `<option value="">Nema mašina iz Direkcije</option>`;
  }

  return `<option value="">Odaberi mašinu</option>` + machines.map(m => assetOptionHtml(m, selected, formatMachineLabel)).join("");
}

function findMachineAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const machines = getMachineAssetsFromDirection();
  const exactCode = (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactCode) return exactCode;
  const exactMachineCode = machines.find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactMachineCode) return exactMachineCode;
  const exactName = machines.find(asset => {
    const name = normalizeVehicleSearch(getAssetName(asset));
    const label = normalizeVehicleSearch(formatMachineLabel(asset));
    return name === q || label === q;
  });
  if (exactName) return exactName;
  const matches = machines.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateMachineSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".m-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result m-picked ok";
    result.textContent = `Pronađena mašina: ${formatMachineLabel(asset)}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result m-picked warn";
    result.textContent = `Nije pronađeno u Direkciji. Biće poslato kao ručni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result m-picked";
  result.textContent = "Upiši broj mašine iz Direkcije ili naziv ako nije na listi.";
}

function refreshOneMachineSelect(entryEl) {
  const sel = entryEl.querySelector(".m-name");
  if (!sel) return;
  const search = entryEl.querySelector(".m-search")?.value || "";
  const custom = entryEl.querySelector(".m-custom");
  const exact = findMachineAssetForSmartInput(search);
  sel.innerHTML = buildMachineOptionsHtml(exact ? getAssetName(exact) : "", search);
  if (exact) {
    const assetId = String(exact.id || "");
    const option = Array.from(sel.options || []).find(o => String(o.dataset.assetId || "") === assetId)
      || Array.from(sel.options || []).find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === normalizeVehicleSearch(getAssetCode(exact)))
      || Array.from(sel.options || []).find(o => o.value === getAssetName(exact));
    if (option) sel.value = option.value;
    if (custom) custom.value = "";
    updateMachineSmartResult(entryEl, exact, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateMachineSmartResult(entryEl, null, search);
  }
  refreshFuelMachineOptions();
}

function buildLowloaderMachineDatalistOptionsHtml() {
  const machines = getMachineAssetsFromDirection();
  return machines.map(m => {
    const label = formatMachineLabel(m);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join("");
}

function buildLowloaderSiteDatalistOptionsHtml() {
  return (Array.isArray(workerSiteOptions) ? workerSiteOptions : []).map(site => {
    const name = site.name || site.site_name || site.title || "";
    const loc = site.location ? ` · ${site.location}` : "";
    const label = String(name + loc).trim();
    return label ? `<option value="${escapeHtml(label)}"></option>` : "";
  }).join("");
}

function parseLowloaderDecimalInput(value) {
  const n = Number(String(value || "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function formatLowloaderDecimalForInput(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function updateLowloaderKmTotal(entryEl) {
  if (!entryEl) return;
  const start = parseLowloaderDecimalInput(entryEl.querySelector(".ll-km-start")?.value);
  const end = parseLowloaderDecimalInput(entryEl.querySelector(".ll-km-end")?.value);
  const totalEl = entryEl.querySelector(".ll-km");
  if (!totalEl) return;
  if (start === null || end === null || end < start) {
    totalEl.value = "";
    return;
  }
  totalEl.value = formatLowloaderDecimalForInput(end - start);
}

function refreshOneLowloaderMachineSelect(entryEl) {
  const machineList = entryEl.querySelector(".ll-machine-list");
  if (machineList) machineList.innerHTML = buildLowloaderMachineDatalistOptionsHtml();
  entryEl.querySelectorAll(".ll-site-list").forEach(list => {
    list.innerHTML = buildLowloaderSiteDatalistOptionsHtml();
  });
}

function refreshLowloaderMachineSelectors() {
  $$("#lowloaderEntries .lowloader-entry").forEach(entry => refreshOneLowloaderMachineSelect(entry));
}

function refreshMachineDatalists() {
  $$("#machineEntries .machine-entry").forEach(entry => refreshOneMachineSelect(entry));
  refreshLowloaderMachineSelectors();
}

function normalizeWorkerAssetRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(a => {
    const rawType = a.asset_type || a.type || a.assetType || a.asset_kind || a.kind || a.category || a.asset_category || a.group || "";
    const normalized = {
      ...a,
      name: getAssetName(a),
      asset_code: getAssetCode(a),
      registration: getAssetRegistration(a),
      asset_type: rawType,
      type: a.type || rawType
    };
    // Ako RPC ne vrati tip, pokušaj da ga popuniš po nazivu/registraciji.
    if (!normalized.asset_type) normalized.asset_type = inferAssetTypeFromText(normalized);
    if (!normalized.type) normalized.type = normalized.asset_type;
    return normalized;
  }).filter(a => a.name || a.registration || a.asset_code);
}

function mergeAssetRows(primary = [], fallback = []) {
  const map = new Map();
  [...primary, ...fallback].forEach(a => {
    const key = String(a.id || `${getAssetCode(a) || ""}|${a.name || ""}|${a.registration || ""}|${a.asset_type || a.type || ""}`);
    if (!map.has(key)) map.set(key, a);
  });
  return Array.from(map.values());
}

async function loadWorkerAssets() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  workerAssetOptions = [];

  if (!worker) return;

  let rpcRows = [];
  let directRows = [];
  let rpcError = null;
  let directError = null;

  // Prvi izvor: RPC. Ovo je pravilan put za radnika.
  try {
    const { data, error } = await sb.rpc("worker_list_assets", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code
    });
    if (error) throw error;
    rpcRows = normalizeWorkerAssetRows(data);
  } catch (e) {
    rpcError = e;
  }

  // Drugi izvor: direktno iz assets po company_id.
  // VAŽNO v1.19.7: ovo se sada pokušava UVEK kada radnik ima company_id,
  // ne samo kada RPC vrati prazno. Tako radnik vidi mašine i ako je RPC star
  // i ne vraća sva polja/tipove, a ne diramo Supabase SQL.
  if (worker.company_id) {
    try {
      const { data, error } = await sb
        .from("assets")
        .select("*")
        .eq("company_id", worker.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      directRows = normalizeWorkerAssetRows(data);
    } catch (e) {
      directError = e;
    }
  }

  workerAssetOptions = mergeAssetRows(directRows, rpcRows);

  refreshVehicleSelects();
  refreshMachineDatalists();
  refreshFieldTankerSelectors();
  refreshFuelMachineOptions();

  const machineCount = workerAssetOptions.filter(isMachineAsset).length;
  const vehicleCount = workerAssetOptions.filter(isVehicleAsset).length;
  const otherCount = workerAssetOptions.filter(isOtherAsset).length;

  if (!workerAssetOptions.length) {
    toast("Radniku nisu učitane mašine/vozila. Proveri da li u Direkciji postoje sredstva za ovu firmu i da li je radnik u istoj firmi. Detalj: " + ((directError && directError.message) || (rpcError && rpcError.message) || "nema podataka"), true);
  } else if (!machineCount && (vehicleCount || otherCount)) {
    toast(`Sredstva su učitana, ali nema tipa Mašina. U Direkciji proveri Tip: Mašina. Učitano: vozila ${vehicleCount}, ostalo ${otherCount}.`, true);
  } else if (machineCount && !vehicleCount && !otherCount) {
    console.warn("Start Work PRO: učitane su samo mašine. Ako u Direkciji postoje vozila/ostalo, proveri Supabase RPC worker_list_assets da vraća sve asset_type vrednosti.", { workerAssetOptions, rpcError, directError });
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
    getAssetCode(asset),
    asset?.name,
    asset?.registration,
    asset?.capacity,
    asset?.type || asset?.asset_type
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

function buildVehicleOptionsHtml(selectedValue = "", searchValue = "") {
  const allVehicles = workerAssetOptions.filter(isVehicleAsset);
  let vehicles = allVehicles.filter(v => vehicleMatchesSearch(v, searchValue));
  const selected = String(selectedValue || "").trim();
  const q = normalizeVehicleSearch(searchValue);

  // v1.19.8: broj sredstva ne sme da blokira stari filter.
  // Ako radnik ukuca tačan interni broj, prvo prikaži to sredstvo makar je tip došao čudno iz RPC-a.
  const exact = findAssetByExactCode(searchValue);
  if (exact && !vehicles.some(v => String(v.id || "") === String(exact.id || ""))) {
    vehicles = [exact, ...vehicles];
  }
  if (q && !vehicles.length) {
    vehicles = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Direkcije</option>`;
  }
  if (!vehicles.length) {
    return q ? `<option value="">Nema sredstva za taj broj/pretragu</option>` : `<option value="">Nema vozila iz Direkcije</option>`;
  }

  return `<option value="">Odaberi vozilo</option>` + vehicles.map(v => assetOptionHtml(v, selected, formatAssetLabel)).join("");
}


function findVehicleAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const vehicles = (workerAssetOptions || []).filter(isVehicleAsset);

  // Interni broj ima prednost. Ako je broj tačan, uzmi sredstvo odmah.
  // Ovo čuva praktičan rad na terenu: radnik zna broj, ne treba da bira iz tri polja.
  const exactCode = (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactCode) return exactCode;

  const exactVehicleCode = vehicles.find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactVehicleCode) return exactVehicleCode;

  const exactName = vehicles.find(asset => {
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatAssetLabel(asset));
    return name === q || reg === q || label === q;
  });
  if (exactName) return exactName;

  const matches = vehicles.filter(asset => vehicleMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateVehicleSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".v-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result v-picked ok";
    result.textContent = `Pronađeno vozilo: ${formatAssetLabel(asset)}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result v-picked warn";
    result.textContent = `Nije pronađeno u Direkciji. Biće poslato kao ručni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result v-picked";
  result.textContent = "Upiši broj vozila, tablice ili naziv ako nije na listi.";
}

function refreshOneVehicleSelect(entryEl) {
  const sel = entryEl.querySelector(".v-name");
  if (!sel) return;
  const search = entryEl.querySelector(".v-search")?.value || "";
  const custom = entryEl.querySelector(".v-custom");
  const exact = findVehicleAssetForSmartInput(search);

  sel.innerHTML = buildVehicleOptionsHtml(exact ? getAssetName(exact) : "", search);

  if (exact) {
    const assetId = String(exact.id || "");
    const option = Array.from(sel.options || []).find(o => String(o.dataset.assetId || "") === assetId)
      || Array.from(sel.options || []).find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === normalizeVehicleSearch(getAssetCode(exact)))
      || Array.from(sel.options || []).find(o => o.value === getAssetName(exact));
    if (option) sel.value = option.value;
    if (custom) custom.value = "";
    updateVehicleSmartResult(entryEl, exact, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateVehicleSmartResult(entryEl, null, search);
  }
  refreshFuelMachineOptions();
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
    asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
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
  const initialSearch = values.asset_code || values.vehicle_code || values.code || values.custom || values.vehicle_custom || selectedName || values.registration || "";
  const div = document.createElement("div");
  div.className = "entry-card vehicle-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Vozilo ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Vozilo / interni broj</label>
    <input class="v-search asset-code-search smart-asset-input" placeholder="upiši broj, tablice ili naziv vozila, npr. 2 ili KAM-05" value="${escapeHtml(initialSearch)}" />
    <div class="asset-smart-result v-picked">Upiši broj vozila, tablice ili naziv ako nije na listi.</div>
    <button class="secondary small-btn refresh-vehicle-assets" type="button">Osveži vozila iz Direkcije</button>

    <select class="v-name hidden-asset-select" aria-hidden="true" tabindex="-1">${buildVehicleOptionsHtml(selectedName)}</select>
    <input class="v-custom hidden-asset-custom" aria-hidden="true" tabindex="-1" value="${escapeHtml(values.custom || values.vehicle_custom || "")}" />

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
  const refreshVehiclesBtn = div.querySelector(".refresh-vehicle-assets");
  if (refreshVehiclesBtn) refreshVehiclesBtn.addEventListener("click", async () => {
    try {
      refreshVehiclesBtn.disabled = true;
      refreshVehiclesBtn.textContent = "Učitavam...";
      await loadWorkerAssets();
      refreshOneVehicleSelect(div);
      updateVehicleCubic(div);
      toast(workerAssetOptions.length ? "Vozila iz Direkcije su osvežena." : "Nema učitanih vozila. Proveri firmu radnika i listu u Direkciji.", !workerAssetOptions.length);
    } finally {
      refreshVehiclesBtn.disabled = false;
      refreshVehiclesBtn.textContent = "Osveži vozila iz Direkcije";
    }
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneVehicleSelect(div);
  updateVehicleCubic(div);
  refreshFuelMachineOptions();
}

function getVehicleEntries() {
  return $$("#vehicleEntries .vehicle-entry").map((el, i) => {
    const selected = getSelectedVehicleFromEntry(el);
    const tours = el.querySelector(".v-tours")?.value || "";
    const autoCubic = calculateVehicleCubic(selected.capacity, tours);
    const manualCubic = "";
    const finalCubic = autoCubic;
    return {
      no: i + 1,
      asset_id: selected.asset_id,
      name: selected.name,
      vehicle: selected.name,
      asset_code: selected.asset_code,
      vehicle_code: selected.asset_code,
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
    workerSiteOptions = sites;
    if (!sites.length) {
      select.innerHTML = `<option value="">Nema aktivnih gradilišta</option>`;
      if (hint) hint.textContent = "Direkcija još nije dodala aktivno gradilište ili je SQL za worker_list_sites star.";
      refreshFieldTankerSelectors();
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
    refreshFieldTankerSelectors();

    if (hint) hint.textContent = "Odaberi aktivno gradilište koje je dodala Direkcija.";
  } catch (e) {
    select.innerHTML = `<option value="">Gradilišta nisu učitana</option>`;
    if (hint) hint.textContent = "Pokreni Supabase SQL za v1.12.1: worker_list_sites. Detalj: " + (e.message || e);
    workerSiteOptions = [];
    refreshFieldTankerSelectors();
    toast("Gradilišta za radnika nisu učitana: " + (e.message || e), true);
  }
}


function normalizeWorkerMaterialList(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map(m => {
      if (typeof m === "string") return { name: m, unit: "", category: "" };
      return {
        id: m?.id || "",
        name: m?.name || m?.material || m?.title || m?.label || "",
        unit: m?.unit || "",
        category: m?.category || ""
      };
    })
    .filter(m => {
      const key = String(m.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "sr"));
}

function buildWorkerMaterialOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const materials = normalizeWorkerMaterialList(workerMaterialOptions);

  if (!materials.length) {
    return `<option value="">Nema materijala iz Direkcije</option>`;
  }

  return `<option value="">Odaberi vrstu materijala</option>` + materials.map(m => {
    const labelParts = [m.name];
    if (m.unit) labelParts.push(m.unit);
    if (m.category) labelParts.push(m.category);
    const label = labelParts.filter(Boolean).join(" · ");
    const isSelected = selected && selected === m.name ? "selected" : "";
    return `<option value="${escapeHtml(m.name)}" data-material-id="${escapeHtml(m.id || "")}" data-unit="${escapeHtml(m.unit || "")}" ${isSelected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function refreshWorkerMaterialSelect(selectedValue = "") {
  const select = $("#wrMaterialSelect");
  if (!select) return;
  const old = selectedValue || select.value || "";
  select.innerHTML = buildWorkerMaterialOptionsHtml(old);
  if (old && Array.from(select.options).some(o => o.value === old)) select.value = old;
}

function getSelectedWorkerMaterial() {
  const manual = $("#wrMaterialManual")?.value?.trim() || "";
  const selected = $("#wrMaterialSelect")?.value?.trim() || "";
  return manual || selected;
}

async function loadWorkerMaterials(selectedValue = "") {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const permissionNames = worker?.permissions?.allowed_material_names || [];

  try {
    let materials = normalizeWorkerMaterialList(permissionNames);

    if (!materials.length && worker?.company_id && sb) {
      const { data, error } = await sb.rpc("director_list_materials", {
        p_company_id: worker.company_id
      });
      if (!error) materials = normalizeWorkerMaterialList(data || []);
    }

    if (!materials.length && worker?.company_id && sb) {
      const { data, error } = await sb
        .from("materials")
        .select("id,name,unit,category")
        .eq("company_id", worker.company_id)
        .order("name", { ascending: true });
      if (!error) materials = normalizeWorkerMaterialList(data || []);
    }

    workerMaterialOptions = materials;
  } catch (e) {
    workerMaterialOptions = normalizeWorkerMaterialList(permissionNames);
  }

  refreshWorkerMaterialSelect(selectedValue);
  refreshMaterialEntrySelectors();
}

function refreshOneMaterialEntrySelect(entryEl) {
  const sel = entryEl.querySelector(".mat-select");
  if (!sel) return;
  const old = sel.value || "";
  sel.innerHTML = buildWorkerMaterialOptionsHtml(old);
  if (old && Array.from(sel.options).some(o => o.value === old)) sel.value = old;
}

function refreshMaterialEntrySelectors() {
  $$("#materialEntries .material-entry").forEach(entryEl => refreshOneMaterialEntrySelect(entryEl));
}


function buildMaterialUnitOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const units = [
    { value: "", label: "Odaberi meru" },
    { value: "t", label: "t — tona" },
    { value: "m³", label: "m³ — kubik" },
    { value: "kg", label: "kg" },
    { value: "m", label: "m — metar" },
    { value: "m²", label: "m² — kvadrat" },
    { value: "kom", label: "kom — komad" },
    { value: "paleta", label: "paleta" },
    { value: "kamion", label: "kamion" },
    { value: "tura", label: "tura" },
    { value: "ručno", label: "ručno / druga mera" }
  ];
  return units.map(u => `<option value="${escapeHtml(u.value)}" ${selected === u.value ? "selected" : ""}>${escapeHtml(u.label)}</option>`).join("");
}

function updateMaterialUnitManualVisibility(entryEl) {
  if (!entryEl) return;
  const sel = entryEl.querySelector(".mat-unit");
  const manualWrap = entryEl.querySelector(".mat-unit-manual-wrap");
  if (!sel || !manualWrap) return;
  manualWrap.classList.toggle("hidden", sel.value !== "ručno");
}

function addMaterialEntry(values = {}) {
  const list = $("#materialEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".material-entry").length + 1;
  const action = values.action || values.material_action || values.type || "ulaz";
  const selectedMaterial = values.material || values.name || "";
  const manualMaterial = values.material_custom || values.manual || "";
  const savedUnit = values.unit || values.measure || values.measure_unit || "";
  const isKnownUnit = ["", "t", "m³", "kg", "m", "m²", "kom", "paleta", "kamion", "tura"].includes(savedUnit);
  const unitSelectValue = isKnownUnit ? savedUnit : (savedUnit ? "ručno" : "");
  const unitManualValue = isKnownUnit ? "" : savedUnit;
  const div = document.createElement("div");
  div.className = "entry-card material-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Materijal ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Radnja sa materijalom</label>
    <select class="mat-action">
      <option value="ulaz" ${action === "ulaz" ? "selected" : ""}>Ulaz materijala na gradilište</option>
      <option value="izlaz" ${action === "izlaz" ? "selected" : ""}>Izlaz materijala sa gradilišta</option>
      <option value="ugradnja" ${action === "ugradnja" ? "selected" : ""}>Ugradnja materijala</option>
    </select>

    <label>Vrsta materijala iz Direkcije</label>
    <select class="mat-select"></select>

    <label>Ručno ako nije u listi</label>
    <input class="mat-manual" placeholder="npr. kamen 0-31, pesak, rizla..." value="${escapeHtml(manualMaterial)}" />

    <div class="mini-grid">
      <div>
        <label>Količina <span class="muted">(ako treba)</span></label>
        <input class="mat-qty numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 24" value="${escapeHtml(values.quantity || values.qty || "")}" />
      </div>
      <div>
        <label>Jedinica mere</label>
        <select class="mat-unit">${buildMaterialUnitOptionsHtml(unitSelectValue)}</select>
      </div>
      <div class="mat-unit-manual-wrap hidden">
        <label>Ručna mera</label>
        <input class="mat-unit-manual" placeholder="npr. džak, bala, set..." value="${escapeHtml(unitManualValue)}" />
      </div>
      <div>
        <label>Napomena <span class="muted">(opciono)</span></label>
        <input class="mat-note" placeholder="npr. dovezao Marko / vraćeno u bazu" value="${escapeHtml(values.note || "")}" />
      </div>
    </div>
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => { div.remove(); renumberMaterialEntries(); });
  div.querySelector(".mat-unit")?.addEventListener("change", () => updateMaterialUnitManualVisibility(div));
  updateMaterialUnitManualVisibility(div);
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneMaterialEntrySelect(div);
  if (selectedMaterial) {
    const sel = div.querySelector(".mat-select");
    if (Array.from(sel.options).some(o => o.value === selectedMaterial)) sel.value = selectedMaterial;
  }
}

function renumberMaterialEntries() {
  $$("#materialEntries .material-entry").forEach((card, i) => {
    const title = card.querySelector(".entry-card-head strong");
    if (title) title.textContent = `Materijal ${i + 1}`;
  });
}

function getMaterialEntries() {
  return $$("#materialEntries .material-entry").map((el, i) => {
    const action = el.querySelector(".mat-action")?.value || "";
    const selected = el.querySelector(".mat-select")?.value || "";
    const manual = el.querySelector(".mat-manual")?.value.trim() || "";
    const select = el.querySelector(".mat-select");
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const materialName = manual || selected;
    const unitSelect = el.querySelector(".mat-unit")?.value || "";
    const unitManual = el.querySelector(".mat-unit-manual")?.value.trim() || "";
    const selectedMaterialDefaultUnit = option?.dataset?.unit || "";
    const finalUnit = unitSelect === "ručno" ? unitManual : (unitSelect || selectedMaterialDefaultUnit || "");
    return {
      no: i + 1,
      action,
      material_action: action,
      material: materialName,
      name: materialName,
      material_id: manual ? null : (option?.dataset?.materialId || null),
      material_custom: manual,
      quantity: el.querySelector(".mat-qty")?.value.trim() || "",
      unit: finalUnit,
      measure_unit: finalUnit,
      note: el.querySelector(".mat-note")?.value.trim() || ""
    };
  }).filter(m => m.action || m.material || m.quantity || m.note);
}

function workerSetSections(perms) {
  // v1.16.5 pravilo:
  // "Ime gradilišta i datum/godina" kod radnika prikazuje samo Datum/godinu + Gradilište iz liste Direkcije.
  // Opis rada i sati rada više se ne otvaraju pod ovom rubrikom.
  const dailyAllowed = !!(perms.daily_work || perms.daily_work_site);

  const dailySection = $("#secDailyWork");
  if (dailySection) {
    dailySection.classList.remove("active");
    dailySection.classList.add("hidden-by-rule");
  }

  const siteSection = $("#secWorkerSite");
  if (siteSection) siteSection.classList.toggle("active", dailyAllowed);

  const map = {
    workers: "#secWorkers",
    machines: "#secMachines",
    vehicles: "#secVehicles",
    lowloader: "#secLowloader",
    fuel: "#secFuel",
    field_tanker: "#secFieldTanker",
    materials: "#secMaterials",
    leave_request: "#secLeaveRequest",
    warehouse: "#secWarehouse",
    defects: "#secDefects"
  };
  Object.entries(map).forEach(([key, sel]) => {
    const el = $(sel);
    if (el) el.classList.toggle("active", !!perms[key]);
  });
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
  const initialSearch = values.asset_code || values.machine_code || values.code || values.custom || values.machine_custom || values.name || "";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Mašina ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Mašina / interni broj</label>
    <input class="m-search asset-code-search smart-asset-input" placeholder="upiši broj ili naziv mašine, npr. 1 ili CAT 330" value="${escapeHtml(initialSearch)}" />
    <div class="asset-smart-result m-picked">Upiši broj mašine iz Direkcije ili naziv ako nije na listi.</div>
    <button class="secondary small-btn refresh-machine-assets" type="button">Osveži mašine iz Direkcije</button>

    <select class="m-name hidden-asset-select" aria-hidden="true" tabindex="-1">${buildMachineOptionsHtml(values.name || "")}</select>
    <input class="m-custom hidden-asset-custom" aria-hidden="true" tabindex="-1" value="${escapeHtml(values.custom || values.machine_custom || "")}" />

    <div class="mini-grid">
      <div>
        <label>Početni sati / MTČ</label>
        <input class="m-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250.5" value="${escapeHtml(values.start || "")}" />
      </div>
      <div>
        <label>Završni sati / MTČ</label>
        <input class="m-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 1258.5" value="${escapeHtml(values.end || "")}" />
      </div>
    </div>

    <label>Ukupno sati rada</label>
    <input class="m-hours numeric-text" type="text" inputmode="decimal" placeholder="automatski ili ručno" value="${escapeHtml(values.hours || "")}" />

    <label>Opis rada za ovu mašinu</label>
    <input class="m-work" placeholder="iskop, utovar, ravnanje..." value="${escapeHtml(values.work || "")}" />
  `;

  const startEl = div.querySelector(".m-start");
  const endEl = div.querySelector(".m-end");
  const hoursEl = div.querySelector(".m-hours");

  function calcHours() {
    const s = parseFloat(String(startEl.value || "").replace(",", "."));
    const e = parseFloat(String(endEl.value || "").replace(",", "."));
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

  const machineSearch = div.querySelector(".m-search");
  const machineSelect = div.querySelector(".m-name");
  const machineCustom = div.querySelector(".m-custom");
  if (machineSearch) machineSearch.addEventListener("input", () => refreshOneMachineSelect(div));
  if (machineSelect) machineSelect.addEventListener("change", refreshFuelMachineOptions);
  if (machineCustom) machineCustom.addEventListener("input", refreshFuelMachineOptions);
  const refreshMachinesBtn = div.querySelector(".refresh-machine-assets");
  if (refreshMachinesBtn) refreshMachinesBtn.addEventListener("click", async () => {
    try {
      refreshMachinesBtn.disabled = true;
      refreshMachinesBtn.textContent = "Učitavam...";
      await loadWorkerAssets();
      refreshOneMachineSelect(div);
      toast(workerAssetOptions.length ? "Mašine/vozila iz Direkcije su osvežene." : "Nema učitanih mašina/vozila. Proveri firmu radnika i listu u Direkciji.", !workerAssetOptions.length);
    } finally {
      refreshMachinesBtn.disabled = false;
      refreshMachinesBtn.textContent = "Osveži mašine iz Direkcije";
    }
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneMachineSelect(div);
  refreshFuelMachineOptions();
}

function getMachineEntries() {
  return $$("#machineEntries .machine-entry").map((el, i) => {
    const select = el.querySelector(".m-name");
    const selected = select?.value.trim() || "";
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const custom = el.querySelector(".m-custom")?.value.trim() || "";
    return {
      no: i + 1,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      machine_code: custom ? "" : (option?.dataset?.assetCode || ""),
      name: custom || selected,
      machine_custom: custom,
      start: el.querySelector(".m-start")?.value || "",
      end: el.querySelector(".m-end")?.value || "",
      hours: el.querySelector(".m-hours")?.value || "",
      work: el.querySelector(".m-work")?.value.trim() || ""
    };
  }).filter(m => m.name || m.start || m.end || m.hours || m.work);
}


function addLowloaderEntry(values = {}) {
  const list = $("#lowloaderEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".lowloader-entry").length + 1;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}`;
  const div = document.createElement("div");
  div.className = "entry-card lowloader-entry";
  const kmStart = values.km_start || values.start_km || values.odometer_start || "";
  const kmEnd = values.km_end || values.end_km || values.odometer_end || "";
  const kmTotal = values.km_total || values.km || "";
  const fromSite = values.from_site || values.from_address || values.from || "";
  const toSite = values.to_site || values.to_address || values.to || "";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Selidba mašine ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Broj tablica labudice</label>
    <input class="ll-plates" placeholder="npr. BG-123-AA" value="${escapeHtml(values.plates || values.registration || "")}" />

    <div class="grid two">
      <div>
        <label>Gradilište sa kog preuzima mašinu</label>
        <input class="ll-from" list="lowloaderFromSiteList-${uid}" placeholder="izaberi gradilište ili upiši ručno" value="${escapeHtml(fromSite)}" />
        <datalist class="ll-site-list" id="lowloaderFromSiteList-${uid}">${buildLowloaderSiteDatalistOptionsHtml()}</datalist>
      </div>
      <div>
        <label>Gradilište gde vozi mašinu</label>
        <input class="ll-to" list="lowloaderToSiteList-${uid}" placeholder="izaberi gradilište ili upiši ručno" value="${escapeHtml(toSite)}" />
        <datalist class="ll-site-list" id="lowloaderToSiteList-${uid}">${buildLowloaderSiteDatalistOptionsHtml()}</datalist>
      </div>
    </div>

    <div class="grid three">
      <div>
        <label>Početna kilometraža</label>
        <input class="ll-km-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 125000" value="${escapeHtml(kmStart)}" />
      </div>
      <div>
        <label>Završna kilometraža</label>
        <input class="ll-km-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 125042" value="${escapeHtml(kmEnd)}" />
      </div>
      <div>
        <label>Ukupno kilometara</label>
        <input class="ll-km numeric-text" type="text" inputmode="decimal" placeholder="automatski" value="${escapeHtml(kmTotal)}" readonly />
      </div>
    </div>
    <p class="field-hint">Ukupno kilometara se računa automatski: završna kilometraža minus početna kilometraža.</p>

    <label>Interni broj ili ime mašine koju seliš</label>
    <input class="ll-machine asset-code-search" list="lowloaderMachineList-${uid}" placeholder="upisati broj mašine, npr. 101" value="${escapeHtml(values.machine || values.machine_name || values.machine_custom || values.manual_machine || "")}" />
    <datalist class="ll-machine-list" id="lowloaderMachineList-${uid}">${buildLowloaderMachineDatalistOptionsHtml()}</datalist>
    <p class="field-hint">Ako je firmina mašina, izaberi je iz liste Direkcije. Ako seliš tuđu/zamensku mašinu, samo je upiši ručno.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberLowloaderEntries();
  });
  div.querySelectorAll(".ll-km-start, .ll-km-end").forEach(input => {
    input.addEventListener("input", () => updateLowloaderKmTotal(div));
    input.addEventListener("change", () => updateLowloaderKmTotal(div));
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  updateLowloaderKmTotal(div);
  refreshOneLowloaderMachineSelect(div);
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
    const kmStart = el.querySelector(".ll-km-start")?.value.trim() || "";
    const kmEnd = el.querySelector(".ll-km-end")?.value.trim() || "";
    updateLowloaderKmTotal(el);
    const km = el.querySelector(".ll-km")?.value.trim() || "";
    const machine = el.querySelector(".ll-machine")?.value.trim() || "";
    const customMachine = machine;
    return {
      no: i + 1,
      plates,
      registration: plates,
      from_site: from,
      to_site: to,
      from_address: from,
      to_address: to,
      km_start: kmStart,
      km_end: kmEnd,
      km_total: km,
      machine,
      machine_custom: customMachine
    };
  }).filter(x => x.plates || x.from_address || x.to_address || x.km_start || x.km_end || x.km_total || x.machine);
}


function buildFieldTankerSiteOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim().toLowerCase();
  if (!workerSiteOptions.length) return `<option value="">Nema gradilišta iz Direkcije</option>`;
  return `<option value="">Odaberi gradilište</option>` + workerSiteOptions.map(site => {
    const name = site.name || "Gradilište";
    const loc = site.location ? ` · ${site.location}` : "";
    const isSelected = selected && String(name).trim().toLowerCase() === selected ? "selected" : "";
    return `<option value="${escapeHtml(name)}" data-site-id="${escapeHtml(site.id || "")}" ${isSelected}>${escapeHtml(name + loc)}</option>`;
  }).join("");
}

function buildFieldTankerAssetOptionsHtml(kind = "machine", selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let allAssets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  let assets = allAssets.filter(asset => machineMatchesSearch(asset, searchValue));
  const q = normalizeVehicleSearch(searchValue);

  // v1.19.8: ako je upisan tačan broj, automatski prikaži sredstvo iako je stari filter tipa kočio listu.
  const exact = findAssetByExactCode(searchValue);
  if (exact) {
    const exactKind = getCanonicalAssetKind(exact);
    if (exactKind === kind && !assets.some(a => String(a.id || "") === String(exact.id || ""))) {
      assets = [exact, ...assets];
    }
  }
  if (q && !assets.length) {
    assets = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Direkcije</option>`;
  }
  if (!assets.length) {
    return `<option value="">Nema sredstva za taj broj/pretragu</option>`;
  }

  return `<option value="">${fuelKindChooseText(kind)}</option>` + assets.map(asset => assetOptionHtml(asset, selected, a => formatFuelKindAssetLabel(a, getCanonicalAssetKind(a)))).join("");
}

function refreshFieldTankerSelectors() {
  $$("#fieldTankerEntries .field-tanker-entry").forEach(card => {
    const siteSelect = card.querySelector(".ft-site-select");
    if (siteSelect) {
      const old = siteSelect.value;
      siteSelect.innerHTML = buildFieldTankerSiteOptionsHtml(old);
      if (old && Array.from(siteSelect.options).some(o => o.value === old)) siteSelect.value = old;
    }
    const assetSelect = card.querySelector(".ft-asset-select");
    if (assetSelect) {
      const kindEl = card.querySelector(".ft-asset-kind");
      let kind = kindEl?.value || "machine";
      const search = card.querySelector(".ft-asset-search")?.value || "";
      const custom = card.querySelector(".ft-asset-custom");
      const asset = findFuelAssetForSmartInput(search, kind);
      if (asset && kindEl) {
        const exactKind = getCanonicalAssetKind(asset);
        if (exactKind && exactKind !== kind) {
          kindEl.value = exactKind;
          kind = exactKind;
        }
      }
      const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
      assetSelect.innerHTML = buildFieldTankerAssetOptionsHtml(kind, selectedValue, search);
      if (asset) {
        const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
        if (Array.from(assetSelect.options).some(o => o.value === name)) assetSelect.value = name;
        if (custom) custom.value = "";
        updateFieldTankerSmartResult(card, asset, "");
      } else {
        if (custom) custom.value = String(search || "").trim();
        updateFieldTankerSmartResult(card, null, search);
      }
    }
  });
}


function addFieldTankerEntry(values = {}) {
  const list = $("#fieldTankerEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".field-tanker-entry").length + 1;
  const selectedSite = values.site_name || values.site || "";
  const selectedAsset = values.asset_name || values.machine || values.vehicle || "";
  const kind = values.asset_kind || values.asset_type || values.kind || (values.other ? "other" : (values.vehicle ? "vehicle" : "machine"));
  const oldReading = values.reading || values.mtc_km || "";
  const kmValue = values.km || values.current_km || values.kilometers || values.odometer || (kind === "vehicle" ? oldReading : "");
  const mtcValue = values.mtc || values.current_mtc || values.machine_mtc || (kind === "machine" ? oldReading : "");
  const manualAsset = values.asset_custom || values.manual_asset || values.machine_custom || values.vehicle_custom || "";
  const div = document.createElement("div");
  div.className = "entry-card field-tanker-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje na terenu ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Gradilište iz Direkcije</label>
    <select class="ft-site-select">${buildFieldTankerSiteOptionsHtml(selectedSite)}</select>
    <p class="field-hint">Ako gradilište nije u listi, upiši ga ručno ispod.</p>

    <label>Upiši ručno gradilište ako nije u listi</label>
    <input class="ft-site-custom" placeholder="npr. Zemun Zmaj" value="${escapeHtml(values.site_custom || values.manual_site || "")}" />

    <label>Šta je tankovano</label>
    <select class="ft-asset-kind">
      <option value="machine" ${kind === "machine" ? "selected" : ""}>Mašina</option>
      <option value="vehicle" ${kind === "vehicle" ? "selected" : ""}>Vozilo</option>
      <option value="other" ${kind === "other" ? "selected" : ""}>Ostalo</option>
    </select>

    <label>Sredstvo / interni broj</label>
    <input class="ft-asset-search asset-code-search smart-asset-input" placeholder="upiši broj, naziv ili tablice" value="${escapeHtml(values.asset_code || values.field_tanker_asset_code || manualAsset || selectedAsset || "")}" />
    <div class="asset-smart-result ft-picked">Upiši interni broj, naziv ili tablice sredstva.</div>
    <select class="ft-asset-select hidden-asset-select" aria-hidden="true" tabindex="-1">${buildFieldTankerAssetOptionsHtml(kind, selectedAsset, values.asset_code || values.field_tanker_asset_code || manualAsset || selectedAsset || "")}</select>
    <input class="ft-asset-custom hidden-asset-custom" type="hidden" value="${escapeHtml(manualAsset)}" />

    <label>Trenutna kilometraža / KM</label>
    <input class="ft-km numeric-text" type="text" inputmode="decimal" placeholder="npr. 85320" value="${escapeHtml(kmValue)}" />

    <label>Trenutni MTČ</label>
    <input class="ft-mtc numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250.5" value="${escapeHtml(mtcValue)}" />
    <p class="field-hint">Ako tankuješ vozilo, obavezno upiši KM. Ako tankuješ mašinu, obavezno upiši MTČ. Možeš popuniti oba ako firma tako traži.</p>

    <label>Sipano litara</label>
    <input class="ft-liters numeric-text" type="text" inputmode="decimal" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />

    <label>Gorivo primio</label>
    <input class="ft-receiver" placeholder="ime i prezime vozača / rukovaoca" value="${escapeHtml(values.receiver || values.received_by || "")}" />
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberFieldTankerEntries();
  });
  function refreshThisFieldTankerAssetSelect() {
    const assetSelect = div.querySelector(".ft-asset-select");
    if (!assetSelect) return;
    const kindEl = div.querySelector(".ft-asset-kind");
    let kindNow = kindEl?.value || "machine";
    const searchNow = div.querySelector(".ft-asset-search")?.value || "";
    const custom = div.querySelector(".ft-asset-custom");
    const asset = findFuelAssetForSmartInput(searchNow, kindNow);
    if (asset && kindEl) {
      const assetKind = getCanonicalAssetKind(asset);
      if (assetKind && assetKind !== kindNow) {
        kindEl.value = assetKind;
        kindNow = assetKind;
      }
    }
    const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
    assetSelect.innerHTML = buildFieldTankerAssetOptionsHtml(kindNow, selectedValue, searchNow);
    if (asset) {
      const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
      if (Array.from(assetSelect.options).some(o => o.value === name)) assetSelect.value = name;
      if (custom) custom.value = "";
      updateFieldTankerSmartResult(div, asset, "");
    } else {
      if (custom) custom.value = String(searchNow || "").trim();
      updateFieldTankerSmartResult(div, null, searchNow);
    }
  }
  div.querySelector(".ft-asset-kind")?.addEventListener("change", refreshThisFieldTankerAssetSelect);
  div.querySelector(".ft-asset-search")?.addEventListener("input", refreshThisFieldTankerAssetSelect);
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshFieldTankerSelectors();
}

function renumberFieldTankerEntries() {
  $$("#fieldTankerEntries .field-tanker-entry").forEach((card, i) => {
    const h = card.querySelector("strong");
    if (h) h.textContent = `Sipanje na terenu ${i + 1}`;
  });
}

function getFieldTankerEntries() {
  return $$("#fieldTankerEntries .field-tanker-entry").map((el, i) => {
    const siteSelect = el.querySelector(".ft-site-select");
    const siteOption = siteSelect?.options ? siteSelect.options[siteSelect.selectedIndex] : null;
    const manualSite = el.querySelector(".ft-site-custom")?.value.trim() || "";
    const site = manualSite || (siteSelect?.value || "").trim();
    const kind = el.querySelector(".ft-asset-kind")?.value || "machine";
    const assetSelect = el.querySelector(".ft-asset-select");
    const assetOption = assetSelect?.options ? assetSelect.options[assetSelect.selectedIndex] : null;
    const manualAsset = el.querySelector(".ft-asset-custom")?.value.trim() || "";
    const asset = manualAsset || (assetSelect?.value || "").trim();
    const km = el.querySelector(".ft-km")?.value.trim() || "";
    const mtc = el.querySelector(".ft-mtc")?.value.trim() || "";
    const reading = mtc || km; // backward-compatible summary for older report/excel code
    const liters = el.querySelector(".ft-liters")?.value.trim() || "";
    const receiver = el.querySelector(".ft-receiver")?.value.trim() || "";
    return {
      no: i + 1,
      site_id: manualSite ? null : (siteOption?.dataset?.siteId || null),
      site_name: site,
      site_custom: manualSite,
      asset_kind: kind,
      asset_type: kind,
      asset_id: manualAsset ? null : (assetOption?.dataset?.assetId || null),
      asset_code: manualAsset ? "" : (assetOption?.dataset?.assetCode || ""),
      asset_name: asset,
      asset_custom: manualAsset,
      machine: kind === "machine" ? asset : "",
      vehicle: kind === "vehicle" ? asset : "",
      other: kind === "other" ? asset : "",
      vehicle_custom: kind === "vehicle" ? manualAsset : "",
      machine_custom: kind === "machine" ? manualAsset : "",
      other_custom: kind === "other" ? manualAsset : "",
      km,
      current_km: km,
      mtc,
      current_mtc: mtc,
      reading,
      mtc_km: reading,
      liters,
      receiver,
      received_by: receiver
    };
  }).filter(x => x.site_name || x.asset_name || x.km || x.mtc || x.reading || x.liters || x.receiver);
}


function getFieldTankerMemoryKey() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const companyPart = worker?.company_id || worker?.company_code || "no_company";
  const userPart = worker?.user_id || worker?.id || worker?.access_code || "no_worker";
  return `swp_field_tanker_memory_${companyPart}_${userPart}`;
}

function readStoredFieldTankerEntries() {
  try {
    const raw = localStorage.getItem(getFieldTankerMemoryKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch(e) {
    return [];
  }
}

function writeStoredFieldTankerEntries(entries = []) {
  localStorage.setItem(getFieldTankerMemoryKey(), JSON.stringify(entries));
  renderStoredFieldTankerEntries();
}

function normalizeStoredFieldTankerEntry(entry = {}, index = 0) {
  return {
    ...entry,
    no: index + 1,
    local_id: entry.local_id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    saved_at: entry.saved_at || new Date().toISOString(),
    saved_by: entry.saved_by || currentWorker?.full_name || "",
    source: "field_tanker_memory"
  };
}

function validateFieldTankerEntryForMemory(entry) {
  if (!entry.site_name) return "Upiši ili izaberi gradilište/lokaciju za svako sipanje.";
  if (!entry.asset_name) return "Izaberi mašinu/vozilo ili upiši ručno šta je tankovano.";
  if (!entry.liters) return "Upiši koliko litara je sipano.";
  if (entry.asset_kind === "vehicle" && !entry.km && !entry.current_km) return "Za vozilo upiši kilometražu / KM.";
  if (entry.asset_kind === "machine" && !entry.mtc && !entry.current_mtc) return "Za mašinu upiši trenutni MTČ.";
  if (!entry.receiver) return "Upiši ko je primio gorivo.";
  return "";
}

function memorizeCurrentFieldTankerEntries() {
  try {
    const currentEntries = getFieldTankerEntries();
    if (!currentEntries.length) throw new Error("Prvo dodaj bar jedno sipanje goriva cisternom.");

    const firstError = currentEntries.map(validateFieldTankerEntryForMemory).find(Boolean);
    if (firstError) throw new Error(firstError);

    const existing = readStoredFieldTankerEntries();
    const savedNow = new Date().toISOString();
    const prepared = currentEntries.map((entry, index) => normalizeStoredFieldTankerEntry({
      ...entry,
      saved_at: savedNow,
      saved_by: currentWorker?.full_name || ""
    }, existing.length + index));

    writeStoredFieldTankerEntries([...existing, ...prepared].map(normalizeStoredFieldTankerEntry));

    if ($("#fieldTankerEntries")) {
      $("#fieldTankerEntries").innerHTML = "";
      addFieldTankerEntry();
    }

    toast(`Memorisano ${prepared.length} sipanje/a goriva na ovom telefonu ✅`);
  } catch(e) {
    toast(e.message, true);
  }
}

function removeStoredFieldTankerEntry(localId) {
  const remaining = readStoredFieldTankerEntries().filter(entry => entry.local_id !== localId);
  writeStoredFieldTankerEntries(remaining.map(normalizeStoredFieldTankerEntry));
  toast("Sipanje je uklonjeno iz lokalne memorije.");
}

function clearStoredFieldTankerEntries() {
  const count = readStoredFieldTankerEntries().length;
  if (!count) {
    renderStoredFieldTankerEntries();
    toast("Nema memorisanih sipanja za brisanje.");
    return;
  }
  if (!confirm(`Obrisati ${count} memorisano/a sipanje/a sa ovog telefona? Ovo radi samo lokalno, ne briše ništa iz Supabase-a.`)) return;
  writeStoredFieldTankerEntries([]);
  toast("Lokalna memorija sipanja je obrisana.");
}

function renderStoredFieldTankerEntries() {
  const box = $("#storedFieldTankerList");
  if (!box) return;
  const entries = readStoredFieldTankerEntries().map(normalizeStoredFieldTankerEntry);
  if (!entries.length) {
    box.innerHTML = `<p class="hint">Trenutno nema memorisanih sipanja na ovom telefonu.</p>`;
    return;
  }

  const totalLiters = entries.reduce((sum, entry) => sum + parseDecimalInput(entry.liters), 0);
  box.innerHTML = `
    <div class="stored-fuel-summary">
      <strong>${entries.length} memorisano/a sipanje/a</strong>
      <span>${totalLiters ? `${totalLiters.toLocaleString("sr-RS")} L ukupno` : "Litri nisu sabrani"}</span>
    </div>
    ${entries.map((entry, index) => `
      <div class="stored-fuel-item">
        <div>
          <strong>${index + 1}. ${escapeHtml(entry.site_name || "Bez lokacije")}</strong>
          <small>${escapeHtml(assetKindLabel(entry.asset_kind))} · ${escapeHtml(entry.asset_name || "")}</small>
          <small>${escapeHtml(entry.liters || "0")} L · KM: ${escapeHtml(entry.km || entry.current_km || "-")} · MTČ: ${escapeHtml(entry.mtc || entry.current_mtc || "-")} · Primio: ${escapeHtml(entry.receiver || "-")}</small>
        </div>
        <button type="button" class="danger-small stored-fuel-remove" data-local-id="${escapeHtml(entry.local_id)}">Ukloni</button>
      </div>
    `).join("")}
  `;

  box.querySelectorAll(".stored-fuel-remove").forEach(btn => {
    btn.addEventListener("click", () => removeStoredFieldTankerEntry(btn.dataset.localId));
  });
}

function buildFieldTankerMemoryReportData(entries = []) {
  const first = entries[0] || {};
  const totalLiters = entries.reduce((sum, entry) => sum + parseDecimalInput(entry.liters), 0);
  return {
    report_type: "field_tanker_daily_batch",
    source: "field_tanker_memory",
    memory_sent_at: new Date().toISOString(),
    report_sections_sent: {
      field_tanker: true,
      tanker_fuel_memory: true
    },
    site_id: first.site_id || null,
    site_name: first.site_name || "Tankanje goriva cisternom",
    field_tanker_entries: entries.map(normalizeStoredFieldTankerEntry),
    tanker_fuel_entries: entries.map(normalizeStoredFieldTankerEntry),
    fuel_liters: totalLiters || "",
    field_tanker_total_liters: totalLiters || "",
    field_tanker_count: entries.length,
    created_by_worker: currentWorker?.full_name || "",
    function_title: currentWorker?.function_title || "",
    description: "Memorisana sipanja goriva cisternom poslata kao jedan dnevni izveštaj."
  };
}

async function sendStoredFieldTankerEntries() {
  try {
    if (!navigator.onLine) throw new Error("Nema interneta. Memorisana sipanja ostaju sačuvana na telefonu.");
    const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
    if (!worker) throw new Error("Radnik nije prijavljen.");

    const entries = readStoredFieldTankerEntries().map(normalizeStoredFieldTankerEntry);
    if (!entries.length) throw new Error("Nema memorisanih sipanja za slanje.");

    const firstError = entries.map(validateFieldTankerEntryForMemory).find(Boolean);
    if (firstError) throw new Error(firstError);

    const data = buildFieldTankerMemoryReportData(entries);
    const { error } = await sb.rpc("submit_worker_report", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code,
      p_report_date: $("#wrDate")?.value || today(),
      p_site_id: data.site_id || null,
      p_data: data
    });

    if (error) throw error;

    localStorage.removeItem(getFieldTankerMemoryKey());
    renderStoredFieldTankerEntries();
    if ($("#fieldTankerEntries")) {
      $("#fieldTankerEntries").innerHTML = "";
      addFieldTankerEntry();
    }
    toast(`Sva memorisana sipanja su poslata Direkciji ✅ (${entries.length})`);
  } catch(e) {
    toast(e.message, true);
  }
}

function buildFuelAssetOptionsHtml(kind = "machine", selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let allAssets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  let assets = allAssets.filter(asset => machineMatchesSearch(asset, searchValue));
  const q = normalizeVehicleSearch(searchValue);

  const exact = findAssetByExactCode(searchValue);
  if (exact) {
    const exactKind = getCanonicalAssetKind(exact);
    if (exactKind === kind && !assets.some(a => String(a.id || "") === String(exact.id || ""))) {
      assets = [exact, ...assets];
    }
  }
  if (q && !assets.length) {
    assets = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Direkcije</option>`;
  }
  if (!assets.length) {
    return `<option value="">Nema sredstva za taj broj/pretragu</option>`;
  }

  return `<option value="">${fuelKindChooseText(kind)}</option>` + assets.map(asset => assetOptionHtml(asset, selected, a => formatFuelKindAssetLabel(a, getCanonicalAssetKind(a)))).join("");
}


function findFuelAssetForSmartInput(searchValue, kind = "machine") {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const exactCode = findAssetByExactCode(searchValue);
  if (exactCode) return exactCode;
  const assets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  const exact = assets.find(asset => {
    const code = normalizeVehicleSearch(getAssetCode(asset));
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatFuelKindAssetLabel(asset, kind));
    return code === q || name === q || reg === q || label === q;
  });
  if (exact) return exact;
  const matches = assets.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateFuelSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".f-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result f-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset))}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result f-picked warn";
    result.textContent = `Nije pronađeno u Direkciji. Biće poslato kao ručni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result f-picked";
  result.textContent = "Upiši interni broj, naziv ili tablice sredstva.";
}

function updateFieldTankerSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".ft-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result ft-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset))}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result ft-picked warn";
    result.textContent = `Nije pronađeno u Direkciji. Biće poslato kao ručni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result ft-picked";
  result.textContent = "Upiši interni broj, naziv ili tablice sredstva.";
}

function findDefectAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const exactCode = findAssetByExactCode(searchValue);
  if (exactCode) return exactCode;
  const assets = (workerAssetOptions || []).filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  const exact = assets.find(asset => {
    const code = normalizeVehicleSearch(getAssetCode(asset));
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset)));
    return code === q || name === q || reg === q || label === q;
  });
  if (exact) return exact;
  const matches = assets.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function formatDefectAssetLabel(asset) {
  if (!asset) return "";
  const kind = getCanonicalAssetKind(asset);
  const kindLabel = kind === "vehicle" ? "Vozilo" : kind === "other" ? "Ostalo" : "Mašina";
  return `${kindLabel}: ${formatFuelKindAssetLabel(asset, kind)}`;
}

function updateDefectAssetSmartResult() {
  const input = $("#wrDefectAssetName");
  const result = $("#wrDefectAssetPicked");
  if (!input || !result) return;
  const value = String(input.value || "").trim();
  const asset = findDefectAssetForSmartInput(value);
  if (asset) {
    result.className = "asset-smart-result defect-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatDefectAssetLabel(asset)}`;
    return;
  }
  if (value) {
    result.className = "asset-smart-result defect-picked warn";
    result.textContent = `Nije pronađeno u Direkciji. Biće poslato kao ručni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result defect-picked";
  result.textContent = "Upiši interni broj, naziv mašine/vozila/opreme ili registraciju.";
}

function getDefectAssetPayload() {
  const raw = String($("#wrDefectAssetName")?.value || "").trim();
  const asset = findDefectAssetForSmartInput(raw);
  if (!asset) {
    return {
      defect_asset_kind: "",
      defect_asset_id: "",
      defect_asset_code: "",
      defect_asset_name: raw,
      defect_asset_registration: "",
      defect_manual_asset_name: raw
    };
  }
  return {
    defect_asset_kind: getCanonicalAssetKind(asset),
    defect_asset_id: asset.id || "",
    defect_asset_code: getAssetCode(asset) || "",
    defect_asset_name: getAssetName(asset) || raw,
    defect_asset_registration: getAssetRegistration(asset) || "",
    defect_manual_asset_name: ""
  };
}

function getDefectImpactPayload() {
  const impact = $("#wrDefectStopsWork")?.value || "";
  return {
    defect_work_impact: impact,
    defect_stops_work: impact === "zaustavlja_rad" ? "da" : impact === "moze_nastaviti" ? "ne" : "",
    defect_can_continue: impact === "moze_nastaviti" ? "da" : impact === "zaustavlja_rad" ? "ne" : ""
  };
}

function refreshOneFuelAssetSelect(entryEl) {
  const sel = entryEl.querySelector(".f-asset-select");
  if (!sel) return;
  const kindEl = entryEl.querySelector(".f-asset-kind");
  let kind = kindEl?.value || "machine";
  const search = entryEl.querySelector(".f-asset-search")?.value || "";
  const custom = entryEl.querySelector(".f-asset-custom");
  const asset = findFuelAssetForSmartInput(search, kind);
  if (asset && kindEl) {
    const assetKind = getCanonicalAssetKind(asset);
    if (assetKind && assetKind !== kind) {
      kindEl.value = assetKind;
      kind = assetKind;
    }
  }
  const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
  sel.innerHTML = buildFuelAssetOptionsHtml(kind, selectedValue, search);
  if (asset) {
    const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
    if (Array.from(sel.options).some(o => o.value === name)) sel.value = name;
    if (custom) custom.value = "";
    updateFuelSmartResult(entryEl, asset, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateFuelSmartResult(entryEl, null, search);
  }
}


function addFuelEntry(values = {}) {
  const list = $("#fuelEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".fuel-entry").length + 1;
  const kind = values.asset_kind || values.asset_type || values.kind || (values.other ? "other" : (values.vehicle ? "vehicle" : "machine"));
  const selectedAsset = values.asset_name || values.machine || values.vehicle || "";
  const manualAsset = values.asset_custom || values.machine_custom || values.vehicle_custom || "";
  const oldReading = values.reading || values.mtc_km || "";
  const kmValue = values.km || values.current_km || values.kilometers || values.odometer || (kind === "vehicle" ? oldReading : "");
  const mtcValue = values.mtc || values.current_mtc || values.machine_mtc || (kind === "machine" ? oldReading : "");
  const div = document.createElement("div");
  div.className = "entry-card fuel-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje goriva ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Šta je tankovano</label>
    <select class="f-asset-kind">
      <option value="machine" ${kind === "machine" ? "selected" : ""}>Mašina</option>
      <option value="vehicle" ${kind === "vehicle" ? "selected" : ""}>Vozilo</option>
      <option value="other" ${kind === "other" ? "selected" : ""}>Ostalo</option>
    </select>

    <label>Sredstvo / interni broj</label>
    <input class="f-asset-search asset-code-search smart-asset-input" placeholder="upiši broj, naziv ili tablice" value="${escapeHtml(values.asset_code || values.fuel_asset_code || manualAsset || selectedAsset || "")}" />
    <div class="asset-smart-result f-picked">Upiši interni broj, naziv ili tablice sredstva.</div>
    <select class="f-asset-select hidden-asset-select" aria-hidden="true" tabindex="-1"></select>
    <input class="f-asset-custom hidden-asset-custom" type="hidden" value="${escapeHtml(manualAsset)}" />

    <div class="mini-grid">
      <div>
        <label>Litara</label>
        <input class="f-liters" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />
      </div>
      <div>
        <label>Trenutna kilometraža / KM</label>
        <input class="f-km numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 85320" value="${escapeHtml(kmValue)}" />
      </div>
      <div>
        <label>Trenutni MTČ</label>
        <input class="f-mtc numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 1255.0" value="${escapeHtml(mtcValue)}" />
      </div>
    </div>

    <label>Ko je sipao</label>
    <input class="f-by" placeholder="npr. Marko" value="${escapeHtml(values.by || "")}" />

    <p class="hint">Za vozilo upiši KM. Za mašinu ili ostalu opremu upiši MTČ ako postoji. Primalac goriva je automatski prijavljeni radnik koji šalje izveštaj.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => div.remove());
  div.querySelector(".f-asset-kind")?.addEventListener("change", () => refreshOneFuelAssetSelect(div));
  div.querySelector(".f-asset-search")?.addEventListener("input", () => refreshOneFuelAssetSelect(div));
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneFuelAssetSelect(div);

  if (selectedAsset) {
    const sel = div.querySelector(".f-asset-select");
    if (Array.from(sel.options).some(o => o.value === selectedAsset)) sel.value = selectedAsset;
  }
}

function getFuelEntries() {
  return $$("#fuelEntries .fuel-entry").map((el, i) => {
    const kind = el.querySelector(".f-asset-kind")?.value || "machine";
    const selected = el.querySelector(".f-asset-select")?.value || "";
    const custom = el.querySelector(".f-asset-custom")?.value.trim() || "";
    const select = el.querySelector(".f-asset-select");
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const assetName = custom || selected;
    const km = el.querySelector(".f-km")?.value.trim() || "";
    const mtc = el.querySelector(".f-mtc")?.value.trim() || "";
    const oldReading = el.querySelector(".f-reading")?.value.trim() || "";
    const reading = mtc || km || oldReading; // backward-compatible summary for older report/excel code
    return {
      no: i + 1,
      asset_kind: kind,
      asset_type: kind,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      asset_name: assetName,
      asset_custom: custom,
      machine: kind === "machine" ? assetName : "",
      machine_custom: kind === "machine" ? custom : "",
      vehicle: kind === "vehicle" ? assetName : "",
      vehicle_custom: kind === "vehicle" ? custom : "",
      other: kind === "other" ? assetName : "",
      other_custom: kind === "other" ? custom : "",
      liters: el.querySelector(".f-liters")?.value || "",
      km,
      current_km: km,
      mtc,
      current_mtc: mtc,
      reading,
      mtc_km: reading,
      by: el.querySelector(".f-by")?.value.trim() || "",
      receiver: currentWorker?.full_name || ""
    };
  }).filter(f => f.asset_name || f.liters || f.km || f.mtc || f.reading || f.by);
}

function refreshFuelMachineOptions() {
  $$("#fuelEntries .fuel-entry").forEach(entryEl => refreshOneFuelAssetSelect(entryEl));
}


// Direktno izlaganje funkcija za onclick fallback
window.addMachineEntry = addMachineEntry;
window.addFuelEntry = addFuelEntry;
window.addVehicleEntry = addVehicleEntry;
window.addFieldTankerEntry = addFieldTankerEntry;
window.memorizeCurrentFieldTankerEntries = memorizeCurrentFieldTankerEntries;
window.sendStoredFieldTankerEntries = sendStoredFieldTankerEntries;
window.clearStoredFieldTankerEntries = clearStoredFieldTankerEntries;
window.addLowloaderEntry = addLowloaderEntry;
window.addMaterialEntry = addMaterialEntry;
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

    if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
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
    (d.material_entries || d.material_movements || []).forEach(m => addMaterialEntry(m));

    Object.entries({
      wrSiteName:"site_name",
      wrDescription:"description",
      wrHours:"hours",
      wrVehicle:"vehicle",
      wrKmStart:"km_start",
      wrKmEnd:"km_end",
      wrRoute:"route",
      wrTours:"tours",
      wrMaterialManual:"material",
      wrWarehouseType:"warehouse_type",
      wrWarehouseItem:"warehouse_item",
      wrWarehouseQty:"warehouse_qty",
      wrDefectAssetName:"defect_asset_code",
      wrDefectSiteName:"defect_site_name",
      wrDefect:"defect",
      wrDefectStopsWork:"defect_work_impact",
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

function updateLeaveRequestVisibility() {
  const type = $("#wrLeaveType")?.value || "slobodan_dan";
  const single = $("#leaveSingleDayBox");
  const range = $("#leaveRangeBox");
  if (single) single.classList.toggle("hidden", type !== "slobodan_dan");
  if (range) range.classList.toggle("hidden", type !== "godisnji_odmor");
}

function getLeaveRequestData() {
  const type = $("#wrLeaveType")?.value || "slobodan_dan";
  const date = $("#wrLeaveDate")?.value || "";
  const dateFrom = $("#wrLeaveFrom")?.value || "";
  const dateTo = $("#wrLeaveTo")?.value || "";
  const note = $("#wrLeaveNote")?.value.trim() || "";
  const label = type === "godisnji_odmor" ? "Godišnji odmor" : "Slobodan dan";
  return {
    type,
    label,
    leave_type: type,
    leave_label: label,
    date,
    leave_date: date,
    date_from: dateFrom,
    date_to: dateTo,
    note,
    leave_note: note
  };
}

function hasLeaveRequestData(req) {
  if (!req) return false;
  return !!(req.date || req.date_from || req.date_to || req.note);
}

function collectWorkerData() {
  const perms = currentWorker?.permissions || {};
  const machines = perms.machines ? getMachineEntries() : [];
  const vehicles = perms.vehicles ? getVehicleEntries() : [];
  const fuelEntries = perms.fuel ? getFuelEntries() : [];
  const selectedSite = getSelectedWorkerSite();
  const canDaily = !!(perms.daily_work || perms.daily_work_site);
  const canWorkers = !!perms.workers;
  const canMaterials = !!perms.materials;
  const canLeaveRequest = !!perms.leave_request;
  const canWarehouse = !!perms.warehouse;
  const canDefects = !!perms.defects;
  const canLowloader = !!perms.lowloader;
  const canFieldTanker = !!perms.field_tanker;
  const lowloaderMoves = canLowloader ? getLowloaderEntries() : [];
  const fieldTankerEntries = canFieldTanker ? getFieldTankerEntries() : [];
  const materialEntries = canMaterials ? getMaterialEntries() : [];
  const leaveRequest = canLeaveRequest ? getLeaveRequestData() : null;

  // v1.17.4: Labudica ne mora imati glavno gradilište iz osnovne rubrike.
  // Ako radnik popunjava samo prevoz mašine labudicom, izveštaj dobija radni naziv
  // iz prvog unosa labudice ili generički naziv, a p_site_id ostaje null.
  const firstLowloaderMove = lowloaderMoves.find(m =>
    m.from_site || m.to_site || m.from_address || m.to_address || m.machine || m.plates
  ) || null;
  const lowloaderFallbackSiteName = firstLowloaderMove
    ? (firstLowloaderMove.from_site || firstLowloaderMove.from_address || firstLowloaderMove.to_site || firstLowloaderMove.to_address || "Prevoz mašine labudicom")
    : "";
  const leaveFallbackSiteName = canLeaveRequest && hasLeaveRequestData(leaveRequest) ? "Zahtev za slobodan dan / godišnji odmor" : "";
  const firstFieldTankerEntry = fieldTankerEntries.find(x => x.site_name || x.site_id) || null;
  const fieldTankerFallbackSiteName = firstFieldTankerEntry ? (firstFieldTankerEntry.site_name || "Tankanje goriva cisternom") : "";
  const reportSiteName = selectedSite.site_name || (canLowloader && lowloaderMoves.length ? lowloaderFallbackSiteName : "") || (canFieldTanker && fieldTankerEntries.length ? fieldTankerFallbackSiteName : "") || leaveFallbackSiteName;
  const reportSiteId = selectedSite.site_id || firstFieldTankerEntry?.site_id || null;

  const reportSectionsSent = {
    workers: canWorkers && getWorkerEntries().length > 0,
    machines: machines.length > 0,
    vehicles: vehicles.length > 0,
    lowloader: lowloaderMoves.length > 0,
    field_tanker: fieldTankerEntries.length > 0,
    fuel: fuelEntries.length > 0,
    materials: materialEntries.length > 0,
    leave_request: !!(canLeaveRequest && hasLeaveRequestData(leaveRequest)),
    warehouse: !!(canWarehouse && (($("#wrWarehouseItem")?.value || "").trim() || ($("#wrWarehouseQty")?.value || "").trim())),
    defects: !!(canDefects && (($("#wrDefect")?.value || "").trim() || ($("#wrDefectAssetName")?.value || "").trim()))
  };

  return {
    report_sections_sent: reportSectionsSent,
    site_id: reportSiteId,
    site_name: reportSiteName,
    // v1.16.3: Ime gradilišta i datum/godina čuva samo datum/godinu kroz report_date i gradilište kroz site_id/site_name.
    // Opis rada i sati rada ne šaljemo pod ovom rubrikom.
    description: "",
    hours: "",
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
    fuel_km: fuelEntries.map(f => f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "")).filter(Boolean).join(" | "),
    fuel_mtc: fuelEntries.map(f => f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "")).filter(Boolean).join(" | "),
    fuel_readings: fuelEntries.map(f => f.reading || f.mtc_km).filter(Boolean).join(" | "),
    fuel_by: fuelEntries.map(f => f.by).filter(Boolean).join(" | "),
    fuel_receiver: currentWorker?.full_name || "",

    vehicle: vehicles.map(v => v.name).filter(Boolean).join(" | "),
    km_start: vehicles.map(v => v.km_start).filter(Boolean).join(" | "),
    km_end: vehicles.map(v => v.km_end).filter(Boolean).join(" | "),
    route: vehicles.map(v => v.route).filter(Boolean).join(" | "),
    tours: vehicles.map(v => v.tours).filter(Boolean).join(" | "),
    cubic_m3: vehicles.map(v => v.cubic_m3).filter(Boolean).join(" | "),
    material_entries: materialEntries,
    material_movements: materialEntries,
    material: canMaterials ? materialEntries.map(m => `${m.action || ""}: ${m.material || ""}`.trim()).filter(Boolean).join(" | ") : "",
    quantity: canMaterials ? materialEntries.map(m => m.quantity).filter(Boolean).join(" | ") : "",
    unit: canMaterials ? materialEntries.map(m => m.unit).filter(Boolean).join(" | ") : "",
    leave_request: canLeaveRequest ? leaveRequest : null,
    leave_request_type: canLeaveRequest && hasLeaveRequestData(leaveRequest) ? leaveRequest.label : "",
    leave_type: canLeaveRequest ? (leaveRequest?.type || "") : "",
    leave_date: canLeaveRequest ? (leaveRequest?.date || "") : "",
    leave_from: canLeaveRequest ? (leaveRequest?.date_from || "") : "",
    leave_to: canLeaveRequest ? (leaveRequest?.date_to || "") : "",
    leave_note: canLeaveRequest ? (leaveRequest?.note || "") : "",
    warehouse_type: canWarehouse ? $("#wrWarehouseType").value : "",
    warehouse_item: canWarehouse ? $("#wrWarehouseItem").value.trim() : "",
    warehouse_qty: canWarehouse ? $("#wrWarehouseQty").value.trim() : "",
    ...defectAssetPayload,
    defect_machine: canDefects ? (defectAssetPayload.defect_asset_name || "") : "",
    defect_site_name: canDefects ? ($("#wrDefectSiteName")?.value.trim() || selectedSite.site_name || "") : "",
    defect_exists: canDefects ? "da" : "ne",
    defect: canDefects ? $("#wrDefect").value.trim() : "",
    ...defectImpactPayload,
    defect_urgency: canDefects ? $("#wrDefectUrgency").value : "",
    called_mechanic_by_phone: canDefects ? ($("#wrDefectCalledMechanic")?.value || "") : ""
  };
}

function clearWorkerForm() {
  ["wrSiteName","wrDescription","wrHours","wrVehicle","wrKmStart","wrKmEnd","wrRoute","wrTours","wrLeaveType","wrLeaveDate","wrLeaveFrom","wrLeaveTo","wrLeaveNote","wrWarehouseType","wrWarehouseItem","wrWarehouseQty","wrDefectAssetName","wrDefectSiteName","wrDefect","wrDefectStopsWork","wrDefectUrgency","wrDefectCalledMechanic"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
  if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
  if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
  if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
  if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
  if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
  if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
  localStorage.removeItem("swp_draft");
  localStorage.removeItem("swp_returned_report_id");
}

function ensureWorkerDefaultEntries() {
  const perms = currentWorker?.permissions || {};
  ensureWorkerDefaultEntries();
  if (perms.materials && $("#materialEntries") && !$("#materialEntries").children.length) addMaterialEntry();
  refreshMachineDatalists();
  refreshVehicleSelects();
  refreshFuelMachineOptions();
  refreshFieldTankerSelectors();
  refreshMaterialEntrySelectors();
}

async function prepareWorkerFormForNextReport() {
  clearWorkerForm();
  if ($("#wrDate")) $("#wrDate").value = today();

  // v1.20.1: Posle uspešnog slanja ne smeju nestati liste mašina/vozila/opreme.
  // Zato ponovo učitavamo sredstva i odmah vraćamo po jednu praznu karticu za svaku dozvoljenu rubriku.
  await Promise.allSettled([loadWorkerSites(), loadWorkerAssets(), loadWorkerMaterials()]);
  ensureWorkerDefaultEntries();
  renderStoredFieldTankerEntries();
  updateLeaveRequestVisibility();
}

async function verifyRecentlySubmittedReport(worker, reportDate) {
  // Samo dijagnostika. Ako RLS ne dozvoli direktno čitanje, ne smemo blokirati radnika.
  try {
    if (!worker?.company_id) return;
    const { data, error } = await sb
      .from("reports")
      .select("id,status,report_date,created_at,submitted_at")
      .eq("company_id", worker.company_id)
      .eq("report_date", reportDate)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.warn("Start Work PRO: izveštaj je poslat preko RPC, ali direktna provera reports nije dozvoljena ili nije uspela:", error.message);
      return;
    }
    console.log("Start Work PRO: poslednji izveštaji za proveru slanja", data || []);
  } catch (e) {
    console.warn("Start Work PRO: provera poslatog izveštaja nije uspela", e);
  }
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

    if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
    if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
    if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
    (d.field_tanker_entries || d.tanker_fuel_entries || []).forEach(x => addFieldTankerEntry(x));
    if ((!d.vehicles || !d.vehicles.length) && (d.vehicle || d.km_start || d.km_end || d.route || d.tours)) {
      addVehicleEntry({ name: d.vehicle, km_start: d.km_start, km_end: d.km_end, route: d.route, tours: d.tours });
    }
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));
    (d.material_entries || d.material_movements || []).forEach(m => addMaterialEntry(m));

    Object.entries({
      wrSiteName:"site_name", wrDescription:"description", wrHours:"hours", wrVehicle:"vehicle", wrKmStart:"km_start", wrKmEnd:"km_end", wrRoute:"route", wrTours:"tours", wrMaterialManual:"material", wrLeaveType:"leave_type", wrLeaveDate:"leave_date", wrLeaveFrom:"leave_from", wrLeaveTo:"leave_to", wrLeaveNote:"leave_note", wrWarehouseType:"warehouse_type", wrWarehouseItem:"warehouse_item", wrWarehouseQty:"warehouse_qty", wrDefectAssetName:"defect_asset_code", wrDefectSiteName:"defect_site_name", wrDefect:"defect", wrDefectStopsWork:"defect_work_impact", wrDefectUrgency:"defect_urgency", wrDefectCalledMechanic:"called_mechanic_by_phone"
    }).forEach(([id,key]) => { if ($("#"+id)) $("#"+id).value = d[key] || ""; });
    updateLeaveRequestVisibility();
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function formatCapacityM3(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/m\s*(³|3)|kub|kubic/i.test(raw)) return raw;
  return `${raw} m³`;
}



let lastWorkerUiAuditText = "";

const WORKER_UI_PERMISSION_MAP = {
  daily_work: { label: "Ime gradilišta i datum/godina", window: "Osnovno: gradilište i datum", worker: true },
  workers: { label: "Radnici na gradilištu", window: "Radnici na gradilištu", worker: true },
  machines: { label: "Rad sa mašinom", window: "Mašina koju sam koristio", worker: true },
  vehicles: { label: "Rad sa kamionom / vozilom", window: "Vozilo / ture / m³", worker: true },
  lowloader: { label: "Prevoz mašine labudicom", window: "Labudica / prevoz mašine", worker: true },
  fuel: { label: "Sipanje goriva u svoju mašinu", window: "Sipanje goriva", worker: true },
  field_tanker: { label: "Tankanje goriva cisternom", window: "Tankanje goriva cisternom", worker: true },
  materials: { label: "Materijal", window: "Materijal", worker: true },
  leave_request: { label: "Zahtev za slobodan dan / godišnji odmor", window: "Slobodan dan / godišnji", worker: true },
  warehouse: { label: "Magacin", window: "Magacin", worker: true },
  defects: { label: "Prijava kvara", window: "Prijava kvara", worker: true },

  // Direkcijska prava nisu radnički prozori. Ako ih ima običan radnik, audit ih označava kao upozorenje.
  view_reports: { label: "Pregled izveštaja", window: "Direkcija: pregled izveštaja", worker: false },
  approve_reports: { label: "Odobravanje", window: "Direkcija: odobravanje", worker: false },
  excel_export: { label: "Izvoz u Excel", window: "Direkcija: Excel", worker: false },
  manage_people: { label: "Upravljanje osobama", window: "Direkcija: osobe", worker: false },
  settings: { label: "Podešavanja firme", window: "Direkcija: podešavanja", worker: false }
};

function permissionIsEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "yes";
}

function normalizePermissions(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  if (typeof raw === "object") return raw;
  return {};
}

function isLikelyWorkerUser(person, perms) {
  const title = `${person.function_title || ""} ${person.role || ""}`.toLowerCase();
  const hasWorkerPerm = Object.entries(perms).some(([key, value]) => permissionIsEnabled(value) && WORKER_UI_PERMISSION_MAP[key]?.worker);
  const hasDirectorPerm = Object.entries(perms).some(([key, value]) => permissionIsEnabled(value) && WORKER_UI_PERMISSION_MAP[key] && !WORKER_UI_PERMISSION_MAP[key].worker);
  if (title.includes("direkc") || title.includes("admin") || title.includes("direktor")) return false;
  return hasWorkerPerm || !hasDirectorPerm;
}

async function runWorkerUiAudit() {
  const box = $("#workerUiAuditResult");
  if (!box) return;
  try {
    if (!currentCompany?.id) {
      box.innerHTML = `<p class="muted">Prvo se prijavi kao Direkcija i učitaj firmu.</p>`;
      return;
    }

    box.innerHTML = `<p class="muted">Proveravam radničke prozore...</p>`;

    const { data, error } = await sb
      .from("company_users")
      .select("id, first_name, last_name, function_title, access_code, permissions, active")
      .eq("company_id", currentCompany.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const people = data || [];
    if (!people.length) {
      lastWorkerUiAuditText = "Nema aktivnih korisnika za proveru.";
      box.innerHTML = `<p class="muted">Nema aktivnih korisnika za proveru.</p>`;
      return;
    }

    const cards = [];
    const plain = [];
    let warningCount = 0;
    let okCount = 0;

    for (const person of people) {
      const perms = normalizePermissions(person.permissions);
      const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.access_code || "Korisnik";
      const enabledKeys = Object.entries(perms)
        .filter(([key, value]) => permissionIsEnabled(value) && key !== "allowed_material_ids" && key !== "allowed_material_names")
        .map(([key]) => key);

      const unknownKeys = enabledKeys.filter(key => !WORKER_UI_PERMISSION_MAP[key]);
      const workerWindows = [];
      const directorPerms = [];
      const duplicateWindows = [];
      const seenWindows = new Map();

      for (const key of enabledKeys) {
        const meta = WORKER_UI_PERMISSION_MAP[key];
        if (!meta) continue;
        if (meta.worker) {
          workerWindows.push(meta.window);
          if (seenWindows.has(meta.window)) duplicateWindows.push(meta.window);
          seenWindows.set(meta.window, true);
        } else {
          directorPerms.push(meta.label);
        }
      }

      const likelyWorker = isLikelyWorkerUser(person, perms);
      const issues = [];
      if (likelyWorker && directorPerms.length) issues.push(`Ima direkcijske dozvole: ${directorPerms.join(", ")}`);
      if (likelyWorker && !workerWindows.length) issues.push("Nema nijednu radničku rubriku za popunjavanje.");
      if (duplicateWindows.length) issues.push(`Duplirani prozori: ${[...new Set(duplicateWindows)].join(", ")}`);
      if (unknownKeys.length) issues.push(`Nepoznate/stare dozvole u profilu: ${unknownKeys.join(", ")}`);

      if (issues.length) warningCount += 1; else okCount += 1;

      const status = issues.length ? "⚠️ Proveriti" : "✅ OK";
      plain.push(`${fullName} (${person.access_code || "bez šifre"}) - ${status}`);
      plain.push(`Radnički prozori: ${workerWindows.join(" | ") || "nema"}`);
      if (issues.length) plain.push(`Upozorenja: ${issues.join("; ")}`);
      plain.push("---");

      cards.push(`
        <div class="item audit-person-card ${issues.length ? "audit-warning" : "audit-ok"}">
          <div class="item-main">
            <strong>${escapeHtml(fullName)}</strong>
            <small>${escapeHtml(person.function_title || "")} · šifra: ${escapeHtml(person.access_code || "")}</small><br/>
            <span class="pill">${status}</span>
            <span class="pill">${workerWindows.length} radnička prozora</span>
          </div>
          <div class="audit-details">
            <b>Treba da vidi:</b>
            <div>${workerWindows.length ? workerWindows.map(w => `<span class="pill">${escapeHtml(w)}</span>`).join(" ") : `<span class="muted">Nema radničkih prozora</span>`}</div>
            ${issues.length ? `<div class="audit-issues"><b>Upozorenja:</b><ul>${issues.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>` : `<p class="muted">Nema dupliranih/nebitnih prozora po dozvolama.</p>`}
          </div>
        </div>
      `);
    }

    lastWorkerUiAuditText = `PROVERA RADNIČKIH PROZORA\nFirma: ${currentCompany.name || currentCompany.company_code || ""}\nOK: ${okCount}\nZa proveru: ${warningCount}\n\n${plain.join("\n")}`;
    box.innerHTML = `
      <div class="audit-summary">
        <span class="pill">✅ OK: ${okCount}</span>
        <span class="pill">⚠️ Za proveru: ${warningCount}</span>
      </div>
      <div class="list">${cards.join("")}</div>
    `;
  } catch (e) {
    lastWorkerUiAuditText = `Greška u proveri: ${e.message}`;
    box.innerHTML = `<p class="error-text">Greška u proveri: ${escapeHtml(e.message)}</p>`;
    toast(e.message, true);
  }
}

async function copyWorkerUiAudit() {
  try {
    if (!lastWorkerUiAuditText) await runWorkerUiAudit();
    const text = lastWorkerUiAuditText || "Nema dijagnostike.";
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast("Dijagnostika kopirana.");
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("Dijagnostika kopirana.");
  } catch (e) {
    toast("Ne mogu da kopiram dijagnostiku: " + e.message, true);
  }
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
  // Radnik na terenu često skroluje preko forme. Native input[type=number]
  // u Chrome/Edge može sam da promeni vrednost (npr. 4,5 -> 4,51) preko
  // točkića/trackpad-a ili strelica. Zato sva numerička polja zaključavamo
  // kao tekstualni unos sa decimalnom tastaturom. Parsiranje već podržava
  // i zarez i tačku preko parseDecimalInput().
  root.querySelectorAll('input[type="number"], input.numeric-text').forEach(input => {
    if (input.type === "number") {
      input.type = "text";
      input.inputMode = "decimal";
      input.classList.add("numeric-text");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("data-fixed-number", "1");
    }
    if (input.dataset.noWheelBound === "1") return;
    input.dataset.noWheelBound = "1";
    input.addEventListener("wheel", (event) => {
      event.preventDefault();
      input.blur();
    }, { passive: false });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
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
const SMART_EXPORT_KEY = "swp_smart_export_settings";

const EXPORT_COLUMNS = [
  { key:"date", label:"Datum" },
  { key:"worker", label:"Radnik koji šalje izveštaj" },
  { key:"function", label:"Radno mesto" },
  { key:"site", label:"Gradilište" },
  { key:"hours", label:"Ukupno sati rada" },
  { key:"description", label:"Šta je rađeno" },
  { key:"crew_worker", label:"Ime radnika na gradilištu" },
  { key:"crew_hours", label:"Sati tog radnika" },
  { key:"machine_code", label:"Broj mašine" },
  { key:"machine", label:"Mašina" },
  { key:"machine_start", label:"Početno stanje MTČ/KM" },
  { key:"machine_end", label:"Krajnje stanje MTČ/KM" },
  { key:"machine_hours", label:"Ukupno sati mašine" },
  { key:"machine_work", label:"Šta je mašina radila" },
  { key:"vehicle_code", label:"Broj vozila" },
  { key:"vehicle", label:"Vozilo / kamion" },
  { key:"registration", label:"Registracija" },
  { key:"capacity", label:"Kapacitet vozila m³" },
  { key:"km_start", label:"Početna kilometraža" },
  { key:"km_end", label:"Krajnja kilometraža" },
  { key:"route", label:"Relacija vožnje" },
  { key:"tours", label:"Broj tura" },
  { key:"cubic", label:"Ukupno m³" },
  { key:"lowloader_plates", label:"Tablice labudice" },
  { key:"lowloader_from", label:"Gradilište sa kog je mašina preuzeta" },
  { key:"lowloader_to", label:"Gradilište gde je mašina odvezena" },
  { key:"lowloader_km_start", label:"Početna kilometraža labudice" },
  { key:"lowloader_km_end", label:"Završna kilometraža labudice" },
  { key:"lowloader_km", label:"Kilometara sa labudicom" },
  { key:"lowloader_machine", label:"Prevezena mašina" },
  { key:"fuel_type", label:"Tip sredstva" },
  { key:"fuel_asset_code", label:"Broj sredstva" },
  { key:"fuel_for", label:"Naziv sredstva" },
  { key:"fuel_registration", label:"Registracija" },
  { key:"fuel_liters", label:"Litara" },
  { key:"fuel_km", label:"KM" },
  { key:"fuel_mtc", label:"MTČ" },
  { key:"fuel_by", label:"Gorivo sipao" },
  { key:"fuel_receiver", label:"Gorivo primio" },
  { key:"field_tanker_site", label:"Gradilište gde je sipano gorivo" },
  { key:"field_tanker_type", label:"Tip tankovanog sredstva" },
  { key:"field_tanker_asset_code", label:"Broj tankovanog sredstva" },
  { key:"field_tanker_asset", label:"Naziv tankovanog sredstva" },
  { key:"field_tanker_registration", label:"Registracija" },
  { key:"field_tanker_km", label:"KM pri tankovanju cisternom" },
  { key:"field_tanker_mtc", label:"MTČ pri tankovanju cisternom" },
  { key:"field_tanker_liters", label:"Sipano litara iz cisterne" },
  { key:"field_tanker_receiver", label:"Gorivo primio iz cisterne" },
  { key:"material_action", label:"Radnja sa materijalom" },
  { key:"material", label:"Materijal" },
  { key:"quantity", label:"Količina" },
  { key:"unit", label:"Jedinica" },
  { key:"material_note", label:"Napomena za materijal" },
  { key:"warehouse_type", label:"Magacin tip" },
  { key:"warehouse_item", label:"Magacin stavka" },
  { key:"warehouse_qty", label:"Magacin količina" },
  { key:"leave_type", label:"Vrsta odsustva" },
  { key:"leave_date", label:"Datum slobodnog dana" },
  { key:"leave_from", label:"Godišnji od" },
  { key:"leave_to", label:"Godišnji do" },
  { key:"leave_note", label:"Napomena za odsustvo" },
  { key:"defect_type", label:"Tip sredstva u kvaru" },
  { key:"defect_asset_code", label:"Broj sredstva u kvaru" },
  { key:"defect_asset", label:"Naziv sredstva u kvaru" },
  { key:"defect_registration", label:"Registracija sredstva" },
  { key:"defect_site", label:"Lokacija kvara" },
  { key:"defect", label:"Opis kvara" },
  { key:"defect_work_impact", label:"Uticaj na rad" },
  { key:"defect_urgency", label:"Hitnost" },
  { key:"defect_called_mechanic", label:"Pozvan šef mehanizacije" },
  { key:"defect_status", label:"Status kvara" },
  { key:"status", label:"Status izveštaja" }
];

const SIMPLE_EXPORT_KEYS = [
  "date", "worker", "site", "description", "hours",
  "machine", "vehicle", "tours", "cubic", "fuel_liters",
  "defect", "status"
];

const EXPORT_GROUPS = [
  {
    id: "basic",
    title: "Osnovni podaci",
    hint: "Ko je poslao izveštaj, gde je radio i šta je urađeno.",
    keys: ["date", "worker", "function", "site", "hours", "description"]
  },
  {
    id: "crew",
    title: "Radnici na gradilištu",
    hint: "Radnici koje je šef uneo i koliko su sati radili.",
    keys: ["crew_worker", "crew_hours"]
  },
  {
    id: "machines",
    title: "Mašine",
    hint: "Bager, valjak, buldozer i druga mehanizacija.",
    keys: ["machine_code", "machine", "machine_start", "machine_end", "machine_hours", "machine_work"]
  },
  {
    id: "vehicles",
    title: "Vozila / kamioni",
    hint: "Kamioni, kilometraža, relacija, ture i kubici.",
    keys: ["vehicle_code", "vehicle", "registration", "capacity", "km_start", "km_end", "route", "tours", "cubic"]
  },
  {
    id: "fuel",
    title: "Sipanje goriva",
    hint: "Gorivo koje je radnik sipao u svoju mašinu ili vozilo.",
    keys: ["fuel_type", "fuel_asset_code", "fuel_for", "fuel_registration", "fuel_liters", "fuel_km", "fuel_mtc", "fuel_by", "fuel_receiver"]
  },
  {
    id: "lowloader",
    title: "Prevoz mašine labudicom",
    hint: "Selidba mašine sa jedne lokacije na drugu.",
    keys: ["lowloader_plates", "lowloader_from", "lowloader_to", "lowloader_km_start", "lowloader_km_end", "lowloader_km", "lowloader_machine"]
  },
  {
    id: "fieldTanker",
    title: "Tankanje goriva cisternom",
    hint: "Cisterna koja na terenu sipa gorivo drugim mašinama/vozilima.",
    keys: ["field_tanker_site", "field_tanker_type", "field_tanker_asset_code", "field_tanker_asset", "field_tanker_registration", "field_tanker_km", "field_tanker_mtc", "field_tanker_liters", "field_tanker_receiver"]
  },
  {
    id: "material",
    title: "Materijal",
    hint: "Materijal, količina i jedinica mere.",
    keys: ["material_action", "material", "quantity", "unit", "material_note"]
  },
  {
    id: "warehouse",
    title: "Magacin",
    hint: "Ulaz/izlaz/stanje u magacinu ako radnik ima tu rubriku.",
    keys: ["warehouse_type", "warehouse_item", "warehouse_qty"]
  },
  {
    id: "leave",
    title: "Zahtev za slobodan dan / godišnji odmor",
    hint: "Zahtevi radnika za slobodan dan ili godišnji odmor.",
    keys: ["leave_type", "leave_date", "leave_from", "leave_to", "leave_note"]
  },
  {
    id: "defects",
    title: "Kvarovi",
    hint: "Kratak prikaz kvara ako se izvozi zajedno sa dnevnim izveštajem.",
    keys: ["defect_type", "defect_asset_code", "defect_asset", "defect_registration", "defect_site", "defect", "defect_work_impact", "defect_urgency", "defect_called_mechanic", "defect_status"]
  },
  {
    id: "status",
    title: "Status i napomene",
    hint: "Status izveštaja i dodatna napomena.",
    keys: ["status"]
  }
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

window.applySimpleExportColumns = () => {
  setExportColumnKeys(SIMPLE_EXPORT_KEYS);
  renderExportPanel();
  toast("Uključen je jednostavan Excel prikaz.");
};

window.applyDetailedExportColumns = () => {
  setExportColumnKeys(EXPORT_COLUMNS.map(c => c.key));
  renderExportPanel();
  toast("Uključen je detaljan Excel prikaz.");
};

window.selectExportGroup = (groupId) => {
  const group = EXPORT_GROUPS.find(g => g.id === groupId);
  if (!group) return;
  const current = getExportColumnKeys();
  setExportColumnKeys(Array.from(new Set([...current, ...group.keys])));
  renderExportPanel();
};

window.clearExportGroup = (groupId) => {
  const group = EXPORT_GROUPS.find(g => g.id === groupId);
  if (!group) return;
  const remove = new Set(group.keys);
  setExportColumnKeys(getExportColumnKeys().filter(k => !remove.has(k)));
  renderExportPanel();
};

function getSelectedReportsForExport() {
  const ids = getExportSelectedIds();
  if (!ids.length) return [];
  const set = new Set(ids);
  return directorReportsCache.filter(r => set.has(r.id));
}

function reportPersonName(r) {
  return r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : ((r.data || {}).created_by_worker || (r.data || {}).worker_name || "");
}

function flattenReportRowsForExport(r) {
  const d = r.data || {};
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : []);
  const leaveRequest = d.leave_request || {};
  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, fuels.length, fieldTankers.length, materials.length);
  const rows = [];

  for (let i = 0; i < maxRows; i++) {
    const w = workers[i] || {};
    const m = machines[i] || {};
    const v = vehicles[i] || {};
    const ll = lowloaders[i] || {};
    const f = fuels[i] || {};
    const ft = fieldTankers[i] || {};
    const mat = materials[i] || {};
    rows.push({
      date: r.report_date || "",
      worker: reportPersonName(r),
      function: r.company_users?.function_title || "",
      site: d.site_name || "",
      hours: d.hours || "",
      description: d.description || "",
      crew_worker: w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || "",
      crew_hours: w.hours || "",
      machine_code: m.asset_code || m.machine_code || "",
      machine: m.name || d.machine || "",
      machine_start: m.start || d.mtc_start || "",
      machine_end: m.end || d.mtc_end || "",
      machine_hours: m.hours || d.machine_hours || "",
      machine_work: m.work || "",
      vehicle_code: v.asset_code || v.vehicle_code || "",
      vehicle: v.name || v.vehicle || d.vehicle || "",
      registration: v.registration || "",
      capacity: v.capacity || "",
      km_start: v.km_start || d.km_start || "",
      km_end: v.km_end || d.km_end || "",
      route: v.route || d.route || "",
      tours: v.tours || d.tours || "",
      cubic: v.cubic_m3 || v.cubic_auto || "",
      lowloader_plates: ll.plates || ll.registration || "",
      lowloader_from: ll.from_site || ll.from_address || "",
      lowloader_to: ll.to_site || ll.to_address || "",
      lowloader_km_start: ll.km_start || "",
      lowloader_km_end: ll.km_end || "",
      lowloader_km: ll.km_total || "",
      lowloader_machine: ll.machine || "",
      fuel_type: assetKindLabel(f.asset_kind),
      fuel_asset_code: f.asset_code || "",
      fuel_for: f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || "",
      fuel_registration: f.asset_registration || f.registration || "",
      fuel_liters: f.liters || d.fuel_liters || "",
      fuel_km: f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || d.fuel_km || "",
      fuel_mtc: f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || d.fuel_mtc || "",
      fuel_by: f.by || "",
      fuel_receiver: f.receiver || d.fuel_receiver || "",
      field_tanker_site: ft.site_name || "",
      field_tanker_type: assetKindLabel(ft.asset_kind),
      field_tanker_asset_code: ft.asset_code || "",
      field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
      field_tanker_registration: ft.asset_registration || ft.registration || "",
      field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_liters: ft.liters || "",
      field_tanker_receiver: ft.receiver || ft.received_by || "",
      material_action: mat.action || mat.material_action || "",
      material: mat.material || mat.name || d.material || "",
      quantity: mat.quantity || mat.qty || d.quantity || "",
      unit: mat.unit || d.unit || "",
      material_note: mat.note || "",
      warehouse_type: d.warehouse_type || "",
      warehouse_item: d.warehouse_item || "",
      warehouse_qty: d.warehouse_qty || "",
      leave_type: d.leave_request_type || leaveRequest.leave_label || leaveRequest.label || "",
      leave_date: d.leave_date || leaveRequest.leave_date || leaveRequest.date || "",
      leave_from: d.leave_from || leaveRequest.date_from || "",
      leave_to: d.leave_to || leaveRequest.date_to || "",
      leave_note: d.leave_note || leaveRequest.leave_note || leaveRequest.note || "",
      defect_type: assetKindLabel(d.defect_asset_kind),
      defect_asset_code: d.defect_asset_code || "",
      defect_asset: d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || "",
      defect_registration: d.defect_asset_registration || "",
      defect_site: d.defect_site_name || d.site_name || "",
      defect: d.defect || "",
      defect_work_impact: defectImpactLabel(d.defect_work_impact),
      defect_urgency: d.defect_urgency || "",
      defect_called_mechanic: d.called_mechanic_by_phone || d.defect_called_mechanic || "",
      defect_status: d.defect_status || "",
      status: r.status || ""
    });
  }

  return rows;
}


const SMART_EXPORT_PRESETS = {
  all: {
    title: "Sve iz izabranih izveštaja",
    keys: EXPORT_COLUMNS.map(c => c.key)
  },
  fuel_all: {
    title: "Sva sipanja goriva",
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","field_tanker_site","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  fuel_own: {
    title: "Sipanje goriva u svoju mašinu/vozilo/opremu",
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","status"]
  },
  fuel_tanker: {
    title: "Tankanje goriva cisternom",
    keys: ["date","worker","site","field_tanker_site","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  hours_workers: {
    title: "Radni sati radnika",
    keys: ["date","site","worker","function","hours","description","crew_worker","crew_hours","status"]
  },
  machines: {
    title: "Rad mašina / MTČ",
    keys: ["date","site","worker","machine_code","machine","machine_start","machine_end","machine_hours","machine_work","status"]
  },
  vehicles: {
    title: "Vozila / ture / m³",
    keys: ["date","site","worker","vehicle_code","vehicle","registration","capacity","km_start","km_end","route","tours","cubic","status"]
  },
  lowloader: {
    title: "Prevoz mašine labudicom",
    keys: ["date","site","worker","lowloader_plates","lowloader_from","lowloader_to","lowloader_km_start","lowloader_km_end","lowloader_km","lowloader_machine","status"]
  },
  materials: {
    title: "Materijal",
    keys: ["date","site","worker","material_action","material","quantity","unit","material_note","status"]
  },
  warehouse: {
    title: "Magacin",
    keys: ["date","site","worker","warehouse_type","warehouse_item","warehouse_qty","status"]
  },
  leave: {
    title: "Slobodni dani / godišnji",
    keys: ["date","site","worker","leave_type","leave_date","leave_from","leave_to","leave_note","status"]
  },
  defects: {
    title: "Kvarovi",
    keys: ["date","site","worker","defect_type","defect_asset_code","defect_asset","defect_registration","defect_site","defect","defect_work_impact","defect_urgency","defect_called_mechanic","defect_status","status"]
  }
};

function getSmartExportSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SMART_EXPORT_KEY) || "{}");
    return {
      type: saved.type || "all",
      from: saved.from || "",
      to: saved.to || "",
      site: saved.site || "",
      worker: saved.worker || ""
    };
  } catch {
    return { type:"all", from:"", to:"", site:"", worker:"" };
  }
}

function setSmartExportSettings(settings) {
  const clean = {
    type: settings.type || "all",
    from: settings.from || "",
    to: settings.to || "",
    site: settings.site || "",
    worker: settings.worker || ""
  };
  localStorage.setItem(SMART_EXPORT_KEY, JSON.stringify(clean));
  return clean;
}

function smartExportReportMatches(r, settings) {
  const d = r.data || {};
  const date = String(r.report_date || "").slice(0, 10);
  if (settings.from && date && date < settings.from) return false;
  if (settings.to && date && date > settings.to) return false;
  const siteQ = normalizeSearch(settings.site || "");
  if (siteQ) {
    const siteText = normalizeSearch([d.site_name, d.site, r.site_name].filter(Boolean).join(" "));
    if (!siteText.includes(siteQ)) return false;
  }
  const workerQ = normalizeSearch(settings.worker || "");
  if (workerQ) {
    const workerText = normalizeSearch([
      reportPersonName(r),
      r.company_users?.first_name,
      r.company_users?.last_name,
      r.company_users?.function_title,
      d.created_by_worker,
      d.worker_name,
      d.access_code,
      d.worker_code
    ].filter(Boolean).join(" "));
    if (!workerText.includes(workerQ)) return false;
  }
  return true;
}

function baseExportRow(r) {
  const d = r.data || {};
  return {
    date: r.report_date || "",
    worker: reportPersonName(r),
    function: r.company_users?.function_title || "",
    site: d.site_name || "",
    hours: d.hours || "",
    description: d.description || "",
    status: r.status || "",
    note: d.note || ""
  };
}

function smartRowsForReport(r, type) {
  if (!type || type === "all") return flattenReportRowsForExport(r);
  const d = r.data || {};
  const base = baseExportRow(r);
  const rows = [];
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : []);
  const leaveRequest = d.leave_request || {};

  if (type === "fuel_all" || type === "fuel_own") {
    fuels.forEach(f => rows.push({
      ...base,
      fuel_type: assetKindLabel(f.asset_kind),
      fuel_asset_code: f.asset_code || "",
      fuel_for: f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || "",
      fuel_registration: f.asset_registration || f.registration || "",
      fuel_liters: f.liters || d.fuel_liters || "",
      fuel_km: f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || d.fuel_km || "",
      fuel_mtc: f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || d.fuel_mtc || "",
      fuel_by: f.by || "",
      fuel_receiver: f.receiver || d.fuel_receiver || ""
    }));
  }

  if (type === "fuel_all" || type === "fuel_tanker") {
    fieldTankers.forEach(ft => rows.push({
      ...base,
      field_tanker_site: ft.site_name || d.site_name || "",
      field_tanker_type: assetKindLabel(ft.asset_kind),
      field_tanker_asset_code: ft.asset_code || "",
      field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
      field_tanker_registration: ft.asset_registration || ft.registration || "",
      field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_liters: ft.liters || "",
      field_tanker_receiver: ft.receiver || ft.received_by || ""
    }));
  }

  if (type === "hours_workers") {
    if (workers.length) {
      workers.forEach(w => rows.push({
        ...base,
        crew_worker: w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || "",
        crew_hours: w.hours || ""
      }));
    } else if (base.hours || base.description) {
      rows.push(base);
    }
  }

  if (type === "machines") {
    machines.forEach(m => rows.push({
      ...base,
      machine_code: m.asset_code || m.machine_code || "",
      machine: m.name || d.machine || "",
      machine_start: m.start || d.mtc_start || "",
      machine_end: m.end || d.mtc_end || "",
      machine_hours: m.hours || d.machine_hours || "",
      machine_work: m.work || ""
    }));
  }

  if (type === "vehicles") {
    vehicles.forEach(v => rows.push({
      ...base,
      vehicle_code: v.asset_code || v.vehicle_code || "",
      vehicle: v.name || v.vehicle || d.vehicle || "",
      registration: v.registration || "",
      capacity: v.capacity || "",
      km_start: v.km_start || d.km_start || "",
      km_end: v.km_end || d.km_end || "",
      route: v.route || d.route || "",
      tours: v.tours || d.tours || "",
      cubic: v.cubic_m3 || v.cubic_auto || ""
    }));
  }

  if (type === "lowloader") {
    lowloaders.forEach(ll => rows.push({
      ...base,
      lowloader_plates: ll.plates || ll.registration || "",
      lowloader_from: ll.from_site || ll.from_address || "",
      lowloader_to: ll.to_site || ll.to_address || "",
      lowloader_km_start: ll.km_start || "",
      lowloader_km_end: ll.km_end || "",
      lowloader_km: ll.km_total || "",
      lowloader_machine: ll.machine || ""
    }));
  }

  if (type === "materials") {
    materials.forEach(mat => rows.push({
      ...base,
      material_action: mat.action || mat.material_action || "",
      material: mat.material || mat.name || d.material || "",
      quantity: mat.quantity || mat.qty || d.quantity || "",
      unit: mat.unit || d.unit || "",
      material_note: mat.note || ""
    }));
  }

  if (type === "warehouse") {
    if (d.warehouse_type || d.warehouse_item || d.warehouse_qty) {
      rows.push({
        ...base,
        warehouse_type: d.warehouse_type || "",
        warehouse_item: d.warehouse_item || "",
        warehouse_qty: d.warehouse_qty || ""
      });
    }
  }

  if (type === "leave") {
    if (d.leave_request_type || d.leave_date || d.leave_from || d.leave_to || leaveRequest.label || leaveRequest.leave_label) {
      rows.push({
        ...base,
        leave_type: d.leave_request_type || leaveRequest.leave_label || leaveRequest.label || "",
        leave_date: d.leave_date || leaveRequest.leave_date || leaveRequest.date || "",
        leave_from: d.leave_from || leaveRequest.date_from || "",
        leave_to: d.leave_to || leaveRequest.date_to || "",
        leave_note: d.leave_note || leaveRequest.leave_note || leaveRequest.note || ""
      });
    }
  }

  if (type === "defects") {
    if (d.defect || d.defect_description || d.problem_description || d.defect_asset_name || d.defect_asset_code) {
      rows.push({
        ...base,
        defect_type: assetKindLabel(d.defect_asset_kind),
        defect_asset_code: d.defect_asset_code || "",
        defect_asset: d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || "",
        defect_registration: d.defect_asset_registration || "",
        defect_site: d.defect_site_name || d.site_name || "",
        defect: d.defect || d.defect_description || d.problem_description || "",
        defect_work_impact: defectImpactLabel(d.defect_work_impact),
        defect_urgency: d.defect_urgency || "",
        defect_called_mechanic: d.called_mechanic_by_phone || d.defect_called_mechanic || "",
        defect_status: d.defect_status || ""
      });
    }
  }

  return rows;
}

window.applySmartExportFilters = () => {
  const settings = setSmartExportSettings({
    type: $("#smartExportType")?.value || "all",
    from: $("#smartExportFrom")?.value || "",
    to: $("#smartExportTo")?.value || "",
    site: $("#smartExportSite")?.value || "",
    worker: $("#smartExportWorker")?.value || ""
  });
  const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
  const reports = directorReportsCache.filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r)).filter(r => smartExportReportMatches(r, settings));
  setExportSelectedIds(reports.map(r => r.id));
  setExportColumnKeys(preset.keys);
  renderExportPanel();
  const info = $("#smartExportInfo");
  const rowsCount = reports.flatMap(r => smartRowsForReport(r, settings.type)).length;
  if (info) info.textContent = `${preset.title}: izabrano ${reports.length} izveštaja, ${rowsCount} redova za Excel.`;
  toast(`Pripremljen export: ${preset.title}. Izveštaja: ${reports.length}.`);
};

window.clearSmartExportFilters = () => {
  setSmartExportSettings({ type:"all", from:"", to:"", site:"", worker:"" });
  ["#smartExportType", "#smartExportFrom", "#smartExportTo", "#smartExportSite", "#smartExportWorker"].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.value = sel === "#smartExportType" ? "all" : "";
  });
  const info = $("#smartExportInfo");
  if (info) info.textContent = "Filter je očišćen. Možeš ručno birati izveštaje i kolone.";
  toast("Filter za poseban Excel je očišćen.");
};

function restoreSmartExportControls() {
  const settings = getSmartExportSettings();
  if ($("#smartExportType")) $("#smartExportType").value = settings.type;
  if ($("#smartExportFrom")) $("#smartExportFrom").value = settings.from;
  if ($("#smartExportTo")) $("#smartExportTo").value = settings.to;
  if ($("#smartExportSite")) $("#smartExportSite").value = settings.site;
  if ($("#smartExportWorker")) $("#smartExportWorker").value = settings.worker;
}

function getExportRowsAndColumns() {
  const reports = getSelectedReportsForExport();
  const settings = getSmartExportSettings();
  const type = settings.type || "all";
  const keys = getExportColumnKeys();
  const columns = EXPORT_COLUMNS.filter(c => keys.includes(c.key));
  const rows = reports
    .filter(r => smartExportReportMatches(r, settings))
    .flatMap(r => smartRowsForReport(r, type));
  return { reports, columns, rows };
}

function renderExportPanel() {
  const box = $("#exportSelectedReportsBox");
  const colsBox = $("#exportColumnsBox");
  const countBox = $("#exportSelectedCount");
  if (!box || !colsBox) return;

  restoreSmartExportControls();
  const selected = getSelectedReportsForExport();
  const selectedIds = new Set(selected.map(r => r.id));
  const keys = getExportColumnKeys();
  const settings = getSmartExportSettings();
  const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
  const exportRowsCount = selected.filter(r => smartExportReportMatches(r, settings)).flatMap(r => smartRowsForReport(r, settings.type)).length;

  if (countBox) countBox.textContent = `${selected.length} izveštaja označeno · ${exportRowsCount} redova · ${preset.title}`;

  box.innerHTML = selected.length ? selected.map(r => {
    const d = r.data || {};
    return `<div class="export-selected-item">
      <b>${escapeHtml(r.report_date || "bez datuma")}</b>
      <span>${escapeHtml(reportPersonName(r) || "Nepoznat radnik")}</span>
      <small>${escapeHtml(d.site_name || "bez gradilišta")} · ${escapeHtml(r.status || "")}</small>
      <button class="secondary small-btn" type="button" onclick="toggleReportExportSelection('${r.id}', false); const cb=document.querySelector('[onchange*=\'${r.id}\']'); if(cb) cb.checked=false;">Ukloni</button>
    </div>`;
  }).join("") : `<p class="muted">Nema izabranih izveštaja. Idi u tab Izveštaji i štikliraj šta želiš za Excel.</p>`;

  const columnByKey = Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, c]));
  colsBox.innerHTML = EXPORT_GROUPS.map(group => {
    const selectedInGroup = group.keys.filter(k => keys.includes(k)).length;
    const totalInGroup = group.keys.length;
    const checks = group.keys.map(key => {
      const c = columnByKey[key];
      if (!c) return "";
      return `<label class="export-column-check">
        <input type="checkbox" ${keys.includes(c.key) ? "checked" : ""} onchange="toggleExportColumn('${c.key}', this.checked)" />
        ${escapeHtml(c.label)}
      </label>`;
    }).join("");
    return `<div class="export-column-group">
      <div class="export-group-head">
        <div>
          <h5>${escapeHtml(group.title)}</h5>
          <p>${escapeHtml(group.hint)}</p>
          <small>${selectedInGroup}/${totalInGroup} rubrika označeno</small>
        </div>
        <div class="row compact">
          <button class="secondary small-btn" type="button" onclick="selectExportGroup('${group.id}')">Označi grupu</button>
          <button class="secondary small-btn" type="button" onclick="clearExportGroup('${group.id}')">Poništi grupu</button>
        </div>
      </div>
      <div class="export-columns-grid">${checks}</div>
    </div>`;
  }).join("");

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
    const defectAsset = getDefectAssetPayload();
    const defectAssetName = defectAsset.defect_asset_name || defectAsset.defect_manual_asset_name || "";
    const defectImpact = getDefectImpactPayload();
    const selectedDefectSite = getSelectedWorkerSite ? getSelectedWorkerSite() : {};
    const defectSiteName = $("#wrDefectSiteName")?.value.trim() || selectedDefectSite.site_name || "";

    if (!defectText && !defectAssetName) {
      throw new Error("Upiši sredstvo u kvaru ili opis kvara.");
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
      ...defectAsset,
      defect_machine: defectAssetName,
      defect_site_name: defectSiteName,
      machines,
      defect_exists: "da",
      defect: defectText,
      ...defectImpact,
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
    if (btn.dataset.tab === "audit") runWorkerUiAudit();
  }));
  $("#addPersonBtn").addEventListener("click", savePersonForm);
  if ($("#cancelEditPersonBtn")) $("#cancelEditPersonBtn").addEventListener("click", clearPersonForm);
  bindPersonPreviewEvents();

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
  if ($("#runWorkerUiAuditBtn")) $("#runWorkerUiAuditBtn").addEventListener("click", runWorkerUiAudit);
  if ($("#copyWorkerUiAuditBtn")) $("#copyWorkerUiAuditBtn").addEventListener("click", copyWorkerUiAudit);
  if ($("#exportCsvBtn")) $("#exportCsvBtn").addEventListener("click", exportCsv);
  if ($("#exportXlsBtn")) $("#exportXlsBtn").addEventListener("click", exportExcelFile);
  if ($("#copyExcelBtn")) $("#copyExcelBtn").addEventListener("click", copyExportTableForExcel);
  if ($("#simpleExportBtn")) $("#simpleExportBtn").addEventListener("click", applySimpleExportColumns);
  if ($("#detailedExportBtn")) $("#detailedExportBtn").addEventListener("click", applyDetailedExportColumns);
  if ($("#selectAllColumnsBtn")) $("#selectAllColumnsBtn").addEventListener("click", selectAllExportColumns);
  if ($("#clearColumnsBtn")) $("#clearColumnsBtn").addEventListener("click", clearExportColumns);

  // Add mašina / gorivo koriste onclick direktno u HTML-u zbog pouzdanosti na mobilnom/PWA cache-u.
  if ($("#sendDefectNowBtn")) $("#sendDefectNowBtn").addEventListener("click", sendDefectNow);
  if ($("#memorizeFieldTankerBtn")) $("#memorizeFieldTankerBtn").addEventListener("click", memorizeCurrentFieldTankerEntries);
  if ($("#sendStoredFieldTankerBtn")) $("#sendStoredFieldTankerBtn").addEventListener("click", sendStoredFieldTankerEntries);
  if ($("#clearStoredFieldTankerBtn")) $("#clearStoredFieldTankerBtn").addEventListener("click", clearStoredFieldTankerEntries);

  if ($("#workerLoginBtn")) $("#workerLoginBtn").addEventListener("click", loginWorkerByCode);

  $("#workerLogoutBtn").addEventListener("click", () => {
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_draft");
    currentWorker = null;
    setInternalHeader("", "", false);
    show("WorkerLogin");
  });

  $("#saveDraftBtn").addEventListener("click", saveDraft);
  if ($("#wrLeaveType")) $("#wrLeaveType").addEventListener("change", updateLeaveRequestVisibility);
  if ($("#wrDefectAssetName")) {
    $("#wrDefectAssetName").addEventListener("input", updateDefectAssetSmartResult);
    $("#wrDefectAssetName").addEventListener("change", updateDefectAssetSmartResult);
  }

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
      const reportDate = $("#wrDate").value || today();
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: reportDate,
        p_site_id: data.site_id || null,
        p_data: data
      });
      if (error) throw error;
      await verifyRecentlySubmittedReport(worker, reportDate);
      await prepareWorkerFormForNextReport();
      toast("Izveštaj je poslat Direkciji ✅ Forma je spremna za sledeći unos.");
    } catch(e) { toast(e.message, true); }
  });
}

async function openWorkerForm() {
  $("#wrDate").value = today();
  $("#workerHello").textContent = `Dobrodošli, ${currentWorker.full_name}`;
  $("#workerCompanyLabel").textContent = `${currentWorker.company_name} · ${currentWorker.function_title}`;
  workerSetSections(currentWorker.permissions || {});
  setInternalHeader("Terenski unos", `${currentWorker?.full_name || "Radnik"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  show("WorkerForm");
  await Promise.all([loadWorkerSites(), loadWorkerAssets(), loadWorkerMaterials()]);
  loadDraft();
  loadWorkerReturnedReports();
  const perms = currentWorker.permissions || {};
  if (perms.workers && $("#workerEntries") && !$("#workerEntries").children.length) addWorkerEntry();
  if (perms.machines && $("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if (perms.vehicles && $("#vehicleEntries") && !$("#vehicleEntries").children.length) addVehicleEntry();
  if (perms.lowloader && $("#lowloaderEntries") && !$("#lowloaderEntries").children.length) addLowloaderEntry();
  if (perms.fuel && $("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
  if (perms.field_tanker && $("#fieldTankerEntries") && !$("#fieldTankerEntries").children.length) addFieldTankerEntry();
  renderStoredFieldTankerEntries();
  updateLeaveRequestVisibility();
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
  await prepareWorkerFormForNextReport();
  loadWorkerReturnedReports();
  toast("Ispravljen izveštaj je ponovo poslat Direkciji ✅ Forma je spremna za sledeći unos.");
  return true;
}
