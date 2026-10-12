---
name: new-adr
description: Draft the next Architecture Decision Record in docs/adr/ from the project template and add its row to the ADR index.
disable-model-invocation: true
argument-hint: <decision title>
---

Draft a new ADR titled: $ARGUMENTS

1. Find the next number: the highest `NNNN-*.md` in `docs/adr/`, plus
   one. Numbers are never reused, even where there are gaps.
2. Name the file `docs/adr/NNNN-kebab-case-title.md`. Title files the
   way the existing ones do: the decision as a short claim
   (`0029-a-day-is-the-fraction-you-got-through.md`), not a topic.
3. Copy the structure of `docs/adr/template.md`. Set **Status:
   Proposed** and today's date. Leave **Decision** empty — it is
   written only when the ADR is accepted, and that is the user's call.
4. Fill **Context** from what the conversation and code establish, and
   cite the ADRs and `vision.md` sections it builds on. Put anything
   undecided under **Open questions**; do not answer them yourself.
5. Add a row to the index table in `docs/adr/README.md` with status
   "Proposed".
6. If the ADR would amend an accepted one, do not edit that ADR now.
   Note under **Consequences** which section it would amend; the dated
   amendment note is added only on acceptance.
7. Wrap prose at about 72 columns, like the existing ADRs.

Show the user the draft and the open questions when done.
