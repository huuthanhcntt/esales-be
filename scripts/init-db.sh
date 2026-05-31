#!/bin/bash
set -e

# Create separate databases for each microservice (Database per Service pattern)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE auth;
    CREATE DATABASE reservations;
    CREATE DATABASE payments;
    CREATE DATABASE notifications;
EOSQL
