import pandas as pd
import numpy as np
import os

RAW = os.path.join(os.path.dirname(__file__), 'data', 'raw')
PROCESSED = os.path.join(os.path.dirname(__file__), 'data', 'processed')
os.makedirs(PROCESSED, exist_ok=True)

FEATURES = [
    'session_duration', 'quiz_scores', 'load_score', 'activity_frequency',
    'sleep_hours', 'stress_score', 'submission_lateness', 'gpa',
    'attendance_rate', 'assignment_completion_rate', 'grade_trend',
    'days_since_last_activity', 'screen_time_hours', 'social_media_hours',
    'physical_activity_hours', 'anxiety_score', 'mood_score',
    'social_interaction_hours', 'academic_pressure_score',
    'extracurricular_load', 'placement_pressure', 'peer_stress',
    'sleep_quality', 'financial_stress'
]

def learn_distributions(ds2_path):
    """Learn realistic feature distributions from DS_NEW2."""
    print("[Pipeline] Learning distributions from DS_NEW2...")
    df = pd.read_csv(ds2_path)
    print(f"  DS2 shape: {df.shape}")

    dist = {}
    dist['gpa_mean']          = df['previous_gpa'].mean()
    dist['gpa_std']           = df['previous_gpa'].std()
    dist['gpa_min']           = df['previous_gpa'].min()
    dist['gpa_max']           = df['previous_gpa'].max()

    dist['attendance_mean']   = df['attendance_percentage'].mean()
    dist['attendance_std']    = df['attendance_percentage'].std()

    dist['social_media_mean'] = df['social_media_hours'].mean()
    dist['social_media_std']  = df['social_media_hours'].std()

    dist['exam_score_mean']   = df['exam_score'].mean()
    dist['exam_score_std']    = df['exam_score'].std()

    dist['extracurr_mean']    = df['extracurricular_participation'].map(
        {'Yes': 2.5, 'No': 0.0}
    ).fillna(1.0).mean()

    dist['time_mgmt_mean']    = df['time_management_score'].mean()
    dist['time_mgmt_std']     = df['time_management_score'].std()

    dist['motivation_mean']   = df['motivation_level'].map(
        {'Low': 2, 'Medium': 5, 'High': 8}
    ).fillna(5).mean()

    # Social activity: map text to hours
    social_map = {'Low': 1.0, 'Moderate': 3.0, 'High': 5.0}
    dist['social_act_mean']   = df['social_activity'].map(social_map).fillna(3.0).mean()
    dist['social_act_std']    = df['social_activity'].map(social_map).fillna(3.0).std()

    print(f"  Learned distributions: {dist}")
    return dist, df

