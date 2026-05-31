#!/bin/bash
# ===================================================================
# eSales API Test Script
# Tests the full flow: auth → reservation → payment (stub) → email (Mailpit)
# Usage: ./scripts/test-api.sh [auth_host] [reservations_host]
# ===================================================================

set -e

AUTH_BASE="${1:-http://localhost:4001}"
RESERVATIONS_BASE="${2:-http://localhost:4000}"
MAILPIT_BASE="http://localhost:8025"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

test_endpoint() {
  local method=$1
  local url=$2
  local description=$3
  local expected_status=$4
  local body=$5
  local cookie=$6

  local args=(-s -o /tmp/esales_response.json -w "%{http_code}" -X "$method")

  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  if [ -n "$cookie" ]; then
    args+=(-H "Cookie: Authentication=$cookie")
  fi

  # Capture Set-Cookie header for login
  args+=(-D /tmp/esales_headers.txt)

  local status
  status=$(curl "${args[@]}" "$url" 2>/dev/null)
  local response
  response=$(cat /tmp/esales_response.json 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    echo -e "  ${GREEN}PASS${NC} [$method $status] $description"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$method $status != $expected_status] $description"
    echo -e "       Response: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

extract_jwt() {
  grep -i "Set-Cookie" /tmp/esales_headers.txt 2>/dev/null | grep -o 'Authentication=[^;]*' | cut -d= -f2 || echo ""
}

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}  eSales API Test Suite (Full Flow)${NC}"
echo -e "${CYAN}  Auth:         $AUTH_BASE${NC}"
echo -e "${CYAN}  Reservations: $RESERVATIONS_BASE${NC}"
echo -e "${CYAN}  Mailpit:      $MAILPIT_BASE${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""

# -----------------------------------------------------------------
# Pre-flight: check for port conflicts with local node processes
# -----------------------------------------------------------------
PORT_CONFLICT=0
for port in 4000 4001; do
  LOCAL_PID=$(lsof -ti :$port 2>/dev/null | head -1)
  if [ -n "$LOCAL_PID" ]; then
    LOCAL_CMD=$(ps -p "$LOCAL_PID" -o command= 2>/dev/null || echo "unknown")
    if echo "$LOCAL_CMD" | grep -q "node.*dist/apps"; then
      echo -e "  ${RED}WARNING${NC} Port $port is held by a local node process (PID $LOCAL_PID)"
      echo -e "          ${CYAN}$LOCAL_CMD${NC}"
      PORT_CONFLICT=1
    fi
  fi
done

if [ "$PORT_CONFLICT" -eq 1 ]; then
  echo ""
  echo -e "  ${YELLOW}Local processes may shadow Docker containers on the same ports.${NC}"
  echo -e "  ${YELLOW}Fix: pkill -f 'nest start' or kill the PIDs above, then restart Docker:${NC}"
  echo -e "  ${YELLOW}     docker compose restart reservations auth${NC}"
  echo ""
fi

# -----------------------------------------------------------------
echo -e "${YELLOW}[1/9] Health Checks${NC}"
# -----------------------------------------------------------------
test_endpoint "GET" "$RESERVATIONS_BASE/health/live" "Reservations liveness" "200"
test_endpoint "GET" "$RESERVATIONS_BASE/health/ready" "Reservations readiness" "200"
test_endpoint "GET" "$AUTH_BASE/health/live" "Auth liveness" "200"
test_endpoint "GET" "$AUTH_BASE/health/ready" "Auth readiness" "200"
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[2/9] Prometheus Metrics${NC}"
# -----------------------------------------------------------------
METRICS=$(curl -s "$RESERVATIONS_BASE/metrics" 2>/dev/null)
if echo "$METRICS" | grep -q "process_cpu_seconds_total"; then
  echo -e "  ${GREEN}PASS${NC} [GET 200] Reservations /metrics contains process metrics"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Reservations /metrics missing process metrics"
  FAIL=$((FAIL + 1))
fi

METRICS=$(curl -s "$AUTH_BASE/metrics" 2>/dev/null)
if echo "$METRICS" | grep -q "process_cpu_seconds_total"; then
  echo -e "  ${GREEN}PASS${NC} [GET 200] Auth /metrics contains process metrics"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Auth /metrics missing process metrics"
  FAIL=$((FAIL + 1))
