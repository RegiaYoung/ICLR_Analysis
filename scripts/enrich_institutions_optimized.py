import json
import openreview
import time
import re
from tqdm import tqdm

# 初始化客户端
client = openreview.api.OpenReviewClient(baseurl='https://api2.openreview.net', username='ryang379@connect.hkust-gz.edu.cn', password='ABCDabcd235')

def normalize_institution(name):
    """
    使用基于规则（Regex）的优先级匹配来规范化机构名称。
    解决了缩写、拼写错误、分校区混淆以及同一机构多种写法的问题。
    """
    if not name:
        return None
    
    # 1. 预处理：去除前后空格，统一转义字符
    raw = name.strip().replace('&', ' and ')
    if not raw:
        return None

    # 2. 常见拼写错误修正
    typo_map = {
        'Univeristy': 'University',
        'Univeresity': 'University',
        'Technolgy': 'Technology',
        'Instiute': 'Institute',
        'Institue': 'Institute',
        'Sceince': 'Science',
        'Schol': 'School',
        'Guang Zhou': 'Guangzhou', 
        'Laboratpry': 'Laboratory',
        'Loboratory': 'Laboratory'
    }
    for wrong, right in typo_map.items():
        if wrong in raw:
            raw = raw.replace(wrong, right)

    # 3. 优先级匹配规则库
    # 格式：(正则表达式 regex, 标准化名称 replacement)
    # 注意：使用 \b (Word Boundary) 避免匹配到单词的一部分 (如 Intel 匹配到 Intelligent)
    rules = [
        # --- 这里的顺序是：先特例，后通用 ---

        # 1. Tsinghua & Berkeley Special Cases
        (r'(?i).*Tsinghua-Berkeley.*', 'Tsinghua University'), 
        (r'(?i).*Lawrence Berkeley.*', 'Lawrence Berkeley National Laboratory'), 
        (r'(?i).*(UC Berkeley|University of California.*Berkeley).*', 'University of California, Berkeley'), 

        # 2. HKUST (Guangzhou vs Main)
        (r'(?i).*(HKUST|Hong Kong University of Science and Technology).*(Guangzhou|GZ).*', 'Hong Kong University of Science and Technology (Guangzhou)'),
        (r'(?i).*(HKUST|Hong Kong University of Science and Technology).*', 'Hong Kong University of Science and Technology'),

        # 3. CUHK (Shenzhen vs Main)
        (r'(?i).*(CUHK|Chinese University of Hong Kong).*(Shenzhen|SZ).*', 'The Chinese University of Hong Kong, Shenzhen'),
        (r'(?i).*(CUHK|Chinese University of Hong Kong).*', 'The Chinese University of Hong Kong'),

        # 4. European Universities with confusing names
        (r'(?i).*(LMU|Ludwig-Maximilians).*', 'Ludwig Maximilian University of Munich'),
        (r'(?i).*(TUM|Technische Universität München|Technical University of Munich|TU Munich).*', 'Technical University of Munich'),
        (r'(?i).*(KIT|Karlsruhe Institute of Technology).*', 'Karlsruhe Institute of Technology'),
        (r'(?i).*(ETH|Swiss Federal Institute of Technology).*Zurich.*', 'ETH Zurich'),
        (r'(?i).*ETH Zurich.*', 'ETH Zurich'),
        (r'(?i).*(EPFL|Swiss Federal Institute of Technology).*Lausanne.*', 'EPFL'),
        (r'(?i).*Sorbonne.*', 'Sorbonne University'),
        (r'(?i).*Imperial College.*', 'Imperial College London'),
        (r'(?i).*University College London.*', 'University College London'),

        # 5. Major US Universities (Common Abbreviations)
        (r'(?i).*\b(CMU|Carnegie Mellon)\b.*', 'Carnegie Mellon University'),
        (r'(?i).*\b(MIT|Massachusetts Institute of Technology)\b.*', 'Massachusetts Institute of Technology'),
        (r'(?i).*\b(UIUC)\b.*', 'University of Illinois Urbana-Champaign'),
        (r'(?i).*University of Illinois.*Urbana.*Champaign.*', 'University of Illinois Urbana-Champaign'),
        (r'(?i).*\b(UCSD)\b.*', 'University of California, San Diego'),
        (r'(?i).*University of California.*San Diego.*', 'University of California, San Diego'),
        (r'(?i).*\b(UCLA)\b.*', 'University of California, Los Angeles'),
        (r'(?i).*University of California.*Los Angeles.*', 'University of California, Los Angeles'),
        (r'(?i).*\b(USC)\b.*', 'University of Southern California'),
        (r'(?i).*University of Southern California.*', 'University of Southern California'),
        (r'(?i).*\b(NYU)\b.*', 'New York University'),
        (r'(?i).*New York University.*', 'New York University'),
        (r'(?i).*\b(Georgia Tech)\b.*', 'Georgia Institute of Technology'),
        (r'(?i).*Georgia Institute of Technology.*', 'Georgia Institute of Technology'),
        (r'(?i).*\b(UW)\b.*', 'University of Washington'), # 注意：UW 有时也指 Wisconsin，但 Washington 更常见
        (r'(?i).*University of Washington.*', 'University of Washington'),
        (r'(?i).*\b(Caltech)\b.*', 'California Institute of Technology'),
        (r'(?i).*California Institute of Technology.*', 'California Institute of Technology'),
        (r'(?i).*\b(UT Austin)\b.*', 'University of Texas at Austin'),
        (r'(?i).*University of Texas at Austin.*', 'University of Texas at Austin'),
        (r'(?i).*\b(UMich)\b.*', 'University of Michigan'),
        (r'(?i).*University of Michigan.*', 'University of Michigan'),
        (r'(?i).*Johns Hopkins.*', 'Johns Hopkins University'),
        (r'(?i).*Stanford.*', 'Stanford University'),
        (r'(?i).*Princeton.*', 'Princeton University'),
        (r'(?i).*Harvard.*', 'Harvard University'),
        (r'(?i).*Yale.*', 'Yale University'),
        (r'(?i).*Cornell.*', 'Cornell University'),
        (r'(?i).*Columbia University.*', 'Columbia University'),

        # 6. Major Chinese Universities & Academies
        (r'(?i).*\b(Tsinghua|THU)\b.*', 'Tsinghua University'),
        (r'(?i).*\b(Peking University|PKU)\b.*', 'Peking University'),
        (r'(?i).*(SJTU|Shanghai Jiao.*Tong).*', 'Shanghai Jiao Tong University'),
        (r'(?i).*\b(Fudan)\b.*', 'Fudan University'),
        (r'(?i).*(Zhejiang University|ZJU).*', 'Zhejiang University'),
        (r'(?i).*(USTC|University of Science and Technology of China).*', 'University of Science and Technology of China'),
        (r'(?i).*(Nanjing University|NJU).*', 'Nanjing University'),
        (r'(?i).*(Sun Yat-sen|SYSU).*', 'Sun Yat-sen University'),
        (r'(?i).*(Harbin Institute of Technology|HIT).*', 'Harbin Institute of Technology'),
        (r'(?i).*(Beihang|Beijing University of Aeronautics).*', 'Beihang University'),
        (r'(?i).*(UCAS|University of Chinese Academy of Sciences).*', 'University of Chinese Academy of Sciences'),
        # CAS Institutes
        (r'(?i).*(Chinese Academy of Sciences|CAS\b|Institute of Automation.*CAS|Institute of Computing.*CAS).*', 'Chinese Academy of Sciences'),
        
        # 7. Other Asian Universities
        (r'(?i).*(KAIST|Korea Advanced Institute).*', 'Korea Advanced Institute of Science and Technology'),
        (r'(?i).*(SNU|Seoul National University).*', 'Seoul National University'),
        (r'(?i).*(POSTECH|Pohang University).*', 'Pohang University of Science and Technology'),
        (r'(?i).*\b(NUS)\b.*', 'National University of Singapore'),
        (r'(?i).*National University of Singapore.*', 'National University of Singapore'),
        (r'(?i).*\b(NTU)\b.*', 'Nanyang Technological University'),
        (r'(?i).*Nanyang Technological University.*', 'Nanyang Technological University'),
        (r'(?i).*University of Tokyo.*', 'The University of Tokyo'),

        # 8. Major Tech Companies (Consolidation) - Updated with Word Boundaries (\b)
        # 修复 Intel 匹配 Intelligent，Meta 匹配 Metadata/Metal，AWS 匹配 Laws 等问题
        (r'(?i).*\b(Google|DeepMind)\b.*', 'Google DeepMind'), 
        (r'(?i).*\b(Meta|Facebook)\b.*', 'Meta'),
        (r'(?i).*\b(Microsoft|Msft)\b.*', 'Microsoft'),
        (r'(?i).*\b(NVIDIA)\b.*', 'NVIDIA'),
        (r'(?i).*\b(ByteDance|TikTok)\b.*', 'ByteDance'),
        (r'(?i).*\b(Tencent)\b.*', 'Tencent'),
        (r'(?i).*\b(Alibaba)\b.*', 'Alibaba Group'),
        (r'(?i).*\b(Baidu)\b.*', 'Baidu'),
        (r'(?i).*\b(Huawei)\b.*', 'Huawei Technologies'),
        (r'(?i).*\b(Amazon|AWS)\b.*', 'Amazon'),
        (r'(?i).*\b(Apple)\b.*', 'Apple'),
        (r'(?i).*\b(Adobe)\b.*', 'Adobe'),
        (r'(?i).*\b(Samsung)\b.*', 'Samsung'),
        (r'(?i).*\b(Sony)\b.*', 'Sony'),
        (r'(?i).*\b(Uber)\b.*', 'Uber'),
        (r'(?i).*\b(OpenAI)\b.*', 'OpenAI'),
        (r'(?i).*\b(Salesforce)\b.*', 'Salesforce'),
        (r'(?i).*\b(IBM)\b.*', 'IBM'),
        (r'(?i).*\b(Intel)\b.*', 'Intel'), # 关键修复：添加 \b 边界
        (r'(?i).*\b(Qualcomm)\b.*', 'Qualcomm'),
    ]

    # 执行正则匹配
    for pattern, replacement in rules:
        if re.match(pattern, raw):
            return replacement

    # 4. Fallback: 如果没有匹配到任何规则，进行通用清理
    if ',' in raw:
        parts = raw.split(',')
        # 简单 heuristic: 倒序找看起来像学校的部分
        for part in reversed(parts):
            p = part.strip()
            if re.search(r'(University|College|Institute|Lab|Inc|Corp)', p, re.IGNORECASE):
                return p
        return parts[-1].strip() # 默认取最后一段

    return raw

