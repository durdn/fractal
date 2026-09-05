---
name: fractal
description: Run a requested Fractal loop with this session planning, coordinating work and judging evidence. Use when the user invokes /fractal or asks to use the Fractal framework.
argument-hint: <intent>
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Agent]
---

# fractal

Intent: $ARGUMENTS

Home is `$FRACTAL_HOME`, or the path inside `home.path` beside this file. If neither exists, run `node install.mjs` from the checkout and try again.

Read `<home>/spec.md`, then `code-axis.md` or `research-axis.md`, in full, verbatim; code when unsure. You are the process: plan by default, delegate independent work, judge the evidence. Add a planning child only for uncertain decomposition or a requested challenge. The axis holds the steps and tools. Read the project's rules; user scope and existing authorization govern.
