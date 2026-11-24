export const ORDER_EXPIRY_MINUTES = Number(import.meta.env.VITE_ORDER_EXPIRY_MINUTES) || 10;
export const DEFAULT_RADIUS_KM = 5;
export const MAX_PRESCRIPTION_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_PRESCRIPTION_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
