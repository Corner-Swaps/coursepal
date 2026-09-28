#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "========================================================"
echo " Running Diverse Teacher Syllabi Audit: 20 Iterations"
echo "========================================================"

FAILED=0
TOTAL_RUNS=20

for i in $(seq 1 $TOTAL_RUNS); do
  echo "--------------------------------------------------------"
  echo "▶️ Iteration $i of $TOTAL_RUNS..."
  START_TIME=$(date +%s)
  
  if npx jest __tests__/diverseTeacherSyllabi20RunAudit.test.ts --silent; then
    END_TIME=$(date +%s)
    DIFF=$((END_TIME - START_TIME))
    echo "✅ Iteration $i: PASSED (completed in ${DIFF}s)"
  else
    echo "❌ Iteration $i: FAILED"
    FAILED=$((FAILED + 1))
    exit 1
  fi
done

echo "========================================================"
echo "🎯 AUDIT COMPLETE: $TOTAL_RUNS / $TOTAL_RUNS PASSES (0 failures, 100% deterministic)"
echo "========================================================"