def build_dataset():
    np.random.seed(42)

    # --- Load DS_NEW2 for distributions ---
    dist, df2 = learn_distributions(
        os.path.join(RAW, 'enhanced_student_habits_performance_dataset.csv')
    )

    # --- Load DS_NEW1 (primary, 1M rows, real labels) ---
    print("\n[Pipeline] Loading DS_NEW1 (1M burnout dataset)...")
    df1 = pd.read_csv(os.path.join(RAW, 'student_mental_health_burnout_1M.csv'))
    print(f"  Shape: {df1.shape}")
    print(f"  Risk levels: {df1['risk_level'].value_counts().to_dict()}")

    n = len(df1)
    out = pd.DataFrame()

    # --- REAL features from DS_NEW1 ---
    out['session_duration']        = df1['study_hours_per_day'] * 60
    out['sleep_hours']             = df1['sleep_hours']
    out['stress_score']            = df1['stress_level']
    out['anxiety_score']           = df1['anxiety_score']
    out['academic_pressure_score'] = df1['exam_pressure']
    out['screen_time_hours']       = df1['screen_time']
    out['physical_activity_hours'] = df1['physical_activity']
    out['financial_stress']        = df1['financial_stress']
    out['placement_pressure']      = df1['family_expectation']
    out['mood_score']              = df1['mental_health_index']

    # social_support (1-10) → social_interaction_hours (0-8)
    out['social_interaction_hours'] = df1['social_support'] * 0.8

    # burnout_score as continuous signal for derived features
    burnout_cont = df1['burnout_score']

    # activity_frequency derived from study hours
    out['activity_frequency'] = np.clip(
        df1['study_hours_per_day'] * 5 + np.random.normal(0, 1, n), 1, 20
    )

    # load_score: combo of stress + exam_pressure
    out['load_score'] = np.clip(
        df1['stress_level'] * 0.6 + df1['exam_pressure'] * 0.4, 1, 10
    )

    # peer_stress: from stress + family expectation
    out['peer_stress'] = np.clip(
        df1['stress_level'] * 0.5 + df1['family_expectation'] * 0.5
        + np.random.normal(0, 0.3, n), 1, 10
    )

    # sleep_quality: derived from sleep_hours (realistic)
    out['sleep_quality'] = np.clip(
        1 + (df1['sleep_hours'] - 3) / 7 * 4 + np.random.normal(0, 0.2, n), 1, 5
    )

    # --- Features learned from DS_NEW2 distributions ---
    out['gpa'] = np.clip(
        np.random.normal(dist['gpa_mean'], dist['gpa_std'], n),
        dist['gpa_min'], dist['gpa_max']
    )
    # Correlate GPA with academic_performance from DS1
    gpa_adj = (df1['academic_performance'] - df1['academic_performance'].mean()) / \
               df1['academic_performance'].std() * 0.3
    out['gpa'] = np.clip(out['gpa'] + gpa_adj, 0.0, 4.0)

    out['attendance_rate'] = np.clip(
        np.random.normal(dist['attendance_mean'], dist['attendance_std'], n),
        50, 100
    )
    # Correlate attendance with burnout (higher burnout = lower attendance)
    burnout_norm = (burnout_cont - burnout_cont.min()) / \
                   (burnout_cont.max() - burnout_cont.min())
    out['attendance_rate'] = np.clip(
        out['attendance_rate'] - burnout_norm * 10, 50, 100
    )

    out['quiz_scores'] = np.clip(
        np.random.normal(dist['exam_score_mean'], dist['exam_score_std'], n),
        40, 100
    )
    # Correlate quiz scores with GPA
    out['quiz_scores'] = np.clip(
        out['quiz_scores'] + (out['gpa'] - dist['gpa_mean']) * 5, 30, 100
    )

    out['social_media_hours'] = np.clip(
        np.random.normal(dist['social_media_mean'], dist['social_media_std'], n),
        0, 12
    )

    # assignment_completion_rate: from motivation + time_management distributions
    motivation_sample = np.clip(
        np.random.normal(dist['motivation_mean'], 2, n), 1, 10
    )
    time_mgmt_sample = np.clip(
        np.random.normal(dist['time_mgmt_mean'], dist['time_mgmt_std'], n), 1, 10
    )
    out['assignment_completion_rate'] = np.clip(
        50 + motivation_sample * 3 + time_mgmt_sample * 2
        + np.random.normal(0, 5, n), 30, 100
    )

    # submission_lateness: inverse of time_management
    out['submission_lateness'] = np.clip(
        (10 - time_mgmt_sample) * 1.5 + np.random.exponential(0.5, n), 0, 14
    )

    # grade_trend: GPA vs quiz performance
    out['grade_trend'] = np.clip(
        (out['quiz_scores'] - 70) * 0.2 + (out['gpa'] - 2.5) * 2
        + np.random.normal(0, 1, n), -15, 15
    )

    out['extracurricular_load'] = np.clip(
        np.random.exponential(dist['extracurr_mean'], n), 0, 6
    )

    out['days_since_last_activity'] = np.clip(
        burnout_norm * 10 + np.random.exponential(1, n), 0, 30
    )

    # --- Target label ---
    label_map = {
        'Low': 'low', 'Medium': 'moderate', 'High': 'high',
        'low': 'low', 'moderate': 'moderate', 'high': 'high'
    }
    out['burnout_risk'] = df1['risk_level'].map(label_map)

    # --- Final cleanup ---
    out = out[FEATURES + ['burnout_risk']]
    out = out.dropna(subset=['burnout_risk'])
    out = out[out['burnout_risk'].isin(['low', 'moderate', 'high'])]

    # Fill any remaining NaN with column median
    for col in FEATURES:
        if out[col].isna().sum() > 0:
            out[col] = out[col].fillna(out[col].median())

    print(f"\n[Pipeline] Final dataset shape: {out.shape}")
    print(f"[Pipeline] Label distribution:\n{out['burnout_risk'].value_counts()}")
    print(f"[Pipeline] Features: {FEATURES}")
    print(f"[Pipeline] NaN check: {out[FEATURES].isna().sum().sum()} total NaNs")

    out_path = os.path.join(PROCESSED, 'edge_training_data.csv')
    out.to_csv(out_path, index=False)
    print(f"\n[Pipeline] Saved to {out_path}")
    return out

if __name__ == '__main__':
    build_dataset()