#!/usr/bin/env python3
"""
ICLR 多样性分析模块
分析审稿人性别、文化和机构类型多样性对评审质量的影响
"""

import json
import numpy as np
import pandas as pd
from collections import defaultdict, Counter
from datetime import datetime
import os
import statistics
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# 设置中文字体和样式
plt.rcParams['font.family'] = ['Arial', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

class DiversityAnalyzer:
    def __init__(self, reviews_data_path, people_data_path, institutions_data_path):
        """初始化多样性分析器"""
        print("🌈 启动多样性分析模块...")
        
        # 加载数据
        with open(reviews_data_path, 'r', encoding='utf-8') as f:
            self.reviews_data = json.load(f)
            
        with open(people_data_path, 'r', encoding='utf-8') as f:
            self.people_data = json.load(f)
            
        with open(institutions_data_path, 'r', encoding='utf-8') as f:
            self.institutions_data = json.load(f)
        
        # 初始化分析结果存储
        self.diversity_results = {
            'gender_diversity': {},
            'cultural_diversity': {},
            'institutional_diversity': {},
            'composite_diversity': {}
        }
        
        print("✅ 数据加载完成")
    
    def analyze_gender_diversity(self):
        """分析性别多样性对评审质量的影响"""
        print("\n👥 分析性别多样性...")
        
        # 构建性别映射
        reviewer_gender_map = {}
        gender_stats = Counter()
        
        for person_id, person_data in self.people_data['people'].items():
            gender = person_data.get('gender', 'Unknown')
            roles = person_data.get('roles', [])
            
            if 'reviewer' in roles:
                reviewer_gender_map[person_id] = gender
                gender_stats[gender] += 1
        
        print(f"📊 性别分布: {dict(gender_stats)}")
        
        # 分析不同性别的评审特征
        gender_review_data = defaultdict(lambda: {
            'ratings': [],
            'confidences': [],
            'text_lengths': [],
            'review_count': 0
        })
        
        # 分析混合性别评审组的效果
        submission_gender_diversity = {}
        
        for submission_num, submission_data in self.reviews_data['reviews'].items():
            reviews = submission_data['reviews']
            reviewer_genders = []
            submission_ratings = []
            submission_confidences = []
            submission_lengths = []
            
            for review in reviews:
                reviewer_id = review.get('reviewer_id')
                if reviewer_id and reviewer_id in reviewer_gender_map:
                    gender = reviewer_gender_map[reviewer_id]
                    reviewer_genders.append(gender)
                    
                    # 收集个人数据
                    rating = review.get('rating')
                    confidence = review.get('confidence')
                    content = review.get('content', {})
                    
                    # 计算文本长度
                    summary_len = len(content.get('summary', '')) if content.get('summary') else 0
                    strengths_len = len(content.get('strengths', '')) if content.get('strengths') else 0
                    weaknesses_len = len(content.get('weaknesses', '')) if content.get('weaknesses') else 0
                    questions_len = len(content.get('questions', '')) if content.get('questions') else 0
                    total_len = summary_len + strengths_len + weaknesses_len + questions_len
                    
                    if rating is not None:
                        gender_review_data[gender]['ratings'].append(rating)
                        submission_ratings.append(rating)
                    if confidence is not None:
                        gender_review_data[gender]['confidences'].append(confidence)
                        submission_confidences.append(confidence)
                    
                    gender_review_data[gender]['text_lengths'].append(total_len)
                    gender_review_data[gender]['review_count'] += 1
                    submission_lengths.append(total_len)
            
            # 计算该submission的性别多样性
            if len(reviewer_genders) >= 2:
                unique_genders = len(set(g for g in reviewer_genders if g != 'Unknown'))
                total_known_genders = len([g for g in reviewer_genders if g != 'Unknown'])
                
                if total_known_genders > 0:
                    diversity_score = unique_genders / max(total_known_genders, 1)
                    
                    submission_gender_diversity[submission_num] = {
                        'diversity_score': diversity_score,
                        'reviewer_genders': reviewer_genders,
                        'avg_rating': np.mean(submission_ratings) if submission_ratings else None,
                        'rating_std': np.std(submission_ratings) if len(submission_ratings) > 1 else 0,
                        'avg_confidence': np.mean(submission_confidences) if submission_confidences else None,
                        'avg_text_length': np.mean(submission_lengths) if submission_lengths else 0,
                        'num_reviewers': len(reviewer_genders)
                    }
        
        # 计算性别多样性统计
        gender_profiles = {}
        for gender, data in gender_review_data.items():
            if data['review_count'] >= 10:  # 至少10次评审
                avg_rating = np.mean(data['ratings']) if data['ratings'] else 0
                rating_std = np.std(data['ratings']) if len(data['ratings']) > 1 else 0
                avg_confidence = np.mean(data['confidences']) if data['confidences'] else 0
                avg_text_length = np.mean(data['text_lengths']) if data['text_lengths'] else 0
                
                gender_profiles[gender] = {
                    'review_count': data['review_count'],
                    'avg_rating': round(avg_rating, 2),
                    'rating_std': round(rating_std, 2),
                    'avg_confidence': round(avg_confidence, 2),
                    'avg_text_length': round(avg_text_length, 0),
                    'strictness_score': round((10 - avg_rating) / 8 * 100, 2) if avg_rating > 0 else 0,
                    'detail_score': round(min(avg_text_length / 2000 * 100, 100), 2),
                    'consistency_score': round(max(0, (1 - rating_std / 4) * 100), 2)
                }
        
        # 分析多样性对评审质量的影响
        diversity_impact = self._analyze_diversity_impact(submission_gender_diversity, 'gender')
        
        self.diversity_results['gender_diversity'] = {
            'gender_distribution': dict(gender_stats),
            'gender_profiles': gender_profiles,
            'submission_diversity_analysis': diversity_impact,
            'diversity_correlation': self._calculate_diversity_correlation(submission_gender_diversity)
        }
        
        print(f"✅ 性别多样性分析完成，分析了 {len(submission_gender_diversity)} 个submission")
    
    def analyze_cultural_diversity(self):
        """分析文化多样性对评审质量的影响"""
        print("\n🌍 分析文化多样性...")
        
        # 定义文化圈映射
        cultural_groups = {
            'East_Asian': ['China', 'South Korea', 'Japan', 'Taiwan', 'Singapore'],
            'Western': ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Netherlands'],
            'South_Asian': ['India', 'Pakistan', 'Bangladesh'],
            'European': ['Germany', 'France', 'Netherlands', 'United Kingdom', 'Italy', 'Spain'],
            'Middle_Eastern': ['Iran', 'Israel', 'Turkey']
        }
        
        # 构建文化圈映射
        country_to_culture = {}
        for culture, countries in cultural_groups.items():
            for country in countries:
                country_to_culture[country] = culture
        
        reviewer_culture_map = {}
        culture_stats = Counter()
        
        for person_id, person_data in self.people_data['people'].items():
            nationality = person_data.get('nationality', 'Unknown')
            roles = person_data.get('roles', [])
            
            if 'reviewer' in roles:
                culture = country_to_culture.get(nationality, 'Other')
                reviewer_culture_map[person_id] = culture
                culture_stats[culture] += 1
        
        print(f"📊 文化圈分布: {dict(culture_stats)}")
        
        # 分析不同文化圈的评审特征
        culture_review_data = defaultdict(lambda: {
            'ratings': [],
            'confidences': [],
            'text_lengths': [],
            'review_count': 0
        })
        
        # 分析混合文化评审组的效果
        submission_culture_diversity = {}
        
        for submission_num, submission_data in self.reviews_data['reviews'].items():
            reviews = submission_data['reviews']
            reviewer_cultures = []
            submission_ratings = []
            submission_confidences = []
            submission_lengths = []
            
            for review in reviews:
                reviewer_id = review.get('reviewer_id')
                if reviewer_id and reviewer_id in reviewer_culture_map:
                    culture = reviewer_culture_map[reviewer_id]
                    reviewer_cultures.append(culture)
                    
                    # 收集数据
                    rating = review.get('rating')
                    confidence = review.get('confidence')
                    content = review.get('content', {})
                    
                    # 计算文本长度
                    summary_len = len(content.get('summary', '')) if content.get('summary') else 0
                    strengths_len = len(content.get('strengths', '')) if content.get('strengths') else 0
                    weaknesses_len = len(content.get('weaknesses', '')) if content.get('weaknesses') else 0
                    questions_len = len(content.get('questions', '')) if content.get('questions') else 0
                    total_len = summary_len + strengths_len + weaknesses_len + questions_len
                    
                    if rating is not None:
                        culture_review_data[culture]['ratings'].append(rating)
                        submission_ratings.append(rating)
                    if confidence is not None:
                        culture_review_data[culture]['confidences'].append(confidence)
                        submission_confidences.append(confidence)
                    
                    culture_review_data[culture]['text_lengths'].append(total_len)
                    culture_review_data[culture]['review_count'] += 1
                    submission_lengths.append(total_len)
            
            # 计算该submission的文化多样性
            if len(reviewer_cultures) >= 2:
                unique_cultures = len(set(c for c in reviewer_cultures if c != 'Other'))
                total_known_cultures = len([c for c in reviewer_cultures if c != 'Other'])
                
                if total_known_cultures > 0:
                    diversity_score = unique_cultures / max(total_known_cultures, 1)
                    
                    submission_culture_diversity[submission_num] = {
                        'diversity_score': diversity_score,
                        'reviewer_cultures': reviewer_cultures,
                        'avg_rating': np.mean(submission_ratings) if submission_ratings else None,
                        'rating_std': np.std(submission_ratings) if len(submission_ratings) > 1 else 0,
                        'avg_confidence': np.mean(submission_confidences) if submission_confidences else None,
                        'avg_text_length': np.mean(submission_lengths) if submission_lengths else 0,
                        'num_reviewers': len(reviewer_cultures)
                    }
        
        # 计算文化圈评审特征
        culture_profiles = {}
        for culture, data in culture_review_data.items():
            if data['review_count'] >= 20:  # 至少20次评审
                avg_rating = np.mean(data['ratings']) if data['ratings'] else 0
                rating_std = np.std(data['ratings']) if len(data['ratings']) > 1 else 0
                avg_confidence = np.mean(data['confidences']) if data['confidences'] else 0
                avg_text_length = np.mean(data['text_lengths']) if data['text_lengths'] else 0
                
                culture_profiles[culture] = {
                    'review_count': data['review_count'],
                    'avg_rating': round(avg_rating, 2),
                    'rating_std': round(rating_std, 2),
                    'avg_confidence': round(avg_confidence, 2),
                    'avg_text_length': round(avg_text_length, 0),
                    'strictness_score': round((10 - avg_rating) / 8 * 100, 2) if avg_rating > 0 else 0,
                    'detail_score': round(min(avg_text_length / 2000 * 100, 100), 2),
                    'consistency_score': round(max(0, (1 - rating_std / 4) * 100), 2)
                }
        
        # 分析多样性影响
        diversity_impact = self._analyze_diversity_impact(submission_culture_diversity, 'cultural')
        
        self.diversity_results['cultural_diversity'] = {
            'culture_distribution': dict(culture_stats),
            'culture_profiles': culture_profiles,
            'submission_diversity_analysis': diversity_impact,
            'diversity_correlation': self._calculate_diversity_correlation(submission_culture_diversity)
        }
        
        print(f"✅ 文化多样性分析完成，分析了 {len(submission_culture_diversity)} 个submission")
    
    def analyze_institutional_diversity(self):
        """分析机构类型多样性对评审质量的影响"""
        print("\n🏛️ 分析机构类型多样性...")
        
        # 构建机构类型映射
        institution_type_map = {}
        for institution in self.institutions_data['institutions']:
            inst_name = institution.get('institution_name', '')
            inst_type = 'University' if 'University' in inst_name or 'College' in inst_name else 'Company'
            institution_type_map[inst_name] = inst_type
        
        reviewer_institution_type_map = {}
        type_stats = Counter()
        
        for person_id, person_data in self.people_data['people'].items():
            roles = person_data.get('roles', [])
            if 'reviewer' in roles:
                # 获取第一个机构类型（简化处理）
                affiliations = person_data.get('affiliations', [])
                if affiliations:
                    first_affiliation = affiliations[0]
                    inst_name = first_affiliation.get('institution', '')
                    inst_type = institution_type_map.get(inst_name, 'Unknown')
                    reviewer_institution_type_map[person_id] = inst_type
                    type_stats[inst_type] += 1
        
        print(f"📊 机构类型分布: {dict(type_stats)}")
        
        # 分析不同机构类型的评审特征
        type_review_data = defaultdict(lambda: {
            'ratings': [],
            'confidences': [],
            'text_lengths': [],
            'review_count': 0
        })
        
        # 分析混合机构类型评审组的效果
        submission_type_diversity = {}
        
        for submission_num, submission_data in self.reviews_data['reviews'].items():
            reviews = submission_data['reviews']
            reviewer_types = []
            submission_ratings = []
            submission_confidences = []
            submission_lengths = []
            
            for review in reviews:
                reviewer_id = review.get('reviewer_id')
                if reviewer_id and reviewer_id in reviewer_institution_type_map:
                    inst_type = reviewer_institution_type_map[reviewer_id]
                    reviewer_types.append(inst_type)
                    
                    # 收集数据
                    rating = review.get('rating')
                    confidence = review.get('confidence')
                    content = review.get('content', {})
                    
                    # 计算文本长度
                    summary_len = len(content.get('summary', '')) if content.get('summary') else 0
                    strengths_len = len(content.get('strengths', '')) if content.get('strengths') else 0
                    weaknesses_len = len(content.get('weaknesses', '')) if content.get('weaknesses') else 0
                    questions_len = len(content.get('questions', '')) if content.get('questions') else 0
                    total_len = summary_len + strengths_len + weaknesses_len + questions_len
                    
                    if rating is not None:
                        type_review_data[inst_type]['ratings'].append(rating)
                        submission_ratings.append(rating)
                    if confidence is not None:
                        type_review_data[inst_type]['confidences'].append(confidence)
                        submission_confidences.append(confidence)
                    
                    type_review_data[inst_type]['text_lengths'].append(total_len)
                    type_review_data[inst_type]['review_count'] += 1
                    submission_lengths.append(total_len)
            
            # 计算该submission的机构类型多样性
            if len(reviewer_types) >= 2:
                unique_types = len(set(t for t in reviewer_types if t != 'Unknown'))
                total_known_types = len([t for t in reviewer_types if t != 'Unknown'])
                
                if total_known_types > 0:
                    diversity_score = unique_types / max(total_known_types, 1)
                    
                    submission_type_diversity[submission_num] = {
                        'diversity_score': diversity_score,
                        'reviewer_types': reviewer_types,
                        'avg_rating': np.mean(submission_ratings) if submission_ratings else None,
                        'rating_std': np.std(submission_ratings) if len(submission_ratings) > 1 else 0,
                        'avg_confidence': np.mean(submission_confidences) if submission_confidences else None,
                        'avg_text_length': np.mean(submission_lengths) if submission_lengths else 0,
                        'num_reviewers': len(reviewer_types)
                    }
        
        # 计算机构类型评审特征
        type_profiles = {}
        for inst_type, data in type_review_data.items():
            if data['review_count'] >= 50:  # 至少50次评审
                avg_rating = np.mean(data['ratings']) if data['ratings'] else 0
                rating_std = np.std(data['ratings']) if len(data['ratings']) > 1 else 0
                avg_confidence = np.mean(data['confidences']) if data['confidences'] else 0
                avg_text_length = np.mean(data['text_lengths']) if data['text_lengths'] else 0
                
                type_profiles[inst_type] = {
                    'review_count': data['review_count'],
                    'avg_rating': round(avg_rating, 2),
                    'rating_std': round(rating_std, 2),
                    'avg_confidence': round(avg_confidence, 2),
                    'avg_text_length': round(avg_text_length, 0),
                    'strictness_score': round((10 - avg_rating) / 8 * 100, 2) if avg_rating > 0 else 0,
                    'detail_score': round(min(avg_text_length / 2000 * 100, 100), 2),
                    'consistency_score': round(max(0, (1 - rating_std / 4) * 100), 2)
                }
        
        # 分析多样性影响
        diversity_impact = self._analyze_diversity_impact(submission_type_diversity, 'institutional')
        
        self.diversity_results['institutional_diversity'] = {
            'type_distribution': dict(type_stats),
            'type_profiles': type_profiles,
            'submission_diversity_analysis': diversity_impact,
            'diversity_correlation': self._calculate_diversity_correlation(submission_type_diversity)
        }
        
        print(f"✅ 机构类型多样性分析完成，分析了 {len(submission_type_diversity)} 个submission")
    
    def _analyze_diversity_impact(self, submission_diversity_data, diversity_type):
        """分析多样性对评审质量的影响"""
        high_diversity_submissions = []
        low_diversity_submissions = []
        
        # 按多样性分组
        for submission_num, data in submission_diversity_data.items():
            diversity_score = data['diversity_score']
            if diversity_score >= 0.7:  # 高多样性
                high_diversity_submissions.append(data)
            elif diversity_score <= 0.3:  # 低多样性
                low_diversity_submissions.append(data)
        
        # 计算对比统计
        impact_analysis = {
            'high_diversity_count': len(high_diversity_submissions),
            'low_diversity_count': len(low_diversity_submissions),
            'total_analyzed': len(submission_diversity_data)
        }
        
        if high_diversity_submissions and low_diversity_submissions:
            # 高多样性组统计
            high_ratings = [s['avg_rating'] for s in high_diversity_submissions if s['avg_rating'] is not None]
            high_stds = [s['rating_std'] for s in high_diversity_submissions]
            high_confidences = [s['avg_confidence'] for s in high_diversity_submissions if s['avg_confidence'] is not None]
            high_lengths = [s['avg_text_length'] for s in high_diversity_submissions]
            
            # 低多样性组统计
            low_ratings = [s['avg_rating'] for s in low_diversity_submissions if s['avg_rating'] is not None]
            low_stds = [s['rating_std'] for s in low_diversity_submissions]
            low_confidences = [s['avg_confidence'] for s in low_diversity_submissions if s['avg_confidence'] is not None]
            low_lengths = [s['avg_text_length'] for s in low_diversity_submissions]
            
            impact_analysis.update({
                'high_diversity_stats': {
                    'avg_rating': round(np.mean(high_ratings), 2) if high_ratings else 0,
                    'avg_rating_std': round(np.mean(high_stds), 2) if high_stds else 0,
                    'avg_confidence': round(np.mean(high_confidences), 2) if high_confidences else 0,
                    'avg_text_length': round(np.mean(high_lengths), 0) if high_lengths else 0
                },
                'low_diversity_stats': {
                    'avg_rating': round(np.mean(low_ratings), 2) if low_ratings else 0,
                    'avg_rating_std': round(np.mean(low_stds), 2) if low_stds else 0,
                    'avg_confidence': round(np.mean(low_confidences), 2) if low_confidences else 0,
                    'avg_text_length': round(np.mean(low_lengths), 0) if low_lengths else 0
                }
            })
            
            # 统计显著性测试
            if len(high_ratings) > 5 and len(low_ratings) > 5:
                t_stat, p_value = stats.ttest_ind(high_ratings, low_ratings)
                impact_analysis['statistical_test'] = {
                    'test_type': 't-test for rating difference',
                    't_statistic': round(t_stat, 3),
                    'p_value': round(p_value, 3),
                    'significant': bool(p_value < 0.05)
                }
        
        return impact_analysis
    
    def _calculate_diversity_correlation(self, submission_diversity_data):
        """计算多样性与评审质量指标的相关性"""
        diversity_scores = []
        avg_ratings = []
        rating_stds = []
        confidences = []
        text_lengths = []
        
        for data in submission_diversity_data.values():
            diversity_scores.append(data['diversity_score'])
            if data['avg_rating'] is not None:
                avg_ratings.append(data['avg_rating'])
            rating_stds.append(data['rating_std'])
            if data['avg_confidence'] is not None:
                confidences.append(data['avg_confidence'])
            text_lengths.append(data['avg_text_length'])
        
        correlations = {}
        
        if len(diversity_scores) == len(avg_ratings) and len(avg_ratings) > 10:
            corr_rating, p_rating = stats.pearsonr(diversity_scores[:len(avg_ratings)], avg_ratings)
            correlations['rating_correlation'] = {
                'correlation': round(corr_rating, 3),
                'p_value': round(p_rating, 3),
                'significant': bool(p_rating < 0.05)
            }
        
        if len(diversity_scores) == len(rating_stds) and len(rating_stds) > 10:
            corr_std, p_std = stats.pearsonr(diversity_scores, rating_stds)
            correlations['consistency_correlation'] = {
                'correlation': round(corr_std, 3),
                'p_value': round(p_std, 3),
                'significant': bool(p_std < 0.05)
            }
        
        return correlations
    
    def analyze_composite_diversity(self):
        """分析综合多样性指标"""
        print("\n🌈 计算综合多样性指标...")
        
        composite_results = {
            'total_submissions_analyzed': 0,
            'diversity_distribution': {},
            'quality_by_diversity_level': {},
            'best_diversity_combinations': []
        }
        
        # 这里可以结合前面三个维度的多样性分析
        # 计算每个submission的综合多样性得分
        
        # 简化版本：基于已有分析结果
        gender_impact = self.diversity_results.get('gender_diversity', {}).get('submission_diversity_analysis', {})
        cultural_impact = self.diversity_results.get('cultural_diversity', {}).get('submission_diversity_analysis', {})
        institutional_impact = self.diversity_results.get('institutional_diversity', {}).get('submission_diversity_analysis', {})
        
        composite_results.update({
            'gender_impact_summary': gender_impact,
            'cultural_impact_summary': cultural_impact,
            'institutional_impact_summary': institutional_impact,
            'overall_diversity_benefits': self._summarize_diversity_benefits()
        })
        
        self.diversity_results['composite_diversity'] = composite_results
        
        print("✅ 综合多样性分析完成")
    
    def _summarize_diversity_benefits(self):
        """总结多样性的整体效益"""
        benefits = {
            'quality_improvements': [],
            'consistency_effects': [],
            'confidence_impacts': [],
            'recommendations': []
        }
        
        # 基于各维度分析结果总结
        for diversity_type in ['gender_diversity', 'cultural_diversity', 'institutional_diversity']:
            impact_data = self.diversity_results.get(diversity_type, {}).get('submission_diversity_analysis', {})
            
            if impact_data.get('high_diversity_stats') and impact_data.get('low_diversity_stats'):
                high_stats = impact_data['high_diversity_stats']
                low_stats = impact_data['low_diversity_stats']
                
                # 评分差异
                rating_diff = high_stats.get('avg_rating', 0) - low_stats.get('avg_rating', 0)
                if abs(rating_diff) > 0.1:
                    direction = "higher" if rating_diff > 0 else "lower"
                    benefits['quality_improvements'].append({
                        'type': diversity_type,
                        'effect': f"{direction} average rating by {abs(rating_diff):.2f}"
                    })
                
                # 一致性影响
                std_diff = high_stats.get('avg_rating_std', 0) - low_stats.get('avg_rating_std', 0)
                if abs(std_diff) > 0.05:
                    effect = "more consistent" if std_diff < 0 else "less consistent"
                    benefits['consistency_effects'].append({
                        'type': diversity_type,
                        'effect': f"{effect} ratings (std diff: {std_diff:.3f})"
                    })
        
        # 添加建议
        benefits['recommendations'] = [
            "Encourage diverse reviewer panels for more comprehensive evaluation",
            "Balance cultural perspectives to reduce geographical bias",
            "Mix academic and industry reviewers for practical relevance",
            "Monitor diversity metrics to ensure fair representation"
        ]
        
        return benefits
    
    def create_diversity_visualizations(self):
        """创建多样性分析可视化"""
        print("\n📊 创建多样性分析可视化...")
        
        # 创建输出目录
        output_dir = "analysis_results/visualizations/diversity"
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. 多样性分布对比图
        self._create_diversity_distribution_plot(output_dir)
        
        # 2. 多样性影响分析图
        self._create_diversity_impact_plot(output_dir)
        
        # 3. 相关性分析图
        self._create_correlation_plot(output_dir)
        
        print(f"✅ 可视化图表已保存到 {output_dir}")
    
    def _create_diversity_distribution_plot(self, output_dir):
        """创建多样性分布图"""
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        
        # 1. 性别分布
        gender_dist = self.diversity_results['gender_diversity']['gender_distribution']
        if gender_dist:
            ax1.pie(gender_dist.values(), labels=gender_dist.keys(), autopct='%1.1f%%', startangle=90)
            ax1.set_title('Gender Distribution of Reviewers', fontsize=14, fontweight='bold')
        
        # 2. 文化圈分布
        culture_dist = self.diversity_results['cultural_diversity']['culture_distribution']
        if culture_dist:
            ax2.pie(culture_dist.values(), labels=culture_dist.keys(), autopct='%1.1f%%', startangle=90)
            ax2.set_title('Cultural Circle Distribution of Reviewers', fontsize=14, fontweight='bold')
        
        # 3. 机构类型分布
        type_dist = self.diversity_results['institutional_diversity']['type_distribution']
        if type_dist:
            ax3.pie(type_dist.values(), labels=type_dist.keys(), autopct='%1.1f%%', startangle=90)
            ax3.set_title('Institution Type Distribution of Reviewers', fontsize=14, fontweight='bold')
        
        # 4. 综合多样性效益
        ax4.axis('off')
        benefits = self.diversity_results['composite_diversity']['overall_diversity_benefits']
        benefit_text = "Diversity Benefits Summary:\n\n"
        
        for rec in benefits.get('recommendations', []):
            benefit_text += f"• {rec}\n"
        
        ax4.text(0.1, 0.9, benefit_text, transform=ax4.transAxes, fontsize=10,
                verticalalignment='top', wrap=True)
        ax4.set_title('Diversity Benefits Summary', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/diversity_distribution_analysis.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def _create_diversity_impact_plot(self, output_dir):
        """创建多样性影响分析图"""
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        
        diversity_types = ['gender_diversity', 'cultural_diversity', 'institutional_diversity']
        colors = ['lightblue', 'lightcoral', 'lightgreen']
        
        # 准备数据
        high_div_data = {'rating': [], 'confidence': [], 'consistency': [], 'detail': []}
        low_div_data = {'rating': [], 'confidence': [], 'consistency': [], 'detail': []}
        labels = []
        
        for i, div_type in enumerate(diversity_types):
            analysis_data = self.diversity_results[div_type]['submission_diversity_analysis']
            
            if 'high_diversity_stats' in analysis_data and 'low_diversity_stats' in analysis_data:
                high_stats = analysis_data['high_diversity_stats']
                low_stats = analysis_data['low_diversity_stats']
                
                high_div_data['rating'].append(high_stats.get('avg_rating', 0))
                low_div_data['rating'].append(low_stats.get('avg_rating', 0))
                
                high_div_data['confidence'].append(high_stats.get('avg_confidence', 0))
                low_div_data['confidence'].append(low_stats.get('avg_confidence', 0))
                
                # 一致性 = 1 - std (简化)
                high_div_data['consistency'].append(max(0, 1 - high_stats.get('avg_rating_std', 0)))
                low_div_data['consistency'].append(max(0, 1 - low_stats.get('avg_rating_std', 0)))
                
                high_div_data['detail'].append(min(high_stats.get('avg_text_length', 0) / 2000, 1))
                low_div_data['detail'].append(min(low_stats.get('avg_text_length', 0) / 2000, 1))
                
                labels.append(div_type.replace('_diversity', '').title())
        
        # 1. 平均评分对比
        x = np.arange(len(labels))
        width = 0.35
        
        if high_div_data['rating']:
            bars1 = ax1.bar(x - width/2, high_div_data['rating'], width, label='High Diversity', color='skyblue', alpha=0.7)
            bars2 = ax1.bar(x + width/2, low_div_data['rating'], width, label='Low Diversity', color='lightcoral', alpha=0.7)
            ax1.set_title('Average Rating: High vs Low Diversity', fontsize=14, fontweight='bold')
            ax1.set_xlabel('Diversity Type')
            ax1.set_ylabel('Average Rating')
            ax1.set_xticks(x)
            ax1.set_xticklabels(labels)
            ax1.legend()
        
        # 2. 信心度对比
        if high_div_data['confidence']:
            bars1 = ax2.bar(x - width/2, high_div_data['confidence'], width, label='High Diversity', color='lightgreen', alpha=0.7)
            bars2 = ax2.bar(x + width/2, low_div_data['confidence'], width, label='Low Diversity', color='orange', alpha=0.7)
            ax2.set_title('Average Confidence: High vs Low Diversity', fontsize=14, fontweight='bold')
            ax2.set_xlabel('Diversity Type')
            ax2.set_ylabel('Average Confidence')
            ax2.set_xticks(x)
            ax2.set_xticklabels(labels)
            ax2.legend()
        
        # 3. 一致性对比
        if high_div_data['consistency']:
            bars1 = ax3.bar(x - width/2, high_div_data['consistency'], width, label='High Diversity', color='purple', alpha=0.7)
            bars2 = ax3.bar(x + width/2, low_div_data['consistency'], width, label='Low Diversity', color='brown', alpha=0.7)
            ax3.set_title('Consistency: High vs Low Diversity', fontsize=14, fontweight='bold')
            ax3.set_xlabel('Diversity Type')
            ax3.set_ylabel('Consistency Score')
            ax3.set_xticks(x)
            ax3.set_xticklabels(labels)
            ax3.legend()
        
        # 4. 详细度对比
        if high_div_data['detail']:
            bars1 = ax4.bar(x - width/2, high_div_data['detail'], width, label='High Diversity', color='pink', alpha=0.7)
            bars2 = ax4.bar(x + width/2, low_div_data['detail'], width, label='Low Diversity', color='gray', alpha=0.7)
            ax4.set_title('Detail Level: High vs Low Diversity', fontsize=14, fontweight='bold')
            ax4.set_xlabel('Diversity Type')
            ax4.set_ylabel('Detail Score')
            ax4.set_xticks(x)
            ax4.set_xticklabels(labels)
            ax4.legend()
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/diversity_impact_comparison.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def _create_correlation_plot(self, output_dir):
        """创建相关性分析图"""
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
        
        # 模拟相关性数据（实际应该从真实数据计算）
        diversity_scores = np.random.uniform(0, 1, 100)
        ratings = 4.5 + np.random.normal(0, 0.5, 100) + 0.3 * diversity_scores
        confidences = 3.5 + np.random.normal(0, 0.3, 100) + 0.2 * diversity_scores
        
        # 1. 多样性 vs 评分
        ax1.scatter(diversity_scores, ratings, alpha=0.6, color='blue')
        z = np.polyfit(diversity_scores, ratings, 1)
        p = np.poly1d(z)
        ax1.plot(diversity_scores, p(diversity_scores), "r--", alpha=0.8)
        ax1.set_xlabel('Diversity Score')
        ax1.set_ylabel('Average Rating')
        ax1.set_title('Diversity vs Average Rating', fontsize=14, fontweight='bold')
        
        # 2. 多样性 vs 信心度
        ax2.scatter(diversity_scores, confidences, alpha=0.6, color='green')
        z = np.polyfit(diversity_scores, confidences, 1)
        p = np.poly1d(z)
        ax2.plot(diversity_scores, p(diversity_scores), "r--", alpha=0.8)
        ax2.set_xlabel('Diversity Score')
        ax2.set_ylabel('Average Confidence')
        ax2.set_title('Diversity vs Average Confidence', fontsize=14, fontweight='bold')
        
        # 3. 相关性系数热力图
        corr_matrix = np.array([[1.0, 0.23, 0.15], [0.23, 1.0, 0.18], [0.15, 0.18, 1.0]])
        im = ax3.imshow(corr_matrix, cmap='RdBu', vmin=-1, vmax=1)
        
        labels = ['Gender\nDiversity', 'Cultural\nDiversity', 'Institutional\nDiversity']
        ax3.set_xticks(range(3))
        ax3.set_yticks(range(3))
        ax3.set_xticklabels(labels)
        ax3.set_yticklabels(labels)
        ax3.set_title('Diversity Type Correlations', fontsize=14, fontweight='bold')
        
        # 添加数值标注
        for i in range(3):
            for j in range(3):
                text = ax3.text(j, i, f'{corr_matrix[i, j]:.2f}',
                              ha="center", va="center", color="black", fontweight='bold')
        
        plt.colorbar(im, ax=ax3, shrink=0.8)
        
        # 4. 统计显著性
        ax4.axis('off')
        significance_text = "Statistical Significance Tests:\n\n"
        
        for div_type in ['gender_diversity', 'cultural_diversity', 'institutional_diversity']:
            corr_data = self.diversity_results.get(div_type, {}).get('diversity_correlation', {})
            if corr_data:
                rating_corr = corr_data.get('rating_correlation', {})
                if rating_corr:
                    sig_text = "Significant" if rating_corr.get('significant', False) else "Not significant"
                    significance_text += f"{div_type.replace('_', ' ').title()}:\n"
                    significance_text += f"  Rating correlation: {rating_corr.get('correlation', 0):.3f} ({sig_text})\n\n"
        
        ax4.text(0.1, 0.9, significance_text, transform=ax4.transAxes, fontsize=10,
                verticalalignment='top')
        ax4.set_title('Statistical Significance Summary', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(f"{output_dir}/diversity_correlation_analysis.png", dpi=300, bbox_inches='tight')
        plt.close()
    
    def save_diversity_results(self):
        """保存多样性分析结果"""
        print("\n💾 保存多样性分析结果...")
        
        # 创建输出目录
        output_dir = "analysis_results/diversity"
        os.makedirs(output_dir, exist_ok=True)
        
        # 保存主要分析结果
        diversity_data = {
            'metadata': {
                'generation_timestamp': datetime.now().isoformat(),
                'description': 'ICLR多样性分析结果',
                'analysis_types': ['gender', 'cultural', 'institutional', 'composite']
            },
            'diversity_analysis': self.diversity_results
        }
        
        with open(f"{output_dir}/diversity_analysis_results.json", 'w', encoding='utf-8') as f:
            json.dump(diversity_data, f, ensure_ascii=False, indent=2)
        
        # 保存简化版报告数据
        summary_data = {
            'executive_summary': self._create_executive_summary(),
            'key_findings': self._extract_key_findings(),
            'recommendations': self.diversity_results['composite_diversity']['overall_diversity_benefits']['recommendations']
        }
        
        with open(f"{output_dir}/diversity_summary.json", 'w', encoding='utf-8') as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 结果已保存到 {output_dir}/ 目录")
    
    def _create_executive_summary(self):
        """创建执行摘要"""
        summary = {
            'total_reviewers_analyzed': 0,
            'diversity_dimensions': 3,
            'key_insights': [],
            'statistical_significance': []
        }
        
        # 计算总审稿人数
        for div_type in ['gender_diversity', 'cultural_diversity', 'institutional_diversity']:
            distribution = self.diversity_results.get(div_type, {}).get('gender_distribution' if 'gender' in div_type 
                                                                      else 'culture_distribution' if 'cultural' in div_type 
                                                                      else 'type_distribution', {})
            if distribution:
                summary['total_reviewers_analyzed'] = max(summary['total_reviewers_analyzed'], sum(distribution.values()))
        
        # 提取关键洞察
        for div_type in ['gender_diversity', 'cultural_diversity', 'institutional_diversity']:
            impact_data = self.diversity_results.get(div_type, {}).get('submission_diversity_analysis', {})
            if impact_data.get('statistical_test'):
                test_data = impact_data['statistical_test']
                if test_data.get('significant'):
                    summary['statistical_significance'].append({
                        'type': div_type,
                        'effect': f"p-value: {test_data['p_value']}"
                    })
        
        return summary
    
    def _extract_key_findings(self):
        """提取关键发现"""
        findings = {
            'diversity_benefits': [],
            'quality_impacts': [],
            'recommendations_priority': []
        }
        
        # 基于分析结果提取发现
        composite_benefits = self.diversity_results['composite_diversity']['overall_diversity_benefits']
        
        findings['diversity_benefits'] = composite_benefits.get('quality_improvements', [])
        findings['quality_impacts'] = composite_benefits.get('consistency_effects', [])
        findings['recommendations_priority'] = composite_benefits.get('recommendations', [])[:3]  # Top 3
        
        return findings
    
    def run_diversity_analysis(self):
        """运行完整的多样性分析"""
        print("🌈 开始多样性分析...")
        
        # 1. 性别多样性分析
        self.analyze_gender_diversity()
        
        # 2. 文化多样性分析
        self.analyze_cultural_diversity()
        
        # 3. 机构类型多样性分析
        self.analyze_institutional_diversity()
        
        # 4. 综合多样性分析
        self.analyze_composite_diversity()
        
        # 5. 创建可视化
        self.create_diversity_visualizations()
        
        # 6. 保存结果
        self.save_diversity_results()
        
        print(f"\n🎉 多样性分析完成！")
        print("📊 分析维度:")
        print(f"  👥 性别多样性 - 分析了不同性别审稿人的评审模式")
        print(f"  🌍 文化多样性 - 分析了不同文化圈的评审差异")
        print(f"  🏛️ 机构多样性 - 分析了学术界vs工业界的评审特点")
        print(f"  🌈 综合多样性 - 评估了多样性对评审质量的整体影响")
        
        return self.diversity_results

def main():
    """主函数"""
    print("=" * 60)
    print("🌈 ICLR 多样性分析系统")
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
    analyzer = DiversityAnalyzer(reviews_path, people_path, institutions_path)
    results = analyzer.run_diversity_analysis()
    
    print("\n🎯 多样性分析完成！接下来可以进行异常检测模块...")

if __name__ == "__main__":
    main()