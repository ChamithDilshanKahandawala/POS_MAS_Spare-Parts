import { isMarketplace } from '../api/dataSource';
import CategoryPagePos from './CategoryPagePos';
import CategoryPageMarketplace from './CategoryPageMarketplace';

export default isMarketplace ? CategoryPageMarketplace : CategoryPagePos;
