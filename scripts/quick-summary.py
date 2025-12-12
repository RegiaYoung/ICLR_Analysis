#!/usr/bin/env python3
"""
简要分析完整机构数据
"""

import json

def quick_summary():
    """快速总结机构数据"""
    
    try:
        with open('./review-data/institutions_data_full.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("❌ 找不到完整机构数据文件")
        return

    print("🏛️  ICLR审稿机构简要分析报告")
    print("=" * 50)
    
    total = data['total_institutions']
    summary = data['extraction_summary']
    
    print(f"📊 基本统计:")
    print(f"  • 总机构数量: {total}")
    print(f"  • 仅作者机构: {summary['author_only_institutions']} ({summary['author_only_institutions']/total*100:.1f}%)")
    print(f"  • 仅审稿人机构: {summary['reviewer_only_institutions']} ({summary['reviewer_only_institutions']/total*100:.1f}%)")
    print(f"  • 双重角色机构: {summary['both_institutions']} ({summary['both_institutions']/total*100:.1f}%)")
    
    print(f"\n🚨 利益冲突风险:")
    conflict_institutions = [inst for inst in data['institutions'] if inst['type'] == 'both']
    print(f"  • 发现 {len(conflict_institutions)} 个机构既有作者又有审稿人")
    print(f"  • 潜在冲突比例: {len(conflict_institutions)/total*100:.1f}%")
    
    # 检测直接冲突
    direct_conflicts = []
    for inst in conflict_institutions:
        author_submissions = set(sub['submission_number'] for sub in inst['submissions_as_author'])
        reviewer_submissions = set(sub['submission_number'] for sub in inst['submissions_as_reviewer'])
        direct_conflict_subs = author_submissions.intersection(reviewer_submissions)
        
        if direct_conflict_subs:
            direct_conflicts.append({
                'institution': inst['institution_name'],
                'conflicts': sorted(direct_conflict_subs),
                'conflict_count': len(direct_conflict_subs)
            })
    
    if direct_conflicts:
        print(f"\n⚠️  发现 {len(direct_conflicts)} 个机构存在直接冲突:")
        total_conflicts = sum(c['conflict_count'] for c in direct_conflicts)
        print(f"  • 总计 {total_conflicts} 个直接冲突投稿")
        
        # 显示前5个最严重的冲突
        direct_conflicts.sort(key=lambda x: x['conflict_count'], reverse=True)
        print(f"\n🔥 最严重的利益冲突:")
        for i, conflict in enumerate(direct_conflicts[:5], 1):
            print(f"  {i}. {conflict['institution'][:40]}")
            print(f"     冲突投稿: {conflict['conflicts'][:10]}{'...' if len(conflict['conflicts']) > 10 else ''} (共{conflict['conflict_count']}个)")
    else:
        print(f"\n✅ 未发现直接利益冲突 (同一机构在同一投稿中既是作者又是审稿人)")
    
    print(f"\n🏆 最活跃机构 (参与投稿数Top 10):")
    institutions_by_activity = sorted(
        data['institutions'], 
        key=lambda x: x['stats']['unique_submissions_involved'],
        reverse=True
    )
    
    for i, inst in enumerate(institutions_by_activity[:10], 1):
        stats = inst['stats']
        type_str = "📝" if inst['type'] == 'author_institution' else "⚖️" if inst['type'] == 'reviewer_institution' else "🔄"
        print(f"  {i:2d}. {type_str} {inst['institution_name'][:35]:35s} | 参与: {stats['unique_submissions_involved']:3d} | 成员: {stats['total_members']:3d}")
    
    # 审稿评分统计
    reviewer_institutions = [
        inst for inst in data['institutions'] 
        if inst['type'] in ['reviewer_institution', 'both'] and 'avg_rating_given' in inst['stats']
    ]
    
    if reviewer_institutions:
        print(f"\n⚖️  审稿评分分析 (基于 {len(reviewer_institutions)} 个审稿机构):")
        
        # 计算整体统计
        all_ratings = [inst['stats']['avg_rating_given'] for inst in reviewer_institutions]
        avg_rating = sum(all_ratings) / len(all_ratings)
        print(f"  • 所有机构平均评分: {avg_rating:.2f}")
        
        # 最宽松和最严格的机构
        reviewer_institutions.sort(key=lambda x: x['stats']['avg_rating_given'], reverse=True)
        
        print(f"\n  最宽松机构 (Top 3):")
        for i, inst in enumerate(reviewer_institutions[:3], 1):
            avg_score = inst['stats']['avg_rating_given']
            review_count = inst['stats']['submissions_as_reviewer_count']
            print(f"    {i}. {inst['institution_name'][:40]:40s} | 平均分: {avg_score:.2f} | 审稿数: {review_count}")
        
        print(f"\n  最严格机构 (Bottom 3):")
        for i, inst in enumerate(reviewer_institutions[-3:], 1):
            avg_score = inst['stats']['avg_rating_given']
            review_count = inst['stats']['submissions_as_reviewer_count']
            print(f"    {i}. {inst['institution_name'][:40]:40s} | 平均分: {avg_score:.2f} | 审稿数: {review_count}")
    
    # Unknown机构分析
    unknown_institutions = [inst for inst in data['institutions'] if 'unknown' in inst['institution_name'].lower()]
    if unknown_institutions:
        print(f"\n📝 数据质量:")
        print(f"  • 机构信息完整度: {((total-len(unknown_institutions))/total*100):.1f}%")
        print(f"  • Unknown/缺失机构: {len(unknown_institutions)} ({len(unknown_institutions)/total*100:.1f}%)")
    
    print(f"\n" + "=" * 50)

if __name__ == '__main__':
    quick_summary()