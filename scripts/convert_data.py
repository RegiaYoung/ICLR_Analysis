import json
import os

# 你的原始数据文件路径
INPUT_FILE = '/home/ruijia/iclr2026_reviews_10000_with_country.jsonl'
OUTPUT_DIR = '/home/ruijia/ICLR_Analysis/review-data'

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# 初始化容器
reviews_output = {
    "summary": {"total_submissions": 0, "total_reviews": 0, "reviews_per_submission": {}},
    "reviews": {}
}
people_output = {"metadata": {"total_people": 0}, "people": {}}
institutions_map = {}  # key: institution_name

# 扩展的机构类型关键词
UNIV_KEYWORDS = [
    "university", "universität", "universite", "université", "uni ", "uni-",
    "tech", "technological", "technology", "polytechnic", "college", "institute",
    "inst", "école", "ecole", "schule", "academy", "campus", "facoltà", "faculty",
    "eth zurich", "e.t.h", "epfl", "lmu", "lmu munich", "ludwig-maximilians",
    "berkeley", "mit", "harvard", "stanford", "oxford", "cambridge"
]

COMPANY_KEYWORDS = [
    "inc", "corp", "co.", "co ", "ltd", "gmbh", "有限责任", "公司",
    "google", "deepmind", "meta", "facebook", "microsoft", "nvidia", "bytedance",
    "tiktok", "tencent", "kuaishou", "alibaba", "baidu", "huawei", "amazon", "aws",
    "apple", "adobe", "samsung", "sony", "uber", "openai", "salesforce", "ibm",
    "intel", "qualcomm", "tesla", "telecom"
]

# 国家缩写与常见别名映射到国家全称
COUNTRY_CODE_MAP = {
    "US": "United States",
    "USA": "United States",
    "U.S": "United States",
    "U.S.": "United States",
    "UK": "United Kingdom",
    "GB": "United Kingdom",
    "GBR": "United Kingdom",
    "CN": "China",
    "CHN": "China",
    "HK": "China",  # 香港视作中国的一部分
    "MO": "China",  # 澳门视作中国的一部分
    "KR": "South Korea",
    "DE": "Germany",
    "FR": "France",
    "CA": "Canada",
    "SG": "Singapore",
    "AU": "Australia",
    "JP": "Japan",
    "IN": "India",
    "ES": "Spain",
    "SE": "Sweden",
    "NL": "Netherlands",
    "BR": "Brazil",
    "CH": "Switzerland",
}

# 特定机构的国家矫正（无视成员的国家信息）
INSTITUTION_COUNTRY_OVERRIDES = {
    "bytedance": "China",
    "harbin institute of technology": "China",
}


def normalize_country(country: str) -> str:
    if not country:
        return "Unknown"
    c = country.strip()
    upper = c.upper()
    if upper in COUNTRY_CODE_MAP:
        return COUNTRY_CODE_MAP[upper]
    if upper in ("HONG KONG", "HONG KONG SAR"):
        return "China"
    if upper in ("MACAU", "MACAO", "MACAU SAR"):
        return "China"
    return c


def infer_country_for_institution(name: str, fallback_country: str) -> str:
    if not name:
        return fallback_country or "Unknown"
    lower_name = name.lower()
    for key, mapped in INSTITUTION_COUNTRY_OVERRIDES.items():
        if key in lower_name:
            return mapped
    return fallback_country or "Unknown"

def infer_institution_type(name: str) -> str:
    """基于机构名粗略推断类型：University / Company / Other."""
    if not name:
        return None
    lower = name.lower()
    for kw in UNIV_KEYWORDS:
        if kw in lower:
            return "University"
    if any(corp_kw in lower for corp_kw in COMPANY_KEYWORDS):
        return "Company"
    return "Other"

def process_person(person_obj, role):
    """合并人员信息，并记录角色、机构、论文关联。"""
    pid = person_obj.get('id')
    if not pid:
        return
    
    # 获取机构名称 & 国家
    inst_name = person_obj.get('institution') or 'Unknown Institution'
    country = person_obj.get('country')
    country_val = normalize_country(country)

    # 1. 更新人员信息 (People Output)
    if pid not in people_output['people']:
        people_output['people'][pid] = {
            "name": person_obj.get('name') or pid.replace('~', '').replace('_', ' '),
            "nationality": country_val,
            "institution": inst_name,
            "institutions": [inst_name] if inst_name and inst_name != 'Unknown Institution' else [],
            "gender": 'Unknown',
            "role": role,
            "authored_papers": [],
            "reviewed_papers": []
        }
    else:
        # 更新角色
        existing_roles = set((people_output['people'][pid].get('role') or "").split(',')) if people_output['people'][pid].get('role') else set()
        existing_roles.add(role)
        people_output['people'][pid]['role'] = ",".join(sorted(r for r in existing_roles if r))
        
        # 更新机构列表
        if inst_name and inst_name != 'Unknown Institution':
            inst_list = people_output['people'][pid].setdefault('institutions', [])
            if inst_name not in inst_list:
                inst_list.append(inst_name)
            # 如果之前的 institution 是 Unknown，更新为主机构
            if people_output['people'][pid].get('institution') == 'Unknown Institution':
                people_output['people'][pid]['institution'] = inst_name
        
        # 更新国籍 (如果之前是 Unknown 现在有值了)
        if people_output['people'][pid]['nationality'] == 'Unknown' and country_val != 'Unknown':
            people_output['people'][pid]['nationality'] = country_val

    # 2. 更新机构信息 (Institutions Map) - 修复了“先入为主”导致没有国家的问题
    if inst_name and inst_name != 'Unknown Institution':
        inferred_country = infer_country_for_institution(inst_name, country_val)
        if inst_name not in institutions_map:
            # 新增机构
            institutions_map[inst_name] = {
                "institution_name": inst_name,
                "country": inferred_country,
                "institution_type": infer_institution_type(inst_name)
            }
        else:
            # 如果已有机构的国家是 Unknown，但当前数据有国家，则更新
            if institutions_map[inst_name]['country'] == 'Unknown' and inferred_country != 'Unknown':
                institutions_map[inst_name]['country'] = inferred_country

