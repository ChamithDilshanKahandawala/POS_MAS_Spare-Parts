// The "currently filtering by this vehicle" state — separate from a
// logged-in customer's saved vehicle LIST (marketplace-backend's
// /customer/vehicles, shown in My Account). This is the one, ambient
// selection that powers the home page's vehicle picker, the persistent
// "Showing parts for X — change/clear" bar, and the "Fits your vehicle"
// badge — works identically for a guest or a signed-in customer, and
// survives a refresh for both via localStorage (a customer's account-side
// saved list is additionally available to pick FROM, once they're
// logged in, but the active selection itself always lives here).
const KEY = 'storefrontSelectedVehicle';

export function getSelectedVehicle() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

// `vehicle`: { makeId, makeName, modelName, year } or null to clear.
export function setSelectedVehicle(vehicle) {
  try {
    if (vehicle) localStorage.setItem(KEY, JSON.stringify(vehicle));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / storage disabled — the selection just won't persist
    // across a refresh this session, nothing else breaks.
  }
}
