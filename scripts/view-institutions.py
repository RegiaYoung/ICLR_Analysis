#!/usr/bin/env python3
"""
查看机构数据的简单脚本
"""

import json

def view_institution_data(data_file='./review-data/institutions_data_full.json'):
    """查看机构数据"""
    
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ 找不到文件: {data_file}")
        return
    
    print("=" * 60)
    print("🏛️  ICLR审稿机构分析报告")
    print("=" * 60)
    
    total = data['total_institutions']
    summary = data['extraction_summary']
    
    print(f"\n📊 总体统计:")
    print(f"  • 总机构数量: {total}")
    print(f"  • 仅作者机构: {summary['author_only_institutions']} ({summary['author_only_institutions']/total*100:.1f}%)")
    print(f"  • 仅审稿人机构: {summary['reviewer_only_institutions']} ({summary['reviewer_only_institutions']/total*100:.1f}%)")
    print(f"  • 双重角色机构: {summary['both_institutions']} ({summary['both_institutions']/total*100:.1f}%)")
    
    print(f"\n🔍 利益冲突风险:")
    conflict_institutions = [inst for inst in data['institutions'] if inst['type'] == 'both']
    print(f"  • 发现 {len(conflict_institutions)} 个机构既有作者又有审稿人")
    print(f"  • 潜在冲突比例: {len(conflict_institutions)/total*100:.1f}%")
    
    print(f"\n🏆 顶级机构分析:")
    # 按参与度排序
    institutions_by_activity = sorted(
        data['institutions'], 
        key=lambda x: x['stats']['unique_submissions_involved'],
        reverse=True
    )
    
    print("  最活跃机构 (按参与投稿数):")
    for i, inst in enumerate(institutions_by_activity[:5], 1):
        stats = inst['stats']
        print(f"    {i}. {inst['institution_name'][:50]}")
        print(f"       参与投稿: {stats['unique_submissions_involved']}, 成员: {stats['total_members']}, 类型: {inst['type']}")
    
    # 审稿人机构评分分析
    reviewer_institutions = [
        inst for inst in data['institutions'] 
        if inst['type'] in ['reviewer_institution', 'both'] and 'avg_rating_given' in inst['stats']
    ]
    
    if reviewer_institutions:
        print(f"\n⚖️  审稿机构评分倾向:")
        # 按平均评分排序
        reviewer_institutions.sort(key=lambda x: x['stats']['avg_rating_given'], reverse=True)
        
        print("  最宽松机构 (平均评分最高):")
        for i, inst in enumerate(reviewer_institutions[:3], 1):
            avg_score = inst['stats']['avg_rating_given']
            range_str = f"{inst['stats']['min_rating_given']}-{inst['stats']['max_rating_given']}"
            review_count = inst['stats']['submissions_as_reviewer_count']
            print(f"    {i}. {inst['institution_name'][:40]}")
            print(f"       平均评分: {avg_score:.2f}, 范围: {range_str}, 审稿数: {review_count}")
        
        print("  最严格机构 (平均评分最低):")
        for i, inst in enumerate(reviewer_institutions[-3:], 1):
            avg_score = inst['stats']['avg_rating_given']
            range_str = f"{inst['stats']['min_rating_given']}-{inst['stats']['max_rating_given']}"
            review_count = inst['stats']['submissions_as_reviewer_count']
            print(f"    {i}. {inst['institution_name'][:40]}")
            print(f"       平均评分: {avg_score:.2f}, 范围: {range_str}, 审稿数: {review_count}")
    
    print(f"\n🚨 利益冲突详情:")
    if conflict_institutions:
        for inst in conflict_institutions:
            print(f"\n  🏛️  {inst['institution_name']}")
            author_submissions = set(sub['submission_number'] for sub in inst['submissions_as_author'])
            reviewer_submissions = set(sub['submission_number'] for sub in inst['submissions_as_reviewer'])
            
            print(f"    • 作者参与的投稿: {sorted(author_submissions)}")
            print(f"    • 审稿人参与的投稿: {sorted(reviewer_submissions)}")
            
            # 检查直接冲突
            direct_conflicts = author_submissions.intersection(reviewer_submissions)
            if direct_conflicts:
                print(f"    ⚠️  直接冲突投稿: {sorted(direct_conflicts)} (同一机构既是作者又是审稿人)")
            else:
                print(f"    ✅ 无直接冲突")
            
            print(f"    • 成员列表:")
            for member in inst['members']:
                print(f"      - {member['name']} ({member['role']})")
    else:
        print("  ✅ 未发现明显的利益冲突")
    
    print(f"\n📋 数据质量:")
    unknown_count = len([inst for inst in data['institutions'] if 'unknown' in inst['institution_name'].lower()])
    print(f"  • 机构信息完整度: {((total-unknown_count)/total*100):.1f}%")
    print(f"  • Unknown/缺失机构: {unknown_count}")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    view_institution_data()