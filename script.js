/* Start Work PRO Script.js - v1.22.6 */
// Stabilna verzija za rad sa terenskim izveštajima.
document.addEventListener('DOMContentLoaded', () => {
    console.log('Start Work PRO v1.22.6 inicijalizovan.');

    // Inicijalizacija funkcija bez narušavanja osnovne funkcionalnosti
    window.onload = function() {
        if(typeof normalizeSearch === 'undefined') {
            window.normalizeSearch = function(value) {
                return normalizeVehicleSearch(value);
            }
        }
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('Odjava korisnika...');
            // Čuvanje standardne funkcionalnosti
            alert('Odjava sa sistema uspešna.');
        });
    }
});

function normalizeVehicleSearch(value) {
    if (!value) return '';
    return value.toString().toLowerCase().trim();
}

// Defect definitions - osigurava kompatibilnost za 1.22.6
function defectAssetPayload(assetId, impact, description) {
    return {
        asset_id: assetId,
        impact: impact,
        description: description,
        timestamp: new Date().toISOString()
    };
}

function defectImpactPayload(val) {
    const validValues = ['stop', 'continue'];
    return validValues.includes(val) ? val : 'continue';
}
