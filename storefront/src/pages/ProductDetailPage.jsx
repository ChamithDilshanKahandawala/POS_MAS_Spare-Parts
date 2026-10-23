import { isMarketplace } from '../api/dataSource';
import ProductDetailPagePos from './ProductDetailPagePos';
import ProductDetailPageMarketplace from './ProductDetailPageMarketplace';

export default isMarketplace ? ProductDetailPageMarketplace : ProductDetailPagePos;
