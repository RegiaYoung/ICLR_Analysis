#!/usr/bin/env python3
"""
Build institution- and reviewer-level metrics from people/reviews/institutions.
Outputs JSON files (no UI wiring).
"""
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "review-data"
OUT_DIR = DATA_DIR / "affiliation_analysis"


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def normalize_inst_name(name: str) -> str:
    if not name:
        return "unknown"
    cleaned = name.lower()
    # remove common punctuation/separators
    cleaned = re.sub(r"[.,;:/\\-]+", " ", cleaned)
    # collapse whitespace
    cleaned = re.sub(r"\\s+", " ", cleaned).strip()
    return cleaned or "unknown"


def count_words(text: str) -> int:
    if not text:
        return 0
    return len(re.findall(r"\\w+", text))


def safe_mean(values):
    vals = [v for v in values if v is not None]
    return mean(vals) if vals else None


def safe_std(values):
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return None
    m = mean(vals)
    return math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals))


def safe_corr(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 2:
        return None
    xs_f, ys_f = zip(*pairs)
    mx, my = mean(xs_f), mean(ys_f)
    num = sum((x - mx) * (y - my) for x, y in pairs)
    den_x = math.sqrt(sum((x - mx) ** 2 for x in xs_f))
    den_y = math.sqrt(sum((y - my) ** 2 for y in ys_f))
    if den_x == 0 or den_y == 0:
        return None
    return num / (den_x * den_y)


def ensure_inst(inst_map, name, country=None, inst_type=None, counts=None):
    norm = normalize_inst_name(name)
    if norm not in inst_map:
        inst_map[norm] = {
            "canonical_name": name or "Unknown",
            "country": country,
            "institution_type": inst_type,
            "author_count": None,
            "reviewer_count": None,
            "total_members": None,
        }
    # fill missing counts/type if provided
    if counts:
        inst_map[norm]["author_count"] = counts.get("author_count", inst_map[norm]["author_count"])
        inst_map[norm]["reviewer_count"] = counts.get("reviewer_count", inst_map[norm]["reviewer_count"])
        inst_map[norm]["total_members"] = counts.get("total_members", inst_map[norm]["total_members"])
    if inst_type and not inst_map[norm].get("institution_type"):
        inst_map[norm]["institution_type"] = inst_type
    if country and not inst_map[norm].get("country"):
        inst_map[norm]["country"] = country
    return norm


def build_inst_lookup(institutions_raw):
    inst_map = {}
    for inst in institutions_raw:
        name = inst.get("institution_name")
        country = inst.get("country")
        inst_type = inst.get("institution_type") or inst.get("type")
        counts = {
            "author_count": inst.get("author_count"),
            "reviewer_count": inst.get("reviewer_count"),
            "total_members": inst.get("total_members"),
        }
        ensure_inst(inst_map, name, country=country, inst_type=inst_type, counts=counts)
    return inst_map


def build_person_insts(people, inst_map):
    person_insts = {}
    person_country = {}
    for pid, pdata in people.items():
        insts = pdata.get("institutions") or []
        # fallback: some datasets only provide single "institution"
        if not insts and pdata.get("institution"):
            insts = [pdata["institution"]]
        norm_list = []
        for inst in insts:
            if isinstance(inst, str):
                inst_obj = {"name": inst}
            elif isinstance(inst, dict):
                inst_obj = inst
            else:
                # ignore unsupported types but keep "unknown" fallback later
                continue
            norm = ensure_inst(
                inst_map,
                inst_obj.get("name"),
                country=inst_obj.get("country"),
                inst_type=inst_obj.get("type") or inst_obj.get("institution_type"),
            )
            norm_list.append(norm)
        if not norm_list:
            norm_list = ["unknown"]
        person_insts[pid] = norm_list
        if pdata.get("nationality"):
            person_country[pid] = pdata["nationality"]
    return person_insts, person_country


def build_submission_authors(people):
    submission_authors = defaultdict(list)
    for pid, pdata in people.items():
        for sub in pdata.get("authored_papers") or []:
            submission_authors[str(sub)].append(pid)
    return submission_authors


def aggregate(reviews_raw, people, inst_map):
    person_insts, person_country = build_person_insts(people, inst_map)
    submission_authors = build_submission_authors(people)

    reviewer_metrics = defaultdict(
        lambda: {
            "ratings": [],
            "confidences": [],
            "text_words": [],
            "question_words": [],
        }
    )
    inst_reviewer_metrics = defaultdict(
        lambda: {
            "ratings": [],
            "confidences": [],
            "text_words": [],
            "question_words": [],
        }
    )
    inst_author_metrics = defaultdict(
        lambda: {
            "ratings": [],
            "confidences": [],
            "review_count": 0,
            "submission_count": 0,
        }
    )
    flows = defaultdict(lambda: {"count": 0, "ratings": []})
    submission_diversity = {}

    missing_reviewer_inst = 0
    total_reviews = 0

    for sub_id, sub_data in reviews_raw.items():
        reviews = sub_data.get("reviews") or []
        ratings_for_sub = []
        reviewer_insts_for_sub = []

        author_ids = submission_authors.get(sub_id, [])
        author_inst_set = set()
        for aid in author_ids:
            author_inst_set.update(person_insts.get(aid, ["unknown"]))
        if not author_inst_set:
            author_inst_set = {"unknown"}

        for rev in reviews:
            total_reviews += 1
            reviewer_id = rev.get("reviewer_id") or "unknown"
            rating = rev.get("rating")
            confidence = rev.get("confidence")
            content = rev.get("content") or {}
            summary = content.get("summary")
            strengths = content.get("strengths")
            weaknesses = content.get("weaknesses")
            questions = content.get("questions")
            text_words = count_words(summary) + count_words(strengths) + count_words(weaknesses) + count_words(questions)
            question_words = count_words(questions)

            reviewer_insts = person_insts.get(reviewer_id, ["unknown"])
            if not reviewer_insts:
                reviewer_insts = ["unknown"]
                missing_reviewer_inst += 1

            # reviewer metrics
            rm = reviewer_metrics[reviewer_id]
            rm["ratings"].append(rating)
            rm["confidences"].append(confidence)
            rm["text_words"].append(text_words)
            rm["question_words"].append(question_words)

            # institution reviewer-side metrics
            for inst in reviewer_insts:
                im = inst_reviewer_metrics[inst]
                im["ratings"].append(rating)
                im["confidences"].append(confidence)
                im["text_words"].append(text_words)
                im["question_words"].append(question_words)

            # author-side aggregation for this submission
            for ainst in author_inst_set:
                ia = inst_author_metrics[ainst]
                ia["ratings"].append(rating)
                ia["confidences"].append(confidence)
                ia["review_count"] += 1

            # flows
            for rinst in reviewer_insts:
                for ainst in author_inst_set:
                    fl = flows[(rinst, ainst)]
                    fl["count"] += 1
                    fl["ratings"].append(rating)

            reviewer_insts_for_sub.extend(reviewer_insts)
            if rating is not None:
                ratings_for_sub.append(rating)

        # diversity per submission
        if reviews:
            counts = Counter(reviewer_insts_for_sub)
            total = sum(counts.values())
            top1_share = max(counts.values()) / total if total else 0
            submission_diversity[sub_id] = {
                "submission_number": sub_id,
                "review_count": len(reviews),
                "unique_reviewer_institutions": len(counts),
                "top1_share": top1_share,
                "rating_std": safe_std(ratings_for_sub),
            }

        # mark submission_count for author institutions
        for ainst in author_inst_set:
            inst_author_metrics[ainst]["submission_count"] += 1

    return {
        "reviewer_metrics": reviewer_metrics,
        "inst_reviewer_metrics": inst_reviewer_metrics,
        "inst_author_metrics": inst_author_metrics,
        "flows": flows,
        "submission_diversity": submission_diversity,
        "person_country": person_country,
        "missing_reviewer_inst": missing_reviewer_inst,
        "total_reviews": total_reviews,
        "inst_map": inst_map,
    }


def finalize_reviewer_metrics(raw):
    out = []
    for rid, data in raw.items():
        ratings = [r for r in data["ratings"] if r is not None]
        confs = [c for c in data["confidences"] if c is not None]
        out.append(
            {
                "reviewer_id": rid,
                "review_count": len(data["ratings"]),
                "avg_rating": safe_mean(ratings),
                "rating_std": safe_std(ratings),
                "avg_confidence": safe_mean(confs),
                "avg_text_words": safe_mean(data["text_words"]),
                "avg_question_words": safe_mean(data["question_words"]),
                "rating_conf_corr": safe_corr(ratings, confs),
            }
        )
    return out


def finalize_inst_metrics(inst_map, reviewer_side, author_side):
    out = []
    for inst, meta in inst_map.items():
        rdata = reviewer_side.get(inst, {"ratings": [], "confidences": [], "text_words": [], "question_words": []})
        adata = author_side.get(inst, {"ratings": [], "confidences": [], "review_count": 0, "submission_count": 0})
        rratings = [r for r in rdata["ratings"] if r is not None]
        rconfs = [c for c in rdata["confidences"] if c is not None]
        aratings = [r for r in adata["ratings"] if r is not None]
        aconfs = [c for c in adata["confidences"] if c is not None]
        out.append(
            {
                "institution": inst,
                "canonical_name": meta.get("canonical_name") or inst,
                "country": meta.get("country"),
                "institution_type": meta.get("institution_type"),
                "author_count": meta.get("author_count"),
                "reviewer_count": meta.get("reviewer_count"),
                "total_members": meta.get("total_members"),
                "reviewer_side": {
                    "review_count": len(rdata["ratings"]),
                    "avg_rating": safe_mean(rratings),
                    "median_rating": median(rratings) if rratings else None,
                    "rating_std": safe_std(rratings),
                    "avg_confidence": safe_mean(rconfs),
                    "avg_text_words": safe_mean(rdata["text_words"]),
                    "avg_question_words": safe_mean(rdata["question_words"]),
                    "rating_conf_corr": safe_corr(rratings, rconfs),
                },
                "author_side": {
                    "submission_count": adata.get("submission_count", 0),
                    "review_count": adata.get("review_count", 0),
                    "avg_rating": safe_mean(aratings),
                    "median_rating": median(aratings) if aratings else None,
                    "rating_std": safe_std(aratings),
                    "avg_confidence": safe_mean(aconfs),
                },
            }
        )
    return out


def finalize_flows(flows):
    out = []
    for (rinst, ainst), data in flows.items():
        ratings = [r for r in data["ratings"] if r is not None]
        out.append(
            {
                "reviewer_institution": rinst,
                "author_institution": ainst,
                "count": data["count"],
                "avg_rating": safe_mean(ratings),
            }
        )
    return out


def finalize_submission_diversity(sub_div):
    return list(sub_div.values())


def select_top(items, key, reverse=True, limit=200, min_count_key=None, min_count=3):
    filtered = []
    for it in items:
        if min_count_key and it.get(min_count_key, 0) < min_count:
            continue
        if it.get(key) is None:
            continue
        filtered.append(it)
    filtered.sort(key=lambda x: x[key], reverse=reverse)
    return filtered[:limit]


def build_rankings(inst_metrics):
    rankings = {}
    rankings["lenient_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_rating": m["reviewer_side"]["avg_rating"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="avg_rating",
        reverse=True,
        min_count_key="review_count",
    )
    rankings["strict_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_rating": m["reviewer_side"]["avg_rating"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="avg_rating",
        reverse=False,
        min_count_key="review_count",
    )
    rankings["volatile_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "rating_std": m["reviewer_side"]["rating_std"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="rating_std",
        reverse=True,
        min_count_key="review_count",
    )
    rankings["steady_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "rating_std": m["reviewer_side"]["rating_std"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="rating_std",
        reverse=False,
        min_count_key="review_count",
    )
    rankings["verbose_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_text_words": m["reviewer_side"]["avg_text_words"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="avg_text_words",
        reverse=True,
        min_count_key="review_count",
    )
    rankings["concise_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_text_words": m["reviewer_side"]["avg_text_words"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="avg_text_words",
        reverse=False,
        min_count_key="review_count",
    )
    rankings["question_heavy_institutions"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_question_words": m["reviewer_side"]["avg_question_words"],
                "review_count": m["reviewer_side"]["review_count"],
            }
            for m in inst_metrics
        ],
        key="avg_question_words",
        reverse=True,
        min_count_key="review_count",
    )
    rankings["author_side_high"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_rating": m["author_side"]["avg_rating"],
                "submission_count": m["author_side"]["submission_count"],
            }
            for m in inst_metrics
        ],
        key="avg_rating",
        reverse=True,
        min_count_key="submission_count",
        min_count=3,
    )
    rankings["author_side_low"] = select_top(
        [
            {
                "institution": m["institution"],
                "avg_rating": m["author_side"]["avg_rating"],
                "submission_count": m["author_side"]["submission_count"],
            }
            for m in inst_metrics
        ],
        key="avg_rating",
        reverse=False,
        min_count_key="submission_count",
        min_count=3,
    )
    rankings["author_side_stable"] = select_top(
        [
            {
                "institution": m["institution"],
                "rating_std": m["author_side"]["rating_std"],
                "submission_count": m["author_side"]["submission_count"],
            }
            for m in inst_metrics
        ],
        key="rating_std",
        reverse=False,
        min_count_key="submission_count",
        min_count=3,
    )
    rankings["author_side_volatile"] = select_top(
        [
            {
                "institution": m["institution"],
                "rating_std": m["author_side"]["rating_std"],
                "submission_count": m["author_side"]["submission_count"],
            }
            for m in inst_metrics
        ],
        key="rating_std",
        reverse=True,
        min_count_key="submission_count",
        min_count=3,
    )
    # confidence outliers
    rankings["confidence_outliers"] = [
        {
            "institution": m["institution"],
            "rating_conf_corr": m["reviewer_side"]["rating_conf_corr"],
            "review_count": m["reviewer_side"]["review_count"],
        }
        for m in inst_metrics
        if m["reviewer_side"]["rating_conf_corr"] is not None and m["reviewer_side"]["review_count"] >= 3
    ]
    rankings["confidence_outliers"].sort(key=lambda x: x["rating_conf_corr"])
    return rankings


def build_country_type_metrics(inst_metrics):
    country_aggr = defaultdict(lambda: {"ratings": [], "confidences": [], "review_count": 0})
    type_aggr = defaultdict(lambda: {"ratings": [], "confidences": [], "review_count": 0})
    for m in inst_metrics:
        country = m.get("country") or "unknown"
        itype = m.get("institution_type") or "unknown"
        avg_rating = m["reviewer_side"]["avg_rating"]
        avg_confidence = m["reviewer_side"]["avg_confidence"]

        if avg_rating is not None:
            country_aggr[country]["ratings"].append(avg_rating)
            type_aggr[itype]["ratings"].append(avg_rating)
        if avg_confidence is not None:
            country_aggr[country]["confidences"].append(avg_confidence)
            type_aggr[itype]["confidences"].append(avg_confidence)
        country_aggr[country]["review_count"] += m["reviewer_side"]["review_count"]
        type_aggr[itype]["review_count"] += m["reviewer_side"]["review_count"]

    def finalize(aggr):
        out = []
        for key, data in aggr.items():
            out.append(
                {
                    "group": key,
                    "avg_rating": safe_mean(data["ratings"]),
                    "avg_confidence": safe_mean(data["confidences"]),
                    "review_count": data["review_count"],
                }
            )
        return out

    return {"by_country": finalize(country_aggr), "by_type": finalize(type_aggr)}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    people = load_json(DATA_DIR / "people.json")["people"]
    reviews_raw = load_json(DATA_DIR / "reviews.json")["reviews"]
    institutions_raw = load_json(DATA_DIR / "institutions.json")["institutions"]

    inst_map = build_inst_lookup(institutions_raw)
    agg = aggregate(reviews_raw, people, inst_map)

    reviewer_metrics = finalize_reviewer_metrics(agg["reviewer_metrics"])
    inst_metrics = finalize_inst_metrics(agg["inst_map"], agg["inst_reviewer_metrics"], agg["inst_author_metrics"])
    flows = finalize_flows(agg["flows"])
    submission_diversity = finalize_submission_diversity(agg["submission_diversity"])
    rankings = build_rankings(inst_metrics)
    country_type = build_country_type_metrics(inst_metrics)

    meta = {
        "total_reviews": agg["total_reviews"],
        "missing_reviewer_inst_count": agg["missing_reviewer_inst"],
        "inst_count": len(inst_metrics),
        "reviewer_count": len(reviewer_metrics),
        "submission_count": len(reviews_raw),
    }

    (OUT_DIR / "reviewer_metrics.json").write_text(json.dumps(reviewer_metrics, ensure_ascii=False, indent=2))
    (OUT_DIR / "institution_metrics.json").write_text(json.dumps(inst_metrics, ensure_ascii=False, indent=2))
    (OUT_DIR / "institution_rankings.json").write_text(json.dumps(rankings, ensure_ascii=False, indent=2))
    (OUT_DIR / "institution_flows.json").write_text(json.dumps(flows, ensure_ascii=False, indent=2))
    (OUT_DIR / "submission_diversity.json").write_text(json.dumps(submission_diversity, ensure_ascii=False, indent=2))
    (OUT_DIR / "country_type_metrics.json").write_text(json.dumps(country_type, ensure_ascii=False, indent=2))
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"Wrote outputs to {OUT_DIR}")


if __name__ == "__main__":
    main()
