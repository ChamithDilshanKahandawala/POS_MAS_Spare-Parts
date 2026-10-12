import { useEffect, useState } from 'react';
import { getStaleProductData, subscribeStaleProductData } from '../utils/staleDataSignal';

export default function useStaleProductData() {
  const [stale, setStale] = useState(getStaleProductData);
  useEffect(() => subscribeStaleProductData(setStale), []);
  return stale;
}
