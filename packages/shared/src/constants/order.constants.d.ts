export declare const ORDER_STATUSES: readonly ["pending", "paid", "shipped", "delivered", "completed", "cancelled", "disputed", "resolved"];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
