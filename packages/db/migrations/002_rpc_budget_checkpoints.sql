ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_request_id numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_resolution_id numeric(78,0) NOT NULL DEFAULT 0;
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS last_protocol_config_check_at timestamptz;
