-- ─────────────────────────────────────────────────────────────────────────────
-- Database-level integrity that Prisma cannot express declaratively.
-- Application validation is NOT a substitute: these constraints are the last line.
-- ─────────────────────────────────────────────────────────────────────────────

-- CHECK constraints -----------------------------------------------------------
ALTER TABLE "inventory_items"
  ADD CONSTRAINT inventory_non_negative CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "sold" >= 0 AND "returned" >= 0 AND "damaged" >= 0),
  ADD CONSTRAINT inventory_reserved_lte_on_hand CHECK ("reserved" <= "onHand");

ALTER TABLE "inventory_reservations" ADD CONSTRAINT reservation_qty_positive CHECK ("quantity" > 0);

ALTER TABLE "products"
  ADD CONSTRAINT product_price_non_negative CHECK ("price" >= 0),
  ADD CONSTRAINT product_compare_at_gte_price CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= "price"),
  ADD CONSTRAINT product_return_window_non_negative CHECK ("returnWindowDays" >= 0);

ALTER TABLE "product_variants" ADD CONSTRAINT variant_price_non_negative CHECK ("price" IS NULL OR "price" >= 0);

ALTER TABLE "cart_items" ADD CONSTRAINT cart_item_qty_positive CHECK ("quantity" > 0 AND "quantity" <= 999);
ALTER TABLE "order_items"
  ADD CONSTRAINT order_item_qty_positive CHECK ("quantity" > 0),
  ADD CONSTRAINT order_item_refunded_qty_bounds CHECK ("refundedQuantity" >= 0 AND "refundedQuantity" <= "quantity"),
  ADD CONSTRAINT order_item_returned_qty_bounds CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity"),
  ADD CONSTRAINT order_item_amounts_non_negative CHECK ("unitPrice" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND "lineTotal" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT order_totals_non_negative CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingTotal" >= 0 AND "taxTotal" >= 0 AND "grandTotal" >= 0 AND "refundedTotal" >= 0),
  ADD CONSTRAINT order_refunded_lte_total CHECK ("refundedTotal" <= "grandTotal");

ALTER TABLE "seller_orders"
  ADD CONSTRAINT seller_order_totals_non_negative CHECK ("subtotal" >= 0 AND "grandTotal" >= 0 AND "commissionAmount" >= 0 AND "refundedTotal" >= 0),
  ADD CONSTRAINT seller_order_commission_bps_range CHECK ("commissionBps" >= 0 AND "commissionBps" <= 10000),
  ADD CONSTRAINT seller_order_refunded_lte_total CHECK ("refundedTotal" <= "grandTotal");

ALTER TABLE "payments"
  ADD CONSTRAINT payment_amount_positive CHECK ("amount" >= 0),
  ADD CONSTRAINT payment_refunded_lte_captured CHECK ("amountRefunded" <= "amountCaptured"),
  ADD CONSTRAINT payment_captured_lte_amount CHECK ("amountCaptured" <= "amount");

ALTER TABLE "refunds" ADD CONSTRAINT refund_amount_positive CHECK ("amount" > 0);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT ledger_entry_non_negative CHECK ("debit" >= 0 AND "credit" >= 0),
  ADD CONSTRAINT ledger_entry_single_side CHECK (("debit" = 0) <> ("credit" = 0));

ALTER TABLE "wallets" ADD CONSTRAINT wallet_balance_non_negative CHECK ("balance" >= 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT wallet_tx_balance_after_non_negative CHECK ("balanceAfter" >= 0);

ALTER TABLE "seller_balances" ADD CONSTRAINT seller_balance_non_negative CHECK ("pending" >= 0 AND "available" >= 0 AND "reserved" >= 0 AND "paid" >= 0);
ALTER TABLE "payouts" ADD CONSTRAINT payout_amount_positive CHECK ("amount" > 0);

ALTER TABLE "product_reviews" ADD CONSTRAINT product_review_rating_range CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "seller_reviews" ADD CONSTRAINT seller_review_rating_range CHECK (
  "rating" BETWEEN 1 AND 5 AND "communicationRating" BETWEEN 1 AND 5 AND "shippingRating" BETWEEN 1 AND 5 AND "accuracyRating" BETWEEN 1 AND 5);

ALTER TABLE "auctions"
  ADD CONSTRAINT auction_prices_positive CHECK ("startingPrice" >= 0 AND "bidIncrement" > 0),
  ADD CONSTRAINT auction_time_order CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT auction_buy_now_gte_start CHECK ("buyNowPrice" IS NULL OR "buyNowPrice" >= "startingPrice");
ALTER TABLE "bids" ADD CONSTRAINT bid_amount_positive CHECK ("amount" > 0);
ALTER TABLE "auto_bids" ADD CONSTRAINT auto_bid_max_positive CHECK ("maxAmount" > 0);

ALTER TABLE "coupons"
  ADD CONSTRAINT coupon_value_positive CHECK ("value" >= 0),
  ADD CONSTRAINT coupon_percentage_max CHECK ("type" <> 'PERCENTAGE' OR "value" <= 10000),
  ADD CONSTRAINT coupon_limits_positive CHECK (("usageLimit" IS NULL OR "usageLimit" > 0) AND "perUserLimit" > 0);

ALTER TABLE "commission_rules" ADD CONSTRAINT commission_bps_range CHECK ("bps" >= 0 AND "bps" <= 10000);
ALTER TABLE "tax_rates" ADD CONSTRAINT tax_rate_bps_range CHECK ("rateBps" >= 0 AND "rateBps" <= 10000);
ALTER TABLE "return_items" ADD CONSTRAINT return_item_qty_positive CHECK ("quantity" > 0 AND "unitRefund" >= 0);
ALTER TABLE "flash_deal_items" ADD CONSTRAINT flash_deal_sold_lte_limit CHECK ("quantityLimit" IS NULL OR "quantitySold" <= "quantityLimit");
ALTER TABLE "answer_votes" ADD CONSTRAINT answer_vote_value CHECK ("value" IN (-1, 1));
ALTER TABLE "categories" ADD CONSTRAINT category_no_self_parent CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "user_blocks" ADD CONSTRAINT user_block_not_self CHECK ("blockerId" <> "blockedId");

-- Partial unique indexes ------------------------------------------------------
CREATE UNIQUE INDEX addresses_one_default_shipping ON "addresses" ("userId") WHERE "isDefaultShipping" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX addresses_one_default_billing ON "addresses" ("userId") WHERE "isDefaultBilling" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX wishlists_one_default_per_user ON "wishlists" ("userId") WHERE "isDefault" = true;
CREATE UNIQUE INDEX product_media_one_primary ON "product_media" ("productId") WHERE "isPrimary" = true;
CREATE UNIQUE INDEX product_variants_one_default ON "product_variants" ("productId") WHERE "isDefault" = true;
CREATE UNIQUE INDEX saved_payment_methods_one_default ON "saved_payment_methods" ("userId") WHERE "isDefault" = true AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX carts_one_active_anonymous ON "carts" ("anonymousId") WHERE "status" = 'ACTIVE' AND "anonymousId" IS NOT NULL;

-- Search indexes (trigram + full text) ----------------------------------------
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, $2) $$;
CREATE INDEX products_title_ar_trgm ON "products" USING gin ("titleAr" gin_trgm_ops);
CREATE INDEX products_title_en_trgm ON "products" USING gin ("titleEn" gin_trgm_ops);
CREATE INDEX products_fts_idx ON "products" USING gin (
  (to_tsvector('simple', coalesce("titleAr", '') || ' ' || coalesce("titleEn", '') || ' ' || immutable_array_to_string("tags", ' ') || ' ' || immutable_array_to_string("searchKeywords", ' '))));
CREATE INDEX products_tags_gin ON "products" USING gin ("tags");
CREATE INDEX stores_name_trgm ON "stores" USING gin ("name" gin_trgm_ops);
CREATE INDEX brands_name_en_trgm ON "brands" USING gin ("nameEn" gin_trgm_ops);
CREATE INDEX categories_name_en_trgm ON "categories" USING gin ("nameEn" gin_trgm_ops);
CREATE INDEX categories_name_ar_trgm ON "categories" USING gin ("nameAr" gin_trgm_ops);
CREATE INDEX faq_articles_fts_idx ON "faq_articles" USING gin ((to_tsvector('simple', "questionAr" || ' ' || "questionEn" || ' ' || "answerAr" || ' ' || "answerEn")));

-- Hot-path composite indexes not derivable from relations --------------------
CREATE INDEX orders_user_status_idx ON "orders" ("userId", "status");
CREATE INDEX notifications_unread_idx ON "notifications" ("userId") WHERE "readAt" IS NULL;
CREATE INDEX outbox_pending_idx ON "outbox_events" ("nextAttemptAt") WHERE "status" = 'PENDING';
CREATE INDEX reservations_active_expiry_idx ON "inventory_reservations" ("expiresAt") WHERE "status" = 'ACTIVE';
CREATE INDEX checkout_open_expiry_idx ON "checkout_sessions" ("expiresAt") WHERE "status" IN ('OPEN', 'RESERVED', 'PAYMENT_PENDING');
CREATE INDEX media_uploads_pending_idx ON "media_uploads" ("expiresAt") WHERE "status" = 'PENDING';
CREATE INDEX products_active_published_idx ON "products" ("publishedAt" DESC) WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- Immutability triggers for append-only tables -------------------------------
CREATE OR REPLACE FUNCTION prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ledger_entries', 'ledger_transactions', 'inventory_ledger', 'audit_logs', 'order_status_history',
    'return_status_history', 'dispute_events', 'wallet_transactions', 'seller_verification_events',
    'moderation_actions', 'bids', 'shipment_events', 'login_history'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_mutation()', t, t);
  END LOOP;
END $$;

-- Bids need one mutable column (isWinning) -> allow UPDATE of isWinning only
DROP TRIGGER bids_immutable ON "bids";
CREATE OR REPLACE FUNCTION bids_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'bids are append-only' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."amount" <> OLD."amount" OR NEW."bidderId" <> OLD."bidderId" OR NEW."auctionId" <> OLD."auctionId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'bid core fields are immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER bids_guard BEFORE UPDATE OR DELETE ON "bids" FOR EACH ROW EXECUTE FUNCTION bids_guard();

-- Ledger transactions must balance: enforced per transaction via deferred constraint trigger
CREATE OR REPLACE FUNCTION assert_ledger_balanced() RETURNS trigger AS $$
DECLARE d bigint; c bigint;
BEGIN
  SELECT coalesce(sum("debit"),0), coalesce(sum("credit"),0) INTO d, c FROM "ledger_entries" WHERE "transactionId" = NEW."transactionId";
  IF d <> c THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced (debit=% credit=%)', NEW."transactionId", d, c USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER ledger_entries_balanced AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assert_ledger_balanced();
