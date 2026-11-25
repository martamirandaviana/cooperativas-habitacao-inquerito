CREATE TABLE responses (
  id TEXT PRIMARY KEY NOT NULL,
  cooperative TEXT NOT NULL CHECK (length(trim(cooperative)) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  collective INTEGER NOT NULL CHECK (collective IN (0, 1)),
  individual INTEGER NOT NULL CHECK (individual IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (collective = 1 OR individual = 1)
) STRICT;
