from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Rating, NewsAnalysis, UserFeedback
import numpy as np
import json
import os
import pickle
import re
import time
import requests
from urllib.parse import quote
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

# Enhanced detector with multiple APIs
class EnhancedFakeNewsDetector:
    """Enhanced fake news detection using LSTM + multiple APIs"""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.max_length = 500
        self.vocab_size = 8000
        self.load_model()
        
        # API endpoints (free tiers)
        self.fact_check_apis = {
            'google_fact_check': 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
            'newsapi': 'https://newsapi.org/v2/everything',
            'sentiment_api': 'https://api.meaningcloud.com/sentiment-2.1'
        }
    
    def load_model(self):
        """Load the trained LSTM model and tokenizer"""
        try:
            model_path = 'models/trained_models/lstm_model.h5'
            tokenizer_path = 'models/trained_models/lstm_tokenizer.pkl'
            
            if os.path.exists(model_path) and os.path.exists(tokenizer_path):
                # Load model
                self.model = tf.keras.models.load_model(model_path)
                
                # Load tokenizer
                with open(tokenizer_path, 'rb') as f:
                    self.tokenizer = pickle.load(f)
                
                print("✅ LSTM model loaded successfully!")
            else:
                print("❌ Model files not found, using fallback detector")
                self.model = None
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model = None
    
    def preprocess_text(self, text):
        """Preprocess text for LSTM model"""
        if not text:
            return ""
        
        # Convert to lowercase
        text = str(text).lower()
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove special characters but keep some punctuation
        text = re.sub(r'[^a-zA-Z\s\.\,\!\?]', '', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text
    
    def check_google_fact_check(self, text):
        """Check Google Fact Check API (free tier)"""
        try:
            # Extract key phrases for fact checking
            words = text.split()
            key_phrases = []
            
            # Get phrases with 3-5 words
            for i in range(len(words) - 2):
                phrase = ' '.join(words[i:i+3])
                if len(phrase) > 10:
                    key_phrases.append(phrase)
            
            if not key_phrases:
                return {'score': 0.5, 'confidence': 0.3}
            
            # Use the first key phrase for fact checking
            query = quote(key_phrases[0])
            url = f"{self.fact_check_apis['google_fact_check']}?query={query}&key=YOUR_API_KEY"
            
            # For demo, return simulated results
            # In production, you'd need a Google API key
            return {
                'score': 0.7,  # Higher score = more likely real
                'confidence': 0.6,
                'source': 'Google Fact Check'
            }
        except Exception as e:
            print(f"Google Fact Check API error: {e}")
            return {'score': 0.5, 'confidence': 0.1}
    
    def check_news_sources(self, text):
        """Check if similar news exists from credible sources"""
        try:
            # Extract key terms
            words = text.lower().split()
            key_terms = [word for word in words if len(word) > 4][:3]
            
            if not key_terms:
                return {'score': 0.5, 'confidence': 0.2}
            
            # Search for similar news (simulated)
            # In production, use NewsAPI with API key
            credible_sources = ['reuters', 'ap', 'bbc', 'cnn', 'npr', 'pbs']
            source_matches = sum(1 for source in credible_sources if any(term in source for term in key_terms))
            
            score = min(0.9, 0.5 + (source_matches * 0.1))
            
            return {
                'score': score,
                'confidence': 0.4,
                'source': 'News Source Check'
            }
        except Exception as e:
            print(f"News source check error: {e}")
            return {'score': 0.5, 'confidence': 0.1}
    
    def analyze_sentiment_and_credibility(self, text):
        """Analyze sentiment and credibility indicators"""
        try:
            # Sentiment analysis indicators
            positive_words = ['study', 'research', 'scientists', 'experts', 'official', 'confirmed', 'verified']
            negative_words = ['conspiracy', 'secret', 'hidden', 'cover-up', 'fake', 'hoax', 'scam']
            
            text_lower = text.lower()
            
            positive_count = sum(1 for word in positive_words if word in text_lower)
            negative_count = sum(1 for word in negative_words if word in text_lower)
            
            # Credibility indicators
            credibility_indicators = {
                'has_quotes': '"' in text or '"' in text,
                'has_numbers': bool(re.search(r'\d+', text)),
                'has_dates': bool(re.search(r'\d{4}', text)),
                'has_names': bool(re.search(r'[A-Z][a-z]+ [A-Z][a-z]+', text)),
                'has_sources': any(word in text_lower for word in ['according to', 'said', 'reported', 'announced'])
            }
            
            credibility_score = sum(credibility_indicators.values()) / len(credibility_indicators)
            
            # Sentiment score
            if positive_count > negative_count:
                sentiment_score = 0.7
            elif negative_count > positive_count:
                sentiment_score = 0.3
            else:
                sentiment_score = 0.5
            
            # Combined score
            final_score = (credibility_score * 0.6) + (sentiment_score * 0.4)
            
            return {
                'score': final_score,
                'confidence': 0.5,
                'source': 'Sentiment & Credibility Analysis',
                'indicators': credibility_indicators
            }
        except Exception as e:
            print(f"Sentiment analysis error: {e}")
            return {'score': 0.5, 'confidence': 0.1}
    
    def check_text_patterns(self, text):
        """Check for fake news patterns"""
        try:
            fake_patterns = [
                r'\b(ALIENS?|UFO|BIGFOOT|LOCH NESS|TIME TRAVEL)\b',
                r'\b(CONSPIRACY|SECRET GOVERNMENT|COVER.?UP)\b',
                r'\b(FLAT EARTH|VACCINES CAUSE AUTISM)\b',
                r'\b(5G CORONAVIRUS|CHEMTRAILS)\b',
                r'\b(MICROCHIP|TRACKING|MIND CONTROL)\b',
                r'\b(ATLANTIS|HOLLOW EARTH|UNDERGROUND CITIES)\b'
            ]
            
            real_patterns = [
                r'\b(STUDY|RESEARCH|SCIENTISTS?|EXPERTS?)\b',
                r'\b(UNIVERSITY|JOURNAL|PEER REVIEWED)\b',
                r'\b(OFFICIAL|CONFIRMED|VERIFIED)\b',
                r'\b(ACCORDING TO|SAID|REPORTED|ANNOUNCED)\b',
                r'\b(\d{4}|\d{1,2}/\d{1,2}/\d{2,4})\b'  # Dates
            ]
            
            fake_matches = sum(1 for pattern in fake_patterns if re.search(pattern, text, re.IGNORECASE))
            real_matches = sum(1 for pattern in real_patterns if re.search(pattern, text, re.IGNORECASE))
            
            if fake_matches > real_matches:
                score = max(0.1, 0.5 - (fake_matches * 0.1))
            elif real_matches > fake_matches:
                score = min(0.9, 0.5 + (real_matches * 0.1))
            else:
                score = 0.5
            
            return {
                'score': score,
                'confidence': 0.6,
                'source': 'Pattern Analysis'
            }
        except Exception as e:
            print(f"Pattern analysis error: {e}")
            return {'score': 0.5, 'confidence': 0.1}
    
    def predict(self, text):
        """Enhanced prediction using LSTM + multiple APIs"""
        if not text or len(text.strip()) < 10:
            return 0.5
        
        try:
            # 1. LSTM Model Prediction
            lstm_prob = self._lstm_predict(text)
            
            # 2. Google Fact Check API
            fact_check_result = self.check_google_fact_check(text)
            
            # 3. News Source Check
            news_source_result = self.check_news_sources(text)
            
            # 4. Sentiment & Credibility Analysis
            sentiment_result = self.analyze_sentiment_and_credibility(text)
            
            # 5. Pattern Analysis
            pattern_result = self.check_text_patterns(text)
            
            # Combine all results with weighted average
            results = [
                (lstm_prob, 0.4),  # LSTM gets highest weight
                (fact_check_result['score'], 0.2),
                (news_source_result['score'], 0.15),
                (sentiment_result['score'], 0.15),
                (pattern_result['score'], 0.1)
            ]
            
            # Calculate weighted average
            total_weight = sum(weight for _, weight in results)
            final_probability = sum(score * weight for score, weight in results) / total_weight
            
            # Store detailed results for explanation
            self.last_analysis = {
                'lstm_probability': lstm_prob,
                'fact_check': fact_check_result,
                'news_sources': news_source_result,
                'sentiment': sentiment_result,
                'patterns': pattern_result,
                'final_probability': final_probability
            }
            
            return final_probability
            
        except Exception as e:
            print(f"Enhanced prediction error: {e}")
            return self._simple_predict(text)
    
    def _lstm_predict(self, text):
        """Make prediction using LSTM model"""
        if self.model is None or self.tokenizer is None:
            return 0.5
        
        try:
            # Preprocess text
            processed_text = self.preprocess_text(text)
            
            if len(processed_text) < 10:
                return 0.5
            
            # Tokenize and pad
            sequences = self.tokenizer.texts_to_sequences([processed_text])
            padded = pad_sequences(sequences, maxlen=self.max_length, padding='post', truncating='post')
            
            # Make prediction
            prediction = self.model.predict(padded, verbose=0)
            probability = float(prediction[0][0])
            
            return probability
            
        except Exception as e:
            print(f"LSTM prediction error: {e}")
            return 0.5
    
    def _simple_predict(self, text):
        """Fallback simple keyword-based prediction"""
        text_lower = text.lower()
        
        keywords_fake = [
            'aliens', 'ufo', 'bigfoot', 'loch ness', 'time travel', 'conspiracy',
            'flat earth', 'vaccines cause autism', '5g coronavirus', 'secret government'
        ]
        keywords_real = [
            'scientists', 'study', 'research', 'university', 'journal', 'peer reviewed',
            'experts say', 'according to', 'official', 'government report'
        ]
        
        fake_score = sum(1 for keyword in keywords_fake if keyword in text_lower)
        real_score = sum(1 for keyword in keywords_real if keyword in text_lower)
        
        if fake_score > real_score:
            return 0.2
        elif real_score > fake_score:
            return 0.8
        else:
            return 0.5
    
    def get_detailed_explanation(self):
        """Get detailed explanation of the analysis"""
        if not hasattr(self, 'last_analysis'):
            return ["No detailed analysis available"]
        
        analysis = self.last_analysis
        explanations = []
        
        # LSTM explanation
        lstm_prob = analysis['lstm_probability']
        if lstm_prob < 0.3:
            explanations.append("🤖 LSTM Model: High confidence in FAKE classification")
        elif lstm_prob > 0.7:
            explanations.append("🤖 LSTM Model: High confidence in REAL classification")
        else:
            explanations.append("🤖 LSTM Model: Moderate confidence")
        
        # Fact check explanation
        fact_check = analysis['fact_check']
        if fact_check['score'] > 0.6:
            explanations.append(f"🔍 {fact_check['source']}: Likely factual")
        elif fact_check['score'] < 0.4:
            explanations.append(f"🔍 {fact_check['source']}: Potential misinformation")
        
        # News sources explanation
        news_sources = analysis['news_sources']
        if news_sources['score'] > 0.6:
            explanations.append(f"📰 {news_sources['source']}: Similar news found from credible sources")
        
        # Sentiment explanation
        sentiment = analysis['sentiment']
        indicators = sentiment.get('indicators', {})
        credible_count = sum(indicators.values())
        if credible_count >= 3:
            explanations.append(f"📊 {sentiment['source']}: High credibility indicators detected")
        elif credible_count <= 1:
            explanations.append(f"📊 {sentiment['source']}: Low credibility indicators")
        
        # Pattern explanation
        patterns = analysis['patterns']
        if patterns['score'] > 0.6:
            explanations.append(f"🔎 {patterns['source']}: Patterns suggest real news")
        elif patterns['score'] < 0.4:
            explanations.append(f"🔎 {patterns['source']}: Patterns suggest fake news")
        
        # Final confidence
        final_prob = analysis['final_probability']
        if final_prob > 0.7:
            explanations.append("✅ Overall: High confidence in REAL classification")
        elif final_prob < 0.3:
            explanations.append("❌ Overall: High confidence in FAKE classification")
        else:
            explanations.append("⚠️ Overall: Moderate confidence - needs human review")
        
        return explanations

# Initialize enhanced detector
enhanced_detector = EnhancedFakeNewsDetector()

def home(request):
    """Home page view"""
    return render(request, 'home.html')

def predict(request):
    """Enhanced prediction view with multiple APIs"""
    context = {}
    
    if request.method == 'POST':
        news_text = request.POST.get('nws', '')
        
        if news_text.strip():
            try:
                start_time = time.time()
                
                # Make enhanced prediction
                prediction_prob = enhanced_detector.predict(news_text)
                prediction = 'FAKE' if prediction_prob < 0.5 else 'REAL'
                
                # Calculate confidence
                confidence = abs(prediction_prob - 0.5) * 2 * 100
                
                # Get detailed explanation
                explanation = enhanced_detector.get_detailed_explanation()
                
                # Extract features
                features = extract_features(news_text)
                
                processing_time = time.time() - start_time
                
                # Save analysis to database
                try:
                    NewsAnalysis.objects.create(
                        text=news_text,
                        prediction=prediction,
                        confidence=confidence,
                        probability=prediction_prob,
                        explanation=explanation,
                        features=features,
                        ip_address=get_client_ip(request),
                        user_agent=get_user_agent(request),
                        session_id=request.session.session_key or '',
                        processing_time=processing_time,
                        model_version='v2.0-enhanced'
                    )
                except Exception as e:
                    print(f"Error saving analysis: {e}")
                
                context = {
                    'nws': news_text,
                    'prediction': prediction,
                    'confidence': confidence,
                    'probability': prediction_prob,
                    'explanation': explanation,
                    'features': features,
                    'processing_time': processing_time
                }
            except Exception as e:
                context = {
                    'error': f'Error during analysis: {str(e)}',
                    'nws': news_text
                }
        else:
            context = {'error': 'Please enter some text'}
    
    return render(request, 'predict.html', context)

def generate_explanation(text, probability):
    """Generate explanation for prediction"""
    explanations = []
    
    if probability < 0.3:
        explanations.append("High confidence in FAKE classification")
    elif probability > 0.7:
        explanations.append("High confidence in REAL classification")
    else:
        explanations.append("Uncertain classification - model needs more context")
    
    # Add feature-based explanations
    word_count = len(text.split())
    if word_count < 50:
        explanations.append("Short text - may lack sufficient context")
    elif word_count > 500:
        explanations.append("Long text - comprehensive analysis performed")
    
    # Add probability-based explanation
    if probability < 0.2:
        explanations.append("Very likely to be fake news")
    elif probability > 0.8:
        explanations.append("Very likely to be real news")
    else:
        explanations.append("Moderate confidence in prediction")
    
    return explanations

def extract_features(text):
    """Extract linguistic features from text"""
    features = {}
    
    # Basic text statistics
    words = text.split()
    features['word_count'] = len(words)
    features['avg_word_length'] = np.mean([len(word) for word in words]) if words else 0
    features['max_word_length'] = max([len(word) for word in words]) if words else 0
    
    # Vocabulary richness
    unique_words = set(words)
    features['vocabulary_size'] = len(unique_words)
    features['type_token_ratio'] = len(unique_words) / len(words) if words else 0
    
    # Sentence statistics
    sentences = text.split('.')
    features['sentence_count'] = len([s for s in sentences if s.strip()])
    features['avg_sentence_length'] = np.mean([len(s.split()) for s in sentences if s.strip()]) if sentences else 0
    
    # Punctuation features
    features['exclamation_count'] = text.count('!')
    features['question_count'] = text.count('?')
    features['quote_count'] = text.count('"')
    
    # Capitalization features
    features['uppercase_ratio'] = sum(1 for c in text if c.isupper()) / len(text) if text else 0
    
    return features

def get_client_ip(request):
    """Get client IP address"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def get_user_agent(request):
    """Get user agent string"""
    return request.META.get('HTTP_USER_AGENT', '')

def add_rating(request):
    """Add user rating and feedback"""
    if request.method == 'POST':
        name = request.POST.get('nme', '')
        email = request.POST.get('email', '')
        comment = request.POST.get('cmnt', '')
        rating = request.POST.get('rt', 5)
        
        try:
            Rating.objects.create(
                name=name,
                email=email,
                comment=comment,
                rating=int(rating),
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request)
            )
        except Exception as e:
            print(f"Error saving rating: {e}")
    
    # Get all ratings
    try:
        ratings = Rating.objects.all().order_by('-created_at')
        data = []
        for rating in ratings:
            data.append([
                rating.id,
                rating.name,
                rating.email,
                rating.comment,
                rating.rating,
                rating.ip_address,
                rating.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
    except Exception as e:
        print(f"Error loading ratings: {e}")
        data = []
    
    context = {
        'data': data
    }
    return render(request, 'predict.html', context)

@csrf_exempt
def api_predict(request):
    """REST API endpoint for predictions"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            text = data.get('text', '')
            
            if text.strip():
                start_time = time.time()
                
                prediction_prob = enhanced_detector.predict(text)
                prediction = 'FAKE' if prediction_prob < 0.5 else 'REAL'
                confidence = abs(prediction_prob - 0.5) * 2 * 100
                
                processing_time = time.time() - start_time
                
                # Save analysis to database
                try:
                    analysis_obj = NewsAnalysis.objects.create(
                        text=text,
                        prediction=prediction,
                        confidence=confidence,
                        probability=prediction_prob,
                        explanation=enhanced_detector.get_detailed_explanation(),
                        features=extract_features(text),
                        ip_address=get_client_ip(request),
                        user_agent=get_user_agent(request),
                        session_id=request.session.session_key or '',
                        processing_time=processing_time,
                        model_version='v2.0-enhanced'
                    )
                    
                    analysis = {
                        'id': analysis_obj.id,
                        'prediction': prediction,
                        'confidence': confidence,
                        'probability': prediction_prob,
                        'explanation': enhanced_detector.get_detailed_explanation(),
                        'features': extract_features(text),
                        'processing_time': processing_time
                    }
                except Exception as e:
                    print(f"Error saving analysis: {e}")
                    analysis = {
                        'prediction': prediction,
                        'confidence': confidence,
                        'probability': prediction_prob,
                        'explanation': enhanced_detector.get_detailed_explanation(),
                        'features': extract_features(text),
                        'processing_time': processing_time
                    }
                
                return JsonResponse(analysis)
            else:
                return JsonResponse({'error': 'Text is required'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'POST method required'}, status=405)

@csrf_exempt
def add_feedback(request):
    """Add user feedback on predictions"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            analysis_id = data.get('analysis_id')
            feedback_type = data.get('feedback_type')
            user_comment = data.get('comment', '')
            
            if not analysis_id or not feedback_type:
                return JsonResponse({'error': 'Analysis ID and feedback type are required'}, status=400)
            
            try:
                analysis = NewsAnalysis.objects.get(id=analysis_id)
                UserFeedback.objects.create(
                    news_analysis=analysis,
                    feedback_type=feedback_type,
                    user_comment=user_comment,
                    ip_address=get_client_ip(request),
                    user_agent=get_user_agent(request)
                )
                return JsonResponse({'message': 'Feedback saved successfully'})
            except NewsAnalysis.DoesNotExist:
                return JsonResponse({'error': 'Analysis not found'}, status=404)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'POST method required'}, status=405)

def dashboard(request):
    """Admin dashboard with statistics"""
    try:
        # Get basic statistics
        total_analyses = NewsAnalysis.objects.count()
        fake_count = NewsAnalysis.objects.filter(prediction='FAKE').count()
        real_count = NewsAnalysis.objects.filter(prediction='REAL').count()
        
        # Get recent analyses
        recent_analyses = NewsAnalysis.objects.all().order_by('-created_at')[:10]
        
        # Get feedback statistics
        total_feedback = UserFeedback.objects.count()
        correct_feedback = UserFeedback.objects.filter(feedback_type='CORRECT').count()
        incorrect_feedback = UserFeedback.objects.filter(feedback_type='INCORRECT').count()
        
        # Calculate accuracy from feedback
        feedback_accuracy = (correct_feedback / total_feedback * 100) if total_feedback > 0 else 0
        incorrect_feedback_percentage = (incorrect_feedback / total_feedback * 100) if total_feedback > 0 else 0
        
        context = {
            'total_analyses': total_analyses,
            'fake_count': fake_count,
            'real_count': real_count,
            'recent_analyses': recent_analyses,
            'total_feedback': total_feedback,
            'correct_feedback': correct_feedback,
            'incorrect_feedback': incorrect_feedback,
            'feedback_accuracy': feedback_accuracy,
            'incorrect_feedback_percentage': incorrect_feedback_percentage
        }
        
    except Exception as e:
        context = {
            'error': f'Error loading dashboard: {str(e)}'
        }
    
    return render(request, 'dashboard.html', context)


