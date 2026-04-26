# API Configuration for Enhanced Fake News Detection
# Add your API keys here for production use

# Google Fact Check API (Free tier available)
GOOGLE_FACT_CHECK_API_KEY = "YOUR_GOOGLE_API_KEY"

# NewsAPI (Free tier: 1000 requests/month)
NEWS_API_KEY = "YOUR_NEWS_API_KEY"

# MeaningCloud Sentiment Analysis (Free tier: 1000 requests/month)
MEANINGCLOUD_API_KEY = "YOUR_MEANINGCLOUD_API_KEY"

# Snopes API (Free tier available)
SNOPES_API_KEY = "YOUR_SNOPES_API_KEY"

# PolitiFact API (Free tier available)
POLITIFACT_API_KEY = "YOUR_POLITIFACT_API_KEY"

# API Configuration
API_CONFIG = {
    'google_fact_check': {
        'url': 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
        'key': GOOGLE_FACT_CHECK_API_KEY,
        'enabled': False  # Set to True when you have API key
    },
    'newsapi': {
        'url': 'https://newsapi.org/v2/everything',
        'key': NEWS_API_KEY,
        'enabled': False  # Set to True when you have API key
    },
    'meaningcloud': {
        'url': 'https://api.meaningcloud.com/sentiment-2.1',
        'key': MEANINGCLOUD_API_KEY,
        'enabled': False  # Set to True when you have API key
    },
    'snopes': {
        'url': 'https://api.snopes.com/v2/fact-check/search',
        'key': SNOPES_API_KEY,
        'enabled': False  # Set to True when you have API key
    },
    'politifact': {
        'url': 'https://www.politifact.com/api/statements/',
        'key': POLITIFACT_API_KEY,
        'enabled': False  # Set to True when you have API key
    }
}

# Credible news sources for verification
CREDIBLE_SOURCES = [
    'reuters.com',
    'ap.org',
    'bbc.com',
    'cnn.com',
    'npr.org',
    'pbs.org',
    'nytimes.com',
    'washingtonpost.com',
    'wsj.com',
    'theguardian.com',
    'aljazeera.com',
    'nbcnews.com',
    'abcnews.go.com',
    'cbsnews.com',
    'foxnews.com',
    'usatoday.com',
    'latimes.com',
    'chicagotribune.com',
    'bostonglobe.com',
    'sfchronicle.com'
]

# Fake news indicators
FAKE_NEWS_INDICATORS = [
    'aliens', 'ufo', 'bigfoot', 'loch ness', 'time travel', 'conspiracy',
    'flat earth', 'vaccines cause autism', '5g coronavirus', 'secret government',
    'chemtrails', 'microchip', 'mind control', 'atlantis', 'hollow earth',
    'underground cities', 'reptilian elite', 'haarp weather control',
    'crystal healing', 'anti-gravity', 'pyramid power', 'dimensional portals',
    'telepathy', 'immortality', 'matrix simulation', 'ancient astronauts'
]

# Real news indicators
REAL_NEWS_INDICATORS = [
    'study', 'research', 'scientists', 'experts', 'university', 'journal',
    'peer reviewed', 'official', 'confirmed', 'verified', 'according to',
    'said', 'reported', 'announced', 'published', 'clinical trial',
    'government report', 'official statement', 'press release'
]

# Credibility indicators
CREDIBILITY_INDICATORS = {
    'has_quotes': True,
    'has_numbers': True,
    'has_dates': True,
    'has_names': True,
    'has_sources': True,
    'has_citations': True,
    'has_author': True,
    'has_publication_date': True
}

# Model weights for ensemble prediction
MODEL_WEIGHTS = {
    'lstm_model': 0.4,        # LSTM gets highest weight
    'fact_check': 0.2,        # Fact checking APIs
    'news_sources': 0.15,     # News source verification
    'sentiment': 0.15,        # Sentiment analysis
    'patterns': 0.1           # Pattern recognition
}

# Confidence thresholds
CONFIDENCE_THRESHOLDS = {
    'high_confidence': 0.7,
    'moderate_confidence': 0.5,
    'low_confidence': 0.3
}

# Processing time limits (seconds)
PROCESSING_LIMITS = {
    'max_api_timeout': 10,
    'max_total_time': 30,
    'cache_duration': 3600  # 1 hour
}