def get_profiles_with_retry(batch_ids):
    """带自动重试机制的批量获取函数"""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            # 批量获取 ID
            return openreview.tools.get_profiles(client, ids_or_emails=batch_ids)
        except openreview.OpenReviewException as e:
            error_str = str(e)
            if "Too many requests" in error_str or "429" in error_str:
                wait_time = 60
                try:
                    match = re.search(r'try again in (\d+) seconds', error_str)
                    if match:
                        wait_time = int(match.group(1)) + 5
                except:
                    pass
                
                print(f"\n⚠️ 触发 API 速率限制，暂停 {wait_time} 秒后重试 (第 {attempt+1}/{max_retries} 次)...")
                time.sleep(wait_time)
            else:
                print(f"\n❌ 批量请求出错: {e}")
                return []
    
    print("\n❌ 重试次数耗尽，跳过此批次。")
    return []

def enrich_data_optimized(input_file, output_file):
    print("🚀 开始优化的数据补全流程 (Fix: Intel/Meta False Positives)")
    
    print(f"\n[1/3] 正在扫描文件中的缺失机构 ID...")
    ids_to_fetch = set()
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'authors' in data:
                    for author in data['authors']:
                        if not author.get('institution') and author.get('id', '').startswith('~'):
                            ids_to_fetch.add(author['id'])
                
                if 'reviews' in data:
                    for review in data['reviews']:
                        profile = review.get('reviewer_profile') or {}
                        if not profile.get('institution') and profile.get('id', '').startswith('~'):
                            ids_to_fetch.add(profile['id'])
            except json.JSONDecodeError:
                continue

    ids_list = list(ids_to_fetch)
    print(f"📊 共发现 {len(ids_list)} 个需要查询的唯一用户 ID")
    
    print(f"\n[2/3] 正在批量查询 OpenReview API...")
    institution_map = {}
    BATCH_SIZE = 200 
    
    if len(ids_list) > 0:
        for i in tqdm(range(0, len(ids_list), BATCH_SIZE), desc="Fetching Profiles"):
            batch = ids_list[i:i+BATCH_SIZE]
            profiles = get_profiles_with_retry(batch)
            
            for profile in profiles or []:
                if not profile:
                    continue
                if profile.content.get('history'):
                    inst_raw = profile.content['history'][0].get('institution', {}).get('name')
                    # 优先使用规范化名称，如果规范化返回None但原始有值，则使用原始值
                    inst = normalize_institution(inst_raw)
                    if not inst and inst_raw:
                        inst = inst_raw.strip()
                    if inst:
                        institution_map[profile.id] = inst
            time.sleep(1)
    else:
        print("没有发现需要查询的 ID，跳过查询步骤。")

    print(f"✅ API 查询完成，成功获取了 {len(institution_map)} 个用户的机构信息")

    print(f"\n[3/3] 正在将数据写入新文件...")
    stats = {'enriched_authors': 0, 'enriched_reviewers': 0}
    
    with open(input_file, 'r', encoding='utf-8') as fin, \
         open(output_file, 'w', encoding='utf-8') as fout:
        
        lines = fin.readlines()
        for line in tqdm(lines, desc="Writing Data"):
            try:
                data = json.loads(line)
                
                # 补全作者
                if 'authors' in data:
                    for author in data['authors']:
                        aid = author.get('id')
                        # 仅当没有 institution 时补全
                        if not author.get('institution'):
                            if aid in institution_map:
                                author['institution'] = institution_map[aid]
                                stats['enriched_authors'] += 1
                        else:
                            # 对已有机构进行规范化（防止已有数据中包含 "Intel Lab" 等被误判的情况）
                            normalized_existing = normalize_institution(author['institution'])
                            if normalized_existing:
                                author['institution'] = normalized_existing

                # 补全审稿人
                if 'reviews' in data:
                    for review in data['reviews']:
                        profile = review.get('reviewer_profile') or {}
                        rid = profile.get('id')
                        
                        if not profile.get('institution'):
                            if rid in institution_map:
                                profile['institution'] = institution_map[rid]
                                review['reviewer_profile'] = profile
                                stats['enriched_reviewers'] += 1
                        else:
                            # 对已有机构进行规范化
                            normalized_existing = normalize_institution(profile['institution'])
                            if normalized_existing:
                                profile['institution'] = normalized_existing
                                review['reviewer_profile'] = profile
                
                fout.write(json.dumps(data, ensure_ascii=False) + '\n')
            except Exception:
                fout.write(line)

    print(f"\n🎉 全部完成！")
    print(f"📈 统计数据:")
    print(f"  - 补全了 {stats['enriched_authors']} 个作者的机构")
    print(f"  - 补全了 {stats['enriched_reviewers']} 个审稿人的机构")
    print(f"📁 结果已保存至: {output_file}")

if __name__ == "__main__":
    input_filename = "/home/ruijia/iclr2026_reviews_10000.jsonl"
    output_filename = "/home/ruijia/iclr2026_reviews_10000_enriched.jsonl"
    enrich_data_optimized(input_filename, output_filename)