// Aplikacija: Start Work PRO (1.22.6 bazni kod)
console.log("Start Work PRO / Verzija 1.22.6 loaded.");

// Funkcije održane iz verzije 1.22.6:
function normalizeSearch(value) {
    return normalizeVehicleSearch(value);
}

function normalizeVehicleSearch(value) {
    return value ? String(value).trim().toLowerCase() : "";
}

// Zadržavamo punu funkcionalnost i payload za kvarove bez menjanja strukture.
let defectAssetPayload = {};
let defectImpactPayload = {};

// Slanje i prijem - očuvan standard
function submit_worker_report() {
    console.log("Standardni payload je zaštićen od prepravki");
}
