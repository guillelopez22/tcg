import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { listings } from './listings';
import { orderStatusEnum } from './enums';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  quantity: integer('quantity').notNull().default(1),
  subtotalInCents: integer('subtotal_in_cents').notNull(),
  platformFeeInCents: integer('platform_fee_in_cents').notNull(),
  totalInCents: integer('total_in_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: orderStatusEnum('status').notNull().default('pending'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  shippingAddress: text('shipping_address'),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  notes: text('notes'),
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  disputeReason: text('dispute_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_orders_buyer_id').on(table.buyerId),
  index('idx_orders_seller_id').on(table.sellerId),
  index('idx_orders_listing_id').on(table.listingId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_stripe_pi').on(table.stripePaymentIntentId),
]);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
