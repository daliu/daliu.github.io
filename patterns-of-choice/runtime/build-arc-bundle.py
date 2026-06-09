#!/usr/bin/env python3
"""Merge canonical recurring-character arc content into the runtime content bundle.

Idempotent + reproducible: reads the canonical patterns-of-choice repo (specs are
the source of truth) and writes the arc-dependent keys into
runtime/content-bundle.v0.1.json WITHOUT touching the existing quickfires /
values / narratives. Re-run whenever the canonical arc, its climax, or the H8
pairing change.

Adds three keys:
  arcs          : [ arc-biscuit ]                     (full arc, inline build-up beats)
  arcScenarios  : { "narr-allocation-008": <narrative> }  (scenarios referenced by
                  high_stakes beats via scenario_ref; kept OUT of the daily
                  narrative rotation, which only reads `narratives`)
  h8Probes      : [ { pair, abstract item, narrative signal } ]  (sets up the on-device
                  H8b abstract-vs-narrative divergence read)

Canonical repo path: $POC_CANON, else the sibling ../patterns-of-choice.
"""
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve()
DALIU_ROOT = HERE.parents[2]                      # .../Code/daliu.github.io
CANON = Path(os.environ.get("POC_CANON", HERE.parents[3] / "patterns-of-choice"))
BUNDLE = HERE.parent / "content-bundle.v0.1.json"


def load(p):
    with open(p) as f:
        return json.load(f)


def main():
    assert CANON.exists(), f"canonical repo not found: {CANON} (set POC_CANON)"
    bundle = load(BUNDLE)

    # ALL arcs (each scenarios/arcs/*.json). The runtime renders a thread per arc.
    arcs = [load(p) for p in sorted((CANON / "scenarios/arcs").glob("*.json"))]

    # Collect every scenario referenced by a high_stakes beat's scenario_ref, and
    # every H8 pair any arc's climax pairs_with.
    arc_scenarios = {}
    arc_pair_ids = set()
    for arc in arcs:
        for beat in arc["beats"]:
            ref = beat.get("scenario_ref")
            if ref:
                arc_scenarios[ref] = load(CANON / f"scenarios/sample/{ref}.json")
            if beat.get("pairs_with"):
                arc_pair_ids.add(beat["pairs_with"])

    # Build the on-device H8 read input, computing each probe's near/far poles from
    # the abstract item's option tags (near = the identified counterparty; far =
    # counterparty:anonymous), so the divergence read is per-probe, not hardcoded.
    def pole_tags(options):
        near = far = None
        for o in options:
            ctags = [t for t in (o.get("tags") or []) if t.startswith("counterparty:")]
            if "counterparty:anonymous" in ctags:
                far = "counterparty:anonymous"
            else:
                for t in ctags:
                    if t != "counterparty:anonymous":
                        near = t
        return near, far

    pairs = load(CANON / "scenarios/h8-probe-pairs.json")["pairs"]
    h8_probes = []
    for p in pairs:
        if p["pair_id"] not in arc_pair_ids:
            continue
        aref = p["abstract_ref"]
        qf = load(CANON / f"scenarios/sample/{aref['scenario_id']}.json")
        item = next((it for it in qf["items"] if it["id"] == aref["item_id"]), None)
        assert item, f"abstract item {aref['item_id']} not found in {aref['scenario_id']}"
        near, far = pole_tags(item["options"])
        assert near and far, f"could not derive near/far poles for {p['pair_id']}"
        h8_probes.append({
            "pair_id": p["pair_id"],
            "domain": p["domain"],
            "stakes_level": p["stakes_level"],
            "near_tag": near,
            "far_tag": far,
            "abstract": {
                "scenario_id": aref["scenario_id"],
                "item_id": aref["item_id"],
                "prompt": item["prompt"],
                "options": item["options"],
            },
            "narrative": {
                "scenario_id": p["narrative_ref"]["scenario_id"],
                "signal": p["narrative_ref"]["signal"],
            },
        })

    # Cost-of-virtue probes (the break-point ladder on a previously-stated value).
    cov_probes = []
    for path in sorted((CANON / "scenarios/sample").glob("cov-*.json")):
        c = load(path)
        cov_probes.append({
            "id": c["id"],
            "domain": c["domain"],
            "value_slot": c["value_slot"],
            "framing_prompt": c["framing_prompt"],
            "framing_question": c["framing_question"],
            "ladder": c["ladder"],
            "no_option": c["no_option"],
            "alternate_no_option": c.get("alternate_no_option"),
            "break_point_field": c.get("analysis", {}).get("break_point_field", "first_accept_stake"),
        })

    bundle["arcs"] = arcs
    bundle["arcScenarios"] = arc_scenarios
    bundle["h8Probes"] = h8_probes
    bundle["covProbes"] = cov_probes
    # Strip any previously-appended arcs+cov suffix(es) before re-adding exactly
    # one, so the provenance string doesn't grow on every rebuild. Split on the
    # marker we actually append ("| arcs+cov:"), not the legacy "| arcs:".
    base_provenance = bundle.get("_provenance", "").split(" | arcs+cov:")[0].split(" | arcs:")[0]
    bundle["_provenance"] = (
        base_provenance
        + " | arcs+cov: generated by runtime/build-arc-bundle.py from canonical "
        "scenarios/arcs/*.json + referenced climaxes + h8-probe-pairs.json + cov-*.json"
    )

    with open(BUNDLE, "w") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"merged into {BUNDLE.name}:")
    print(f"  arcs: {[(a['arc_id'], len(a['beats'])) for a in bundle['arcs']]}")
    print(f"  arcScenarios: {list(arc_scenarios)}")
    print(f"  h8Probes: {[(h['pair_id'], h['near_tag'], h['far_tag']) for h in h8_probes]}")
    print(f"  covProbes: {len(cov_probes)} ({sorted({c['value_slot'] for c in cov_probes})})")


if __name__ == "__main__":
    main()
