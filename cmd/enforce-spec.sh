#!/usr/bin/env bash
# Enforce: mechanical checks on the spec. No judgment. Exit 1 on any failure.
f="${1:-spec.md}"
fail=0

# The spec is the fenced block. Under 1000 characters.
block=$(awk '/^```/{p=!p; next} p' "$f")
n=$(printf '%s\n' "$block" | wc -m | tr -d ' ')
echo "chars $n"
if [ "$n" -gt 1000 ]; then echo "FAIL over 1000 chars"; fail=1; fi

# The loop composes the plan's steps; which ones run is pattern's, the order is each axis's.
want="judge . steps . work . pattern"
if ! printf '%s\n' "$block" | grep -qF "$want"; then echo "FAIL loop line: $want"; fail=1; fi

# Every step is declared, and the three a plan chooses among are listed together.
for s in pattern steps work verify enforce reduce judge; do
  printf '%s\n' "$block" | grep -q "^$s" || { echo "FAIL $s not declared"; fail=1; }
done
order=$(printf '%s\n' "$block" | grep -oE '^(verify|enforce|reduce)' | tr '\n' ' ')
if [ "$order" != "verify enforce reduce " ]; then echo "FAIL step order: $order"; fail=1; fi

# Every axis the type names has a file beside the spec. Docs was named for three versions
# with no file behind it; this is the check that would have caught it.
dir=$(dirname "$f")
for a in $(printf '%s
' "$block" | sed -n 's/^data Axis = //p' | tr -d ' ' | tr '|' ' '); do
  lower=$(printf '%s' "$a" | tr 'A-Z' 'a-z')
  if [ ! -f "$dir/$lower-axis.md" ]; then echo "FAIL axis $a has no $lower-axis.md"; fail=1; fi
done

# No placeholders.
if grep -nE 'TODO|TBD|XXX' "$f"; then echo "FAIL placeholders"; fail=1; fi

if [ "$fail" -eq 0 ]; then echo PASS; fi
exit "$fail"
