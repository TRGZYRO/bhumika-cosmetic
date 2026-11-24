-- 007: booking rules requested by the owner.
--  * Opening hours 11:00 to 22:00.
--  * No turnaround buffer: a table is free for the next booking as soon as the
--    previous booking's time ends (for example, 6pm for 60 minutes frees at 7pm).
--  * Index for the per-customer booking rate limit.

update booking_settings
set opening_time = '11:00',
    closing_time = '22:00',
    buffer_minutes = 0,
    updated_at = now();

create index if not exists bookings_user_created_idx on bookings (user_id, created_at);
