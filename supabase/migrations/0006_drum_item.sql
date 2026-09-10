alter table parts
  add column is_drum boolean not null default false,
  add column pack_size text;
