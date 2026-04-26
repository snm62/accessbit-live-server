from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Rating(models.Model):
    """Model for storing user ratings and feedback"""
    name = models.CharField(max_length=100)
    email = models.EmailField(blank=True, null=True)
    comment = models.TextField()
    rating = models.IntegerField(choices=[
        (1, 'Very Bad'),
        (2, 'Bad'),
        (3, 'Average'),
        (4, 'Good'),
        (5, 'Excellent'),
    ])
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['rating']),
            models.Index(fields=['created_at']),
            models.Index(fields=['ip_address']),
        ]

    def __str__(self):
        return f"{self.name} - {self.rating}/5"

class NewsAnalysis(models.Model):
    """Model for storing news analysis results"""
    text = models.TextField()
    prediction = models.CharField(max_length=10, choices=[
        ('FAKE', 'Fake News'),
        ('REAL', 'Real News'),
    ])
    confidence = models.FloatField()
    probability = models.FloatField()
    explanation = models.JSONField(default=dict)
    features = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    session_id = models.CharField(max_length=100, blank=True, null=True)
    processing_time = models.FloatField(default=0.0)  # in seconds
    model_version = models.CharField(max_length=50, default='v1.0')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['prediction']),
            models.Index(fields=['created_at']),
            models.Index(fields=['ip_address']),
            models.Index(fields=['confidence']),
        ]
        verbose_name_plural = "News Analyses"

    def __str__(self):
        return f"{self.prediction} - {self.confidence:.2f}%"

class UserFeedback(models.Model):
    """Model for storing user feedback on predictions"""
    news_analysis = models.ForeignKey(NewsAnalysis, on_delete=models.CASCADE, related_name='feedbacks')
    feedback_type = models.CharField(max_length=20, choices=[
        ('CORRECT', 'Correct Prediction'),
        ('INCORRECT', 'Incorrect Prediction'),
        ('UNSURE', 'Not Sure'),
    ])
    user_comment = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['feedback_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.news_analysis.prediction} - {self.feedback_type}"

class SystemMetrics(models.Model):
    """Model for storing system performance metrics"""
    total_predictions = models.IntegerField(default=0)
    correct_predictions = models.IntegerField(default=0)
    average_confidence = models.FloatField(default=0.0)
    average_processing_time = models.FloatField(default=0.0)
    model_accuracy = models.FloatField(default=0.0)
    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['date']),
        ]
        verbose_name_plural = "System Metrics"

    def __str__(self):
        return f"{self.date} - Accuracy: {self.model_accuracy:.2f}%"
