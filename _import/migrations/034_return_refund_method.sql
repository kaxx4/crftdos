-- version: 20260812063052
-- applied name: 011_return_refund_method

-- migration 011: stall_returns.refund_method
--
-- Shift close computed "expected cash" as opening_float + cash-order totals,
-- with no way to know whether a return's refund_amount came out of the same
-- till in cash or was sent back over UPI -- so a cash refund during a shift
-- made the till legitimately short with nothing in the app explaining why,
-- and a volunteer's correct count would read as an unexplained variance.
alter table stall_returns add column if not exists refund_method stall_payment_method;
