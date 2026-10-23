import { isMarketplace } from '../api/dataSource';
import StorePagePos from './StorePagePos';
import StorePageMarketplace from './StorePageMarketplace';

export default isMarketplace ? StorePageMarketplace : StorePagePos;
