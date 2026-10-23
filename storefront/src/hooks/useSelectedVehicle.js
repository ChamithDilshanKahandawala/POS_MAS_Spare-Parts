import { useState, useCallback } from 'react';
import { getSelectedVehicle, setSelectedVehicle } from '../utils/selectedVehicle';

// Thin React wrapper around utils/selectedVehicle.js's localStorage pair —
// every page that reads/sets the active vehicle filter (home, category,
// search, product detail) uses this instead of touching localStorage
// directly, so they all read the same initial value and re-render
// together within one page when it changes.
export default function useSelectedVehicle() {
  const [vehicle, setVehicleState] = useState(() => getSelectedVehicle());

  const select = useCallback((next) => {
    setSelectedVehicle(next);
    setVehicleState(next);
  }, []);

  const clear = useCallback(() => {
    setSelectedVehicle(null);
    setVehicleState(null);
  }, []);

  return { vehicle, select, clear };
}
