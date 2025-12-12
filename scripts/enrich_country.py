import json
import openreview
import time
import re
from tqdm import tqdm

# 初始化客户端（与机构补全脚本保持一致）
client = openreview.api.OpenReviewClient(
    baseurl="https://api2.openreview.net",
    username="ryang379@connect.hkust-gz.edu.cn",
    password="ABCDabcd235"
)


def extract_latest_country(profile):
    """从 profile 的最新记录中提取国家信息"""
    if not profile:
        return None

    content = getattr(profile, "content", {}) or {}

    # history 通常按时间倒序
    history = content.get("history") or []
    for entry in history:
        if not isinstance(entry, dict):
            continue

        # location 里可能包含 country
        loc = entry.get("location") or {}
        country = loc.get("country") or loc.get("country_name") or loc.get("countryCode")
        if country:
            return country.strip()

        # institution 里若有 country 也尝试使用
        inst = entry.get("institution") or {}
        inst_country = inst.get("country")
        if inst_country:
            return inst_country.strip()

    # 兜底：如果有顶层 location
    top_loc = content.get("location") or {}
    if top_loc.get("country"):
        return top_loc["country"].strip()

    return None


def get_profiles_with_retry(batch_ids):
    """带自动重试机制的批量获取函数"""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            return openreview.tools.get_profiles(client, ids_or_emails=batch_ids)
        except openreview.OpenReviewException as e:
            error_str = str(e)
            if "Too many requests" in error_str or "429" in error_str:
                wait_time = 60
                try:
                    match = re.search(r"try again in (\d+) seconds", error_str)
                    if match:
                        wait_time = int(match.group(1)) + 5
                except Exception:
                    pass

                print(f"\n⚠️ 触发 API 速率限制，暂停 {wait_time} 秒后重试 (第 {attempt+1}/{max_retries} 次)...")
                time.sleep(wait_time)
            else:
                print(f"\n❌ 批量请求出错: {e}")
                return []

    print("\n❌ 重试次数耗尽，跳过此批次。")
    return []


def enrich_country(input_file, output_file):
    print("🚀 开始补充 country 信息（基于已补充机构的文件）")

    # -------------------------------------------------
    # 第一阶段：扫描所有需要查询的 ID (去重)
    # -------------------------------------------------
    print("\n[1/3] 正在扫描文件中的缺失 country ID...")

    ids_to_fetch = set()

    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)

                # 收集作者
                for author in data.get("authors", []):
                    if not author.get("country") and author.get("id", "").startswith("~"):
                        ids_to_fetch.add(author["id"])

                # 收集审稿人
                for review in data.get("reviews", []):
                    profile = review.get("reviewer_profile") or {}
                    if not profile.get("country") and profile.get("id", "").startswith("~"):
                        ids_to_fetch.add(profile["id"])
            except json.JSONDecodeError:
                continue

    ids_list = list(ids_to_fetch)
    print(f"📊 共发现 {len(ids_list)} 个需要查询的唯一用户 ID")

    # -------------------------------------------------
    # 第二阶段：批量查询 OpenReview API
    # -------------------------------------------------
    print("\n[2/3] 正在批量查询 OpenReview API...")

    country_map = {}
    BATCH_SIZE = 250

    if ids_list:
        for i in tqdm(range(0, len(ids_list), BATCH_SIZE), desc="Fetching Profiles"):
            batch = ids_list[i : i + BATCH_SIZE]
            profiles = get_profiles_with_retry(batch)

            for profile in profiles or []:
                if not profile:
                    continue
                country = extract_latest_country(profile)
                if country:
                    country_map[profile.id] = country

            time.sleep(1)
    else:
        print("没有发现需要查询的 ID，跳过查询步骤。")

    print(f"✅ API 查询完成，成功获取了 {len(country_map)} 个用户的 country 信息")

    # -------------------------------------------------
    # 第三阶段：将数据写回文件
    # -------------------------------------------------
    print("\n[3/3] 正在将数据写入新文件...")

    stats = {"enriched_authors": 0, "enriched_reviewers": 0}

    with open(input_file, "r", encoding="utf-8") as fin, open(output_file, "w", encoding="utf-8") as fout:
        lines = fin.readlines()
        for line in tqdm(lines, desc="Writing Data"):
            try:
                data = json.loads(line)

                # 补全作者
                for author in data.get("authors", []):
                    aid = author.get("id")
                    if not author.get("country") and aid in country_map:
                        author["country"] = country_map[aid]
                        stats["enriched_authors"] += 1

                # 补全审稿人
                for review in data.get("reviews", []):
                    profile = review.get("reviewer_profile") or {}
                    rid = profile.get("id")
                    if rid and not profile.get("country") and rid in country_map:
                        profile["country"] = country_map[rid]
                        review["reviewer_profile"] = profile
                        stats["enriched_reviewers"] += 1

                fout.write(json.dumps(data, ensure_ascii=False) + "\n")
            except Exception:
                fout.write(line)

    print("\n🎉 全部完成！")
    print("📈 统计数据:")
    print(f"  - 补全了 {stats['enriched_authors']} 个作者的 country")
    print(f"  - 补全了 {stats['enriched_reviewers']} 个审稿人的 country")
    print(f"📁 结果已保存至: {output_file}")


if __name__ == "__main__":
    input_filename = "/home/ruijia/iclr2026_reviews_10000_enriched.jsonl"
    output_filename = "/home/ruijia/iclr2026_reviews_10000_with_country.jsonl"

    enrich_country(input_filename, output_filename)

