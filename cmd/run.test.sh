#!/bin/sh
# cmd/run.test.sh: tests for cmd/run.sh, driven by cmd/fixtures/fake-cli.sh.
# No network, no real CLI: FRACTAL_PI_BIN / FRACTAL_CLAUDE_BIN point at the fake.
# usage: sh cmd/run.test.sh   (exit 0 all green, 1 on any failure)
set -u

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUN_SH=$here/run.sh
FAKE=$here/fixtures/fake-cli.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
ARGV=$work/argv
CWDFILE=$work/cwd
out=$work/out
err=$work/err

pass=0
fail=0

ok() {
    pass=$((pass + 1))
}
bad() {
    fail=$((fail + 1))
    echo "FAIL: $case: $1" >&2
    echo "      stdout: $(cat "$out")" >&2
}
is() { # is <label> <got> <want>
    if [ "$2" = "$3" ]; then ok; else bad "$1: got [$2] want [$3]"; fi
}
has() { # has <label> <haystack> <needle>
    case "$2" in
    *"$3"*) ok ;;
    *) bad "$1: [$2] does not contain [$3]" ;;
    esac
}

# why: every path must print exactly one JSON line; a second line or none is the drift
# the single emit() exists to prevent. Parsed with node, the same parser run.sh uses.
lines() { wc -l <"$out" | tr -d ' '; }
field() { node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").trim();const o=JSON.parse(l);const v=process.argv[2].split(".").reduce((a,k)=>a===undefined?a:a[k],o);process.stdout.write(v===undefined?"<undefined>":typeof v==="object"?JSON.stringify(v):String(v))' "$out" "$1"; }

run() { # run <args...>; captures stdout, stderr and the exit code
    env FRACTAL_PI_BIN="$FAKE" FRACTAL_CLAUDE_BIN="$FAKE" \
        FRACTAL_FAKE_ARGV="$ARGV" FRACTAL_FAKE_CWD="$CWDFILE" \
        sh "$RUN_SH" "$@" >"$out" 2>"$err"
    rc=$?
}

case="pi success"
run pi model-a 1 "$work" "do the thing"
is "exit code" "$rc" 0
is "one json line" "$(lines)" 1
is "runner" "$(field runner)" pi
is "model" "$(field model)" model-a
is "reply is the last assistant turn" "$(field reply)" "fake reply from pi"
is "usage summed over turns" "$(field usage)" '{"input":30,"output":7,"cacheRead":9,"cacheWrite":12,"cost":0.003}'
is "exit field" "$(field exit)" 0
is "seconds is a number" "$(field seconds)" 0
is "cd into cwd" "$(cat "$CWDFILE")" "$(CDPATH= cd -- "$work" && pwd)"
has "flags: headless json" "$(cat "$ARGV")" "--mode"
has "flags: default provider" "$(cat "$ARGV")" "openai-codex"
has "flags: read-only tools" "$(cat "$ARGV")" "--no-session"
is "task is the last arg" "$(tail -n 1 "$ARGV")" "do the thing"

case="pi provider override"
run -p anthropic pi model-a 1 "$work" t
is "exit code" "$rc" 0
has "provider passed through" "$(cat "$ARGV")" "anthropic"
if [ -s "$ARGV" ] && ! grep -q '^openai-codex$' "$ARGV"; then ok; else bad "default provider still sent"; fi

case="pi task from stdin"
printf 'task off stdin' | env FRACTAL_PI_BIN="$FAKE" FRACTAL_FAKE_ARGV="$ARGV" \
    sh "$RUN_SH" pi model-a 1 "$work" >"$out" 2>"$err"
is "exit code" "$?" 0
is "stdin became the task" "$(tail -n 1 "$ARGV")" "task off stdin"
is "one json line" "$(lines)" 1

case="claude success"
run claude model-b 1 "$work" "hello"
is "exit code" "$rc" 0
is "one json line" "$(lines)" 1
is "runner" "$(field runner)" claude
is "reply is result" "$(field reply)" "fake reply from claude"
is "usage mapped from claude names" "$(field usage)" '{"input":31,"output":8,"cacheRead":9,"cacheWrite":13,"cost":0.004}'
is "exit field" "$(field exit)" 0
has "flags: json output" "$(cat "$ARGV")" "--output-format"

# why: usage is asserted whole, not one field: a caller reading usage.cacheRead must not
# have to know which path produced the line.
case="pi non-zero exit"
FRACTAL_FAKE_MODE=fail run pi model-a 1 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reason names the runner and its code" "$(field reply)" "pi exited 3"
has "reason carries the stderr" "$(field reply)" "boom, the model is not available"
is "exit field is the CLI code" "$(field exit)" 3
is "usage empty" "$(field usage.input)" 0
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="claude non-zero exit"
FRACTAL_FAKE_MODE=fail FRACTAL_FAKE_RC=7 run claude model-b 1 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reason names the runner and its code" "$(field reply)" "claude exited 7"
is "exit field is the CLI code" "$(field exit)" 7

case="pi timeout"
# why: 0.01m is 0.6s, the smallest budget the numeric check accepts; the fake sleeps past it.
FRACTAL_FAKE_SLEEP=5 run pi model-a 0.01 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reply names the timeout and the budget" "$(field reply)" "timeout: budget of 0.01m exceeded"
is "exit field is timeout's 124" "$(field exit)" 124
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="claude timeout"
FRACTAL_FAKE_SLEEP=5 run claude model-b 0.01 "$work" t
is "exit code" "$rc" 1
has "reply names the timeout" "$(field reply)" "timeout: budget of 0.01m exceeded"
is "runner" "$(field runner)" claude
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="claude killed at budget after it produced its reply"
# why: the kill is still a failure, but what the agent had already written is not the
# budget's to throw away; the reason and the reply both travel, and usage is the real one.
FRACTAL_FAKE_SLEEP_AFTER=5 run claude model-b 0.01 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reply names the timeout" "$(field reply)" "timeout: budget of 0.01m exceeded"
has "reply keeps what the agent produced" "$(field reply)" "fake reply from claude"
is "exit field is timeout's 124" "$(field exit)" 124
is "usage is the real one, not zero" "$(field usage.input)" 31

case="pi killed at budget after it produced its reply"
FRACTAL_FAKE_SLEEP_AFTER=5 run pi model-a 0.01 "$work" t
has "reply keeps the last pi turn" "$(field reply)" "fake reply from pi"
is "usage sums the assistant turns" "$(field usage.input)" 30

case="claude non-zero exit usage"
FRACTAL_FAKE_MODE=fail FRACTAL_FAKE_RC=7 run claude model-b 1 "$work" t
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="unparseable CLI output"
FRACTAL_FAKE_MODE=garbage run pi model-a 1 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
is "reply says no reply" "$(field reply)" "pi: no reply in its output"
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="claude is_error"
FRACTAL_FAKE_MODE=is_error run claude model-b 1 "$work" t
is "exit code" "$rc" 1
is "reply is the model's own text" "$(field reply)" "claude hit its limit"
is "usage is the CLI's own, same five keys" "$(field usage)" '{"input":1,"output":1,"cacheRead":0,"cacheWrite":0,"cost":0.01}'

case="bad runner"
run herdr model-a 1 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reason names the bad runner" "$(field reply)" "runner must be pi or claude, got 'herdr'"
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="non-numeric budget"
run pi model-a abc "$work" t
is "exit code" "$rc" 1
has "reason names the budget" "$(field reply)" "budget-min must be numeric, got 'abc'"

# why: `timeout 0m` is unlimited, so a budget of 0 used to mean no budget at all: the one
# thing the argument exists to prevent. It is refused before any CLI starts.
case="budget of zero"
run pi model-a 0 "$work" t
is "exit code" "$rc" 1
is "one json line" "$(lines)" 1
has "reason names the budget" "$(field reply)" "budget-min must be greater than 0, got '0'"
is "exit field is null, no child ran" "$(field exit)" null
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="budget of zero, written long"
run claude model-b 0.00 "$work" t
is "exit code" "$rc" 1
has "reason names the budget" "$(field reply)" "budget-min must be greater than 0, got '0.00'"
is "one json line" "$(lines)" 1

case="smallest budget above zero still runs"
run pi model-a 0.01 "$work" t
is "exit code" "$rc" 0
is "reply is the last assistant turn" "$(field reply)" "fake reply from pi"

case="missing cwd"
run pi model-a 1 "$work/nope" t
is "exit code" "$rc" 1
has "reason names the missing cwd" "$(field reply)" "cwd not found"

case="too few args"
run pi model-a 1
is "exit code" "$rc" 1
has "reason is usage" "$(field reply)" "usage run.sh"
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

case="-p with no provider"
run -p
is "exit code" "$rc" 1
has "reason names the flag" "$(field reply)" "-p requires a provider"
is "usage carries the success key set" "$(field usage)" '{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":0}'

echo "run.test.sh: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
