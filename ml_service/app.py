from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
import json

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')
MODEL_PATH = os.path.join(MODELS_DIR, 'burnout_model.pkl')
SCALER_PATH = os.path.join(MODELS_DIR, 'scaler.pkl')
LABEL_ENCODER_PATH = os.path.join(MODELS_DIR, 'label_encoder.pkl')
METADATA_PATH = os.path.join(MODELS_DIR, 'model_metadata.json')

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

model = None
scaler = None
le = None
metadata = {}
load_error = None


def _clamp(value, low=0.0, high=1.0):
    return float(max(low, min(high, value)))


def _load_artifacts():
    global model, scaler, le, metadata, load_error

    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        le = joblib.load(LABEL_ENCODER_PATH)

        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            metadata = json.load(f)

        load_error = None
        print('[ML] Loaded model, scaler, label encoder, and metadata.')
    except Exception as exc:
        load_error = str(exc)
        print(f'[ML] Failed to load model artifacts: {exc}')


_load_artifacts()


@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'service': 'edge-ml',
        'status': 'ok' if not load_error else 'error',
        'health': '/health',
        'predict': '/predict'
    }), 200


@app.route('/health', methods=['GET'])
def health():
    if load_error:
        return jsonify({
            'status': 'error',
            'message': load_error
        }), 500

    classes = []
    try:
        classes = [str(c) for c in le.classes_]
    except Exception:
        classes = []

    return jsonify({
        'status': 'ok',
        'model_version': metadata.get('version', 'unknown'),
        'n_features': len(FEATURES),
        'classes': classes
    }), 200


@app.route('/predict', methods=['POST'])
def predict():
    if load_error:
        return jsonify({
            'error': 'Model artifacts not loaded',
            'message': load_error
        }), 500

    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({
                'error': 'Invalid JSON body'
            }), 400

        # Missing features are defaulted to 0 as requested.
        ordered_values = [float(data.get(feature, 0)) for feature in FEATURES]
        features_array = np.array(ordered_values, dtype=float).reshape(1, -1)

        features_scaled = scaler.transform(features_array)
        raw_pred = model.predict(features_scaled)[0]
        probabilities_array = model.predict_proba(features_scaled)[0]

        class_labels = []
        if hasattr(le, 'classes_'):
            class_labels = [str(c) for c in le.classes_]
        elif hasattr(model, 'classes_'):
            class_labels = [str(c) for c in model.classes_]

        if isinstance(raw_pred, (np.integer, int)) and hasattr(le, 'inverse_transform'):
            risk_level = str(le.inverse_transform([int(raw_pred)])[0])
        else:
            risk_level = str(raw_pred)

        probabilities_map = {'low': 0.0, 'moderate': 0.0, 'high': 0.0}
        for i, label in enumerate(class_labels):
            if label in probabilities_map:
                probabilities_map[label] = float(probabilities_array[i])

        if risk_level in class_labels:
            predicted_index = class_labels.index(risk_level)
            risk_score = float(probabilities_array[predicted_index])
        elif risk_level in probabilities_map:
            risk_score = float(probabilities_map[risk_level])
        else:
            risk_score = float(np.max(probabilities_array))

        confidence = float(np.max(probabilities_array))

        sleep_hours = float(data.get('sleep_hours', 0))
        stress_score = float(data.get('stress_score', 0))
        load_score = float(data.get('load_score', 0))
        activity_frequency = float(data.get('activity_frequency', 0))
        days_since_last_activity = float(data.get('days_since_last_activity', 0))
        attendance_rate = float(data.get('attendance_rate', 0))
        gpa = float(data.get('gpa', 0))
        quiz_scores = float(data.get('quiz_scores', 0))
        assignment_completion_rate = float(data.get('assignment_completion_rate', 0))

        dimension_scores = {
            'exhaustion': _clamp(
                (stress_score / 10.0) * 0.4 +
                (load_score / 10.0) * 0.3 +
                (1 - (sleep_hours / 10.0)) * 0.3
            ),
            'cynicism': _clamp(
                (1 - (activity_frequency / 20.0)) * 0.4 +
                (days_since_last_activity / 30.0) * 0.3 +
                (1 - (attendance_rate / 100.0)) * 0.3
            ),
            'efficacy': _clamp(
                (1 - (gpa / 4.0)) * 0.4 +
                (1 - (quiz_scores / 100.0)) * 0.3 +
                (1 - (assignment_completion_rate / 100.0)) * 0.3
            )
        }

        return jsonify({
            'risk_level': risk_level,
            'risk_score': risk_score,
            'confidence': confidence,
            'probabilities': {
                'low': float(probabilities_map['low']),
                'moderate': float(probabilities_map['moderate']),
                'high': float(probabilities_map['high'])
            },
            'dimension_scores': dimension_scores,
            'model_version': metadata.get('version', 'unknown'),
            'features_received': len(FEATURES)
        }), 200
    except ValueError as exc:
        return jsonify({
            'error': 'Invalid feature values',
            'message': str(exc)
        }), 400
    except Exception as exc:
        return jsonify({
            'error': 'Prediction failed',
            'message': str(exc)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
