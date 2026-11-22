-- Existing installations only. Fresh databases no longer create this table: it held the daily
-- spending limits of the removed desktop app.
DROP TABLE IF EXISTS request_buckets;
