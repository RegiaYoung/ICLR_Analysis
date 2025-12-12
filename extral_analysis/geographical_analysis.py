#!/usr/bin/env python3
"""
ICLR 地域维度分析模块
实现国家学术特征、跨国合作、地域偏见和文化差异分析
"""

import json
import numpy as np
import pandas as pd
from collections import defaultdict, Counter
from datetime import datetime
import os
from itertools import combinations
import statistics

class GeographicalAnalyzer:
    def __init__(self, reviews_data_path, people_data_path, institutions_data_path):
        """初始化地域分析器"""
        print("🌍 启动地域维度分析...")
        
        # 加载数据
        with open(reviews_data_path, 'r', encoding='utf-8') as f:
            self.reviews_data = json.load(f)
            
        with open(people_data_path, 'r', encoding='utf-8') as f:
            self.people_data = json.load(f)
            
        with open(institutions_data_path, 'r', encoding='utf-8') as f:
            self.institutions_data = json.load(f)
        
        # 创建国家映射
        self.country_data = defaultdict(lambda: {
            'reviewers': set(),
            'authors': set(),
            'institutions': set(),
            'reviews': [],
            'ratings': [],
            'confidences': [],
            'text_lengths': []
        })
        
        print(f"✅ 数据加载完成")
        
    def analyze_country_characteristics(self):
        """分析国家学术特征"""
        print("\n🌎 分析国家学术特征...")
        
        # 构建国家数据
        reviewer_country_map = {}
        author_country_map = {}
        
        # 从people数据中提取国家信息
        for person_id, person_data in self.people_data['people'].items():
            nationality = person_data.get('nationality', 'Unknown')
            roles = person_data.get('roles', [])
            
            if 'reviewer' in roles:
                reviewer_country_map[person_id] = nationality
                self.country_data[nationality]['reviewers'].add(person_id)
                
            if 'author' in roles:
                author_country_map[person_id] = nationality
                self.country_data[nationality]['authors'].add(person_id)
        
        # 分析评审记录
        processed_reviews = 0
        for submission_num, submission_data in self.reviews_data['reviews'].items():
            for review in submission_data['reviews']:
                reviewer_id = review.get('reviewer_id')
                if not reviewer_id or reviewer_id not in reviewer_country_map:
                    continue
                
                reviewer_country = reviewer_country_map[reviewer_id]
                
                # 收集评审数据
                rating = review.get('rating')
                confidence = review.get('confidence')
                content = review.get('content', {})
                
                # 计算文本长度
                summary_len = len(content.get('summary', '')) if content.get('summary') else 0
                strengths_len = len(content.get('strengths', '')) if content.get('strengths') else 0
                weaknesses_len = len(content.get('weaknesses', '')) if content.get('weaknesses') else 0
                questions_len = len(content.get('questions', '')) if content.get('questions') else 0
                total_len = summary_len + strengths_len + weaknesses_len + questions_len
                
                country_data = self.country_data[reviewer_country]
                country_data['reviews'].append({
                    'submission_number': int(submission_num),
                    'review_id': review.get('review_id'),
                    'reviewer_id': reviewer_id,
                    'rating': rating,
                    'confidence': confidence,
                    'text_length': total_len
                })
                
                if rating is not None:
                    country_data['ratings'].append(rating)
                if confidence is not None:
                    country_data['confidences'].append(confidence)
                country_data['text_lengths'].append(total_len)
                
                processed_reviews += 1
        
        # 添加机构信息
        for institution in self.institutions_data['institutions']:
            country = institution.get('country', 'Unknown')
            if country != 'Unknown':
                self.country_data[country]['institutions'].add(institution['institution_name'])
        
        print(f"✅ 处理了 {processed_reviews} 条评审记录")
        print(f"📊 分析了 {len(self.country_data)} 个国家/地区")
        
        return dict(self.country_data)
    
    def calculate_country_metrics(self, country_data):
        """计算国家指标"""
        print("\n📏 计算国家学术指标...")
        
        country_profiles = {}
        
        for country, data in country_data.items():
            if len(data['reviews']) < 5:  # 至少5次评审
                continue
            
            # 基础统计
            num_reviewers = len(data['reviewers'])
            num_authors = len(data['authors'])
            num_institutions = len(data['institutions'])
            num_reviews = len(data['reviews'])
            
            # 评审特征指标
            avg_rating = np.mean(data['ratings']) if data['ratings'] else 0
            rating_std = np.std(data['ratings']) if len(data['ratings']) > 1 else 0
            median_rating = np.median(data['ratings']) if data['ratings'] else 0
            
            avg_confidence = np.mean(data['confidences']) if data['confidences'] else 0
            confidence_std = np.std(data['confidences']) if len(data['confidences']) > 1 else 0
            
            avg_text_length = np.mean(data['text_lengths']) if data['text_lengths'] else 0
            text_std = np.std(data['text_lengths']) if len(data['text_lengths']) > 1 else 0
            
            # 计算国家特征指标
            strictness_score = (10 - avg_rating) / 8 * 100 if avg_rating > 0 else 0
            detail_score = min(avg_text_length / 2000 * 100, 100) if avg_text_length > 0 else 0
            consistency_score = max(0, (1 - rating_std / 4) * 100) if rating_std is not None else 0
            confidence_score = avg_confidence / 5 * 100 if avg_confidence > 0 else 0
            
            # 学术活跃度指标
            reviews_per_reviewer = num_reviews / num_reviewers if num_reviewers > 0 else 0
            author_reviewer_ratio = num_authors / max(num_reviewers, 1) if num_reviewers > 0 else 0
            
            # 国际化程度（后续在跨国分析中计算）
            
            country_profile = {
                'country': country,
                'academic_scale': {
                    'num_reviewers': num_reviewers,
                    'num_authors': num_authors,
                    'num_institutions': num_institutions,
                    'total_reviews': num_reviews,
                    'reviews_per_reviewer': round(reviews_per_reviewer, 2),
                    'author_reviewer_ratio': round(author_reviewer_ratio, 2)
                },
                
                'reviewing_characteristics': {
                    'avg_rating': round(avg_rating, 2),
                    'rating_std': round(rating_std, 2),
                    'median_rating': round(median_rating, 2),
                    'avg_confidence': round(avg_confidence, 2),
                    'confidence_std': round(confidence_std, 2),
                    'avg_text_length': round(avg_text_length, 0),
                    'text_std': round(text_std, 0)
                },
                
                'country_scores': {
                    'strictness_score': round(strictness_score, 2),
                    'detail_score': round(detail_score, 2),
                    'consistency_score': round(consistency_score, 2),
                    'confidence_score': round(confidence_score, 2)
                },
                
                'tags': self._generate_country_tags(
                    strictness_score, detail_score, consistency_score, 
                    num_reviewers, num_institutions, reviews_per_reviewer
                )
            }
            
            country_profiles[country] = country_profile
        
        print(f"✅ 生成了 {len(country_profiles)} 个国家画像")
        return country_profiles
    
    def _generate_country_tags(self, strictness, detail, consistency, num_reviewers, num_institutions, reviews_per_reviewer):
        """生成国家标签"""
        tags = []
        
        # 规模标签
        if num_reviewers >= 200:
            tags.append("学术大国")
        elif num_reviewers >= 50:
            tags.append("学术中等国")
        else:
            tags.append("学术小国")
        
        # 严格度标签
        if strictness >= 70:
            tags.append("严格评审文化")
        elif strictness <= 50:
            tags.append("宽松评审文化")
        else:
            tags.append("中性评审文化")
        
        # 详细度标签
        if detail >= 70:
            tags.append("详细评审风格")
        elif detail <= 30:
            tags.append("简洁评审风格")
        
        # 稳定性标签
        if consistency >= 80:
            tags.append("评审标准统一")
        elif consistency <= 60:
            tags.append("评审标准多样")
        
        # 活跃度标签
        if reviews_per_reviewer >= 3:
            tags.append("高度参与")
        elif reviews_per_reviewer >= 2:
            tags.append("积极参与")
        else:
            tags.append("适度参与")
        
        return tags
    
    def analyze_cross_country_interactions(self, country_data):
        """分析跨国互评关系"""
        print("\n🌐 分析跨国互评关系...")
        
        # 构建国家间互评矩阵
        cross_country_matrix = defaultdict(lambda: defaultdict(lambda: {
            'count': 0,
            'ratings': [],
            'confidences': [],
            'reviews': []
        }))
        
        reviewer_country_map = {}
        for person_id, person_data in self.people_data['people'].items():
            nationality = person_data.get('nationality', 'Unknown')
            roles = person_data.get('roles', [])
            if 'reviewer' in roles:
                reviewer_country_map[person_id] = nationality
        
        # 分析评审记录，构建跨国关系
        # 注意：由于缺少明确的作者国籍信息，这里使用一个简化的方法
        # 实际应用中需要从submission数据中获取作者国籍
        
        same_country_reviews = defaultdict(list)
        
        for submission_num, submission_data in self.reviews_data['reviews'].items():
            reviewer_countries = []
            
            for review in submission_data['reviews']:
                reviewer_id = review.get('reviewer_id')
                if reviewer_id and reviewer_id in reviewer_country_map:
                    reviewer_country = reviewer_country_map[reviewer_id]
                    reviewer_countries.append((reviewer_country, review))
            
            # 分析同一篇论文的不同国家审稿人评分差异
            if len(reviewer_countries) >= 2:
                for i, (country1, review1) in enumerate(reviewer_countries):
                    for j, (country2, review2) in enumerate(reviewer_countries):
                        if i != j:
                            rating1 = review1.get('rating')
                            rating2 = review2.get('rating')
                            
                            if rating1 is not None and rating2 is not None:
                                if country1 == country2:
                                    # 同国评审
                                    same_country_reviews[country1].append({
                                        'submission': int(submission_num),
                                        'rating_diff': abs(rating1 - rating2),
                                        'avg_rating': (rating1 + rating2) / 2
                                    })
                                else:
                                    # 跨国评审
                                    interaction_data = cross_country_matrix[country1][country2]
                                    interaction_data['count'] += 1
                                    interaction_data['ratings'].append(rating1)
                                    interaction_data['reviews'].append({
                                        'submission': int(submission_num),
                                        'reviewer_country': country1,
                                        'target_country': country2,
                                        'rating': rating1,
                                        'confidence': review1.get('confidence')
                                    })
        
        print(f"✅ 构建了跨国互评关系网络")
        return dict(cross_country_matrix), dict(same_country_reviews)
    
    def detect_geographical_bias(self, cross_country_matrix, same_country_reviews, country_profiles):
        """检测地域偏见"""
        print("\n🔍 检测地域偏见...")
        
        geographical_bias = {}
        
        for reviewer_country, targets in cross_country_matrix.items():
            if reviewer_country not in country_profiles:
                continue
            
            # 计算该国对其他国家的评分模式
            all_cross_ratings = []
            target_ratings = {}
            
            for target_country, data in targets.items():
                if data['count'] >= 3 and data['ratings']:
                    avg_rating = np.mean(data['ratings'])
                    target_ratings[target_country] = {
                        'avg_rating': round(avg_rating, 2),
                        'count': data['count']
                    }
                    all_cross_ratings.extend(data['ratings'])
            
            if len(all_cross_ratings) >= 10:  # 需要足够的跨国评审样本
                overall_cross_avg = np.mean(all_cross_ratings)
                
                # 同国 vs 跨国评审差异
                same_country_data = same_country_reviews.get(reviewer_country, [])
                same_country_avg = None
                
                if same_country_data:
                    same_ratings = [item['avg_rating'] for item in same_country_data]
                    same_country_avg = np.mean(same_ratings)
                
                home_bias_score = None
                if same_country_avg is not None:
                    home_bias_score = round(same_country_avg - overall_cross_avg, 2)
                
                # 检测对特定国家的偏见
                biased_towards = []
                biased_against = []
                
                for target_country, rating_data in target_ratings.items():
                    if rating_data['count'] >= 5:
                        rating_diff = rating_data['avg_rating'] - overall_cross_avg
                        
                        if abs(rating_diff) >= 0.3:  # 显著差异阈值
                            if rating_diff > 0:
                                biased_towards.append({
                                    'target_country': target_country,
                                    'avg_rating': rating_data['avg_rating'],
                                    'difference': round(rating_diff, 2),
                                    'review_count': rating_data['count']
                                })
                            else:
                                biased_against.append({
                                    'target_country': target_country,
                                    'avg_rating': rating_data['avg_rating'],
                                    'difference': round(rating_diff, 2),
                                    'review_count': rating_data['count']
                                })
                
                geographical_bias[reviewer_country] = {
                    'overall_cross_country_avg': round(overall_cross_avg, 2),
                    'same_country_avg': round(same_country_avg, 2) if same_country_avg else None,
                    'home_bias_score': home_bias_score,
                    'total_cross_reviews': len(all_cross_ratings),
                    'biased_towards': sorted(biased_towards, key=lambda x: x['difference'], reverse=True)[:5],
                    'biased_against': sorted(biased_against, key=lambda x: x['difference'])[:5],
                    'cultural_distance_effects': self._analyze_cultural_distance(reviewer_country, target_ratings)
                }
        
        print(f"✅ 完成了 {len(geographical_bias)} 个国家的地域偏见分析")
        return geographical_bias
    
    def _analyze_cultural_distance(self, reviewer_country, target_ratings):
        """分析文化距离效应"""
        # 简化版文化距离分析
        # 实际应用中可以使用更复杂的文化距离模型
        
        cultural_groups = {
            'East_Asian': ['China', 'South Korea', 'Japan', 'Taiwan', 'Singapore'],
            'Western': ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Netherlands'],
            'South_Asian': ['India', 'Pakistan', 'Bangladesh'],
            'European': ['Germany', 'France', 'Netherlands', 'United Kingdom', 'Italy', 'Spain'],
            'Middle_Eastern': ['Iran', 'Israel', 'Turkey']
        }
        
        reviewer_group = None
        for group, countries in cultural_groups.items():
            if reviewer_country in countries:
                reviewer_group = group
                break
        
        if not reviewer_group:
            return {}
        
        same_culture_ratings = []
        different_culture_ratings = []
        
        for target_country, rating_data in target_ratings.items():
            target_group = None
            for group, countries in cultural_groups.items():
                if target_country in countries:
                    target_group = group
                    break
            
            if target_group:
                if target_group == reviewer_group:
                    same_culture_ratings.append(rating_data['avg_rating'])
                else:
                    different_culture_ratings.append(rating_data['avg_rating'])
        
        result = {}
        if same_culture_ratings and different_culture_ratings:
            same_avg = np.mean(same_culture_ratings)
            diff_avg = np.mean(different_culture_ratings)
            cultural_bias = round(same_avg - diff_avg, 2)
            
            result = {
                'reviewer_cultural_group': reviewer_group,
                'same_culture_avg_rating': round(same_avg, 2),
                'different_culture_avg_rating': round(diff_avg, 2),
                'cultural_bias_score': cultural_bias,
                'same_culture_count': len(same_culture_ratings),
                'different_culture_count': len(different_culture_ratings)
            }
        
        return result
    
    def analyze_international_collaboration(self, country_profiles):
        """分析国际合作模式"""
        print("\n🤝 分析国际合作模式...")
        
        collaboration_analysis = {
            'collaboration_matrix': {},
            'openness_rankings': {},
            'collaboration_patterns': {}
        }
        
        # 计算各国的国际化程度
        for country, profile in country_profiles.items():
            num_reviewers = profile['academic_scale']['num_reviewers']
            num_institutions = profile['academic_scale']['num_institutions']
            
            # 国际化指标（简化版本）
            # 实际应用中需要更多国际合作数据
            international_openness = min(num_institutions / max(num_reviewers, 1), 1.0)
            
            collaboration_analysis['openness_rankings'][country] = {
                'openness_score': round(international_openness, 3),
                'num_reviewers': num_reviewers,
                'num_institutions': num_institutions,
                'reviews_per_reviewer': profile['academic_scale']['reviews_per_reviewer']
            }
        
        # 识别合作模式
        # 这里使用简化的分析，实际需要更多合作数据
        major_countries = [country for country, profile in country_profiles.items() 
                          if profile['academic_scale']['num_reviewers'] >= 20]
        
        for country in major_countries:
            collaboration_analysis['collaboration_patterns'][country] = {
                'collaboration_type': self._classify_collaboration_type(country_profiles[country]),
                'preferred_partners': [],  # 需要更多数据来分析
                'collaboration_strength': self._calculate_collaboration_strength(country_profiles[country])
            }
        
        print(f"✅ 完成了国际合作模式分析")
        return collaboration_analysis
    
    def _classify_collaboration_type(self, country_profile):
        """分类合作类型"""
        num_reviewers = country_profile['academic_scale']['num_reviewers']
        reviews_per_reviewer = country_profile['academic_scale']['reviews_per_reviewer']
        
        if num_reviewers >= 200:
            if reviews_per_reviewer >= 2.5:
                return "Global Academic Hub"
            else:
                return "Major Academic Power"
        elif num_reviewers >= 50:
            if reviews_per_reviewer >= 2.0:
                return "Active Regional Player"
            else:
                return "Emerging Academic Force"
        else:
            return "Specialized Contributor"
    
    def _calculate_collaboration_strength(self, country_profile):
        """计算合作强度"""
        num_reviewers = country_profile['academic_scale']['num_reviewers']
        num_institutions = country_profile['academic_scale']['num_institutions']
        
        # 简化的合作强度计算
        strength = (num_reviewers * 0.7 + num_institutions * 0.3) / 100
        return min(round(strength, 2), 1.0)
    
    def create_geographical_rankings(self, country_profiles, geographical_bias, collaboration_analysis):
        """创建地域排行榜"""
        print("\n🏆 创建地域排行榜...")
        
        # 过滤：只包含至少20个审稿人的国家
        qualified_countries = [profile for profile in country_profiles.values() 
                             if profile['academic_scale']['num_reviewers'] >= 20]
        
        print(f"📊 合格国家数量（≥20个审稿人）: {len(qualified_countries)}")
        
        rankings = {}
        
        # 1. 学术规模排行榜
        rankings['academic_scale'] = {
            'largest_academic_communities': sorted(qualified_countries, 
                                                 key=lambda x: x['academic_scale']['num_reviewers'], reverse=True)[:20],
            'most_institutions': sorted(qualified_countries,
                                      key=lambda x: x['academic_scale']['num_institutions'], reverse=True)[:20],
            'highest_participation': sorted(qualified_countries,
                                          key=lambda x: x['academic_scale']['reviews_per_reviewer'], reverse=True)[:20]
        }
        
        # 2. 评审特征排行榜
        rankings['reviewing_characteristics'] = {
            'most_strict': sorted(qualified_countries,
                                key=lambda x: x['country_scores']['strictness_score'], reverse=True)[:15],
            'most_lenient': sorted(qualified_countries,
                                 key=lambda x: x['country_scores']['strictness_score'])[:15],
            'most_detailed': sorted(qualified_countries,
                                  key=lambda x: x['country_scores']['detail_score'], reverse=True)[:15],
            'most_consistent': sorted(qualified_countries,
                                    key=lambda x: x['country_scores']['consistency_score'], reverse=True)[:15],
            'highest_confidence': sorted(qualified_countries,
                                       key=lambda x: x['country_scores']['confidence_score'], reverse=True)[:15]
        }
        
        # 3. 国际化程度排行榜
        openness_data = collaboration_analysis['openness_rankings']
        qualified_openness = {country: data for country, data in openness_data.items()
                            if data['num_reviewers'] >= 20}
        
        rankings['internationalization'] = {
            'most_open': sorted(qualified_openness.items(),
                              key=lambda x: x[1]['openness_score'], reverse=True)[:15],
            'collaboration_types': collaboration_analysis['collaboration_patterns']
        }
        
        # 4. 地域偏见排行榜
        bias_rankings = []
        for country, bias_data in geographical_bias.items():
            if country in [p['country'] for p in qualified_countries]:
                home_bias = bias_data.get('home_bias_score')
                if home_bias is not None:
                    bias_score = abs(home_bias)
                    bias_rankings.append({
                        'country': country,
                        'home_bias_score': home_bias,
                        'bias_magnitude': bias_score,
                        'total_cross_reviews': bias_data['total_cross_reviews']
                    })
        
        rankings['geographical_bias'] = {
            'most_biased': sorted(bias_rankings, key=lambda x: x['bias_magnitude'], reverse=True)[:10],
            'most_fair': sorted(bias_rankings, key=lambda x: x['bias_magnitude'])[:10]
        }
        
        # 5. 文化圈分析
        cultural_analysis = self._analyze_cultural_circles(qualified_countries, geographical_bias)
        rankings['cultural_analysis'] = cultural_analysis
        
        print(f"✅ 地域排行榜生成完成")
        return rankings
    
    def _analyze_cultural_circles(self, qualified_countries, geographical_bias):
        """分析文化圈特征"""
        cultural_groups = {
            'East_Asian': ['China', 'South Korea', 'Japan', 'Taiwan', 'Singapore'],
            'Western': ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Netherlands'],
            'European': ['Germany', 'France', 'Netherlands', 'United Kingdom', 'Italy', 'Spain'],
            'South_Asian': ['India', 'Pakistan', 'Bangladesh']
        }
        
        cultural_circle_stats = {}
        
        for group_name, countries in cultural_groups.items():
            group_countries = [country for country in qualified_countries 
                             if country['country'] in countries]
            
            if len(group_countries) >= 2:
                # 计算文化圈平均特征
                avg_strictness = np.mean([c['country_scores']['strictness_score'] for c in group_countries])
                avg_detail = np.mean([c['country_scores']['detail_score'] for c in group_countries])
                avg_confidence = np.mean([c['country_scores']['confidence_score'] for c in group_countries])
                total_reviewers = sum([c['academic_scale']['num_reviewers'] for c in group_countries])
                
                cultural_circle_stats[group_name] = {
                    'countries': [c['country'] for c in group_countries],
                    'country_count': len(group_countries),
                    'total_reviewers': total_reviewers,
                    'avg_strictness': round(avg_strictness, 2),
                    'avg_detail_score': round(avg_detail, 2),
                    'avg_confidence': round(avg_confidence, 2),
                    'characteristics': self._get_cultural_characteristics(group_name, avg_strictness, avg_detail)
                }
        
        return cultural_circle_stats
    
    def _get_cultural_characteristics(self, group_name, strictness, detail):
        """获取文化特征"""
        characteristics = []
        
        if strictness >= 70:
            characteristics.append("严格评审传统")
        elif strictness <= 50:
            characteristics.append("宽松评审文化")
        
        if detail >= 70:
            characteristics.append("详细反馈风格")
        elif detail <= 30:
            characteristics.append("简洁反馈风格")
        
        # 根据文化圈添加特定特征
        cultural_traits = {
            'East_Asian': ["细致认真", "层次分明"],
            'Western': ["直接坦率", "创新导向"],
            'European': ["严谨规范", "平衡客观"],
            'South_Asian': ["详细分析", "建设性建议"]
        }
        
        if group_name in cultural_traits:
            characteristics.extend(cultural_traits[group_name])
        
        return characteristics
    
    def save_geographical_results(self, country_profiles, cross_country_matrix, geographical_bias, 
                                collaboration_analysis, rankings):
        """保存地域分析结果"""
        print("\n💾 保存地域分析结果...")
        
        # 创建输出目录
        output_dir = "analysis_results/geographical"
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. 保存国家画像
        country_data = {
            'metadata': {
                'total_countries': len(country_profiles),
                'generation_timestamp': datetime.now().isoformat(),
                'minimum_reviewer_threshold': 5,
                'description': 'ICLR国家地域学术特征画像'
            },
            'country_profiles': country_profiles
        }
        
        with open(f"{output_dir}/country_profiles.json", 'w', encoding='utf-8') as f:
            json.dump(country_data, f, ensure_ascii=False, indent=2)
        
        # 2. 保存跨国互评矩阵（简化版）
        simplified_matrix = {}
        for reviewer_country, targets in cross_country_matrix.items():
            if reviewer_country in country_profiles:
                simplified_matrix[reviewer_country] = {}
                for target_country, data in targets.items():
                    if data['count'] >= 3 and target_country in country_profiles:
                        simplified_matrix[reviewer_country][target_country] = {
                            'interaction_count': data['count'],
                            'avg_rating': round(np.mean(data['ratings']), 2) if data['ratings'] else 0
                        }
        
        cross_country_data = {
            'metadata': {
                'generation_timestamp': datetime.now().isoformat(),
                'description': '国家间互评关系矩阵',
                'minimum_interaction_threshold': 3
            },
            'interaction_matrix': simplified_matrix
        }
        
        with open(f"{output_dir}/cross_country_matrix.json", 'w', encoding='utf-8') as f:
            json.dump(cross_country_data, f, ensure_ascii=False, indent=2)
        
        # 3. 保存地域偏见分析
        bias_data = {
            'metadata': {
                'generation_timestamp': datetime.now().isoformat(),
                'description': '地域偏见检测分析结果',
                'bias_threshold': 0.3
            },
            'geographical_bias': geographical_bias
        }
        
        with open(f"{output_dir}/geographical_bias_analysis.json", 'w', encoding='utf-8') as f:
            json.dump(bias_data, f, ensure_ascii=False, indent=2)
        
        # 4. 保存国际合作分析
        with open(f"{output_dir}/international_collaboration.json", 'w', encoding='utf-8') as f:
            json.dump(collaboration_analysis, f, ensure_ascii=False, indent=2)
        
        # 5. 保存地域排行榜
        rankings_data = {
            'metadata': {
                'generation_timestamp': datetime.now().isoformat(),
                'description': '地域维度各类排行榜',
                'minimum_reviewer_threshold': 20
            },
            'rankings': rankings
        }
        
        with open(f"{output_dir}/geographical_rankings.json", 'w', encoding='utf-8') as f:
            json.dump(rankings_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 结果已保存到 {output_dir}/ 目录")
        print(f"  📄 country_profiles.json - {len(country_profiles)} 个国家画像")
        print(f"  🌐 cross_country_matrix.json - 跨国互评矩阵")
        print(f"  🔍 geographical_bias_analysis.json - 地域偏见分析")
        print(f"  🤝 international_collaboration.json - 国际合作分析")
        print(f"  🏆 geographical_rankings.json - 地域排行榜")
    
    def run_analysis(self):
        """执行完整的地域分析流程"""
        print("🎯 开始地域维度分析...")
        
        # 1. 分析国家特征
        country_data = self.analyze_country_characteristics()
        
        # 2. 计算国家指标
        country_profiles = self.calculate_country_metrics(country_data)
        
        # 3. 分析跨国互评
        cross_country_matrix, same_country_reviews = self.analyze_cross_country_interactions(country_data)
        
        # 4. 检测地域偏见
        geographical_bias = self.detect_geographical_bias(cross_country_matrix, same_country_reviews, country_profiles)
        
        # 5. 分析国际合作
        collaboration_analysis = self.analyze_international_collaboration(country_profiles)
        
        # 6. 创建排行榜
        rankings = self.create_geographical_rankings(country_profiles, geographical_bias, collaboration_analysis)
        
        # 7. 保存结果
        self.save_geographical_results(country_profiles, cross_country_matrix, geographical_bias, 
                                     collaboration_analysis, rankings)
        
        print(f"\n🎉 地域分析完成！")
        print(f"🌍 分析了 {len(country_profiles)} 个国家/地区")
        print(f"🌐 构建了跨国互评网络")
        print(f"🔍 完成了地域偏见检测")
        print(f"🤝 分析了国际合作模式")
        print(f"🏆 生成了多维度地域排行榜")
        
        return country_profiles, cross_country_matrix, geographical_bias, collaboration_analysis, rankings

def main():
    """主函数"""
    print("=" * 60)
    print("🌍 ICLR 地域维度分析系统")
    print("=" * 60)
    
    # 数据文件路径 - 可以通过环境变量或命令行参数自定义
    data_dir = os.environ.get('ICLR_DATA_DIR', './review-data')
    reviews_path = os.path.join(data_dir, 'reviews.json')
    people_path = os.path.join(data_dir, 'people.json')
    institutions_path = os.path.join(data_dir, 'institutions.json')
    
    # 检查文件存在
    for path, name in [(reviews_path, "评审数据"), (people_path, "人员数据"), (institutions_path, "机构数据")]:
        if not os.path.exists(path):
            print(f"❌ {name}文件不存在: {path}")
            return
    
    # 创建分析器并运行
    analyzer = GeographicalAnalyzer(reviews_path, people_path, institutions_path)
    results = analyzer.run_analysis()
    
    print("\n🎯 地域分析完成！可以继续进行下一个分析模块...")

if __name__ == "__main__":
    main()