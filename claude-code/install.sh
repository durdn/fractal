#!/bin/sh
# install.sh: installs this folder as a Claude Code skill, plus its agents.
# POSIX sh has no local variables, so every function reads its arguments
# through positionals and writes only names prefixed for itself. No function
# reads a variable another function assigns.
set -eu

# usage: to_win POSIX_PATH
to_win() {
    cygpath -w "$1"
}

# usage: link_dir SRC DST
# MSYS_NO_PATHCONV stops Git Bash rewriting the /J switch into a path,
# and cmd /c (one slash) survives that same setting.
link_dir() {
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(to_win "$2")" "$(to_win "$1")" \
        >/dev/null 2>&1
}

# usage: script_dir
script_dir() {
    (cd "$(dirname "$0")" && pwd)
}

# usage: compute_home OVERRIDE
compute_home() {
    if [ -n "$1" ]; then
        (cd "$1" && pwd)
        return 0
    fi
    (cd "$(script_dir)/.." && pwd)
}

# usage: verify_home HOME
verify_home() {
    if [ ! -f "$1/spec.md" ]; then
        echo "fractal: no spec.md under $1, not a fractal home" >&2
        exit 1
    fi
}

# usage: unlink_dir PATH
# rmdir unlinks a junction without touching what it points at, and refuses
# a real directory with anything in it, so nothing is deleted through it.
unlink_dir() {
    MSYS_NO_PATHCONV=1 cmd /c rmdir "$(to_win "$1")" >/dev/null 2>&1 ||
        rm -f "$1" 2>/dev/null ||
        true
}

# usage: install_skill SRC DST
# A junction at the destination goes first: rm would delete through it.
install_skill() {
    mkdir -p "$(dirname "$2")"
    unlink_dir "$2"
    rm -rf "$2"
    if link_dir "$1" "$2"; then
        echo "linked (junction): $2 -> $1"
        return 0
    fi
    cp -r "$1" "$2"
    echo "copied: $2 <- $1"
}

# usage: remove_home SKILL_DIR
remove_home() {
    rm -f "$1/home.path"
    unlink_dir "$1/home"
}

# usage: write_home_path SKILL_DIR HOME
# Never a link: while the skill is a junction its folder is the source tree,
# so a link there would aim the tree at itself.
write_home_path() {
    remove_home "$1"
    echo "$2" >"$1/home.path"
    echo "wrote $1/home.path holding $2"
}

# usage: frontmatter ROLE
# Claude Code's half of a role file. The body is shared, one file per role
# under HOME/roles; only these keys are per harness. A role with no row here
# stops the install, so a body can never ship without its frontmatter.
frontmatter() {
    case "$1" in
    fractal-lead)
        fm_d="Plans a loop: pattern on its item, the top model, memory first; runs no step and judges nothing, the process runs the plan and the record decides; used when a task is a loop."
        fm_m="opus"
        fm_e="high"
        fm_t="Read, Write, Edit, Glob, Grep, Bash"
        ;;
    fractal-scout)
        fm_d="Reads code, tracker, files or a web page to answer a question with facts, no opinions; used when pattern's agent or a worker needs ground truth before acting."
        fm_m="sonnet"
        fm_e="low"
        fm_t="Read, Glob, Grep, Bash, WebFetch"
        ;;
    fractal-worker)
        fm_d="Produces the artifact its task names, inside the files the task names, and nowhere else; runs the work step of a loop."
        fm_m="sonnet"
        fm_e="high"
        fm_t="Read, Write, Edit, Glob, Grep, Bash"
        ;;
    fractal-verifier)
        fm_d="Writes or runs tests that see a behavior fail before a change and pass after, never for code it authored; runs the verify step of a loop."
        fm_m="opus"
        fm_e="high"
        fm_t="Read, Glob, Grep, Bash, Write"
        ;;
    fractal-senior)
        fm_d="Runs reduce on a diff: the numbers, then what the intent does not need comes out; used after work and verify."
        fm_m="opus"
        fm_e="high"
        fm_t="Read, Write, Edit, Glob, Grep, Bash"
        ;;
    *)
        echo "fractal: no Claude Code frontmatter for role $1" >&2
        exit 1
        ;;
    esac
    printf -- '---\nname: %s\ndescription: %s\nmodel: %s\neffort: %s\ntools: %s\n---\n\n' \
        "$1" "$fm_d" "$fm_m" "$fm_e" "$fm_t"
}

# usage: install_roles HOME DST
# One agent file per shared body, this harness's frontmatter on top.
install_roles() {
    mkdir -p "$2"
    ir_n=0
    for ir_f in "$1"/roles/*.md; do
        [ -e "$ir_f" ] || continue
        ir_r="$(basename "$ir_f" .md)"
        {
            frontmatter "$ir_r"
            cat "$ir_f"
        } >"$2/$ir_r.md"
        echo "wrote: $2/$ir_r.md"
        ir_n=$((ir_n + 1))
    done
    if [ "$ir_n" -eq 0 ]; then
        echo "fractal: no role bodies found under $1/roles" >&2
        exit 1
    fi
    echo "installed $ir_n agent files into $2"
}

# usage: uninstall SKILL_DST AGENTS_DST HOME
# home.path goes first: while SKILL_DST is a junction it lives in the source.
uninstall() {
    remove_home "$1"
    if [ -e "$1" ] || [ -L "$1" ]; then
        rm -rf "$1"
        echo "removed $1"
    fi
    for un_f in "$3"/roles/*.md; do
        [ -e "$un_f" ] || continue
        un_t="$2/$(basename "$un_f")"
        [ -e "$un_t" ] || continue
        rm -f "$un_t"
        echo "removed $un_t"
    done
}

usage() {
    cat <<EOF
usage: install.sh [--home PATH] [--dest DIR] [--uninstall] [--help]

Installs this folder as a Claude Code skill (DIR/skills/fractal) plus its
agents (DIR/agents). --dest sets the Claude config root, default
\$HOME/.claude. --home overrides the computed FRACTAL_HOME. --uninstall
removes what this script installed.
EOF
}

# usage: require_value FLAG [VALUE...]
require_value() {
    if [ $# -lt 2 ]; then
        echo "fractal: $1 needs a value" >&2
        usage >&2
        exit 2
    fi
}

# usage: run UNINSTALL DEST HOME SRC
run() {
    if [ "$1" -eq 1 ]; then
        uninstall "$2/skills/fractal" "$2/agents" "$3"
        return 0
    fi
    verify_home "$3"
    install_skill "$4" "$2/skills/fractal"
    write_home_path "$2/skills/fractal" "$3"
    install_roles "$3" "$2/agents"
}

main() {
    m_home=""
    m_dest="$HOME/.claude"
    m_uninstall=0
    while [ $# -gt 0 ]; do
        case "$1" in
        --home)
            require_value "$@"
            m_home="$2"
            shift 2
            ;;
        --dest)
            require_value "$@"
            m_dest="$2"
            shift 2
            ;;
        --uninstall)
            m_uninstall=1
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo "fractal: unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
        esac
    done
    m_resolved="$(compute_home "$m_home")"
    run "$m_uninstall" "$m_dest" "$m_resolved" "$(script_dir)"
}

main "$@"