total_reviews_count = 0

print("🚀 Starting conversion process...")

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        try:
            sub = json.loads(line)
        except json.JSONDecodeError:
            continue

        # 优先使用 submission_number，如果没有则尝试解析 id (例如 ICLR...Submission123)
        sub_num = sub.get('submission_number')
        if sub_num is None and sub.get('id'):
            try:
                sub_num = int(sub['id'].split('Submission')[-1])
            except (ValueError, IndexError):
                pass
        
        if not sub_num:
            continue

        sub_id_str = str(sub_num)

        # 如果没有有效评审，视为无效 submission（可能撤稿），跳过
        if not sub.get('reviews'):
            continue

        # 1. 处理作者
        for author in sub.get('authors', []):
            process_person(author, 'author')
            if author.get('id'):
                people_output['people'][author['id']]['authored_papers'].append(int(sub_num))

        # 2. 处理评审
        cleaned_reviews = []
        for review in sub.get('reviews', []):
            total_reviews_count += 1

            reviewer_profile = review.get('reviewer_profile') or {}
            reviewer_id = reviewer_profile.get('id')

            # 缺失 reviewer_id 时生成占位，避免导入空值
            if not reviewer_id:
                if review.get('signature') and 'Reviewer_' in review.get('signature'):
                    reviewer_id = f"anonymous_reviewer_{review.get('signature').split('Reviewer_')[1]}"
                else:
                    reviewer_id = f"anonymous_reviewer_{review.get('id')}"
                # 重新构建 profile 以便 process_person 处理
                reviewer_profile = {"id": reviewer_id, "institution": "Unknown Institution", "country": "Unknown"}

            process_person(reviewer_profile, 'reviewer')
            if reviewer_id in people_output['people']:
                people_output['people'][reviewer_id]['reviewed_papers'].append(int(sub_num))

            # 提取 Review 内容
            cleaned_review = {
                "review_id": review.get('id'),
                "reviewer_id": reviewer_id,
                "reviewer_profile_url": review.get('reviewer_profile_url'),
                "signature": review.get('signature'),
                "rating": review.get('rating', {}).get('value') if isinstance(review.get('rating'), dict) else review.get('rating'),
                "confidence": review.get('confidence', {}).get('value') if isinstance(review.get('confidence'), dict) else review.get('confidence'),
                "content": {
                    "summary": review.get('content', {}).get('summary', {}).get('value'),
                    "strengths": review.get('content', {}).get('strengths', {}).get('value'),
                    "weaknesses": review.get('content', {}).get('weaknesses', {}).get('value'),
                    "questions": review.get('content', {}).get('questions', {}).get('value'),
                    "flag_for_ethics_review": review.get('content', {}).get('flag_for_ethics_review', {}).get('value'),
                    "soundness": review.get('soundness', {}).get('value') if isinstance(review.get('soundness'), dict) else review.get('soundness'),
                    "presentation": review.get('presentation', {}).get('value') if isinstance(review.get('presentation'), dict) else review.get('presentation'),
                    "contribution": review.get('contribution', {}).get('value') if isinstance(review.get('contribution'), dict) else review.get('contribution'),
                    "code_of_conduct": review.get('code_of_conduct')
                }
            }
            cleaned_reviews.append(cleaned_review)

        reviews_output['reviews'][sub_id_str] = {
            "submission_number": int(sub_num),
            "submission_id": sub.get('submission_id'),
            "authors": [a.get('id') for a in sub.get('authors', []) if a.get('id')],
            "reviews": cleaned_reviews
        }

        reviews_output['summary']['reviews_per_submission'][sub_id_str] = len(cleaned_reviews)

# 汇总统计
reviews_output['summary']['total_submissions'] = len(reviews_output['reviews'])
reviews_output['summary']['total_reviews'] = total_reviews_count
people_output['metadata']['total_people'] = len(people_output['people'])

institutions_list = list(institutions_map.values())
institutions_output = {"institutions": institutions_list}

print(f"Writing reviews.json ({len(reviews_output['reviews'])} submissions)...")
with open(os.path.join(OUTPUT_DIR, 'reviews.json'), 'w', encoding='utf-8') as f:
    json.dump(reviews_output, f, indent=2, ensure_ascii=False)

print(f"Writing people.json ({len(people_output['people'])} people)...")
with open(os.path.join(OUTPUT_DIR, 'people.json'), 'w', encoding='utf-8') as f:
    json.dump(people_output, f, indent=2, ensure_ascii=False)

print(f"Writing institutions.json ({len(institutions_list)} institutions)...")
with open(os.path.join(OUTPUT_DIR, 'institutions.json'), 'w', encoding='utf-8') as f:
    json.dump(institutions_output, f, indent=2, ensure_ascii=False)

print("✅ Data conversion complete!")