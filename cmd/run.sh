#!/bin/sh
# cmd/run.sh: dispatch one headless coding agent (pi or claude), enforce its
# budget with `timeout`, and print exactly one JSON line:
# {"runner","model","seconds","reply","usage","exit"}. Exits 0 on success,
# 1 on failure or timeout, with the reason in reply.
#
# usage: run.sh [-p <provider>] <pi|claude> <model> <budget-min> <cwd> [task]
# Task is the last argument, or read from stdin when absent. -p defaults to
# openai-codex and applies to pi only.
#
# why: binaries come from env so a test can swap in a fake CLI.
set -u

pi_bin=${FRACTAL_PI_BIN:-pi}
claude_bin=${FRACTAL_CLAUDE_BIN:-claude}
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# why: one writer of the JSON line, on every path, so the shape never drifts. It
# is run-parse.mjs, a file, so it can be read and linted; this script never
# quotes model output.
# argv: runner model seconds exit reason. reason set means no CLI ran, or it
# ran but failed before producing parseable output; stdin is then unused.
# reason empty means stdin holds the CLI's raw stdout, to be parsed.
emit() {
    node "$here/run-parse.mjs" "$1" "$2" "$3" "$4" "$5"
    exit $?
}

# why: the budget is a failure, but what the agent produced before it is not the
# budget's to throw away. Same argv plus KEEP, with the raw file on stdin.
emit_keeping() {
    node "$here/run-parse.mjs" "$1" "$2" "$3" "$4" "$5" 1 <"$rawfile"
    exit $?
}

provider=openai-codex
# why: `shift 2` with one argument is fatal in dash, so the guard comes first.
if [ "${1-}" = "-p" ]; then
    [ $# -ge 2 ] || emit "" "" 0 "" "bad args: -p requires a provider"
    provider=$2
    shift 2
fi

if [ $# -lt 4 ]; then
    emit "${1-}" "${2-}" 0 "" "bad args: usage run.sh [-p provider] <pi|claude> <model> <budget-min> <cwd> [task]"
fi

runner=$1
model=$2
budget_min=$3
cwd=$4
shift 4

case "$runner" in
pi | claude) ;;
*) emit "$runner" "$model" 0 "" "bad args: runner must be pi or claude, got '$runner'" ;;
esac

case "$budget_min" in
'' | *[!0-9.]* | .) emit "$runner" "$model" 0 "" "bad args: budget-min must be numeric, got '$budget_min'" ;;
esac

# why: `timeout 0m` is unlimited, so a budget of zero would run unbounded, which
# is the one thing a budget exists to stop. Digits and dots only by now, so a
# value with no digit above zero left in it is zero.
case "$(printf '%s' "$budget_min" | tr -d '0.')" in
'') emit "$runner" "$model" 0 "" "bad args: budget-min must be greater than 0, got '$budget_min'" ;;
esac

if [ ! -d "$cwd" ]; then
    emit "$runner" "$model" 0 "" "bad args: cwd not found: $cwd"
fi

if [ $# -ge 1 ]; then
    task=$1
else
    task=$(cat)
fi

rawfile=$(mktemp) && errfile=$(mktemp) || emit "$runner" "$model" 0 "" "bad args: mktemp failed"
trap 'rm -f "$rawfile" "$errfile"' EXIT

start=$(date +%s)
# why: TERM at the budget, KILL 30 s later. The grace is what lets an agent that
# traps TERM close its item and flush its JSON; a child that ignores TERM still
# dies and the budget still holds, coming back as 137 instead of 124.
if [ "$runner" = pi ]; then
    timeout -k 30 "${budget_min}m" sh -c 'cd "$1" && shift && exec "$@"' sh "$cwd" \
        "$pi_bin" -p --mode json --provider "$provider" --model "$model" -t read --no-session "$task" \
        >"$rawfile" 2>"$errfile"
else
    timeout -k 30 "${budget_min}m" sh -c 'cd "$1" && shift && exec "$@"' sh "$cwd" \
        "$claude_bin" -p "$task" --model "$model" --output-format json \
        >"$rawfile" 2>"$errfile"
fi
rc=$?
seconds=$(($(date +%s) - start))

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
    emit_keeping "$runner" "$model" "$seconds" "$rc" "timeout: budget of ${budget_min}m exceeded"
elif [ "$rc" -ne 0 ]; then
    detail=$(head -c 300 "$errfile" 2>/dev/null)
    emit "$runner" "$model" "$seconds" "$rc" "$runner exited $rc: ${detail:-no stderr}"
else
    emit "$runner" "$model" "$seconds" "$rc" "" <"$rawfile"
fi
