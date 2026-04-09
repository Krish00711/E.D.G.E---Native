<div align="center">

```
███████╗   ██████╗      ██████╗     ███████╗
██╔════╝   ██╔══██╗    ██╔════╝     ██╔════╝
█████╗     ██║  ██║    ██║  ███╗    █████╗  
██╔══╝     ██║  ██║    ██║   ██║    ██╔══╝  
███████╗   ██████╔╝    ╚██████╔╝    ███████╗
╚══════╝   ╚═════╝      ╚═════╝     ╚══════╝
```

### **Early Detection & Guidance Engine**
*A student burnout intelligence platform powered by real machine learning*

<br/>

[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://e-d-g-e-backend.onrender.com)
[![ML Service](https://img.shields.io/badge/ML%20Service-Python%20Flask-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://e-d-g-e-ml.onrender.com)
[![Mobile](https://img.shields.io/badge/Mobile-React%20Native%20%2B%20Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Model](https://img.shields.io/badge/Model-89.2%25%20Accuracy-FF6B6B?style=for-the-badge&logo=scikit-learn&logoColor=white)]()

<br/>

> *"A candle that melts too fast was never given a chance to rest."*
> 
> **E.D.G.E detects burnout before it extinguishes the flame.**

<br/>

---

</div>

## 🕯️ What is E.D.G.E?

**E.D.G.E** (Early Detection & Guidance Engine) is a full-stack mobile platform that watches for the subtle signs of academic burnout — and acts before it becomes a crisis.

It combines **24 behavioural and wellness signals**, a **trained ensemble ML model** (RandomForest + XGBoost, 89.2% accuracy, trained on 1,000,000 real samples), and a **real-time mobile app** to predict risk, explain it, and guide students back to balance.

Three roles. One system. Zero guesswork.

| Role | What they see |
|------|--------------|
| **Student** | Their burnout risk score, 3-dimension breakdown, personalized recovery actions, forecast, what-if simulator |
| **Mentor** | All students sorted by risk, intervention tools, direct messaging, alert feed |
| **Admin** | System analytics, model retraining trigger, cohort insights, training data export |

---

## 🧠 The Model — How It Actually Works

This is not a rule engine. This is a real trained ML model.

### Training Data
- **1,000,000 real rows** from Kaggle's Student Mental Health & Burnout Dataset
- **80,000 rows** from the Student Habits & Academic Performance Dataset
- Combined into a unified 24-feature training set with real burnout labels

### Architecture
```
24 scaled features
       │
       ├──────────────────┬─────────────────────┐
       │                  │                     │
  RandomForest       XGBoost               (parallel)
  100 trees          100 boosted rounds
  max_depth=12       learning_rate=0.1
  Gini criterion     mlogloss objective
       │                  │
       └──────────┬───────┘
                  │
         Soft Voting Ensemble
     P_final(k) = [P_rf(k) + P_xgb(k)] / 2
                  │
         ŷ = argmax_k P_final(k)
                  │
       low / moderate / high
```

### The 24 Features
```
WELLNESS (self-reported)          ACADEMIC (from records)
─────────────────────────         ────────────────────────
sleep_hours                       gpa
stress_score                      quiz_scores
load_score                        attendance_rate
anxiety_score                     assignment_completion_rate
mood_score                        submission_lateness
sleep_quality                     session_duration
                                  activity_frequency
LIFESTYLE (onboarding)            days_since_last_activity
────────────────────────          grade_trend
screen_time_hours
social_media_hours                PRESSURE (onboarding)
physical_activity_hours           ────────────────────────
social_interaction_hours          academic_pressure_score
financial_stress                  extracurricular_load
                                  placement_pressure
                                  peer_stress
```

### Maslach Dimension Formulas
The three clinical burnout dimensions are computed analytically alongside the ML prediction:

```
Exhaustion  E  = clamp( 0.4×(stress/10) + 0.3×(load/10) + 0.3×(1−sleep/10) , 0, 1)

Cynicism    C  = clamp( 0.4×(1−activity/20) + 0.3×(days_inactive/30) + 0.3×(1−attendance/100) , 0, 1)

Efficacy    Ef = clamp( 0.4×(1−GPA/4) + 0.3×(1−quiz/100) + 0.3×(1−completion/100) , 0, 1)
```

### Risk Thresholds
```
score < 0.40   →  🟢 LOW       Monitor regularly
0.40 – 0.70    →  🟡 MODERATE  Recommend recovery actions
0.70 – 0.75    →  🔴 HIGH      Alert mentor + push notification
score ≥ 0.75   →  🚨 CRITICAL  Immediate intervention required
```

### Model Performance
```
Test Accuracy       89.20%   (200,000 real unseen samples)
Weighted F1         89.89%
CV Mean (3-fold)    92.23%   ± 0.15%
High Risk Recall    92%      (catches 92% of at-risk students)
Low Precision       98%      (almost no false alarms)
Model size          45 MB    (RF + XGBoost ensemble)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        E.D.G.E Native                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              React Native + Expo (mobile/)               │   │
│  │  24 screens · Zustand state · Socket.io client           │   │
│  │  Expo Push Notifications · AsyncStorage offline sync     │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ HTTPS + JWT                          │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │          Node.js + Express (server/)                     │   │
│  │  35 routes · JWT auth · Socket.io · Rate limiting        │   │
│  │  Helmet · Morgan · Input sanitization · Expo Push SDK    │   │
│  └──────────┬────────────────────────┬────────────────────  │   │
│             │                        │                          │
│  ┌──────────▼───────────┐  ┌────────▼────────────────────┐     │
│  │   MongoDB Atlas      │  │   Flask ML Service          │     │
│  │   29 collections     │  │   (ml_service/)             │     │
│  │   Cloud-hosted       │  │   10 endpoints              │     │
│  │   Real-time sync     │  │   SHAP · Anomaly · Forecast │     │
│  └──────────────────────┘  └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v20+
- Python 3.9+
- MongoDB Atlas account
- Expo Go app (for mobile testing)

### 1. Clone
```bash
git clone https://github.com/Krish00711/EDGE-Native.git
cd EDGE-Native
```

### 2. Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, ML_SERVICE_URL
npm run dev
```

### 3. ML Service Setup
```bash
cd ml_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Train the model (first time only — takes ~10 mins)
python pipeline.py
python train.py

# Start the service
python app.py
```

### 4. Mobile Setup
```bash
cd mobile
npm install
cp .env.example .env
# Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_ML_URL
npx expo start
```

### 5. Seed Test Data
```bash
cd server
npm run seed
```

**Test credentials:**
```
Admin:   admin@edge.com   /  Admin123456
Mentor:  mentor@edge.com  /  Mentor123456
Student: student@edge.com /  Student123456
```

---

## 🌐 Live Deployment

| Service | URL |
|---------|-----|
| Backend API | https://e-d-g-e-backend.onrender.com |
| ML Service | https://e-d-g-e-ml.onrender.com |
| Health Check | https://e-d-g-e-backend.onrender.com/api/health |

---

## 📱 Mobile App — 24 Screens

### Auth Flow
```
Splash → Onboarding → Login / Register
```
After registration, new students complete a **4-step onboarding survey** that collects all 24 features and triggers their first burnout prediction automatically.

### Student Screens (12)
| Screen | What it does |
|--------|-------------|
| **Dashboard** | Risk score, 3 dimension bars, quick actions, recalculate |
| **Check-in** | Submit self-report · log activity · log study session |
| **Academics** | Grades, assignments, attendance — all in one tabbed view |
| **Burnout Deep Dive** | Overview · SHAP explain · 7-day forecast |
| **What-If Simulator** | "If I sleep 2 more hours, my risk drops by X%" |
| **Anomaly Pulse** | Z-score detection of sudden behavioural shifts |
| **Recovery** | AI-personalized actions based on your 24 features |
| **Peer Pulse** | Anonymous cohort comparison |
| **Notifications** | Real-time alerts |
| **Messages** | Direct messaging with mentor |
| **Forums** | Discussion boards |
| **Profile & Settings** | Account, push notification prefs, logout |

### Mentor Screens (4)
| Screen | What it does |
|--------|-------------|
| **Mentor Dashboard** | All students sorted by risk, search, risk filter chips |
| **Student Detail** | Full risk profile, prediction history, intervention history |
| **Interventions** | Create and track interventions |
| **Messages** | Direct messaging |

### Admin Screens (3)
| Screen | What it does |
|--------|-------------|
| **Admin Dashboard** | System stats, risk distribution, ML model metadata |
| **User Management** | All users |
| **Reports** | Cohort analytics |

---

## 🔌 API Reference

### ML Service Endpoints (http://localhost:5001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Model status + version |
| `POST` | `/predict` | Predict burnout from 24 features |
| `POST` | `/explain` | SHAP feature importance explanation |
| `POST` | `/anomaly` | Z-score behavioural shift detection |
| `POST` | `/forecast` | 7-day risk projection |
| `POST` | `/whatif` | Simulate feature changes |
| `POST` | `/retrain` | Trigger async model retraining |
| `GET` | `/retrain/status` | Retraining progress |
| `GET` | `/models/performance` | Accuracy, F1, CV scores |
| `GET` | `/models/feature-importance` | Top feature importances |

### Backend Highlights (http://localhost:5000/api)

```
/auth          →  register, login, me, refresh
/self-reports  →  submit check-in (auto-triggers prediction)
/predictions   →  latest, forecast, whatif, calculate
/recovery      →  personalized recommendations
/admin         →  students, dashboard, retrain, export
/sync          →  delta sync, push token registration
/onboarding    →  submit 24-feature survey, status
```

Full documentation: 35 route files, 187+ endpoints across 32 domain areas.

---

## ⚡ Real-Time Features

When a student submits a check-in, this happens automatically:

```
1. Self-report saved to MongoDB
2. predictionService.triggerPredictionUpdate() called
3. 24 features aggregated from 8+ collections
4. POST /predict → ML service
5. RiskPrediction saved to MongoDB
6. If HIGH → Alert record created
7. Socket.io emits "prediction_updated" to student's room
8. Expo push notification sent (if token registered)
9. Dashboard refreshes in real time
```

---

## 🔒 Security

- JWT authentication on all protected routes (7-day expiry + refresh endpoint)
- Helmet security headers
- Rate limiting: 300 req/15min global · 10 login attempts/15min · 5 registrations/hr
- Input sanitization (blocks MongoDB injection operators)
- Morgan request logging
- Role-based access control: `student` / `mentor` / `admin`
- ML `/retrain` endpoint protected by `ML_SECRET_TOKEN`

---

## 🗄️ Database

**MongoDB Atlas — TrueOne database**

29 collections including:

```
User · Student · Instructor · Course · Enrollment
Grade · Attendance · Assignment · AssignmentSubmission
Session · ActivityLog · SelfReport
RiskPrediction · Alert · Recommendation · Intervention
RecoveryAction · SessionAction · Notification
Communication · DiscussionForum · Resource
CognitiveLoadRecord · SensorData · ConsentRecord
CohortAggregate · AuditLog · SystemMetrics
```

---

## 📦 Project Structure

```
EDGE-Native/
│
├── server/                    ← Node.js + Express backend
│   ├── src/
│   │   ├── routes/            ← 35 route files
│   │   ├── models/            ← 29 Mongoose schemas
│   │   ├── middleware/        ← auth, roles, sanitize, lastActive
│   │   ├── services/          ← predictionService, pushNotifications, socket
│   │   ├── config/            ← db.js
│   │   ├── seed.js            ← test data seeder
│   │   └── index.js           ← app entry + Socket.io
│   ├── .env.example
│   └── package.json
│
├── ml_service/                ← Python Flask ML service
│   ├── app.py                 ← 10 endpoints
│   ├── pipeline.py            ← data pipeline (1M rows)
│   ├── train.py               ← model training
│   ├── start.sh               ← gunicorn production start
│   ├── models/
│   │   ├── burnout_model.pkl  ← 45MB trained ensemble
│   │   ├── scaler.pkl
│   │   ├── label_encoder.pkl
│   │   ├── model_metadata.json
│   │   └── feature_importance.csv
│   ├── data/
│   │   ├── raw/               ← original Kaggle CSVs
│   │   └── processed/         ← edge_training_data.csv (1M rows)
│   └── requirements.txt
│
├── mobile/                    ← React Native + Expo app
│   ├── app/
│   │   ├── (auth)/            ← login, register, onboarding
│   │   └── (app)/
│   │       ├── (student)/     ← 12 student screens
│   │       ├── (mentor)/      ← 4 mentor screens
│   │       └── (admin)/       ← 3 admin screens
│   ├── components/            ← EdgeBackdrop, shared UI
│   ├── store/                 ← authStore, syncStore (Zustand)
│   ├── lib/                   ← api.ts (axios + JWT interceptor)
│   ├── constants/             ← theme.ts (colors, spacing, typography)
│   ├── assets/                ← icon.png, splash.png
│   ├── eas.json
│   └── package.json
│
└── README.md
```

---

## 🏗️ Build & Deploy

### Backend + ML (Render)
Both services are deployed on Render with automatic deploys from GitHub.

```bash
# Backend: Node.js web service
# Build: npm install
# Start: npm start

# ML: Python web service  
# Build: pip install -r requirements.txt
# Start: bash start.sh  (gunicorn -w 2 -b 0.0.0.0:5001 app:app)
```

### Mobile APK (EAS Build)
```bash
cd mobile

# Preview APK (Android)
eas build --profile preview --platform android

# Production build (both platforms)
eas build --profile production --platform all

# Over-the-air update (no rebuild needed)
eas update --branch production
```

---

## 🔧 Environment Variables

### server/.env
```env
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/TrueOne?retryWrites=true&w=majority
JWT_SECRET=your-64-char-hex-secret
ML_SERVICE_URL=http://localhost:5001
ML_SECRET_TOKEN=your-ml-secret-token
NODE_ENV=development
RATE_LIMIT_MAX=300
```

### ml_service/.env
```env
PORT=5001
ML_SECRET_TOKEN=your-ml-secret-token
```

### mobile/.env
```env
EXPO_PUBLIC_API_URL=https://e-d-g-e-backend.onrender.com/api
EXPO_PUBLIC_ML_URL=https://e-d-g-e-ml.onrender.com
```

---

## 📊 ML Training Datasets

| Dataset | Source | Rows | Role |
|---------|--------|------|------|
| Student Mental Health & Burnout | Kaggle: sharmajicoder | 1,000,000 | Primary — real burnout labels |
| Student Habits & Academic Performance | Kaggle: aryan208 | 80,000 | Distribution learning for GPA, attendance, scores |

Training pipeline: `pipeline.py` → `edge_training_data.csv` (1M × 25 columns) → `train.py` → `burnout_model.pkl`

To retrain with new real student data:
```bash
cd ml_service
source venv/bin/activate
python pipeline.py   # rebuild dataset
python train.py      # retrain model
# or trigger via API: POST /api/admin/retrain
```

---

## 🧩 Unique Features

Beyond standard burnout tracking, E.D.G.E includes features not found in any commercial student wellness platform:

**🔮 Burnout Forecast** — Projects your risk score for the next 7 days using exponential smoothing + linear trend extrapolation. Shows "You're 4 days from HIGH risk" if the trajectory is worsening.

**⚗️ What-If Simulator** — "What if I slept 2 more hours?" — runs a live prediction comparison and shows exactly how much your risk score would change for any feature modification.

**🌡️ Anomaly Pulse** — Detects sudden behavioural shifts using z-score analysis against your personal historical baseline. Flags when something changed unusually, even if overall risk is still low.

**🧬 SHAP Explainability** — Uses TreeSHAP to explain exactly which of your 24 features drove today's prediction. "Your stress_score is your #1 risk factor right now."

**💊 AI Personalized Recovery** — Recommendations generated from your specific dimension scores and feature values — not generic advice. Different for a student with high exhaustion vs high cynicism.

**📡 Real-Time Risk Updates** — Socket.io pushes prediction updates instantly to your phone the moment you submit a check-in. No refresh needed.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Krish Sharma**

Built with obsessive attention to detail, real machine learning, and genuine care for student wellbeing.

---

<div align="center">

*The candle that knows it's burning — can choose to rest.*

**E.D.G.E Native** — because burnout should be detected, not discovered.

</div>
