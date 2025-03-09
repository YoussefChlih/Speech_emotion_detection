// feature-extractor.js - Implémentation JavaScript de l'extraction de caractéristiques audio

class AudioFeatureExtractor {
  constructor() {
    // Initialisation des paramètres d'extraction
    this.sampleRate = 22050; // Taux d'échantillonnage standard pour l'audio
    this.fftSize = 2048;     // Taille de la FFT
    this.hopSize = 512;      // Taille du "hop" (chevauchement)
    this.mfccCount = 40;     // Nombre de coefficients MFCC à extraire
    this.essentiaLoaded = false;
  }

  // Configuration de l'extracteur
async initialize() {
  try {
    // Vérifier si Essentia est définie globalement
    if (typeof Essentia === 'undefined' || typeof EssentiaWASM === 'undefined') {
      console.warn("Essentia.js n'est pas disponible, passage en mode simulation");
      this.useRandomFeatures = true;
      return false;
    }

    // Charger les bibliothèques nécessaires
    this.essentia = await new Essentia(EssentiaWASM);
    this.essentiaLoaded = true;
    console.log("Essentia.js chargée avec succès");
    return true;
  } catch (error) {
    console.error("Erreur lors du chargement d'Essentia.js:", error);
    this.useRandomFeatures = true;
    return false;
  }
}
  // Extraction des caractéristiques à partir d'un buffer audio
  async extractFeatures(audioBuffer) {
    try {
      // Si Essentia n'est pas chargée, utiliser des caractéristiques aléatoires
      if (!this.essentiaLoaded || this.useRandomFeatures) {
        return this._createRandomFeatures();
      }

      // Convertir le buffer audio en format flottant mono
      const monoSignal = this._convertToMono(audioBuffer);
      
      // Extraire les MFCCs
      const mfccs = await this._extractMFCCs(monoSignal);
      
      // Extraire le chroma
      const chroma = await this._extractChroma(monoSignal);
      
      // Extraire l'énergie et ZCR
      const energy = await this._extractEnergy(monoSignal);
      const zcr = await this._extractZCR(monoSignal);
      
      // Autres caractéristiques pertinentes
      const spectralFeatures = await this._extractSpectralFeatures(monoSignal);
      
      // Combiner toutes les caractéristiques
      const combinedFeatures = [
        ...mfccs,
        ...chroma,
        ...spectralFeatures,
        energy,
        zcr
      ];
      
      return combinedFeatures;
    } catch (error) {
      console.error("Erreur lors de l'extraction des caractéristiques:", error);
      return this._createRandomFeatures(); // Secours en cas d'erreur
    }
  }

  // Créer un vecteur de caractéristiques aléatoires pour la démonstration
  _createRandomFeatures() {
    const randomFeatures = new Array(196).fill(0).map(() => Math.random() * 0.1);
    return randomFeatures;
  }

  // Conversion en signal mono
  _convertToMono(audioBuffer) {
    if (audioBuffer.numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }
    
    // Mixer les canaux en mono
    const monoSignal = new Float32Array(audioBuffer.length);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      monoSignal[i] = (left[i] + right[i]) / 2;
    }
    
