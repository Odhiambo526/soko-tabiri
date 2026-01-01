#!/usr/bin/env bash
# scripts/prepush-verify.sh
# Verify staged changes against required checks and prepare an AI review bundle.
# Exit codes:
#   0 - checks passed (AI review bundle prepared)
#   non-zero - a hard failure requiring fix

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/prepush_review"
DIFF_FILE="$OUT_DIR/prepush.diff"
PROMPT_FILE="$OUT_DIR/ai_review_prompt.txt"
FILES_TO_BUNDLE=(README.md SECURITY.md THREAT_MODEL.md OPERATIONAL_RUNBOOK.md docker-compose.yml migrations services/settlement/openapi.yaml services/oracle/openapi.yaml)

mkdir -p "$OUT_DIR"

echo "== prepush-verify: working from $ROOT"

# 1) Ensure there are staged changes
if git diff --staged --quiet 2>/dev/null; then
  echo "No staged changes detected. Generating diff of all tracked changes instead."
  git diff > "$DIFF_FILE" || true
else
  git diff --staged --binary > "$DIFF_FILE"
  echo "Staged diff written to $DIFF_FILE"
fi

# 2) Basic checks: lint & tests for each service
run_service_checks() {
  local service_dir=$1
  local pkg_json="$service_dir/package.json"
  
  if [ -f "$pkg_json" ]; then
    echo "Checking service: $service_dir"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "$service_dir/node_modules" ]; then
      echo "  Installing dependencies..."
      (cd "$service_dir" && npm install --silent 2>/dev/null) || true
    fi
    
    # Run lint if defined
    if grep -q '"lint"' "$pkg_json" 2>/dev/null; then
      echo "  Running lint..."
      (cd "$service_dir" && npm run lint 2>/dev/null) || echo "  Warning: lint failed or not configured"
    fi
    
    # Run tests if defined
    if grep -q '"test"' "$pkg_json" 2>/dev/null; then
      echo "  Running tests..."
      (cd "$service_dir" && npm test 2>/dev/null) || echo "  Warning: tests failed or not configured"
    fi
  fi
}

# Check each service
for service in gateway-api engine settlement oracle; do
  service_path="$ROOT/services/$service"
  if [ -d "$service_path" ]; then
    run_service_checks "$service_path"
  fi
done

# 3) Docker build sanity (if docker-compose.yml exists)
if [ -f "$ROOT/docker-compose.yml" ]; then
  echo "Checking docker-compose configuration..."
  if command -v docker-compose >/dev/null 2>&1; then
    if docker-compose -f "$ROOT/docker-compose.yml" config --quiet 2>/dev/null; then
      echo "Docker Compose configuration is valid."
    else
      echo "Warning: docker-compose config validation failed. Please check docker-compose.yml"
    fi
  else
    echo "docker-compose not found; skipping docker validation."
  fi
else
  echo "No docker-compose.yml found; skipping docker build check."
fi

# 4) Secrets check: regex scan for common secret patterns
SECRETS_FOUND=0
echo "Running secret scan on repository files..."

# Files to scan (exclude node_modules, .git, etc.)
SCAN_FILES=$(find "$ROOT" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.sql" -o -name "*.md" -o -name "*.sh" -o -name "*.env*" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/prepush_review/*" \
  2>/dev/null || true)

for f in $SCAN_FILES; do
  if [ -f "$f" ]; then
    # Search for common secret patterns (excluding .example files and comments)
    if grep -I -n -E "-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ssh-rsa AAAA[A-Za-z0-9+/]+|AWS_SECRET_ACCESS_KEY\s*=\s*['\"][^'\"]+['\"]" "$f" 2>/dev/null | grep -v "example" | grep -v "#" | grep -v "//"; then
      echo "Potential secret found in: $f"
      SECRETS_FOUND=1
    fi
  fi
done

if [ "$SECRETS_FOUND" -ne 0 ]; then
  echo "ERROR: possible secrets detected. Remove them before pushing."
  exit 2
fi
echo "No secrets detected."

# 5) Documentation checks: ensure ASSUMPTIONS section exists in key docs
echo "Checking for ASSUMPTIONS header in key docs..."
DOCS_MISSING_ASSUMPTIONS=0
for doc in README.md SECURITY.md THREAT_MODEL.md OPERATIONAL_RUNBOOK.md; do
  if [ -f "$ROOT/$doc" ]; then
    if ! grep -qi "ASSUMPTION" "$ROOT/$doc"; then
      echo "Warning: 'ASSUMPTIONS' section not found in $doc."
      DOCS_MISSING_ASSUMPTIONS=1
    fi
  else
    echo "Warning: $doc not present."
  fi
done

if [ "$DOCS_MISSING_ASSUMPTIONS" -ne 0 ]; then
  echo "Note: Some docs are missing ASSUMPTIONS sections. Consider adding them."
fi

# 6) Search for TODO / FIXME tags
echo "Scanning for TODO/FIXME markers..."
TODO_COUNT=$(grep -r -n "TODO\|FIXME" "$ROOT" \
  --include="*.js" --include="*.ts" --include="*.sql" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=prepush_review \
  2>/dev/null | wc -l || echo "0")

if [ "$TODO_COUNT" -gt 0 ]; then
  echo "Found $TODO_COUNT TODO/FIXME markers in codebase. Ensure these are intended."
fi

