#!/usr/bin/env python
"""
Proper LSTM Training Script
Uses the exact architecture specified for better accuracy
"""

import os
import sys
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, LSTM, Embedding, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
import matplotlib.pyplot as plt
import pickle
import json
import re

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# Enable mixed precision for faster training
tf.keras.mixed_precision.set_global_policy('mixed_float16')

class ProperLSTMTrainer:
    def __init__(self, max_length=500, vocab_size=8000, embedding_dim=128):
        self.max_length = max_length
        self.vocab_size = vocab_size
        self.embedding_dim = embedding_dim
        self.model = None
        self.tokenizer = None
        self.history = None
        
    def create_large_dataset(self):
        """Create a larger, more diverse dataset for better training"""
        print("Creating comprehensive dataset for training...")
        
        # Real news examples (more diverse and realistic)
        real_news = [
            "Scientists discover new species of deep-sea creatures in Pacific Ocean. Marine biologists from Stanford University published their findings in Nature journal.",
            "NASA launches new Mars rover to search for signs of ancient life. The Perseverance rover will collect rock samples for return to Earth.",
            "COVID-19 vaccine development shows promising results in clinical trials. Researchers report 95% effectiveness in preventing infection.",
            "Global climate summit addresses renewable energy transition. World leaders agree on new carbon reduction targets.",
            "SpaceX successfully launches astronauts to International Space Station. Commercial spaceflight marks new era in space exploration.",
            "Medical breakthrough: New treatment for Alzheimer's disease shows positive results. Clinical trials demonstrate improved cognitive function.",
            "Renewable energy costs continue to decline worldwide. Solar and wind power now cheaper than fossil fuels in many regions.",
            "Archaeologists discover ancient city in Amazon rainforest. Laser technology reveals previously unknown urban settlements.",
            "New study shows benefits of Mediterranean diet for heart health. Research conducted over 10 years with 10,000 participants.",
            "Electric vehicle sales reach record high in Europe. Market share increases to 15% of all new car sales.",
            "Scientists develop new method for plastic recycling. Technology converts waste plastic into useful materials.",
            "Global internet connectivity improves in developing countries. Satellite technology provides access to remote areas.",
            "New cancer treatment shows promising results in early trials. Immunotherapy approach targets specific cancer cells.",
            "Solar panel efficiency reaches new record levels. Perovskite technology achieves 30% conversion rate.",
            "Ocean cleanup project removes tons of plastic from Pacific. Innovative floating barriers collect waste effectively.",
            "Quantum computing breakthrough achieved by research team. New algorithm solves complex problems faster.",
            "Artificial intelligence helps diagnose rare diseases. Machine learning model identifies patterns in medical data.",
            "Space tourism company announces first civilian space flight. Tickets available for 2024 launch.",
            "Breakthrough in fusion energy research reported. Scientists achieve sustained plasma confinement.",
            "New species of butterfly discovered in rainforest. Biodiversity study reveals previously unknown insects.",
            "Global study shows decline in bee populations. Conservation efforts needed to protect pollinators.",
            "Renewable energy storage technology improves. Battery costs decrease by 40% in past year.",
            "Climate change impact on coral reefs documented. Research shows 50% decline in coral coverage.",
            "New medical imaging technology provides clearer scans. AI-enhanced MRI reduces scan time by 60%.",
            "International space station celebrates 25 years in orbit. Collaboration between 15 countries continues.",
            "Breakthrough in quantum communication achieved. Secure data transmission over long distances demonstrated.",
            "New method for carbon capture developed. Technology removes CO2 from atmosphere efficiently.",
            "Global study on mental health during pandemic published. Research shows increased awareness of mental health issues.",
            "Innovation in water purification technology. New filters remove microplastics from drinking water."
        ]
        
        # Fake news examples (more diverse and realistic)
        fake_news = [
            "ALIENS DISCOVERED ON MARS! Scientists claim they found evidence of extraterrestrial life on the red planet. The government has been hiding this information for years.",
            "BREAKING: Time travel machine invented by secret government agency. Anonymous sources reveal that scientists have successfully sent objects back in time.",
            "5G CORONAVIRUS CONSPIRACY: New study shows 5G networks are spreading coronavirus. Experts warn about the dangers of wireless technology.",
            "FLAT EARTH PROVEN: New satellite images reveal the truth about our planet's shape. All previous science was wrong.",
            "BIGFOOT CAPTURED: Hunters in Oregon claim to have captured the legendary creature. DNA tests confirm it's not human.",
            "VACCINES CAUSE AUTISM: New research reveals shocking connection between vaccines and autism spectrum disorders.",
            "LOCH NESS MONSTER SPOTTED: Tourists capture clear footage of the legendary creature in Scottish lake.",
            "SECRET GOVERNMENT EXPERIMENTS: Underground facilities conducting mind control experiments on citizens.",
            "CHEMTRAILS CONSPIRACY: Government spraying chemicals from planes to control population. Citizens report unusual cloud patterns.",
            "MOON LANDING FAKE: New evidence proves Apollo missions were staged in Hollywood studio. Astronauts never left Earth.",
            "REPTILIAN ELITE: World leaders are actually shape-shifting reptiles. Ancient documents reveal the truth.",
            "HAARP WEATHER CONTROL: Government controlling weather with secret technology. Storms and droughts are man-made.",
            "MICROCHIP VACCINES: COVID vaccines contain tracking microchips. Bill Gates confirms in leaked video.",
            "HOLLOW EARTH: Earth is hollow with advanced civilizations inside. Scientists discover massive underground cities.",
            "ATLANTIS FOUND: Ancient city discovered under the ocean. Archaeologists find evidence of advanced technology.",
            "DINOSAURS STILL ALIVE: Scientists discover living dinosaurs in remote jungle. Government covers up the discovery.",
            "MIND READING TECHNOLOGY: Government develops brain scanning devices. Privacy concerns raised by experts.",
            "TIME TRAVELERS AMONG US: Evidence of future humans in present day. Photographs show people in period clothing.",
            "ALIEN ABDUCTIONS REAL: Thousands report missing time experiences. Government admits to covering up incidents.",
            "CRYSTAL HEALING PROVEN: New study shows crystals cure all diseases. Medical establishment refuses to acknowledge.",
            "ANTI-GRAVITY DISCOVERED: Scientists develop technology that defies gravity. Military applications being developed.",
            "PYRAMID POWER: Ancient pyramids generate free energy. Egyptian government hides the technology.",
            "MIND CONTROL VACCINES: New vaccines contain mind control chemicals. Population control program revealed.",
            "UNDERGROUND CITIES: Massive underground cities discovered worldwide. Elite preparing for apocalypse.",
            "TIME MACHINE PATENT: Inventor files patent for working time machine. Government seizes the technology.",
            "ALIEN INVASION IMMINENT: Space agencies detect alien fleet approaching Earth. Public not informed.",
            "DIMENSIONAL PORTALS: Scientists discover portals to parallel universes. Travel between dimensions possible.",
            "TELEPATHY REAL: Research proves humans can communicate with thoughts. Government suppresses the findings.",
            "IMMORTALITY ACHIEVED: Scientists discover way to stop aging. Elite keeping it secret from public.",
            "MATRIX SIMULATION: Evidence suggests we live in computer simulation. Reality is artificial construct.",
            "ANCIENT ASTRONAUTS: Aliens built all ancient monuments. Human civilization guided by extraterrestrials.",
            "UNDERWATER BASES: Government operates secret underwater cities. Technology beyond current capabilities.",
            "QUANTUM IMMORTALITY: Consciousness continues in parallel universes. Death is illusion of single universe.",
            "MAGIC REAL: Ancient magical practices proven effective. Modern science finally acknowledges supernatural.",
            "UNDERGROUND ALIENS: Extraterrestrials living in Earth's core. Government has contact with them.",
            "TIME LOOP DISCOVERED: Scientists find evidence of repeating time periods. History repeating itself.",
            "DIMENSIONAL BEINGS: Entities from other dimensions visiting Earth. Government monitoring their activities.",
            "REALITY MANIPULATION: Technology exists to alter reality. Elite using it to control population."
        ]
        
        # Create DataFrames
        real_df = pd.DataFrame({
            'text': real_news,
            'label': [1] * len(real_news)
        })
        
        fake_df = pd.DataFrame({
            'text': fake_news,
            'label': [0] * len(fake_news)
        })
        
        # Combine and shuffle
        combined_df = pd.concat([real_df, fake_df], ignore_index=True)
        combined_df = combined_df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        print(f"Dataset created: {len(combined_df)} articles")
        print(f"Real news: {len(real_df)} articles")
        print(f"Fake news: {len(fake_df)} articles")
        
        return combined_df
    
    def preprocess_text(self, text):
        """Enhanced text preprocessing"""
        if pd.isna(text):
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
    
    def prepare_data(self, df):
        """Prepare data for LSTM training"""
        print("Preprocessing text data...")
        
        # Preprocess text
        df['processed_text'] = df['text'].apply(self.preprocess_text)
        
        # Remove very short texts
        df = df[df['processed_text'].str.len() > 20]
        
        # Split data
        train_size = int(0.8 * len(df))
        val_size = int(0.1 * len(df))
        
        train_df = df[:train_size]
        val_df = df[train_size:train_size + val_size]
        test_df = df[train_size + val_size:]
        
        print(f"Training set: {len(train_df)} articles")
        print(f"Validation set: {len(val_df)} articles")
        print(f"Test set: {len(test_df)} articles")
        
        # Prepare text and labels
        train_texts = train_df['processed_text'].values
        val_texts = val_df['processed_text'].values
        test_texts = test_df['processed_text'].values
        
        train_labels = train_df['label'].values
        val_labels = val_df['label'].values
        test_labels = test_df['label'].values
        
        # Tokenize
        print("Tokenizing text data...")
        self.tokenizer = Tokenizer(num_words=self.vocab_size, oov_token='<OOV>')
        self.tokenizer.fit_on_texts(train_texts)
        
        # Convert to sequences
        train_sequences = self.tokenizer.texts_to_sequences(train_texts)
        val_sequences = self.tokenizer.texts_to_sequences(val_texts)
        test_sequences = self.tokenizer.texts_to_sequences(test_texts)
        
        # Pad sequences
        train_padded = pad_sequences(train_sequences, maxlen=self.max_length, padding='post', truncating='post')
        val_padded = pad_sequences(val_sequences, maxlen=self.max_length, padding='post', truncating='post')
        test_padded = pad_sequences(test_sequences, maxlen=self.max_length, padding='post', truncating='post')
        
        print(f"Training shape: {train_padded.shape}")
        print(f"Validation shape: {val_padded.shape}")
        print(f"Test shape: {test_padded.shape}")
        
        return train_padded, val_padded, test_padded, train_labels, val_labels, test_labels
    
    def create_lstm_model(self):
        """Create LSTM model with EXACT architecture specified"""
        print("Creating LSTM Model with EXACT architecture:")
        print("Input Layer (Text)")
        print("↓")
        print("Embedding Layer (128 dimensions)")
        print("↓")
        print("LSTM Layer 1 (128 units, return_sequences=True)")
        print("↓")
        print("Dropout (0.2)")
        print("↓")
        print("LSTM Layer 2 (64 units, return_sequences=False)")
        print("↓")
        print("Dropout (0.2)")
        print("↓")
        print("Dense Layer (32 units, ReLU)")
        print("↓")
        print("Dropout (0.3)")
        print("↓")
        print("Output Layer (1 unit, Sigmoid)")
        
        model = Sequential([
            # Embedding Layer (128 dimensions)
            Embedding(self.vocab_size, self.embedding_dim, input_length=self.max_length),
            
            # LSTM Layer 1 (128 units, return_sequences=True)
            LSTM(128, return_sequences=True),
            Dropout(0.2),
            
            # LSTM Layer 2 (64 units, return_sequences=False)
            LSTM(64, return_sequences=False),
            Dropout(0.2),
            
            # Dense Layer (32 units, ReLU)
            Dense(32, activation='relu'),
            Dropout(0.3),
            
            # Output Layer (1 unit, Sigmoid)
            Dense(1, activation='sigmoid')
        ])
        
        # Compile model
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        print(f"\n✅ Model created successfully!")
        
        return model
    
    def train_model(self, train_data, val_data, train_labels, val_labels):
        """Train the LSTM model with proper callbacks"""
        print("\n🚀 Starting LSTM Training...")
        
        # Create model
        self.model = self.create_lstm_model()
        
        # Create callbacks for better training
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=5,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=3,
                min_lr=1e-7,
                verbose=1
            ),
            ModelCheckpoint(
                'models/trained_models/best_lstm_model.h5',
                monitor='val_accuracy',
                save_best_only=True,
                verbose=1
            )
        ]
        
        # Train the model
        self.history = self.model.fit(
            train_data,
            train_labels,
            validation_data=(val_data, val_labels),
            epochs=25,  # More epochs for better training
            batch_size=32,  # Smaller batch size for better generalization
            callbacks=callbacks,
            verbose=1
        )
        
        print("✅ Training completed!")
        return self.history
    
    def evaluate_model(self, test_data, test_labels):
        """Evaluate the trained model"""
        print("\n📊 Evaluating Model...")
        
        # Make predictions
        predictions = self.model.predict(test_data)
        predicted_labels = (predictions > 0.5).astype(int).flatten()
        
        # Calculate metrics
        accuracy = accuracy_score(test_labels, predicted_labels)
        precision = precision_score(test_labels, predicted_labels)
        recall = recall_score(test_labels, predicted_labels)
        f1 = f1_score(test_labels, predicted_labels)
        
        print(f"🎯 Test Results:")
        print(f"Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1-Score: {f1:.4f}")
        
        # Classification report
        print("\n📋 Classification Report:")
        print(classification_report(test_labels, predicted_labels, target_names=['Fake', 'Real']))
        
        # Save metrics
        metrics = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1)
        }
        
        os.makedirs('models/trained_models', exist_ok=True)
        with open('models/trained_models/metrics.json', 'w') as f:
            json.dump(metrics, f, indent=4)
        
        return metrics
    
    def save_model_and_tokenizer(self):
        """Save the trained model and tokenizer"""
        print("\n💾 Saving Model and Tokenizer...")
        
        # Create models directory
        os.makedirs('models/trained_models', exist_ok=True)
        
        # Save model
        self.model.save('models/trained_models/lstm_model.h5')
        
        # Save tokenizer
        with open('models/trained_models/lstm_tokenizer.pkl', 'wb') as f:
            pickle.dump(self.tokenizer, f)
        
        # Save model configuration
        model_config = {
            'max_length': self.max_length,
            'vocab_size': self.vocab_size,
            'embedding_dim': self.embedding_dim,
            'model_path': 'models/trained_models/lstm_model.h5',
            'tokenizer_path': 'models/trained_models/lstm_tokenizer.pkl'
        }
        
        with open('models/trained_models/model_config.json', 'w') as f:
            json.dump(model_config, f, indent=4)
        
        print("✅ Model and tokenizer saved successfully!")
    
    def plot_training_history(self):
        """Plot training history"""
        if self.history is None:
            print("No training history available.")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # Accuracy
        axes[0, 0].plot(self.history.history['accuracy'], label='Training Accuracy')
        axes[0, 0].plot(self.history.history['val_accuracy'], label='Validation Accuracy')
        axes[0, 0].set_title('Model Accuracy')
        axes[0, 0].set_xlabel('Epoch')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].legend()
        axes[0, 0].grid(True)
        
        # Loss
        axes[0, 1].plot(self.history.history['loss'], label='Training Loss')
        axes[0, 1].plot(self.history.history['val_loss'], label='Validation Loss')
        axes[0, 1].set_title('Model Loss')
        axes[0, 1].set_xlabel('Epoch')
        axes[0, 1].set_ylabel('Loss')
        axes[0, 1].legend()
        axes[0, 1].grid(True)
        
        # Precision
        if 'precision' in self.history.history:
            axes[1, 0].plot(self.history.history['precision'], label='Training Precision')
            axes[1, 0].plot(self.history.history['val_precision'], label='Validation Precision')
            axes[1, 0].set_title('Model Precision')
            axes[1, 0].set_xlabel('Epoch')
            axes[1, 0].set_ylabel('Precision')
            axes[1, 0].legend()
            axes[1, 0].grid(True)
        
        # Recall
        if 'recall' in self.history.history:
            axes[1, 1].plot(self.history.history['recall'], label='Training Recall')
            axes[1, 1].plot(self.history.history['val_recall'], label='Validation Recall')
            axes[1, 1].set_title('Model Recall')
            axes[1, 1].set_xlabel('Epoch')
            axes[1, 1].set_ylabel('Recall')
            axes[1, 1].legend()
            axes[1, 1].grid(True)
        
        plt.tight_layout()
        plt.savefig('models/trained_models/training_history.png', dpi=300, bbox_inches='tight')
        print("✅ Training history plot saved!")
    
    def run_training_pipeline(self):
        """Run the complete training pipeline"""
        print("=" * 60)
        print("PROPER LSTM FAKE NEWS DETECTION TRAINING")
        print("=" * 60)
        
        try:
            # Create dataset
            df = self.create_large_dataset()
            
            # Prepare data
            train_data, val_data, test_data, train_labels, val_labels, test_labels = self.prepare_data(df)
            
            # Train model
            self.train_model(train_data, val_data, train_labels, val_labels)
            
            # Evaluate model
            metrics = self.evaluate_model(test_data, test_labels)
            
            # Save model and tokenizer
            self.save_model_and_tokenizer()
            
            # Plot training history
            self.plot_training_history()
            
            print("\n" + "=" * 60)
            print("✅ PROPER LSTM TRAINING COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print(f"Final Test Accuracy: {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.2f}%)")
            print(f"Final Test F1-Score: {metrics['f1_score']:.4f}")
            print("\nModel files saved in: models/trained_models/")
            print("You can now use the trained LSTM model for predictions!")
            
        except Exception as e:
            print(f"❌ Error during training: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    # Create trainer and run pipeline
    trainer = ProperLSTMTrainer()
    trainer.run_training_pipeline()
