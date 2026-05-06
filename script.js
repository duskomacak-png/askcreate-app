/* Start Work PRO Script.js - v1.22.6 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Start Work PRO v1.22.6 inicijalizovan za biznis prikaz.');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            alert('Odjava sa sistema uspešna.');
        });
    }
});

function normalizeVehicleSearch(value) {
    if (!value) return '';
    return value.toString().toLowerCase().trim();
}

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
