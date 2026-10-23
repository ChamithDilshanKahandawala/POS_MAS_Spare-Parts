import { isMarketplace } from '../api/dataSource';
import StorefrontPagePos from './StorefrontPagePos';
import StorefrontPageMarketplace from './StorefrontPageMarketplace';

// Milestone 5 — picks the pos-mode implementation (StorefrontPagePos.jsx,
// an exact, untouched copy of this page's pre-Milestone-5 content) or the
// new marketplace-mode one, based on the build-time VITE_DATA_SOURCE
// flag. App.jsx's import of this file is unchanged either way.
export default isMarketplace ? StorefrontPageMarketplace : StorefrontPagePos;
