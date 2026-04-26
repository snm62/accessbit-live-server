from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('predict/', views.predict, name='predict'),
    path('addrating/', views.add_rating, name='add_rating'),
    path('api/predict/', views.api_predict, name='api_predict'),
    path('api/feedback/', views.add_feedback, name='add_feedback'),
    path('dashboard/', views.dashboard, name='dashboard'),
]
