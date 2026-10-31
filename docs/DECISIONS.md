# Engineering decisions

## Latest direction clarification

The owner explicitly wants an AutoCAD-class application, not a product limited to the
plate experiment. The default UI is now the 2D drafting workspace, with original code
and assets implementing familiar workflows. The existing 3D experiment remains at
`/index.html`. See `AUTOCAD-DIRECTION.md` and `REVIEW-RESULTS.md` for the updated scope
and the actually completed Gemini collaboration. The earlier sections below describe
the initial geometry milestone and are retained as development history.

## Direction and scope

The user approved starting an independent open-source CAD project and publishing
incremental progress on GitHub. AutoCAD-scale ambition is the long-term direction.
The first experiment follows a 3D parametric-part workflow; a full 2D drafting
application and DWG compatibility are separate unsolved scopes.

## Working name

Temporary repository name: `cad-lab`. Candidate brands: Kivora CAD, Veyra CAD,
Orvanta CAD. An exact-name web search returned no matches during the initial check;
this is not a trademark, domain, or package-name clearance. No domain is purchased.

## First executable milestone

A plate 80 × 50 × 6 mm with four 5 mm through-holes whose centers are 10 mm from
the adjacent edges. Changing the width to 100 mm preserves these margins.
Use a versioned JSON project format; STEP is an exchange format, not the editable
feature history. Parameter-driven regeneration does not prove a general sketch solver.

## Technology experiment

Use Python 3.12 and build123d 0.13.0 over Open CASCADE for the initial geometry
experiment. Keep the application model independent from presentation code.
The final desktop shell, language mix, and platform strategy remain open.

Start with Windows, which is the current development environment. Dependencies
belong in a project-specific virtual environment. No global Python changes are needed.

## Public development

Original work is MIT-licensed with explicit upstream attribution. Use small commits
for meaningful changes, run relevant checks, and publish the source under the user's
GitHub account. Do not publish credentials, generated environments, or unrelated files.
This project does not change existing websites, DNS, or production deployments.
