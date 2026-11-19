CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Tokens OAuth não devem permanecer neste banco. A tabela é mantida apenas
-- para compatibilidade com instalações de teste anteriores; o fluxo novo usa
-- oauth_results, que é temporária e consumida uma única vez pelo aplicativo.
CREATE TABLE IF NOT EXISTS social_tokens (
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  token_type TEXT,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, platform),
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_results (
  device_id TEXT PRIMARY KEY,
  encrypted_token TEXT NOT NULL,
  token_type TEXT,
  token_expires_at INTEGER,
  delivery_expires_at INTEGER NOT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
