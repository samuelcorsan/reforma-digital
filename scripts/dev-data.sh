#!/usr/bin/env bash
# Deja los datos reales del Congreso en el Postgres de compose.yaml, para ver /congreso y
# /elecciones en local. Encadena los pasos de apps/ingestion/README.md («Importación inicial»).
# Necesita Docker y Python 3.12+ (PYTHON=python3.14 si `python3` es más antiguo). Ocupa ~1 GB en .cache/.
set -euo pipefail
cd "$(dirname "$0")/.."

recent='import sys; sys.exit(sys.version_info < (3, 12))'
"${PYTHON:-python3}" -c "$recent" || {
  echo "Necesita Python 3.12+: PYTHON=python3.14 pnpm dev:data" >&2
  exit 1
}

export DATABASE_URL=postgres://gov:gov@127.0.0.1:5442/gov
export CONGRESS_DATABASE_URL="$DATABASE_URL"
revision=$(sed -n 's/^REVISION = "\(.*\)"$/\1/p' apps/ingestion/run.py)
source=.cache/escano-abierto
python=.cache/congreso-python/bin/python

docker compose -p reforma-escano up -d --wait postgres
pnpm db:migrate

# bootstrap no sobrescribe una instalación. Para reimportar:
# docker compose -p reforma-escano down -v && rm -r .cache/congreso-data
imported=$(docker compose -p reforma-escano exec -T postgres psql -U gov -d gov -tAc 'SELECT count(*) FROM congreso_publications')
if [ "$imported" != 0 ]; then
  echo "Los datos ya están importados. Arranca la web con: DATABASE_URL=$DATABASE_URL pnpm dev"
  exit 0
fi

# Solo los datos del commit fijado, sin historial.
if [ "$(git -C "$source" rev-parse HEAD 2>/dev/null)" != "$revision" ]; then
  git init -q "$source"
  git -C "$source" fetch -q --depth 1 https://github.com/jorgegarcelan/escano-abierto "$revision"
  git -C "$source" checkout -q FETCH_HEAD
fi

"$python" -c "$recent" 2>/dev/null || "${PYTHON:-python3}" -m venv --clear .cache/congreso-python
"$python" -m pip install -q -r apps/ingestion/requirements.txt
CONGRESS_WORKDIR="$PWD/.cache/congreso-data" "$python" apps/ingestion/run.py bootstrap --local --source "$source"

echo "Listo. Arranca la web con: DATABASE_URL=$DATABASE_URL pnpm dev"