fi
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[3/9] Swagger / OpenAPI${NC}"
# -----------------------------------------------------------------
SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" "$RESERVATIONS_BASE/api/docs" 2>/dev/null)
if [ "$SWAGGER" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} [GET 200] Reservations Swagger UI"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} [GET $SWAGGER] Reservations Swagger UI"
  FAIL=$((FAIL + 1))
fi

SWAGGER=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH_BASE/api/docs" 2>/dev/null)
if [ "$SWAGGER" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} [GET 200] Auth Swagger UI"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} [GET $SWAGGER] Auth Swagger UI"
  FAIL=$((FAIL + 1))
fi
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[4/9] User Registration${NC}"
# -----------------------------------------------------------------
TIMESTAMP=$(date +%s)
TEST_EMAIL="apitest+${TIMESTAMP}@example.com"
ADMIN_EMAIL="apiadmin+${TIMESTAMP}@example.com"

test_endpoint "POST" "$AUTH_BASE/users" "Create test user" "201" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"StrongPass123!\"}"

test_endpoint "POST" "$AUTH_BASE/users" "Create admin user" "201" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"AdminPass123!\",\"roles\":[\"Admin\"]}"

test_endpoint "POST" "$AUTH_BASE/users" "Reject weak password" "400" \
  '{"email":"weak@example.com","password":"123"}'

test_endpoint "POST" "$AUTH_BASE/users" "Reject invalid email" "400" \
  '{"email":"not-an-email","password":"StrongPass123!"}'
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[5/9] Authentication${NC}"
# -----------------------------------------------------------------
test_endpoint "POST" "$AUTH_BASE/auth/login" "Login with valid credentials" "201" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"StrongPass123!\"}"
JWT_TOKEN=$(extract_jwt)

if [ -z "$JWT_TOKEN" ]; then
  echo -e "  ${RED}FATAL: Could not extract JWT token. Remaining tests will fail.${NC}"
else
  echo -e "  ${GREEN}JWT token extracted${NC} (${#JWT_TOKEN} chars)"
fi

test_endpoint "POST" "$AUTH_BASE/auth/login" "Reject wrong password" "401" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"WrongPass999!\"}"

# Login as admin
test_endpoint "POST" "$AUTH_BASE/auth/login" "Login as admin" "201" \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"AdminPass123!\"}"
ADMIN_TOKEN=$(extract_jwt)
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[6/9] Authenticated User Endpoints${NC}"
# -----------------------------------------------------------------
test_endpoint "GET" "$AUTH_BASE/users" "Get current user (with auth)" "200" "" "$JWT_TOKEN"
test_endpoint "GET" "$AUTH_BASE/users" "Reject unauthenticated request" "401"
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[7/9] Reservations CRUD + Payment (stub) + Email${NC}"
# -----------------------------------------------------------------

# Clear Mailpit inbox before test
curl -s -X DELETE "$MAILPIT_BASE/api/v1/messages" > /dev/null 2>&1
echo -e "  ${CYAN}Cleared Mailpit inbox${NC}"

# Create reservation (triggers payment stub → notification → Mailpit)
test_endpoint "POST" "$RESERVATIONS_BASE/reservations" "Create reservation (stub payment + email)" "201" \
  "{
    \"startDate\": \"2026-07-01T00:00:00.000Z\",
    \"endDate\": \"2026-07-05T00:00:00.000Z\",
    \"charge\": {
      \"card\": {\"number\":\"4242424242424242\",\"exp_month\":12,\"exp_year\":2030,\"cvc\":\"123\"},
      \"amount\": 200
    }
  }" "$JWT_TOKEN"

