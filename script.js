/* START WORK PRO by AskCreate - MVP v1
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";

let sb = null;
let currentCompany = null;
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
  return (s || "").trim();
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
  await Promise.all([loadPeople(), loadSites(), loadAssets(), loadReports()]);
  return data;
}

async function loadPeople() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("company_users").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#peopleList").innerHTML = (data || []).map(p => `
    <div class="item">
      <strong>${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</strong>
      <small>${escapeHtml(p.function_title)} · kod: ${escapeHtml(p.access_code)}</small><br/>
      <span class="pill">${p.active ? "Aktivan" : "Neaktivan"}</span>
      <span class="pill">${Object.keys(p.permissions || {}).filter(k => p.permissions[k]).length} rubrika</span>
    </div>`).join("") || `<p class="muted">Nema dodatih osoba.</p>`;
}

async function loadSites() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("sites").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#sitesList").innerHTML = (data || []).map(s => `
    <div class="item"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.location || "")}</small></div>
  `).join("") || `<p class="muted">Nema gradilišta.</p>`;
}

async function loadAssets() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("assets").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  $("#assetsList").innerHTML = (data || []).map(a => `
    <div class="item"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.asset_type)} · ${escapeHtml(a.registration || "")} · ${escapeHtml(a.capacity || "")}</small></div>
  `).join("") || `<p class="muted">Nema mašina/vozila.</p>`;
}

async function loadReports() {
  if (!currentCompany) return;
  const { data, error } = await sb.from("reports").select("*, company_users(first_name,last_name,function_title)").eq("company_id", currentCompany.id).order("submitted_at", { ascending:false });
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
    <div class="item">
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
  const reason = prompt("Razlog vraćanja na dopunu:");
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
    called_mechanic_by_phone: $("#wrDefectCalledMechanic")?.value || "",
    note: $("#wrNote").value.trim()
  };
}

function clearWorkerForm() {
  ["wrSiteName","wrDescription","wrHours","wrVehicle","wrKmStart","wrKmEnd","wrRoute","wrTours","wrMaterial","wrQuantity","wrUnit","wrWarehouseType","wrWarehouseItem","wrWarehouseQty","wrDefectExists","wrDefect","wrDefectStopsWork","wrDefectCanContinue","wrDefectUrgency","wrDefectCalledMechanic","wrNote"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
  if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
  if ($("#wrDefectExists")) $("#wrDefectExists").value = "ne";
  localStorage.removeItem("swp_draft");
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
      wrSiteName:"site_name", wrDescription:"description", wrHours:"hours", wrVehicle:"vehicle", wrKmStart:"km_start", wrKmEnd:"km_end", wrRoute:"route", wrTours:"tours", wrMaterial:"material", wrQuantity:"quantity", wrUnit:"unit", wrWarehouseType:"warehouse_type", wrWarehouseItem:"warehouse_item", wrWarehouseQty:"warehouse_qty", wrDefectExists:"defect_exists", wrDefect:"defect", wrDefectStopsWork:"defect_stops_work", wrDefectCanContinue:"defect_can_continue", wrDefectUrgency:"defect_urgency", wrDefectCalledMechanic:"called_mechanic_by_phone", wrNote:"note"
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
      note: $("#wrNote")?.value.trim() || "",
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

function bindEvents() {
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

  $("#addPersonBtn").addEventListener("click", async () => {
    try {
      if (!currentCompany) throw new Error("Nema aktivne firme.");
      const code = normalizeCode($("#personCode").value);
      if (code.length < 4) throw new Error("Kod za ulaz mora imati najmanje 4 karaktera.");
      const { error } = await sb.from("company_users").insert({
        company_id: currentCompany.id,
        first_name: $("#personFirst").value.trim(),
        last_name: $("#personLast").value.trim(),
        function_title: $("#personFunction").value.trim(),
        access_code: code,
        permissions: collectPermissions(),
        active: true
      });
      if (error) throw error;
      ["personFirst","personLast","personFunction","personCode"].forEach(id => $("#"+id).value = "");
      toast("Osoba je dodata.");
      loadPeople();
    } catch(e) { toast(e.message, true); }
  });

  $("#addSiteBtn").addEventListener("click", async () => {
    try {
      const { error } = await sb.from("sites").insert({ company_id: currentCompany.id, name: $("#siteName").value.trim(), location: $("#siteLocation").value.trim() });
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

  $("#exportCsvBtn").addEventListener("click", exportCsv);

  // Add mašina / gorivo koriste onclick direktno u HTML-u zbog pouzdanosti na mobilnom/PWA cache-u.
  if ($("#sendDefectNowBtn")) $("#sendDefectNowBtn").addEventListener("click", sendDefectNow);

  $("#workerLoginBtn").addEventListener("click", async () => {
    try {
      if (!initSupabase()) return;
      const companyCode = $("#workerCompanyCode").value.trim();
      const accessCode = $("#workerAccessCode").value.trim();
      const { data, error } = await sb.rpc("worker_login", { p_company_code: companyCode, p_access_code: accessCode });
      if (error) throw error;
      if (!data || !data.length) throw new Error("Neispravna šifra firme ili kod za ulaz.");
      currentWorker = { ...data[0], company_code: companyCode, access_code: accessCode };
      localStorage.setItem("swp_worker", JSON.stringify(currentWorker));
      openWorkerForm();
    } catch(e) { toast(e.message, true); }
  });

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
  if ($("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if ($("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
}

async function boot() {
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
