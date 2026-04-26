# Fake News Detection System - Enhanced Version

## 🚀 Overview

This enhanced fake news detection system now includes comprehensive data tracking and storage capabilities. The system tracks user interactions, IP addresses, processing times, and provides detailed analytics.

## ✨ New Features

### 📊 Enhanced Database Models

1. **Rating Model**
   - User name and email
   - Rating (1-5 stars)
   - Comments
   - IP address tracking
   - User agent logging
   - Timestamps

2. **NewsAnalysis Model**
   - News text content
   - Prediction (FAKE/REAL)
   - Confidence score
   - Probability
   - Explanation and features
   - IP address tracking
   - User agent logging
   - Session tracking
   - Processing time measurement
   - Model version tracking

3. **UserFeedback Model**
   - Links to news analysis
   - Feedback type (Correct/Incorrect/Unsure)
   - User comments
   - IP address tracking
   - Timestamps

4. **SystemMetrics Model**
   - Total predictions
   - Correct predictions
   - Average confidence
   - Average processing time
   - Model accuracy
   - Daily statistics

### 🔍 Enhanced Tracking

- **IP Address Tracking**: Every analysis and feedback is logged with the user's IP address
- **User Agent Logging**: Browser and device information is captured
- **Processing Time**: Measures how long each analysis takes
- **Session Tracking**: Links analyses to user sessions
- **Model Versioning**: Tracks which model version was used for each prediction

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Create Superuser (Optional)
```bash
python manage.py createsuperuser
```

### 4. Start the Server
```bash
python manage.py runserver
```

## 🌐 Access Points

- **Home Page**: http://127.0.0.1:8000/
- **News Analysis**: http://127.0.0.1:8000/predict/
- **Dashboard**: http://127.0.0.1:8000/dashboard/
- **Admin Panel**: http://127.0.0.1:8000/admin/

## 📈 Dashboard Features

The dashboard provides:
- Total number of analyses
- Fake vs Real news counts
- User feedback accuracy
- Recent analyses with IP addresses
- Processing time statistics
- Quick access to all features

## 🔧 API Endpoints

### Predict News
```
POST /api/predict/
Content-Type: application/json

{
    "text": "Your news text here"
}
```

### Add Feedback
```
POST /api/feedback/
Content-Type: application/json

{
    "analysis_id": 123,
    "feedback_type": "CORRECT",
    "comment": "Optional comment"
}
```

## 📊 Database Schema

### Rating Table
- id (Primary Key)
- name (CharField)
- email (EmailField)
- comment (TextField)
- rating (IntegerField, 1-5)
- ip_address (GenericIPAddressField)
- user_agent (TextField)
- created_at (DateTimeField)
- updated_at (DateTimeField)

### NewsAnalysis Table
- id (Primary Key)
- text (TextField)
- prediction (CharField, FAKE/REAL)
- confidence (FloatField)
- probability (FloatField)
- explanation (JSONField)
- features (JSONField)
- ip_address (GenericIPAddressField)
- user_agent (TextField)
- session_id (CharField)
- processing_time (FloatField)
- model_version (CharField)
- created_at (DateTimeField)
- updated_at (DateTimeField)

### UserFeedback Table
- id (Primary Key)
- news_analysis (ForeignKey to NewsAnalysis)
- feedback_type (CharField, CORRECT/INCORRECT/UNSURE)
- user_comment (TextField)
- ip_address (GenericIPAddressField)
- user_agent (TextField)
- created_at (DateTimeField)

### SystemMetrics Table
- id (Primary Key)
- total_predictions (IntegerField)
- correct_predictions (IntegerField)
- average_confidence (FloatField)
- average_processing_time (FloatField)
- model_accuracy (FloatField)
- date (DateField)
- created_at (DateTimeField)

## 🔒 Privacy & Security

- IP addresses are stored for analytics but can be anonymized
- User agent strings help identify bot traffic
- All data is stored locally in SQLite database
- Admin panel requires authentication

## 🚀 Future Enhancements

1. **MySQL Integration**: Switch to MySQL for better performance
2. **Real-time Analytics**: Live dashboard updates
3. **Export Features**: CSV/JSON data export
4. **Advanced Filtering**: Filter by date, IP, prediction type
5. **Machine Learning**: Retrain models based on user feedback
6. **API Rate Limiting**: Prevent abuse
7. **Data Visualization**: Charts and graphs

## 📝 Usage Examples

### Analyze News
1. Go to http://127.0.0.1:8000/predict/
2. Enter news text
3. Click "Analyze"
4. View results with confidence score
5. Optionally provide feedback

### View Analytics
1. Go to http://127.0.0.1:8000/dashboard/
2. See overall statistics
3. View recent analyses
4. Check user feedback accuracy

### Admin Access
1. Go to http://127.0.0.1:8000/admin/
2. Login with superuser credentials
3. Manage all data models
4. Export data for analysis

## 🎯 Key Benefits

- **Comprehensive Tracking**: Every interaction is logged
- **Performance Monitoring**: Processing times are measured
- **User Feedback**: Continuous improvement through feedback
- **Analytics Dashboard**: Real-time insights into system usage
- **Admin Interface**: Easy data management
- **API Access**: Programmatic access to all features

This enhanced system provides a complete solution for fake news detection with comprehensive data tracking and analytics capabilities.
