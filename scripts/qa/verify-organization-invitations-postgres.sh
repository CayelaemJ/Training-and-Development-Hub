#!/usr/bin/env bash
# Usage: PGHOST=/path/to/socket PGUSER=user bash scripts/qa/verify-organization-invitations-postgres.sh
# Creates and uses ONLY a throwaway database named invcheck on a LOCAL server. Never point at Neon/Render.
# Throwaway local verification of 20261122_organization_invitations.sql on PostgreSQL 16.
set -u
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "Refusing: PGHOST must be a local socket dir or localhost" >&2; exit 2;; esac
cd "$(dirname "$0")/../.."
P="psql -d invcheck -v ON_ERROR_STOP=1 -Atq"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1 :: $2"; fail=$((fail+1)); }
expect_err(){ out=$($P -c "$2" 2>&1); if grep -qi "$3" <<<"$out"; then ok "$1"; else bad "$1" "$out"; fi; }
expect_eq(){ out=$($P -c "$2" 2>&1); if [[ "$out" == "$3" ]]; then ok "$1"; else bad "$1" "got '$out' want '$3'"; fi; }
psql -d postgres -qc "DROP DATABASE IF EXISTS invcheck" -c "CREATE DATABASE invcheck"
$P -c "CREATE TABLE users(id varchar PRIMARY KEY, email varchar UNIQUE); CREATE TABLE organizations(id serial PRIMARY KEY, name varchar(200) NOT NULL, owner_id varchar NOT NULL REFERENCES users(id)); CREATE TABLE organization_members(organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, role varchar(24) NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id));"
M=lib/db/migrations/20261122_organization_invitations.sql
$P -f $M && $P -f $M && ok "migration applies and re-applies idempotently" || bad "migration apply" "error"
$P -c "INSERT INTO users VALUES ('owner-a','owner.a@example.org'),('owner-b','owner.b@example.org'),('learner-1','learner.one@example.org'); INSERT INTO organizations(id,name,owner_id) VALUES (11,'Synthetic School A','owner-a'),(22,'Synthetic School B','owner-b');"
ins(){ echo "INSERT INTO organization_invitations(organization_id,email,role,invited_by) VALUES ($1,'$2','$3','$4')"; }
expect_eq "default pending with future expiry" "$(ins 11 learner.one@example.org learner owner-a) RETURNING status||':'||(expires_at>created_at)" "pending:true"
expect_err "rejects uppercase email" "$(ins 11 Learner.Two@example.org learner owner-a)" "organization_invitations_email_normalized"
expect_err "rejects padded email" "$(ins 11 ' x@example.org' learner owner-a)" "organization_invitations_email_normalized"
expect_err "rejects owner role" "$(ins 11 y@example.org owner owner-a)" "organization_invitations_role"
expect_err "one open invite per org+email" "$(ins 11 learner.one@example.org teacher owner-a)" "organization_invitations_open_idx"
expect_eq "other tenant independent" "$(ins 22 learner.one@example.org learner owner-b) RETURNING organization_id" "22"
expect_err "answer requires responded_at" "UPDATE organization_invitations SET status='accepted' WHERE organization_id=11" "organization_invitations_response"
expect_err "unknown org rejected" "$(ins 999 z@example.org learner owner-a)" "foreign key"
# Accept flow as the route performs it: lock row, insert membership, mark accepted.
$P -c "BEGIN; SELECT id FROM organization_invitations WHERE organization_id=11 AND status='pending' FOR UPDATE; INSERT INTO organization_members(organization_id,user_id,role) SELECT organization_id,'learner-1',role FROM organization_invitations WHERE organization_id=11 AND status='pending' ON CONFLICT DO NOTHING; UPDATE organization_invitations SET status='accepted',responded_at=now(),responded_by='learner-1' WHERE organization_id=11 AND status='pending'; COMMIT;"
expect_eq "acceptance creates exactly one membership in the inviting org only" "SELECT string_agg(organization_id||':'||role,',') FROM organization_members WHERE user_id='learner-1'" "11:learner"
expect_eq "slot reopens after answer" "$(ins 11 learner.one@example.org teacher owner-a) RETURNING status" "pending"
# Concurrency: two sessions race to accept the same invitation; the row lock serializes them.
ID=$($P -c "SELECT id FROM organization_invitations WHERE organization_id=22 AND status='pending'")
OUT=$(mktemp -d)
race(){ $P -c "BEGIN; SELECT 1 FROM organization_invitations WHERE id=$ID AND status='pending' FOR UPDATE; SELECT pg_sleep(1); UPDATE organization_invitations SET status='accepted',responded_at=now(),responded_by='learner-1' WHERE id=$ID AND status='pending' RETURNING 'won'; COMMIT;" >"$OUT/$1" 2>&1; }
race 1 & race 2 & wait
winners=$(cat "$OUT"/1 "$OUT"/2 | grep -c won); rm -rf "$OUT"
[[ "$winners" == "1" ]] && ok "concurrent accepts resolve to a single winner" || bad "concurrent accepts" "winners=$winners"
$P -c "DELETE FROM organizations WHERE id=22"
expect_eq "deleting an organization removes its invitations" "SELECT count(*) FROM organization_invitations WHERE organization_id=22" "0"
expect_eq "rollback statement drops cleanly" "DROP TABLE organization_invitations; SELECT to_regclass('organization_invitations') IS NULL" "t"
echo "RESULT pass=$pass fail=$fail"
[[ $fail -eq 0 ]]
