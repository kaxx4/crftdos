-- version: 20260811181711
-- applied name: stall_008_prep_enum_value

alter type stall_fulfillment add value 'prepped' after 'pending_press';
