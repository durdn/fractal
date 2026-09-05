#!/bin/sh
# cmd/fixtures/fake-cli.sh: a fake pi/claude CLI for run.test.sh. Prints a fixed JSON
# payload in the shape run.sh parses, and nothing else. Never contacts a network.
#
# It is plugged in through FRACTAL_PI_BIN / FRACTAL_CLAUDE_BIN, the same env vars run.sh
# reads for the real binaries. Behaviour is chosen by env:
#   FRACTAL_FAKE_MODE   ok (default) | fail | garbage | is_error | empty
#   FRACTAL_FAKE_SLEEP  seconds to sleep before printing, for the timeout case
#   FRACTAL_FAKE_SLEEP_AFTER  seconds to sleep after printing: the agent finished its
#                       work and the budget killed it before it could close
#   FRACTAL_FAKE_RC     exit code for mode=fail (default 3)
#   FRACTAL_FAKE_ARGV   file to write the argv it was called with, one arg per line
#   FRACTAL_FAKE_CWD    file to write the directory it was started in
#
# why: the shape (pi NDJSON vs claude single object) is taken from the flags run.sh
# passes, not from an env var, so a test can prove run.sh drives each CLI its own way.
set -u

if [ -n "${FRACTAL_FAKE_ARGV:-}" ]; then
    printf '%s\n' "$@" >"$FRACTAL_FAKE_ARGV"
fi
if [ -n "${FRACTAL_FAKE_CWD:-}" ]; then
    pwd >"$FRACTAL_FAKE_CWD"
fi

shape=pi
for a in "$@"; do
    if [ "$a" = "--output-format" ]; then shape=claude; fi
done

after_sleep() {
    if [ -n "${FRACTAL_FAKE_SLEEP_AFTER:-}" ]; then
        sleep "$FRACTAL_FAKE_SLEEP_AFTER"
    fi
}

if [ -n "${FRACTAL_FAKE_SLEEP:-}" ]; then
    sleep "$FRACTAL_FAKE_SLEEP"
fi

case "${FRACTAL_FAKE_MODE:-ok}" in
fail)
    echo "fake-cli: boom, the model is not available" >&2
    exit "${FRACTAL_FAKE_RC:-3}"
    ;;
garbage)
    echo "fake-cli: this is not JSON at all"
    exit 0
    ;;
empty)
    exit 0
    ;;
esac

if [ "$shape" = pi ]; then
    # why: noise first. run.sh must skip a non-JSON line, a non-message_end event and a
    # user turn, sum usage over the assistant turns, and keep the last turn's text.
    echo "loading model catalog"
    echo '{"type":"message_start","message":{"role":"assistant"}}'
    echo '{"type":"message_end","message":{"role":"user","content":[{"type":"text","text":"the task"}],"usage":{"input":999,"output":999}}}'
    echo '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"first turn"}],"usage":{"input":10,"output":2,"cacheRead":3,"cacheWrite":4,"cost":{"total":0.001}}}}'
    echo '{"type":"message_end","message":{"role":"assistant","content":[{"type":"thinking","text":"dropped"},{"type":"text","text":"fake reply from pi"}],"usage":{"input":20,"output":5,"cacheRead":6,"cacheWrite":8,"cost":{"total":0.002}}}}'
    after_sleep
    exit 0
fi

if [ "${FRACTAL_FAKE_MODE:-ok}" = is_error ]; then
    echo '{"result":"claude hit its limit","is_error":true,"usage":{"input_tokens":1,"output_tokens":1},"total_cost_usd":0.01}'
    exit 0
fi
echo '{"result":"fake reply from claude","is_error":false,"usage":{"input_tokens":31,"output_tokens":8,"cache_read_input_tokens":9,"cache_creation_input_tokens":13},"total_cost_usd":0.004}'
after_sleep
