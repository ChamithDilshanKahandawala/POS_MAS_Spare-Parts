import { isMarketplace } from '../api/dataSource';
import CustomerOrdersPagePos from './CustomerOrdersPagePos';
import CustomerOrdersPageMarketplace from './CustomerOrdersPageMarketplace';

export default isMarketplace ? CustomerOrdersPageMarketplace : CustomerOrdersPagePos;