    return monoSignal;
  }

  // Extraction des MFCCs en utilisant Essentia.js
  async _extractMFCCs(signal) {
    try {
      const frameSize = this.fftSize;
      const hopSize = this.hopSize;
      const mfccBands = 40;
      
      // Utiliser Essentia.js pour calculer les MFCCs
      const frames = this.essentia.FrameGenerator(signal, frameSize, hopSize);
      const mfccs = [];
      
      for (let i = 0; i < frames.size(); i++) {
        const frame = frames.get(i);
        const windowed = this.essentia.Windowing(frame, "hann");
        const spectrum = this.essentia.Spectrum(windowed.frame);
        const mfccFrame = this.essentia.MFCC(spectrum.spectrum, this.sampleRate, mfccBands);
        mfccs.push(mfccFrame.mfcc);
      }
      
      // Calculer la moyenne des MFCCs sur tous les frames
      const mfccMeans = new Array(mfccBands).fill(0);
      if (mfccs.length > 0) {
        for (let i = 0; i < mfccs.length; i++) {
          for (let j = 0; j < mfccBands; j++) {
            mfccMeans[j] += mfccs[i][j] / mfccs.length;
          }
        }
      }
      
      return mfccMeans;
    } catch (error) {
      console.warn("Erreur lors de l'extraction des MFCCs:", error);
      return new Array(40).fill(0).map(() => Math.random() * 0.1); // Retourner des valeurs aléatoires en cas d'erreur
    }
  }

  // Extraction du chroma
  async _extractChroma(signal) {
    try {
      // Simplification: Retourne 12 valeurs chroma (une par note musicale)
      const chromaFeatures = new Array(12).fill(0);
      
      const frames = this.essentia.FrameGenerator(signal, this.fftSize, this.hopSize);
      const chromaFrames = [];
      
      for (let i = 0; i < frames.size(); i++) {
        const frame = frames.get(i);
        const windowed = this.essentia.Windowing(frame, "hann");
        const spectrum = this.essentia.Spectrum(windowed.frame);
        const chroma = this.essentia.HPCP(spectrum.spectrum);
        chromaFrames.push(chroma.hpcp);
      }
      
      // Moyenne des valeurs chroma
      if (chromaFrames.length > 0) {
        for (let i = 0; i < chromaFrames.length; i++) {
          for (let j = 0; j < 12; j++) {
            chromaFeatures[j] += chromaFrames[i][j] / chromaFrames.length;
          }
        }
      }
      
      return chromaFeatures;
    } catch (error) {
      console.warn("Erreur dans l'extraction chroma:", error);
      return new Array(12).fill(0).map(() => Math.random() * 0.1); // Retourner des valeurs aléatoires en cas d'erreur
    }
  }

  // Extraction de l'énergie
  async _extractEnergy(signal) {
    try {
      return this.essentia.Energy(signal).energy;
    } catch (error) {
      return Math.random() * 0.1;
    }
  }

  // Extraction du ZCR (Zero-Crossing Rate)
  async _extractZCR(signal) {
    try {
      return this.essentia.ZeroCrossingRate(signal).zeroCrossingRate;
    } catch (error) {
      return Math.random() * 0.1;
    }
  }

  // Extraction des caractéristiques spectrales
  async _extractSpectralFeatures(signal) {
    try {
      // Nous allons extraire les caractéristiques spectrales pour simuler les fonctionnalités manquantes
      const spectralFeatures = new Array(141).fill(0); // 128 (Mel) + 7 (Spectral Contrast) + 6 (Tonnetz)
      
      const frames = this.essentia.FrameGenerator(signal, this.fftSize, this.hopSize);
      const spectralFrames = [];
      
      for (let i = 0; i < Math.min(frames.size(), 10); i++) { // Limiter à 10 frames pour la performance
        const frame = frames.get(i);
        const windowed = this.essentia.Windowing(frame, "hann");
        const spectrum = this.essentia.Spectrum(windowed.frame);
        
        // Caractéristiques spectrales
        const spectralContrast = this.essentia.SpectralContrast(spectrum.spectrum, this.sampleRate);
        const spectralCentroid = this.essentia.SpectralCentroid(spectrum.spectrum, this.sampleRate);
        const spectralFlux = this.essentia.SpectralFlux(spectrum.spectrum);
        
        // Stocker les caractéristiques
        spectralFrames.push({
          contrast: spectralContrast.spectralContrast,
          valleys: spectralContrast.spectralValley,
          centroid: spectralCentroid.spectralCentroid,
          flux: spectralFlux.flux
        });
      }
      
      // Traiter les caractéristiques spectrales
      if (spectralFrames.length > 0) {
        // Remplir les 141 valeurs avec les caractéristiques spectrales disponibles
        // Ceci est une simplification - dans un cas réel, vous extrairiez plus précisément les features
        let index = 0;
        
        // Simuler les 128 valeurs Mel
        for (let i = 0; i < 128; i++) {
          spectralFeatures[index++] = Math.random() * 0.1; // Valeurs aléatoires faibles comme placeholder
        }
        
        // Ajouter les 7 valeurs de contraste spectral
        if (spectralFrames[0].contrast && spectralFrames[0].contrast.length >= 7) {
          for (let i = 0; i < 7; i++) {
            let sum = 0;
            for (let j = 0; j < spectralFrames.length; j++) {
              sum += spectralFrames[j].contrast[i];
            }
            spectralFeatures[index++] = sum / spectralFrames.length;
          }
        } else {
          index += 7; // Sauter les valeurs manquantes
        }
        
        // Simuler les 6 valeurs Tonnetz
        for (let i = 0; i < 6; i++) {
          spectralFeatures[index++] = Math.random() * 0.1;
        }
      }
      
      return spectralFeatures;
    } catch (error) {
      console.warn("Erreur dans l'extraction des caractéristiques spectrales:", error);
      return new Array(141).fill(0).map(() => Math.random() * 0.1); // Retourner des valeurs aléatoires en cas d'erreur
    }
  }

}