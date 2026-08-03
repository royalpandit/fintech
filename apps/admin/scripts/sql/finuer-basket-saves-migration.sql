-- Finuer Basket watchlist (basket-level "save"). Idempotent.
CREATE TABLE IF NOT EXISTS finuer_basket_saves (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  basket_id  INTEGER NOT NULL REFERENCES finuer_baskets(id) ON DELETE CASCADE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS finuer_basket_saves_user_id_basket_id_key ON finuer_basket_saves (user_id, basket_id);
CREATE INDEX IF NOT EXISTS finuer_basket_saves_user_id_idx ON finuer_basket_saves (user_id);
