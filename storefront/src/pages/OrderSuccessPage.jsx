import { isMarketplace } from '../api/dataSource';
import OrderSuccessPagePos from './OrderSuccessPagePos';
import OrderSuccessPageMarketplace from './OrderSuccessPageMarketplace';

export default isMarketplace ? OrderSuccessPageMarketplace : OrderSuccessPagePos;
