from django.contrib import admin
from .models import Rating, NewsAnalysis, UserFeedback, SystemMetrics

@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'rating', 'ip_address', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('name', 'email', 'comment')
    readonly_fields = ('created_at', 'updated_at', 'ip_address', 'user_agent')

@admin.register(NewsAnalysis)
class NewsAnalysisAdmin(admin.ModelAdmin):
    list_display = ('prediction', 'confidence', 'ip_address', 'processing_time', 'model_version', 'created_at')
    list_filter = ('prediction', 'model_version', 'created_at')
    search_fields = ('text',)
    readonly_fields = ('created_at', 'updated_at', 'processing_time')
    list_per_page = 50

@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    list_display = ('news_analysis', 'feedback_type', 'ip_address', 'created_at')
    list_filter = ('feedback_type', 'created_at')
    search_fields = ('user_comment',)
    readonly_fields = ('created_at',)

@admin.register(SystemMetrics)
class SystemMetricsAdmin(admin.ModelAdmin):
    list_display = ('date', 'total_predictions', 'correct_predictions', 'model_accuracy', 'average_confidence')
    list_filter = ('date',)
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Analysis Results', {
            'fields': ('text', 'prediction', 'confidence', 'probability')
        }),
        ('Details', {
            'fields': ('explanation', 'features', 'created_at'),
            'classes': ('collapse',)
        }),
    )
