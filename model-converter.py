# Convertir le modèle Keras en format TensorFlow.js
# Exécutez ce script après avoir entraîné votre modèle

import os
import tensorflow as tf
from tensorflowjs.converters import save_keras_model

# Chemin vers le modèle sauvegardé en format h5
model_path = 'emotion_recognition_bilstm_model.h5'

# Chemin de sortie pour le modèle TensorFlow.js
output_path = 'web/model'

# Créer le répertoire de sortie s'il n'existe pas
os.makedirs(output_path, exist_ok=True)

# Charger le modèle
model = tf.keras.models.load_model(model_path)

# Convertir et sauvegarder le modèle au format TensorFlow.js
save_keras_model(model, output_path)

print(f"Modèle converti et sauvegardé dans {output_path}")
print("Pour installer la bibliothèque requise: pip install tensorflowjs")