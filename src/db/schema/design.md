## ##-- Primary keys (automatic indexes)

## 
## -- Foreign keys (CRITICAL for JOINs):
## CREATE INDEX idx_reservations_guest ON reservations(guest_id);
## CREATE INDEX idx_reservation_rooms_reservation ON reservation_rooms(reservation_id);
## CREATE INDEX idx_reservation_rooms_room ON reservation_rooms(room_id);
## CREATE INDEX idx_invoices_guest ON invoices(guest_id);
## CREATE INDEX idx_invoices_reservation ON invoices(reservation_id);

## 
## -- Date range queries (very common in hotels):
## CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
## CREATE INDEX idx_reservation_rooms_dates ON reservation_rooms(check_in_date, check_out_date);

## 
## -- Status filtering (common):
## CREATE INDEX idx_reservations_status ON reservations(status) 
##   WHERE status IN ('confirmed', 'checked_in');  -- Partial index (smaller)

## 
## -- Availability queries (most critical):
## CREATE INDEX idx_availability_check ON reservation_rooms(room_id, check_in_date, check_out_date);

## names search:
## -- Add tsvector column:
## ALTER TABLE guests ADD COLUMN name_search tsvector;
## 
## -- Populate it:
## UPDATE guests 
## SET name_search = to_tsvector('english', first_name || ' ' || last_name);
## 
## -- Create GIN index (fast for full-text):
## CREATE INDEX idx_guests_name_search ON guests USING gin(name_search);
## 
## -- Query:
## SELECT * FROM guests
## WHERE name_search @@ plainto_tsquery('english', 'joh smi');
## 
## -- Finds: "John Smith", "Johan Smite", etc.
## -- Time: ~1ms even on millions of rows