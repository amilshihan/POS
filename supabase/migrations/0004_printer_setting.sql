-- Preferred receipt printer name (a label/reminder, not an OS-level default —
-- browsers don't let a web page enumerate or silently select system printers;
-- window.print() always shows the browser's own print dialog for the user to
-- pick a destination printer).

alter table shop_settings add column printer_name text;
