-- Full-text search on guests
CREATE INDEX idx_guests_full_text ON guests 
USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '')));

-- GIST exclusion constraint for preventing double-booking
-- Requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation_rooms 
ADD CONSTRAINT reservation_rooms_no_overlap_excl 
EXCLUDE USING gist (
  room_id WITH =,
  daterange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (room_id IS NOT NULL);

-- Partial unique index for room assignments
CREATE UNIQUE INDEX idx_room_assignments_unique 
ON room_assignments(room_id, date);