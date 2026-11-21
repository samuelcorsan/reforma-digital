CREATE TABLE searches (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), result jsonb NOT NULL);
CREATE TABLE feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), search_id uuid NOT NULL REFERENCES searches(id) ON DELETE CASCADE, rating integer NOT NULL CHECK(rating IN (-1,1)), reason text, comment text, created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz);
CREATE TABLE experiments (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), report jsonb NOT NULL);