# 7) Prepare AI review bundle: copy selected docs + diff + other artifacts
echo "Preparing AI review bundle in $OUT_DIR ..."

# Copy listed files/directories if they exist
for p in "${FILES_TO_BUNDLE[@]}"; do
  src="$ROOT/$p"
  if [ -e "$src" ]; then
    dest="$OUT_DIR/$p"
    mkdir -p "$(dirname "$dest")"
    cp -r "$src" "$dest" 2>/dev/null || true
    echo "  Copied: $p"
  fi
done

# 8) Generate the AI prompt file
cat > "$PROMPT_FILE" <<'EOF'
AI REVIEW PROMPT
----------------
Context:
You have the staged-diff (prepush.diff) and the relevant docs in this bundle (README.md, SECURITY.md, THREAT_MODEL.md, OPERATIONAL_RUNBOOK.md, migrations/, openapi/). Your job is to detect and fix:
  - AI-slops / hallucinations: any factual assertions, external claims, or "design facts" that are not supported by in-repo evidence must be flagged. For each such claim either:
      A) annotate it with a clear "// ASSUMPTION: <rationale>" comment or
      B) replace it with neutral wording (or remove it) if it is unverifiable.
    Default action: annotate (A) unless safe, deterministic code/doc change can be applied.
  - Biased language: detect phrasing that is biased, judgmental, or exclusionary. Replace with neutral language and provide a summary of replacements.
  - Unsupported API endpoints: ensure OpenAPI files correspond to implemented endpoints in the staged diff. If mismatch, produce patches to either the OpenAPI doc or to add stub handler that returns 501 + TODO.
  - Missing tests: verify that core AMM math module has unit tests covering invariants and that a smoke integration test exists for trade→settlement against a mocked lightwalletd.
  - Secrets: confirm no secrets remain. If any possible secrets are found, list them (file + line context) and produce a patch to remove them or replace with env placeholders.

Output requirements (strict):
1) Produce a concise executive summary of findings (max 10 lines).
2) Produce unified-diff patch(es) that directly modify files to fix issues (add annotations, neutralize biased phrasing, fix OpenAPI mismatches, add missing small test stubs). The output must be valid unified-diff format and **only** contain changes to files included in the bundle.
3) For every changed file, include an inline justification comment (one-liner) at top of the patch hunk explaining why the change was made.
4) For each detected hallucination or unsupported factual claim that you cannot safely auto-fix, produce a small block in the summary titled "Unresolved hallucinations" listing file:line:quote and a recommended ASSUMPTION text to insert.
5) All added statements asserting external facts must be either:
     - annotated with "// ASSUMPTION: <explanation>" OR
     - replaced by "EXAMPLE SOURCE — verify before use" placeholder.
6) Replace biased words with alternatives and list them in the summary "Bias corrections".
7) Do not invent external sources. If you recommend a source, mark it as "EXAMPLE SOURCE — verify before use" and do not include any URLs.
8) Do not add real private keys or credentials.
9) Keep patches minimal and focused. Avoid wholesale rewrites.
10) If a requested code change is non-trivial (more than ~40 LOC), instead create a small stub + TODO with an ASSUMPTION marker and an explicit developer action item.

Behavioral rules for the assistant:
- Be conservative: prefer annotation to deletion when in doubt.
- Be explicit about assumptions: any added factual statement must include an ASSUMPTION comment.
- Neutralize language: convert evaluative or sensational phrasing to technical, neutral phrasing.
- For API mismatches: if an endpoint is documented but no handler exists, add a stub handler returning 501 and a TODO referencing the OpenAPI operationId.

Files you will find in the bundle:
- prepush.diff
- README.md
- SECURITY.md
- THREAT_MODEL.md
- OPERATIONAL_RUNBOOK.md
- migrations/001_init.sql (if present)
- services/settlement/openapi.yaml (if present)
- services/oracle/openapi.yaml (if present)
- any other staged files included in diff

Deliver patches only. Begin by listing a one-paragraph summary, then output unified-diff(s).
EOF

echo "AI review prompt written to: $PROMPT_FILE"

# 9) Final guidance for the developer
cat <<MSG

================================================================================
Pre-push verification completed.
================================================================================

Next steps:

1) Inspect the bundle: $OUT_DIR
   - Diff: $DIFF_FILE
   - AI prompt: $PROMPT_FILE

2a) Manual AI review (recommended):
   - Open the files in $OUT_DIR (prepush.diff + docs)
   - Paste the content of prepush.diff and then ai_review_prompt.txt into
     your Cursor session or preferred code assistant
   - Request unified-diff patches
   - Review patches and apply them locally (git apply)

2b) Optional automated call (ASSUMPTION: you have a Cursor CLI or similar):
   - Example (ASSUMPTION; adjust to your tool):
       cursor review --file "$DIFF_FILE" --prompt-file "$PROMPT_FILE" --output "$OUT_DIR/ai_patches.diff"
     (This is an example; your CLI syntax may differ.)

3) If you prefer to proceed without AI review, ensure you:
   - Added ASSUMPTIONS sections in key docs
   - Removed TODOs/FIXMEs or annotated them with risk and plan
   - Confirmed no secrets are staged
   - Linted and ran tests

If any check failed above, fix the issue and re-stage changes, then run again:
   ./scripts/prepush-verify.sh

To enable as a git pre-push hook:
   cp scripts/pre-push.hook .git/hooks/pre-push
   chmod +x .git/hooks/pre-push

MSG

exit 0

