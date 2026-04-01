import numpy as np
import pandas as pd
import joblib
import json
import os
from datetime import datetime

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

PROCESSED = os.path.join(os.path.dirname(__file__), 'data', 'processed')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

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

def load_data():
    path = os.path.join(PROCESSED, 'edge_training_data.csv')
    print(f"[Train] Loading data from {path}...")
    df = pd.read_csv(path)
    print(f"[Train] Shape: {df.shape}")
    print(f"[Train] Label distribution:\n{df['burnout_risk'].value_counts()}")
    return df

def train():
    df = load_data()

    X = df[FEATURES].values
    y = df['burnout_risk'].values

    # Encode labels
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    print(f"\n[Train] Classes: {le.classes_}")

    # Split — stratified to preserve imbalanced distribution
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )
    print(f"[Train] Train: {X_train.shape}, Test: {X_test.shape}")

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # SMOTE to handle class imbalance
    print("\n[Train] Applying SMOTE...")
    sm = SMOTE(random_state=42, k_neighbors=5)
    X_train_bal, y_train_bal = sm.fit_resample(X_train_scaled, y_train)
    print(f"[Train] After SMOTE: {X_train_bal.shape}")
    unique, counts = np.unique(y_train_bal, return_counts=True)
    print(f"[Train] Balanced classes: {dict(zip(le.classes_[unique], counts))}")

    # Define models
    rf = RandomForestClassifier(
        n_estimators=100,  # reduced from 200
        max_depth=12,      # reduced from 15
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )

    xgb = XGBClassifier(
        n_estimators=100,  # reduced from 200
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='mlogloss',
        random_state=42,
        n_jobs=-1
    )

    # Ensemble: soft voting
    ensemble = VotingClassifier(
        estimators=[('rf', rf), ('xgb', xgb)],
        voting='soft',
        n_jobs=-1
    )

    print("\n[Train] Training ensemble (RandomForest + XGBoost)...")
    ensemble.fit(X_train_bal, y_train_bal)
    print("[Train] Training complete.")

    # Evaluate on test set
    y_pred = ensemble.predict(X_test_scaled)
    test_acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')

    print(f"\n[Train] ── Evaluation ──────────────────────────")
    print(f"[Train] Test Accuracy  : {test_acc:.4f}")
    print(f"[Train] Weighted F1    : {f1:.4f}")
    print(f"\n[Train] Classification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    print(f"[Train] Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Cross-validation on RF (faster than full ensemble)
    # Cross-validation on a sample (faster)
    print("\n[Train] Running 3-fold CV on 100k sample...")
    sample_idx = np.random.choice(len(X_train_bal), 100000, replace=False)
    X_sample = X_train_bal[sample_idx]
    y_sample = y_train_bal[sample_idx]

    rf_standalone = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        class_weight='balanced',
        random_state=42,    
        n_jobs=-1
    )
    cv_scores = cross_val_score(
        rf_standalone, X_sample, y_sample,
        cv=3, scoring='accuracy', n_jobs=-1
    )
    print(f"[Train] CV Scores : {cv_scores}")
    print(f"[Train] CV Mean   : {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")

    # Feature importance from RF inside ensemble
    print("\n[Train] Fitting RF for feature importance...")
    rf_standalone.fit(X_train_bal, y_train_bal)
    importance_df = pd.DataFrame({
        'feature': FEATURES,
        'importance': rf_standalone.feature_importances_
    }).sort_values('importance', ascending=False)
    print(f"\n[Train] Top 10 Feature Importances:")
    print(importance_df.head(10).to_string(index=False))

    # Save everything
    joblib.dump(ensemble, os.path.join(MODELS_DIR, 'burnout_model.pkl'))
    joblib.dump(scaler,   os.path.join(MODELS_DIR, 'scaler.pkl'))
    joblib.dump(le,       os.path.join(MODELS_DIR, 'label_encoder.pkl'))

    importance_df.to_csv(
        os.path.join(MODELS_DIR, 'feature_importance.csv'), index=False
    )

    metadata = {
        'version': '3.0_real_data_ensemble',
        'trained_date': datetime.now().isoformat(),
        'model_type': 'VotingClassifier(RandomForest + XGBoost)',
        'n_samples': len(df),
        'n_features': len(FEATURES),
        'feature_names': FEATURES,
        'classes': list(le.classes_),
        'test_accuracy': round(float(test_acc), 4),
        'weighted_f1': round(float(f1), 4),
        'cv_mean': round(float(cv_scores.mean()), 4),
        'cv_std': round(float(cv_scores.std()), 4),
    }

    with open(os.path.join(MODELS_DIR, 'model_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[Train] ✅ Saved: burnout_model.pkl, scaler.pkl, label_encoder.pkl")
    print(f"[Train] ✅ Saved: feature_importance.csv, model_metadata.json")
    print(f"[Train] ✅ Final metadata:")
    print(json.dumps(metadata, indent=2))

    return ensemble, scaler, le, metadata

if __name__ == '__main__':
    train()