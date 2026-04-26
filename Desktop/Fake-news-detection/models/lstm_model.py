import numpy as np
import pandas as pd
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import Dense, LSTM, Embedding, Dropout, Bidirectional, Input, Attention, GlobalAveragePooling1D
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import pickle
import os
import json

class LSTMDataPreprocessor:
    """Data preprocessing class for LSTM models"""
    
    def __init__(self, max_length=1000, vocab_size=10000):
        self.max_length = max_length
        self.vocab_size = vocab_size
        self.tokenizer = None
        self.ps = PorterStemmer()
        
        # Download NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords')
    
    def preprocess_text(self, text):
        """Comprehensive text preprocessing for LSTM"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        
        # Remove email addresses
        text = re.sub(r'\S+@\S+', '', text)
        
        # Remove special characters but keep punctuation
        text = re.sub(r'[^a-zA-Z\s\.\,\!\?]', '', text)
        
        # Tokenize
        words = text.split()
        
        # Remove stopwords
        stop_words = set(stopwords.words('english'))
        words = [word for word in words if word not in stop_words]
        
        # Apply stemming
        words = [self.ps.stem(word) for word in words]
        
        return ' '.join(words)
    
    def fit_tokenizer(self, texts):
        """Fit tokenizer on training data"""
        self.tokenizer = Tokenizer(num_words=self.vocab_size, oov_token='<OOV>')
        self.tokenizer.fit_on_texts(texts)
        return self.tokenizer
    
    def text_to_sequence(self, text):
        """Convert text to sequence for LSTM"""
        if self.tokenizer is None:
            raise ValueError("Tokenizer not fitted. Call fit_tokenizer first.")
        
        # Preprocess text
        processed_text = self.preprocess_text(text)
        
        # Convert to sequence
        sequence = self.tokenizer.texts_to_sequences([processed_text])
        
        # Pad sequence
        padded_sequence = pad_sequences(sequence, maxlen=self.max_length, padding='post', truncating='post')
        
        return padded_sequence[0]
    
    def prepare_data(self, texts, labels):
        """Prepare data for LSTM training"""
        # Preprocess all texts
        processed_texts = [self.preprocess_text(text) for text in texts]
        
        # Fit tokenizer
        self.fit_tokenizer(processed_texts)
        
        # Convert to sequences
        sequences = self.tokenizer.texts_to_sequences(processed_texts)
        
        # Pad sequences
        padded_sequences = pad_sequences(sequences, maxlen=self.max_length, padding='post', truncating='post')
        
        return padded_sequences, np.array(labels)

class LSTMFakeNewsDetector:
    """LSTM-based fake news detection model"""
    
    def __init__(self, max_length=1000, vocab_size=10000, embedding_dim=128):
        self.max_length = max_length
        self.vocab_size = vocab_size
        self.embedding_dim = embedding_dim
        self.model = None
        self.tokenizer = None
        self.preprocessor = LSTMDataPreprocessor(max_length, vocab_size)
        
    def create_basic_lstm_model(self):
        """Create basic LSTM model"""
        model = Sequential([
            # Embedding layer
            Embedding(self.vocab_size, self.embedding_dim, input_length=self.max_length),
            
            # First LSTM layer
            LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.2),
            
            # Second LSTM layer
            LSTM(64, return_sequences=False, dropout=0.2, recurrent_dropout=0.2),
            
            # Dense layers
            Dense(32, activation='relu'),
            Dropout(0.3),
            
            # Output layer
            Dense(1, activation='sigmoid')
        ])
        
        # Compile model
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        return model
    
    def create_attention_lstm_model(self):
        """Create LSTM model with attention mechanism"""
        inputs = Input(shape=(self.max_length,))
        
        # Embedding layer
        embedding = Embedding(self.vocab_size, self.embedding_dim, input_length=self.max_length)(inputs)
        
        # Bidirectional LSTM layers
        lstm1 = Bidirectional(LSTM(128, return_sequences=True, dropout=0.2))(embedding)
        lstm2 = Bidirectional(LSTM(64, return_sequences=True, dropout=0.2))(lstm1)
        
        # Attention mechanism
        attention = Attention()([lstm2, lstm2])
        
        # Global average pooling
        pooled = GlobalAveragePooling1D()(attention)
        
        # Dense layers
        dense1 = Dense(64, activation='relu')(pooled)
        dropout1 = Dropout(0.3)(dense1)
        
        dense2 = Dense(32, activation='relu')(dropout1)
        dropout2 = Dropout(0.3)(dense2)
        
        # Output layer
        outputs = Dense(1, activation='sigmoid')(dropout2)
        
        model = Model(inputs=inputs, outputs=outputs)
        
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        return model
    
    def create_model(self, model_type='basic'):
        """Create LSTM model based on type"""
        if model_type == 'basic':
            self.model = self.create_basic_lstm_model()
        elif model_type == 'attention':
            self.model = self.create_attention_lstm_model()
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        return self.model
    
    def train_model(self, texts, labels, model_type='basic', epochs=10, batch_size=32, validation_split=0.2):
        """Train LSTM model"""
        # Prepare data
        X, y = self.preprocessor.prepare_data(texts, labels)
        
        # Create model
        self.create_model(model_type)
        
        # Callbacks
        callbacks = [
            EarlyStopping(patience=3, restore_best_weights=True, monitor='val_loss'),
            ReduceLROnPlateau(patience=2, factor=0.5, monitor='val_loss')
        ]
        
        # Train model
        history = self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=callbacks,
            verbose=1
        )
        
        # Save tokenizer
        self.tokenizer = self.preprocessor.tokenizer
        
        return history
    
    def predict(self, text):
        """Predict if news is fake or real"""
        if self.model is None:
            raise ValueError("Model not trained. Call train_model first.")
        
        # Preprocess and tokenize
        sequence = self.preprocessor.text_to_sequence(text)
        sequence = sequence.reshape(1, -1)
        
        # Make prediction
        prediction = self.model.predict(sequence)[0][0]
        
        return prediction
    
    def predict_batch(self, texts):
        """Predict for multiple texts"""
        if self.model is None:
            raise ValueError("Model not trained. Call train_model first.")
        
        # Preprocess all texts
        sequences = []
        for text in texts:
            sequence = self.preprocessor.text_to_sequence(text)
            sequences.append(sequence)
        
        sequences = np.array(sequences)
        
        # Make predictions
        predictions = self.model.predict(sequences)
        
        return predictions.flatten()
    
    def save_model(self, model_path, tokenizer_path):
        """Save trained model and tokenizer"""
        if self.model is not None:
            self.model.save(model_path)
        
        if self.tokenizer is not None:
            with open(tokenizer_path, 'wb') as f:
                pickle.dump(self.tokenizer, f)
    
    def load_model(self, model_path, tokenizer_path):
        """Load trained model and tokenizer"""
        self.model = tf.keras.models.load_model(model_path)
        
        with open(tokenizer_path, 'rb') as f:
            self.tokenizer = pickle.load(f)
        
        self.preprocessor.tokenizer = self.tokenizer
    
    def load_or_train_model(self):
        """Load existing model or train new one"""
        model_path = 'models/trained_models/lstm_model.h5'
        tokenizer_path = 'models/trained_models/lstm_tokenizer.pkl'
        
        if os.path.exists(model_path) and os.path.exists(tokenizer_path):
            # Load existing model
            self.load_model(model_path, tokenizer_path)
        else:
            # Train new model
            self.train_model_with_sample_data()
    
    def train_model_with_sample_data(self):
        """Train model with sample data"""
        # Sample data for training
        sample_data = {
            'text': [
                # Real news examples
                "Scientists discover new species of dinosaur in remote mountain range",
                "New study shows benefits of exercise for mental health",
                "COVID-19 vaccine development progresses with promising results",
                "Global warming study reveals alarming trends",
                "Renewable energy adoption increases worldwide",
                "NASA announces new Mars mission with international partners",
                "Medical breakthrough in cancer treatment shows promise",
                "Climate change report shows urgent need for action",
                "New renewable energy technology reduces costs by 50%",
                "Study finds link between diet and longevity",
                "World Health Organization releases new health guidelines",
                "International Space Station celebrates 20 years in orbit",
                "Scientists develop new method for plastic recycling",
                "Global study shows decline in bee populations",
                "New electric vehicle sales reach record numbers",
                
                # Fake news examples
                "Aliens contact Earth government in secret meeting",
                "Time travel machine invented by local scientist",
                "Bigfoot spotted in local forest, experts confirm",
                "Loch Ness monster finally photographed by tourist",
                "Flying cars to be available by next year, company claims",
                "Conspiracy theory claims Earth is flat despite evidence",
                "Ancient alien artifacts found in Egyptian pyramid",
                "UFO sightings increase in rural areas",
                "Secret government program controls weather patterns",
                "Time travelers spotted at historical events",
                "Scientists discover that vaccines cause autism",
                "5G networks spreading coronavirus, experts claim",
                "Flat Earth society gains millions of new members",
                "Time machine discovered in ancient ruins",
                "Aliens built the pyramids, new evidence shows"
            ],
            'label': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,  # Real news
                      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]   # Fake news
        }
        
        # Train model
        history = self.train_model(
            texts=sample_data['text'],
            labels=sample_data['label'],
            model_type='attention',
            epochs=15
        )
        
        # Save model
        os.makedirs('models/trained_models', exist_ok=True)
        self.save_model('models/trained_models/lstm_model.h5', 'models/trained_models/lstm_tokenizer.pkl')
        
        return history
