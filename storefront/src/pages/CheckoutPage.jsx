import { isMarketplace } from '../api/dataSource';
import CheckoutPagePos from './CheckoutPagePos';
import CheckoutPageMarketplace from './CheckoutPageMarketplace';

export default isMarketplace ? CheckoutPageMarketplace : CheckoutPagePos;
