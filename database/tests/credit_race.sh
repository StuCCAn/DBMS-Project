#!/usr/bin/env bash
# ============================================================================
# CueClub Manager: Concurrency Credit Race Test
# Simulates two concurrent client sessions attempting to book on credit for
# the same member when only one fits under the credit limit.
# Asserts:
# 1. Exactly one session succeeds.
# 2. Exactly one session is rejected with 'Credit limit exceeded'.
# 3. Final outstanding balance is at or under the credit limit.
# 4. State is cleaned up and idempotent.
# ============================================================================
set -euo pipefail

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PWD="${MYSQL_PWD:-cueclub-ci}"
MYSQL_DB="${MYSQL_DB:-cueclub}"

export MYSQL_PWD

MYSQL_CMD=(mysql --protocol=tcp -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DB")

echo "=== Running Concurrency Credit Race Test ==="

# Pre-test cleanup to guarantee idempotency
"${MYSQL_CMD[@]}" -e "
    DELETE FROM Credit_Ledger WHERE user_id = 7 AND reservation_id IN (
        SELECT reservation_id FROM Reservations WHERE user_id = 7 AND start_time = '2026-12-10 14:00:00'
    );
    DELETE FROM Reservations WHERE user_id = 7 AND start_time = '2026-12-10 14:00:00';
"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

OUT1="$TMP_DIR/session1.log"
OUT2="$TMP_DIR/session2.log"

# Member 7 has credit limit 500.00 and starting balance 0.00.
# Table 1 rate: 300.00/hr. Table 2 rate: 300.00/hr.
# Both sessions attempt a 300.00 credit booking simultaneously on distinct tables.
echo "Launching concurrent booking sessions for Member 7..."
"${MYSQL_CMD[@]}" -e "CALL sp_book_table(7, 1, '2026-12-10 14:00:00', '2026-12-10 15:00:00', 'Hourly', 0, 'OnCredit', @r1);" > "$OUT1" 2>&1 &
PID1=$!

"${MYSQL_CMD[@]}" -e "CALL sp_book_table(7, 2, '2026-12-10 14:00:00', '2026-12-10 15:00:00', 'Hourly', 0, 'OnCredit', @r2);" > "$OUT2" 2>&1 &
PID2=$!

set +e
wait "$PID1"
STATUS1=$?
wait "$PID2"
STATUS2=$?
set -e

echo "Session 1 exited with code $STATUS1"
echo "Session 2 exited with code $STATUS2"

FAIL_LOG=""
if [ "$STATUS1" -eq 0 ] && [ "$STATUS2" -ne 0 ]; then
    echo "Session 1 succeeded, Session 2 failed as expected."
    FAIL_LOG="$OUT2"
elif [ "$STATUS1" -ne 0 ] && [ "$STATUS2" -eq 0 ]; then
    echo "Session 2 succeeded, Session 1 failed as expected."
    FAIL_LOG="$OUT1"
else
    echo "ERROR: Expected exactly one session to succeed and one to fail."
    echo "--- Session 1 log ---"
    cat "$OUT1"
    echo "--- Session 2 log ---"
    cat "$OUT2"
    exit 1
fi

# Verify rejection message
if ! grep -q "Credit limit exceeded" "$FAIL_LOG"; then
    echo "ERROR: Rejected session did not contain 'Credit limit exceeded'."
    cat "$FAIL_LOG"
    exit 1
fi
echo "Verified: Rejection message correctly contains 'Credit limit exceeded'."

# Verify database state: final balance must be <= credit limit (500.00)
FINAL_BAL="$("${MYSQL_CMD[@]}" -N -e "
    SELECT COALESCE(SUM(
        CASE
            WHEN entry_type IN ('Booking charge','Canteen charge','Fine') THEN amount
            WHEN entry_type = 'Payment' THEN -amount
            ELSE 0
        END
    ), 0) FROM Credit_Ledger WHERE user_id = 7;
")"

echo "Verified: Member 7 outstanding balance is $FINAL_BAL (credit limit: 500.00)."

IS_VALID="$("${MYSQL_CMD[@]}" -N -e "SELECT IF($FINAL_BAL <= 500.00, 'YES', 'NO');")"
if [ "$IS_VALID" != "YES" ]; then
    echo "ERROR: Final balance $FINAL_BAL exceeds credit limit of 500.00!"
    exit 1
fi

# Post-test cleanup
"${MYSQL_CMD[@]}" -e "
    DELETE FROM Credit_Ledger WHERE user_id = 7 AND reservation_id IN (
        SELECT reservation_id FROM Reservations WHERE user_id = 7 AND start_time = '2026-12-10 14:00:00'
    );
    DELETE FROM Reservations WHERE user_id = 7 AND start_time = '2026-12-10 14:00:00';
"

echo "PASS: Concurrency credit race test completed successfully."
