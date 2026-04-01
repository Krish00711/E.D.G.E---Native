# E.D.G.E — Early Detection & Guidance Engine

A student burnout detection and intervention platform combining a React Native mobile app, Node/Express backend, and a Python ML service.

## Structure

```
EDGE-Native/
├── mobile/        ← React Native (Expo) app
├── server/        ← Express backend (Node.js + MongoDB)
├── ml_service/    ← Flask ML service (scikit-learn + XGBoost + SHAP)
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 5+
- Python 3.9+

### Backend
```bash
cd server
cp .env.example .env   # fill in your values
npm install
npm run dev
```

### ML Service
```bash
cd ml_service
pip install -r requirements.txt
python pipeline.py     # build training data
python train.py        # train model
python app.py          # start Flask on :5001
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

## Environment Variables (server/.env)

| Variable         | Description                        | Default                          |
|------------------|------------------------------------|----------------------------------|
| PORT             | Backend port                       | 5000                             |
| MONGO_URI        | MongoDB connection string          | mongodb://localhost:27017/edge   |
| JWT_SECRET       | JWT signing secret                 | —                                |
| ML_SERVICE_URL   | Flask ML service URL               | http://localhost:5001            |
| NODE_ENV         | Environment (development/production) | development                    |
| RATE_LIMIT_MAX   | Max requests per 15 min window     | 300                              |

## Test Credentials
- Admin: admin@edge.com / Admin123456
- Mentor: prof.johnson@edge.com / Prof123456
- Student: john@student.com / John123456

## ML Service Endpoints

| Endpoint              | Method | Description                        |
|-----------------------|--------|------------------------------------|
| /health               | GET    | Service health + model version     |
| /predict              | POST   | Burnout risk prediction (24 features) |
| /explain              | POST   | SHAP explainability                |
| /anomaly              | POST   | Behavioral shift detection         |
| /forecast             | POST   | 7-day risk projection              |
| /whatif               | POST   | Simulate feature changes           |
| /retrain              | POST   | Trigger async model retraining     |
| /retrain/status       | GET    | Poll retraining progress           |
| /models/performance   | GET    | Model metrics                      |
| /models/feature-importance | GET | Feature importance rankings    |
