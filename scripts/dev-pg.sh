#!/usr/bin/env bash
# يشغّل PostgreSQL محليًا بدون Docker (للتطوير والاختبار على أجهزة بلا docker).
# الاستخدام: scripts/dev-pg.sh start|stop|status   —   المنفذ 5432 وقاعدة iltizam (مستخدم/كلمة: iltizam)
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
PGDATA="${PGDATA:-/var/lib/iltizam-pg}"
PGPORT="${PGPORT:-5432}"
RUN="bash -c"
if [ "$(id -u)" = "0" ]; then RUN="su postgres -s /bin/bash -c"; fi
case "${1:-start}" in
  start)
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      mkdir -p "$PGDATA"; [ "$(id -u)" = "0" ] && chown postgres:postgres "$PGDATA"
      $RUN "$PGBIN/initdb -D '$PGDATA' -A trust -E UTF8 --locale=C.UTF-8 >/dev/null"
    fi
    if ! $RUN "$PGBIN/pg_ctl -D '$PGDATA' status" >/dev/null 2>&1; then
      $RUN "$PGBIN/pg_ctl -D '$PGDATA' -o '-p $PGPORT -c listen_addresses=127.0.0.1 -c fsync=off -c max_connections=100' -l '$PGDATA/server.log' -w start" >/dev/null
    fi
    $RUN "psql -h 127.0.0.1 -p $PGPORT -d postgres -tAc \"SELECT 1 FROM pg_roles WHERE rolname='iltizam'\"" | grep -q 1 || \
      $RUN "psql -h 127.0.0.1 -p $PGPORT -d postgres -c \"CREATE ROLE iltizam LOGIN SUPERUSER PASSWORD 'iltizam'\"" >/dev/null
    $RUN "psql -h 127.0.0.1 -p $PGPORT -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='iltizam'\"" | grep -q 1 || \
      $RUN "createdb -h 127.0.0.1 -p $PGPORT -O iltizam iltizam" >/dev/null
    echo "postgresql://iltizam:iltizam@127.0.0.1:$PGPORT/iltizam"
    ;;
  stop) $RUN "$PGBIN/pg_ctl -D '$PGDATA' -m fast stop" ;;
  status) $RUN "$PGBIN/pg_ctl -D '$PGDATA' status" ;;
  *) echo "usage: $0 start|stop|status"; exit 1 ;;
esac