RESERVATION_ID=$(cat /tmp/esales_response.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
if [ -n "$RESERVATION_ID" ]; then
  echo -e "  ${GREEN}Reservation created${NC}: id=$RESERVATION_ID"
else
  echo -e "  ${YELLOW}Could not extract reservation ID${NC}"
fi

test_endpoint "GET" "$RESERVATIONS_BASE/reservations" "List all reservations" "200" "" "$JWT_TOKEN"

if [ -n "$RESERVATION_ID" ]; then
  test_endpoint "GET" "$RESERVATIONS_BASE/reservations/$RESERVATION_ID" "Get reservation by ID" "200" "" "$JWT_TOKEN"

  test_endpoint "PATCH" "$RESERVATIONS_BASE/reservations/$RESERVATION_ID" "Update reservation" "200" \
    '{"startDate":"2026-08-01T00:00:00.000Z"}' "$JWT_TOKEN"
fi

test_endpoint "POST" "$RESERVATIONS_BASE/reservations" "Reject unauthenticated create" "403" \
  '{"startDate":"2026-06-01","endDate":"2026-06-05","charge":{"card":{"number":"4242424242424242","exp_month":12,"exp_year":2030,"cvc":"123"},"amount":100}}'
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[8/9] Verify Email via Mailpit${NC}"
# -----------------------------------------------------------------

# Wait for email delivery (async via Kafka/TCP)
sleep 3

MAIL_COUNT=$(curl -s "$MAILPIT_BASE/api/v1/messages" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")

if [ "$MAIL_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC} Mailpit received $MAIL_COUNT email(s)"
  PASS=$((PASS + 1))

  # Show email details
  MAIL_SUBJECT=$(curl -s "$MAILPIT_BASE/api/v1/messages" 2>/dev/null | python3 -c "
import sys, json
msgs = json.load(sys.stdin).get('messages', [])
if msgs:
    m = msgs[0]
    print(f\"  To: {m['To'][0]['Address']}\")
    print(f\"  Subject: {m['Subject']}\")
" 2>/dev/null || echo "")
  if [ -n "$MAIL_SUBJECT" ]; then
    echo -e "  ${CYAN}$MAIL_SUBJECT${NC}"
  fi
else
  echo -e "  ${RED}FAIL${NC} No emails received in Mailpit"
  echo -e "       ${CYAN}(Is Mailpit running? Check: curl $MAILPIT_BASE/api/v1/messages)${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# -----------------------------------------------------------------
echo -e "${YELLOW}[9/9] Role-Based Access (Admin)${NC}"
# -----------------------------------------------------------------
if [ -n "$RESERVATION_ID" ]; then
  test_endpoint "DELETE" "$RESERVATIONS_BASE/reservations/$RESERVATION_ID" "Delete reservation (non-admin, should fail)" "403" "" "$JWT_TOKEN"
  test_endpoint "DELETE" "$RESERVATIONS_BASE/reservations/$RESERVATION_ID" "Delete reservation (admin)" "200" "" "$ADMIN_TOKEN"
else
  test_endpoint "DELETE" "$RESERVATIONS_BASE/reservations/999" "Delete reservation (non-admin, should fail)" "403" "" "$JWT_TOKEN"
  test_endpoint "DELETE" "$RESERVATIONS_BASE/reservations/999" "Delete reservation (admin, not found)" "500" "" "$ADMIN_TOKEN"
fi
echo ""

# -----------------------------------------------------------------
# Kafka Topics Check (optional)
# -----------------------------------------------------------------
echo -e "${YELLOW}[Bonus] Kafka Topics${NC}"
KAFKA_TOPICS=$(docker exec esales-kafka-1 kafka-topics --bootstrap-server kafka:9092 --list 2>/dev/null || echo "")
if [ -n "$KAFKA_TOPICS" ]; then
  echo -e "  ${GREEN}Kafka topics found:${NC}"
  echo "$KAFKA_TOPICS" | while read -r topic; do
    [ -n "$topic" ] && echo -e "    - $topic"
  done
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}SKIP${NC} Kafka not reachable or no topics created"
fi
echo ""

# -----------------------------------------------------------------
# Summary
# -----------------------------------------------------------------
echo -e "${CYAN}====================================================================${NC}"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}  All $TOTAL tests passed${NC}"
else
  echo -e "  ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} out of $TOTAL tests"
fi
echo -e "${CYAN}====================================================================${NC}"
echo ""

# Cleanup
rm -f /tmp/esales_response.json /tmp/esales_headers.txt

exit $FAIL