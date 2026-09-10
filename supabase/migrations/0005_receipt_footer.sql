alter table shop_settings
  add column receipt_footer text not null default 'Thank you!'
  constraint receipt_footer_length check (char_length(receipt_footer) <= 512);
