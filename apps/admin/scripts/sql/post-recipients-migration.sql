-- Specific-people targeting: recipients for an audience='custom' market post.

CREATE TABLE IF NOT EXISTS market_post_recipients (
  id      SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES market_posts(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS market_post_recipients_user_id_idx ON market_post_recipients(user_id);
