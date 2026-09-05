#!/bin/sh
# Wire as a hook with: ln -s ../../claude-code/enforce.sh .git/hooks/commit-msg
# This repo does not install hooks itself.
set -eu

# A subject is `type: item: message`: a type, then a tracker item id, a known prefix, a hyphen, an id
# segment, optional dotted child numbers, then a colon and a space.
PATTERN=""

# usage: item_prefixes
# Prints the accepted prefixes, whitespace separated.
item_prefixes() {
    if [ -n "${FRACTAL_ITEM_PREFIX:-}" ]; then
        printf '%s\n' "$FRACTAL_ITEM_PREFIX" | sed 's/,/ /g'
        return 0
    fi
    command -v bd >/dev/null 2>&1 || return 0
    bd list --all --limit 0 --json 2>/dev/null |
        sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
        sed 's/\..*$//; s/-[^-]*$//'
}

# usage: build_pattern
# Sets PATTERN from the accepted prefixes, dropping any that is not a plain
# word so the pattern needs no escaping. 1 when no prefix could be found.
build_pattern() {
    bp_alt=""
    bp_noglob=0
    case "$-" in
    *f*) bp_noglob=1 ;;
    esac
    set -f
    for bp_p in $(item_prefixes); do
        case "$bp_p" in
        *[!A-Za-z0-9_-]*) continue ;;
        esac
        case "|$bp_alt|" in
        *"|$bp_p|"*) continue ;;
        esac
        bp_alt="${bp_alt:+$bp_alt|}$bp_p"
    done
    [ "$bp_noglob" -eq 1 ] || set +f
    [ -n "$bp_alt" ] || return 1
    PATTERN="^(feat|fix|maint|log|doc|spec|port): ($bp_alt)-[A-Za-z0-9]+(\.[0-9]+)*: "
    return 0
}

# usage: subject_ok SUBJECT
# 0 if SUBJECT opens with a tracker item id, 1 otherwise. Git's own subjects,
# "Merge ..." and "Revert ...", are not authored by a person and are exempt.
subject_ok() {
    case "$1" in
    "Merge "* | "Revert "*) return 0 ;;
    esac
    printf '%s\n' "$1" | grep -Eiq "$PATTERN"
}

# usage: check_file PATH
# commit-msg hook mode: PATH holds the message being committed.
check_file() {
    cf_subject="$(head -n 1 "$1")"
    if subject_ok "$cf_subject"; then
        return 0
    fi
    echo "(new commit) $cf_subject" >&2
    return 1
}

# usage: check_range N
check_range() {
    if git rev-parse --verify --quiet origin/HEAD >/dev/null; then
        cr_range="origin/HEAD..HEAD"
    else
        cr_range="-$1 HEAD"
    fi
    cr_bad=0
    while IFS=' ' read -r cr_hash cr_subject; do
        # An empty range still feeds the loop one blank line; that is not a commit.
        [ -n "$cr_hash" ] || continue
        if subject_ok "$cr_subject"; then
            continue
        fi
        echo "$cr_hash $cr_subject" >&2
        cr_bad=1
    done <<EOF
$(git log --format='%h %s' $cr_range)
EOF
    return $cr_bad
}

usage() {
    cat <<EOF
usage: enforce.sh [-n COUNT] [MSG_FILE]

With MSG_FILE, checks that file's first line, as a commit-msg hook does.
With no file, checks the commits this branch has beyond origin/HEAD, or
the last COUNT commits when there is no origin/HEAD. COUNT defaults to 1.

Set FRACTAL_ITEM_PREFIX to the tracker's id prefix, or to several separated
by spaces or commas. Unset, the prefix comes from the ids the repository's
tracker reports. Exit 1 when a subject names no item, 2 on a usage error,
3 when the prefix could not be determined.
EOF
}

# usage: require_count FLAG [VALUE...]
require_count() {
    if [ $# -lt 2 ] || ! printf '%s\n' "$2" | grep -Eq '^[0-9]+$'; then
        echo "enforce: $1 needs a whole number" >&2
        usage >&2
        exit 2
    fi
}

# usage: no_prefix
no_prefix() {
    echo "enforce: cannot determine the tracker id prefix" >&2
    echo "enforce: set FRACTAL_ITEM_PREFIX, for example FRACTAL_ITEM_PREFIX=eng" >&2
    echo "enforce: or run where the tracker reports this repository's items" >&2
    exit 3
}

main() {
    m_n=1
    m_file=""
    while [ $# -gt 0 ]; do
        case "$1" in
        -n)
            require_count "$@"
            m_n="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            m_file="$1"
            shift
            ;;
        esac
    done
    build_pattern || no_prefix
    if [ -n "$m_file" ]; then
        check_file "$m_file"
        return $?
    fi
    check_range "$m_n"
}

main "$@"
