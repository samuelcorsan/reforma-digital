-- La búsqueda de intervenciones (`search ILIKE '%…%'`) usa un índice de trigramas en lugar de
-- recorrer la tabla. `pg_trgm` viene con Postgres y es una extensión de confianza.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX congreso_interventions_search ON congreso_interventions USING gin (search gin_trgm_ops);
