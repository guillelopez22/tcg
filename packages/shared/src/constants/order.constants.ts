export const ORDER_STATUSES = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'resolved',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
