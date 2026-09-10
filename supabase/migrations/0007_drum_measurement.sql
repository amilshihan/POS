alter table parts
  add column drum_measurement text
  constraint drum_measurement_valid check (drum_measurement in ('KG', 'L'));
