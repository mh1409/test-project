-- Extensions required by the Prisma schema (also created by migrations; idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- Test database for integration tests
SELECT 'CREATE DATABASE marketplace_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'marketplace_test')\gexec
