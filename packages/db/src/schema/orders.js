"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orders = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const listings_1 = require("./listings");
const enums_1 = require("./enums");
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    buyerId: (0, pg_core_1.uuid)('buyer_id').notNull().references(() => users_1.users.id),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => users_1.users.id),
    listingId: (0, pg_core_1.uuid)('listing_id').notNull().references(() => listings_1.listings.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
    subtotalInCents: (0, pg_core_1.integer)('subtotal_in_cents').notNull(),
    platformFeeInCents: (0, pg_core_1.integer)('platform_fee_in_cents').notNull(),
    totalInCents: (0, pg_core_1.integer)('total_in_cents').notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    status: (0, enums_1.orderStatusEnum)('status').notNull().default('pending'),
    stripePaymentIntentId: (0, pg_core_1.varchar)('stripe_payment_intent_id', { length: 255 }),
    stripeTransferId: (0, pg_core_1.varchar)('stripe_transfer_id', { length: 255 }),
    shippingAddress: (0, pg_core_1.text)('shipping_address'),
    trackingNumber: (0, pg_core_1.varchar)('tracking_number', { length: 100 }),
    notes: (0, pg_core_1.text)('notes'),
    paidAt: (0, pg_core_1.timestamp)('paid_at'),
    shippedAt: (0, pg_core_1.timestamp)('shipped_at'),
    deliveredAt: (0, pg_core_1.timestamp)('delivered_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    cancelledAt: (0, pg_core_1.timestamp)('cancelled_at'),
    disputeReason: (0, pg_core_1.text)('dispute_reason'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_orders_buyer_id').on(table.buyerId),
    (0, pg_core_1.index)('idx_orders_seller_id').on(table.sellerId),
    (0, pg_core_1.index)('idx_orders_listing_id').on(table.listingId),
    (0, pg_core_1.index)('idx_orders_status').on(table.status),
    (0, pg_core_1.index)('idx_orders_stripe_pi').on(table.stripePaymentIntentId),
]);
