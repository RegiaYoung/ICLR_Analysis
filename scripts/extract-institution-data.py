#!/usr/bin/env python3
"""
解析带机构数据的JSONL文件，提取所有机构信息到单独的JSON文件
"""

import json
import os
from collections import defaultdict

def normalize_institution_name(institution):
    """简单规范化机构名称"""
    if not institution or institution.lower() in ['unknown', 'null', '']:
        return None
    
    # 基础清理
    institution = institution.strip()
    if not institution:
        return None
        
    return institution

def extract_institution_data(input_file, output_file):
    """提取所有机构信息"""
    
    institution_data = {}  # 使用字典避免重复，key为机构名
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue
                
            try:
                submission = json.loads(line)
                submission_id = submission.get('submission_id', f'unknown_{line_num}')
                submission_number = submission.get('submission_number', line_num)
                
                # 处理作者机构
                authors = submission.get('authors', [])
                for author in authors:
                    author_id = author.get('id', 'unknown_author')
                    author_name = author.get('name', 'Unknown')
                    affiliation = author.get('affiliation')
                    profile_url = author.get('profile_url', '')
                    
                    normalized_affiliation = normalize_institution_name(affiliation)
                    if normalized_affiliation:
                        if normalized_affiliation not in institution_data:
                            institution_data[normalized_affiliation] = {
                                'institution_name': normalized_affiliation,
                                'type': 'mixed',  # 可能既是作者机构也是审稿人机构
                                'members': [],
                                'submissions_as_author': [],
                                'submissions_as_reviewer': [],
                                'first_seen': submission_number,
                                'homepage_url': None  # 暂时无法从数据中获取
                            }
                        
                        # 添加成员信息
                        member_info = {
                            'id': author_id,
                            'name': author_name,
                            'profile_url': profile_url,
                            'role': 'author'
                        }
                        
                        # 检查是否已存在此成员
                        existing_member = None
                        for member in institution_data[normalized_affiliation]['members']:
                            if member['id'] == author_id:
                                existing_member = member
                                break
                        
                        if not existing_member:
                            institution_data[normalized_affiliation]['members'].append(member_info)
                        
                        # 添加投稿信息
                        author_submission_info = {
                            'submission_id': submission_id,
                            'submission_number': submission_number,
                            'author_id': author_id,
                            'author_name': author_name,
                            'submission_score': None  # 作者没有评分，后续会计算平均分
                        }
                        
                        institution_data[normalized_affiliation]['submissions_as_author'].append(author_submission_info)
                        
                        # 更新首次出现
                        if submission_number < institution_data[normalized_affiliation]['first_seen']:
                            institution_data[normalized_affiliation]['first_seen'] = submission_number
                
                # 处理审稿人机构
                reviews = submission.get('reviews', [])
                for review in reviews:
                    reviewer_id = review.get('reviewer_id', 'unknown_reviewer')
                    reviewer_name = review.get('reviewer_name', 'Unknown')
                    reviewer_affiliation = review.get('reviewer_affiliation', 'Unknown')
                    reviewer_profile_url = review.get('reviewer_profile_url', '')
                    
                    rating = review.get('rating', {})
                    confidence = review.get('confidence', {})
                    rating_value = rating.get('value') if isinstance(rating, dict) else rating
                    confidence_value = confidence.get('value') if isinstance(confidence, dict) else confidence
                    
                    normalized_affiliation = normalize_institution_name(reviewer_affiliation)
                    if normalized_affiliation:
                        if normalized_affiliation not in institution_data:
                            institution_data[normalized_affiliation] = {
                                'institution_name': normalized_affiliation,
                                'type': 'mixed',
                                'members': [],
                                'submissions_as_author': [],
                                'submissions_as_reviewer': [],
                                'first_seen': submission_number,
                                'homepage_url': None
                            }
                        
                        # 添加成员信息
                        member_info = {
                            'id': reviewer_id,
                            'name': reviewer_name,
                            'profile_url': reviewer_profile_url,
                            'role': 'reviewer'
                        }
                        
                        # 检查是否已存在此成员
                        existing_member = None
                        for member in institution_data[normalized_affiliation]['members']:
                            if member['id'] == reviewer_id:
                                existing_member = member
                                break
                        
                        if not existing_member:
                            institution_data[normalized_affiliation]['members'].append(member_info)
                        elif existing_member['role'] == 'author':
                            # 如果此人既是作者又是审稿人，更新角色
                            existing_member['role'] = 'both'
                        
                        # 添加审稿信息
                        reviewer_submission_info = {
                            'submission_id': submission_id,
                            'submission_number': submission_number,
                            'reviewer_id': reviewer_id,
                            'reviewer_name': reviewer_name,
                            'rating_given': rating_value,
                            'confidence': confidence_value
                        }
                        
                        institution_data[normalized_affiliation]['submissions_as_reviewer'].append(reviewer_submission_info)
                        
                        # 更新首次出现
                        if submission_number < institution_data[normalized_affiliation]['first_seen']:
                            institution_data[normalized_affiliation]['first_seen'] = submission_number
                            
            except json.JSONDecodeError as e:
                print(f"解析第 {line_num} 行时出错: {e}")
                continue
            except Exception as e:
                print(f"处理第 {line_num} 行时出现未知错误: {e}")
                continue
    
    # 计算统计信息并确定机构类型
    for institution_name, data in institution_data.items():
        author_count = len(data['submissions_as_author'])
        reviewer_count = len(data['submissions_as_reviewer'])
        
        if author_count > 0 and reviewer_count > 0:
            data['type'] = 'both'
        elif author_count > 0:
            data['type'] = 'author_institution'
        else:
            data['type'] = 'reviewer_institution'
        
        # 添加统计信息
        data['stats'] = {
            'total_members': len(data['members']),
            'submissions_as_author_count': author_count,
            'submissions_as_reviewer_count': reviewer_count,
            'unique_submissions_involved': len(set(
                [sub['submission_number'] for sub in data['submissions_as_author']] +
                [sub['submission_number'] for sub in data['submissions_as_reviewer']]
            ))
        }
        
        # 计算平均评分（如果作为审稿人）
        if reviewer_count > 0:
            ratings = [sub['rating_given'] for sub in data['submissions_as_reviewer'] 
                      if sub['rating_given'] is not None]
            if ratings:
                data['stats']['avg_rating_given'] = sum(ratings) / len(ratings)
                data['stats']['min_rating_given'] = min(ratings)
                data['stats']['max_rating_given'] = max(ratings)
        
        # 计算平均置信度（如果作为审稿人）
        if reviewer_count > 0:
            confidences = [sub['confidence'] for sub in data['submissions_as_reviewer'] 
                          if sub['confidence'] is not None]
            if confidences:
                data['stats']['avg_confidence'] = sum(confidences) / len(confidences)
    
    # 转换为列表并按first_seen排序
    institution_list = list(institution_data.values())
    institution_list.sort(key=lambda x: x['first_seen'])
    
    # 保存结果
    result = {
        'total_institutions': len(institution_list),
        'extraction_summary': {
            'author_only_institutions': len([i for i in institution_list if i['type'] == 'author_institution']),
            'reviewer_only_institutions': len([i for i in institution_list if i['type'] == 'reviewer_institution']),
            'both_institutions': len([i for i in institution_list if i['type'] == 'both']),
        },
        'institutions': institution_list
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 提取完成!")
    print(f"📊 总计发现 {len(institution_list)} 个机构")
    print(f"📝 仅作者机构: {result['extraction_summary']['author_only_institutions']}")
    print(f"👨‍⚖️ 仅审稿人机构: {result['extraction_summary']['reviewer_only_institutions']}")
    print(f"🔄 既是作者又是审稿人机构: {result['extraction_summary']['both_institutions']}")
    print(f"💾 结果保存至: {output_file}")
    
    return result

if __name__ == '__main__':
    input_file = './review-data/带机构数据.jsonl'
    output_file = './review-data/institutions_data_full.json'
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    try:
        extract_institution_data(input_file, output_file)
    except FileNotFoundError:
        print(f"❌ 找不到输入文件: {input_file}")
        print("请确保文件路径正确")
    except Exception as e:
        print(f"❌ 执行过程中出现错误: {e}")