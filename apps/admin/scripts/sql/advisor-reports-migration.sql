-- Advisor Reports — advisors upload their own research reports (PDF), free or paid.

CREATE TABLE IF NOT EXISTS advisor_reports (
  id              SERIAL PRIMARY KEY,
  advisor_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_name       VARCHAR(255),
  file_size       INT,
  access_type     post_access_type NOT NULL DEFAULT 'free',
  price           DECIMAL(12, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS advisor_reports_advisor_user_id_idx ON advisor_reports(advisor_user_id);
