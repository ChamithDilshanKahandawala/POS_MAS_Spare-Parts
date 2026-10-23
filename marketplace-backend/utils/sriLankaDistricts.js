// The canonical 25-district list — same set storefront/'s CheckoutPage.jsx
// already hardcodes for POS-mode checkout. Kept here as the single
// source of truth for the marketplace side (customer addresses) so a
// future POS-mode/marketplace-mode merge has one real list to converge
// on, not two that have quietly drifted apart.
const SRI_LANKA_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara',
  'Moneragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

module.exports = { SRI_LANKA_DISTRICTS };
