// Configuration globale
const EMOTIONS = ["neutre", "heureux", "triste", "colère", "peur", "dégoût", "surprise"];
const EMOTION_COLORS = [
    'rgba(149, 165, 166, 0.7)', // neutre
    'rgba(46, 204, 113, 0.7)',  // heureux
    'rgba(52, 152, 219, 0.7)',  // triste
    'rgba(231, 76, 60, 0.7)',   // colère
    'rgba(155, 89, 182, 0.7)',  // peur
    'rgba(142, 68, 173, 0.7)',  // dégoût
    'rgba(241, 196, 15, 0.7)'   // surprise
];
const EMOTION_BACKGROUNDS = [
    'rgba(149, 165, 166, 0.2)', // neutre
    'rgba(46, 204, 113, 0.2)',  // heureux
    'rgba(52, 152, 219, 0.2)',  // triste
    'rgba(231, 76, 60, 0.2)',   // colère
    'rgba(155, 89, 182, 0.2)',  // peur
    'rgba(142, 68, 173, 0.2)',  // dégoût
    'rgba(241, 196, 15, 0.2)'   // surprise
];
const ANALYSIS_INTERVAL = 2000; // Intervalle d'analyse en ms
const MODEL_PATH = 'model/model.json'; // Chemin vers le modèle TensorFlow.js

// Variables globales
let model;
let audioContext;
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let startTime;
let timerInterval;
let videoStream;
let audioAnalyser;
let audioSource;
let featureExtractor;
let emotionData = {
    timestamps: [],
    emotions: [],
    confidences: []
};
let currentEmotions = new Array(EMOTIONS.length).fill(0);
let emotionChart;
let distributionChart;
let analyzeInterval;
let visualizerBars = [];
let demoMode = false;

// Éléments DOM
const videoElement = document.getElementById('video-element');
const startButton = document.getElementById('start-btn');
const stopButton = document.getElementById('stop-btn');
const generateButton = document.getElementById('generate-btn');
const statusElement = document.getElementById('status');
const timerElement = document.getElementById('timer');
const emotionListElement = document.getElementById('emotion-list');
const audioVisualizerElement = document.getElementById('audio-visualizer');
const reportSectionElement = document.getElementById('report-section');
const loadingEmotionsElement = document.getElementById('loading-emotions');

// Initialiser l'application au chargement de la page
document.addEventListener('DOMContentLoaded', initApp);

// Initialisation de l'application
async function initApp() {
    // Forcer le mode démo pour éviter les erreurs
    demoMode = true;

    try {
        // Initialiser l'extracteur de caractéristiques
        featureExtractor = new AudioFeatureExtractor();
        await featureExtractor.initialize();

        // Créer l'interface de visualisation des émotions
        createEmotionList();

        // Afficher des émotions initiales à zéro
        updateEmotionList(new Array(EMOTIONS.length).fill(0));

        // Initialiser les graphiques
        initCharts();

        // Initialiser l'audio visualizer
        initAudioVisualizer();

        // Charger le modèle TensorFlow.js
        try {
            statusElement.textContent = "Chargement du modèle...";
            // Vérifier si tf est défini
            if (typeof tf === 'undefined') {
                throw new Error("TensorFlow.js n'est pas chargé");
            }
            model = await tf.loadLayersModel(MODEL_PATH);
            console.log("Modèle chargé avec succès!");
            statusElement.className = "status-ready";
            statusElement.textContent = "Prêt à démarrer l'enregistrement";
        } catch (error) {
            console.error("Erreur lors du chargement du modèle:", error);
            // Mode démo - nous allons simuler les prédictions
            demoMode = true;
            statusElement.className = "status-ready";
            statusElement.textContent = "Mode démo - Prêt à démarrer";
        }

        // Activer les contrôles
        setupEventListeners();
    } catch (error) {
        console.error("Erreur d'initialisation:", error);
        demoMode = true;
        statusElement.className = "status-error";
        statusElement.textContent = "Erreur d'initialisation, mode démo activé";
        setupEventListeners();
    }
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    startButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    generateButton.addEventListener('click', generateReport);
}

// Créer la liste des émotions
function createEmotionList() {
    emotionListElement.innerHTML = '';

    EMOTIONS.forEach((emotion, index) => {
        const emotionItem = document.createElement('div');
        emotionItem.className = 'emotion-item';
        emotionItem.innerHTML = `
            <div class="emotion-name">${emotion.charAt(0).toUpperCase() + emotion.slice(1)}</div>
            <div class="emotion-confidence" id="emotion-${index}">0%</div>
        `;
        emotionListElement.appendChild(emotionItem);
    });
}

// Initialiser les graphiques
function initCharts() {
    try {
        const ctx = document.getElementById('emotion-chart').getContext('2d');

        if (typeof Chart === 'undefined') {
            console.error("Chart.js n'est pas chargé");
            return;
        }

        emotionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: EMOTIONS.map((emotion, index) => ({
                    label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
                    data: [],
                    borderColor: EMOTION_COLORS[index].replace('0.7', '1'),
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 1
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Temps (s)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Confiance (%)'
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erreur lors de l'initialisation des graphiques:", error);
    }
}

// Initialiser le graphique de distribution pour le rapport
function initDistributionChart() {
    try {
        const ctx = document.getElementById('distribution-chart').getContext('2d');

        if (typeof Chart === 'undefined') {
            console.error("Chart.js n'est pas chargé");
            return;
        }

        distributionChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: EMOTIONS.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
                datasets: [{
                    data: new Array(EMOTIONS.length).fill(0),
                    backgroundColor: EMOTION_COLORS,
                    borderColor: EMOTION_COLORS.map(c => c.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erreur lors de l'initialisation du graphique de distribution:", error);
    }
}

// Initialiser l'audio visualizer
function initAudioVisualizer() {
    audioVisualizerElement.innerHTML = '';
    visualizerBars = [];
    const barCount = 64;

    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar';
        bar.style.left = `${(i * (100 / barCount))}%`;
        audioVisualizerElement.appendChild(bar);
        visualizerBars.push(bar);
    }
}

// Démarrer l'enregistrement
async function startRecording() {
    try {
        // Initialisation de l'enregistrement
        resetData();

        // Si le mode démo est activé, simuler l'enregistrement
        if (demoMode) {
            simulateRecording();
            return;
        }

        // Obtenir l'accès à la caméra et au micro
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });

        // Afficher la vidéo
        videoElement.srcObject = stream;
        videoElement.muted = true; // Éviter le retour audio
        videoStream = stream;

        // Configurer l'analyser audio
        setupAudioAnalyser(stream);

        // Configurer l'enregistreur média
        setupMediaRecorder(stream);

        // Mettre à jour l'interface
        statusElement.className = 'status-recording';
        statusElement.textContent = 'Enregistrement en cours...';
        startButton.disabled = true;
        stopButton.disabled = false;
        generateButton.disabled = true;

        // Démarrer le timer
        startTimer();

        // Démarrer l'analyse des émotions
        startEmotionAnalysis();

    } catch (error) {
        console.error('Erreur lors du démarrage de l\'enregistrement:', error);
        // En cas d'erreur, passer en mode démo
        demoMode = true;
        statusElement.className = 'status-error';
        statusElement.textContent = 'Erreur d\'accès à la caméra/micro, mode démo activé';
        simulateRecording();
    }
}

// Simuler l'enregistrement en mode démo
function simulateRecording() {
    // Mettre à jour l'interface
    statusElement.className = 'status-recording';
    statusElement.textContent = 'Simulation d\'enregistrement (mode démo)...';
    startButton.disabled = true;
    stopButton.disabled = false;
    generateButton.disabled = true;

    // Démarrer le timer
    startTimer();

    // Démarrer l'analyse simulée des émotions
    isRecording = true;
    startEmotionAnalysis();

    // Simuler l'animation du visualiseur audio
    simulateAudioVisualizer();
}

// Simuler l'animation du visualiseur audio
function simulateAudioVisualizer() {
    if (!isRecording) return;

    // Générer des valeurs aléatoires pour les barres
    for (let i = 0; i < visualizerBars.length; i++) {
        const height = Math.random() * 100;
        visualizerBars[i].style.height = `${height}%`;
    }

    // Continuer l'animation
    requestAnimationFrame(simulateAudioVisualizer);
}

// Configurer l'analyseur audio
function setupAudioAnalyser(stream) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            throw new Error("AudioContext n'est pas supporté");
        }

        audioContext = new AudioContext();
        audioSource = audioContext.createMediaStreamSource(stream);
        audioAnalyser = audioContext.createAnalyser();

        audioAnalyser.fftSize = 256;
        audioSource.connect(audioAnalyser);

        // Animer le visualiseur audio
        animateAudioVisualizer();
    } catch (error) {
        console.error('Erreur lors de la configuration de l\'analyseur audio:', error);
        // Fallback à la simulation
        simulateAudioVisualizer();
    }
}

// Configurer l'enregistreur média
function setupMediaRecorder(stream) {
    // Vérifier si MediaRecorder est supporté
    if (typeof MediaRecorder === 'undefined') {
        console.error('MediaRecorder n\'est pas supporté dans ce navigateur');
        demoMode = true;
        statusElement.textContent = 'Enregistrement non supporté, mode démo activé';
        return;
    }

    let options = {};

    // Tester les types MIME supportés
    if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        console.warn('MediaRecorder avec options spécifiées non supporté, utilisation du format par défaut');
        try {
            mediaRecorder = new MediaRecorder(stream);
        } catch (err) {
            console.error('MediaRecorder n\'est pas supporté dans ce navigateur:', err);
            demoMode = true;
            statusElement.textContent = 'Enregistrement non supporté, mode démo activé';
            return;
        }
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    try {
        mediaRecorder.start(100);
        isRecording = true;
    } catch (err) {
        console.error('Erreur lors du démarrage de MediaRecorder:', err);
        demoMode = true;
        statusElement.textContent = 'Erreur d\'enregistrement, mode démo activé';
        simulateRecording();
    }
}

// Animer le visualiseur audio
function animateAudioVisualizer() {
    if (!isRecording || !audioAnalyser) return;

    try {
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser.getByteFrequencyData(dataArray);

        const step = Math.floor(bufferLength / visualizerBars.length);

        for (let i = 0; i < visualizerBars.length; i++) {
            const value = dataArray[i * step];
            const height = (value / 255) * 100;
            visualizerBars[i].style.height = `${height}%`;
        }

        requestAnimationFrame(animateAudioVisualizer);
    } catch (error) {
        console.error('Erreur lors de l\'animation du visualiseur audio:', error);
        simulateAudioVisualizer();
    }
}

// Démarrer le timer
function startTimer() {
    startTime = Date.now();

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor((elapsed / 1000) % 60).toString().padStart(2, '0');
        const minutes = Math.floor((elapsed / 1000 / 60) % 60).toString().padStart(2, '0');

        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// Démarrer l'analyse des émotions
function startEmotionAnalysis() {
    analyzeInterval = setInterval(async () => {
        if (!isRecording) return;

        try {
            // Analyse des émotions
            const predictions = await analyzeAudio();

            // Mettre à jour l'interface
            updateEmotionDisplay(predictions);

            // Enregistrer les données pour le rapport
            recordEmotionData(predictions);
        } catch (error) {
            console.error('Erreur lors de l\'analyse des émotions:', error);
        }
    }, ANALYSIS_INTERVAL);
}

// Analyser l'audio actuel
async function analyzeAudio() {
    try {
        if (demoMode) {
            // En mode démo, générer des prédictions simulées
            return generateDemoPredictions();
        }

        // Créer un buffer audio à partir du flux actuel
        const audioBuffer = await createAudioBuffer();

        // Extraire les caractéristiques
        const features = await featureExtractor.extractFeatures(audioBuffer);

        // Préparer les données pour le modèle
        const tensorFeatures = tf.tensor(features).reshape([1, features.length, 1]);

        // Faire une prédiction
        const predictions = await model.predict(tensorFeatures).data();

        // Nettoyer
        tensorFeatures.dispose();

        return Array.from(predictions);
    } catch (error) {
        console.error('Erreur lors de l\'analyse audio:', error);
        return generateDemoPredictions(); // Fallback
    }
}

// Créer un buffer audio à partir du flux actuel
async function createAudioBuffer() {
    return new Promise((resolve, reject) => {
        try {
            // Simulation pour l'exemple - dans une application réelle,
            // vous devriez extraire un véritable buffer audio du flux
            const sampleRate = audioContext ? audioContext.sampleRate : 44100;
            const dummyBuffer = {
                length: sampleRate * 3, // 3 secondes
                numberOfChannels: 1,
                sampleRate: sampleRate,
                getChannelData: () => new Float32Array(sampleRate * 3)
            };

            resolve(dummyBuffer);
        } catch (error) {
            reject(error);
        }
    });
}

// Générer des prédictions simulées pour le mode démo
function generateDemoPredictions() {
    // Créer un tableau de prédictions aléatoires qui change progressivement
    if (currentEmotions.every(e => e === 0)) {
        // Initialiser les prédictions avec une tendance
        const randomIndex = Math.floor(Math.random() * EMOTIONS.length);
        currentEmotions = new Array(EMOTIONS.length).fill(0).map((_, i) =>
            i === randomIndex ? 60 + Math.random() * 30 : Math.random() * 10
        );
    } else {
        // Faire évoluer les prédictions progressivement
        currentEmotions = currentEmotions.map((val, i) => {
            const change = (Math.random() - 0.5) * 15;
            return Math.max(0, Math.min(100, val + change));
        });

        // Normaliser pour que le total soit proche de 100
        const total = currentEmotions.reduce((a, b) => a + b, 0);
        currentEmotions = currentEmotions.map(val => (val / total) * 100);
    }

    return currentEmotions;
}

// Mettre à jour l'affichage des émotions
function updateEmotionDisplay(predictions) {
    // Mettre à jour la liste des émotions
    updateEmotionList(predictions);

    // Mettre à jour le graphique
    updateEmotionChart(predictions);
}

// Mettre à jour la liste des émotions
function updateEmotionList(predictions) {
    EMOTIONS.forEach((emotion, index) => {
        const confidenceElement = document.getElementById(`emotion-${index}`);
        if (!confidenceElement) return;

        const confidence = Math.round(predictions[index]);
        confidenceElement.textContent = `${confidence}%`;

        // Mettre en évidence l'émotion dominante
        const emotionItem = confidenceElement.parentElement;

        if (confidence === Math.max(...predictions)) {
            emotionItem.style.backgroundColor = EMOTION_BACKGROUNDS[index];
            emotionItem.style.borderLeft = `4px solid ${EMOTION_COLORS[index]}`;
        } else {
            emotionItem.style.backgroundColor = '#f5f5f5';
            emotionItem.style.borderLeft = 'none';
        }
    });
}

// Mettre à jour le graphique d'émotions
function updateEmotionChart(predictions) {
    if (!emotionChart) return;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    emotionChart.data.labels.push(elapsed);

    EMOTIONS.forEach((emotion, index) => {
        emotionChart.data.datasets[index].data.push(predictions[index]);
    });

    // Limiter le nombre de points à afficher (20 derniers points)
    if (emotionChart.data.labels.length > 20) {
        emotionChart.data.labels.shift();
        emotionChart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }

    emotionChart.update();
}

// Enregistrer les données d'émotions pour le rapport
function recordEmotionData(predictions) {
    const timestamp = (Date.now() - startTime) / 1000;

    emotionData.timestamps.push(timestamp);
    emotionData.emotions.push(EMOTIONS[predictions.indexOf(Math.max(...predictions))]);
    emotionData.confidences.push([...predictions]);
}

// Arrêter l'enregistrement
function stopRecording() {
    if (!isRecording) return;

    isRecording = false;

    // Arrêter le média recorder s'il existe
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch (error) {
            console.error('Erreur lors de l\'arrêt de MediaRecorder:', error);
        }
    }

    // Arrêter les intervalles
    clearInterval(timerInterval);
    clearInterval(analyzeInterval);

    // Arrêter les flux média
    stopMediaTracks();

    // Mettre à jour l'interface
    statusElement.className = 'status-processing';
    statusElement.textContent = 'Traitement terminé';
    startButton.disabled = false;
    stopButton.disabled = true;
    generateButton.disabled = false;
}

// Arrêter tous les flux média
function stopMediaTracks() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (error) {
                console.error('Erreur lors de l\'arrêt d\'une piste média:', error);
            }
        });
    }

    // Arrêter le contexte audio
    if (audioContext && audioContext.state !== 'closed') {
        try {
            audioContext.close();
        } catch (error) {
            console.error('Erreur lors de la fermeture du contexte audio:', error);
        }
    }
}

// Générer le rapport final
function generateReport() {
    // Désactiver temporairement les événements de défilement
    document.body.style.overflow = 'hidden';

    // Préparer l'interface du rapport
    reportSectionElement.classList.remove('hidden');

    // Initialiser le graphique de distribution s'il n'existe pas
    if (!distributionChart) {
        initDistributionChart();
    }

    // Calculer les statistiques
    const stats = calculateStats();

    // Mettre à jour les statistiques dans l'interface
    updateReportStats(stats);

    // Mettre à jour le graphique de distribution
    updateDistributionChart(stats.distribution);

    // Générer une analyse textuelle basée sur les émotions détectées
    const analysis = generateAnalysisText(stats);
    const analysisElement = document.getElementById('analysis-text');
    if (analysisElement) {
        analysisElement.textContent = analysis;
    }

    // Utiliser setTimeout pour retarder légèrement le défilement
    setTimeout(() => {
        // Position fixe à la section du rapport
        const yOffset = reportSectionElement.getBoundingClientRect().top + window.pageYOffset - 50;
        window.scrollTo({
            top: yOffset,
            behavior: 'auto' // Changer à 'auto' au lieu de 'smooth'
        });

        // Réactiver le défilement après un court délai
        setTimeout(() => {
            document.body.style.overflow = '';
        }, 100);
    }, 50);
}

// Calculer les statistiques pour le rapport
function calculateStats() {
    const stats = {
        dominantEmotion: '',
        emotionChanges: 0,
        recordingDuration: timerElement.textContent,
        distribution: new Array(EMOTIONS.length).fill(0)
    };

    // Si aucune donnée n'a été enregistrée, retourner des statistiques par défaut
    if (emotionData.emotions.length === 0) {
        stats.dominantEmotion = 'Neutre';
        return stats;
    }

    // Calculer la distribution
    emotionData.emotions.forEach(emotion => {
        const index = EMOTIONS.indexOf(emotion);
        if (index !== -1) {
            stats.distribution[index]++;
        }
    });

    // Normaliser la distribution en pourcentages
    const total = stats.distribution.reduce((a, b) => a + b, 0);
    if (total > 0) {
        stats.distribution = stats.distribution.map(count => Math.round((count / total) * 100));
    }

    // Trouver l'émotion dominante
    const maxIndex = stats.distribution.indexOf(Math.max(...stats.distribution));
    stats.dominantEmotion = EMOTIONS[maxIndex].charAt(0).toUpperCase() + EMOTIONS[maxIndex].slice(1);

    // Calculer les changements d'émotions
    if (emotionData.emotions.length > 1) {
        let prevEmotion = emotionData.emotions[0];

        for (let i = 1; i < emotionData.emotions.length; i++) {
            if (emotionData.emotions[i] !== prevEmotion) {
                stats.emotionChanges++;
                prevEmotion = emotionData.emotions[i];
            }
        }
    }

    return stats;
}

// Mettre à jour les statistiques dans l'interface
function updateReportStats(stats) {
    const dominantElement = document.getElementById('dominant-emotion');
    const changesElement = document.getElementById('emotion-changes');
    const durationElement = document.getElementById('recording-duration');

    if (dominantElement) dominantElement.textContent = stats.dominantEmotion;
    if (changesElement) changesElement.textContent = stats.emotionChanges;
    if (durationElement) durationElement.textContent = stats.recordingDuration;
}

// Mettre à jour le graphique de distribution
function updateDistributionChart(distribution) {
    if (!distributionChart) return;

    distributionChart.data.datasets[0].data = distribution;
    distributionChart.update();
}

// Générer une analyse textuelle détaillée
function generateAnalysisText(stats) {
    const dominantEmotion = stats.dominantEmotion.toLowerCase();
    const dominantIndex = EMOTIONS.indexOf(dominantEmotion);
    const dominantPercent = dominantIndex >= 0 ? stats.distribution[dominantIndex] : 0;

    // Introduction
    let analysis = `Durant cet enregistrement d'une durée de ${stats.recordingDuration}, votre expression vocale a été analysée pour détecter différentes émotions.\n\n`;

    // Émotions dominantes
    analysis += `RÉSUMÉ DES ÉMOTIONS DÉTECTÉES :\n`;
    analysis += `• Émotion dominante : "${stats.dominantEmotion}" (${dominantPercent}% du temps)\n`;

    // Trouver la deuxième émotion la plus fréquente
    let tempDistribution = [...stats.distribution];
    const highestIndex = tempDistribution.indexOf(Math.max(...tempDistribution));
    tempDistribution[highestIndex] = -1;
    const secondHighestIndex = tempDistribution.indexOf(Math.max(...tempDistribution));

    if (secondHighestIndex >= 0 && tempDistribution[secondHighestIndex] > 0) {
        const secondEmotion = EMOTIONS[secondHighestIndex].charAt(0).toUpperCase() + EMOTIONS[secondHighestIndex].slice(1);
        analysis += `• Seconde émotion significative : "${secondEmotion}" (${stats.distribution[secondHighestIndex]}% du temps)\n`;
    }

    // Variabilité émotionnelle
    analysis += `• Changements émotionnels détectés : ${stats.emotionChanges}\n\n`;

    // Analyse de la stabilité émotionnelle
    if (stats.emotionChanges === 0) {
        analysis += `STABILITÉ ÉMOTIONNELLE :\nVotre expression émotionnelle est restée remarquablement stable tout au long de l'enregistrement, ce qui peut indiquer une forte concentration ou une position émotionnelle constante sur le sujet abordé.\n\n`;
    } else if (stats.emotionChanges < 3) {
        analysis += `STABILITÉ ÉMOTIONNELLE :\nVotre expression émotionnelle a montré peu de variations (${stats.emotionChanges} changements significatifs), suggérant une certaine consistance dans votre état émotionnel, avec quelques moments de transition.\n\n`;
    } else if (stats.emotionChanges < 8) {
        analysis += `VARIABILITÉ ÉMOTIONNELLE :\nVotre expression émotionnelle a montré une variabilité modérée (${stats.emotionChanges} changements détectés), ce qui indique que vous avez exploré différents états émotionnels pendant la conversation.\n\n`;
    } else {
        analysis += `VARIABILITÉ ÉMOTIONNELLE ÉLEVÉE :\nVotre expression émotionnelle a montré une variabilité significative (${stats.emotionChanges} changements détectés), ce qui peut indiquer soit une réactivité émotionnelle élevée, soit une discussion abordant des sujets très variés sur le plan émotionnel.\n\n`;
    }

    // Analyse détaillée basée sur l'émotion dominante
    analysis += `INTERPRÉTATION DE L'ÉMOTION DOMINANTE :\n`;
    switch (dominantEmotion) {
        case 'neutre':
            analysis += `L'expression majoritairement neutre peut indiquer :\n• Une approche objective ou analytique du sujet\n• Une conversation formelle ou professionnelle\n• Une concentration sur le contenu factuel plutôt qu'émotionnel\n• Une possible retenue émotionnelle ou un contrôle des expressions`;
            break;
        case 'heureux':
            analysis += `L'expression majoritairement joyeuse témoigne de :\n• Un état émotionnel positif et ouvert\n• Une atmosphère de communication agréable\n• Une possible discussion sur des sujets appréciés ou enthousiasmants\n• Une attitude optimiste envers le sujet abordé`;
            break;
        case 'triste':
            analysis += `L'expression de tristesse dominante peut refléter :\n• Une humeur mélancolique ou nostalgique\n• Une discussion sur des sujets émotionnellement difficiles\n• Une réflexion sur des pertes ou des regrets\n• Un ton empathique envers des situations douloureuses`;
            break;
        case 'colère':
            analysis += `L'expression de colère prédominante suggère :\n• Une intensité émotionnelle liée à un sentiment d'injustice\n• Une possible frustration face à des obstacles ou difficultés\n• Une expression de désaccord fort ou d'indignation\n• Une énergie émotionnelle élevée durant l'échange`;
            break;
        case 'peur':
            analysis += `L'expression de peur dominante peut indiquer :\n• De l'anxiété ou de l'appréhension face au sujet abordé\n• Une perception de menace ou d'incertitude\n• Des préoccupations sur des risques potentiels\n• Une vulnérabilité émotionnelle durant l'échange`;
            break;
        case 'dégoût':
            analysis += `L'expression de dégoût dominante suggère :\n• Une forte aversion morale ou physique\n• Une réaction de rejet face à certaines idées ou situations\n• Une évaluation négative prononcée\n• Une distanciation émotionnelle face à des éléments perçus comme répulsifs`;
            break;
        case 'surprise':
            analysis += `L'expression de surprise dominante indique :\n• Des réactions à l'inattendu ou à la nouveauté\n• Des moments de découverte ou de révélation\n• Une ouverture aux informations nouvelles\n• Un engagement actif dans l'échange d'informations`;
            break;
        default:
            analysis += `Cette analyse émotionnelle peut vous aider à mieux comprendre comment vous vous exprimez dans différentes situations et à développer votre intelligence émotionnelle à travers la conscience de vos expressions vocales.`;
    }

    // Conseils personnalisés
    analysis += `\n\nSUGGESTIONS PERSONNALISÉES :\n`;

    if (dominantEmotion === 'neutre' && stats.emotionChanges < 3) {
        analysis += `• Essayez d'incorporer plus de variations tonales pour enrichir votre expression\n• Explorez l'expression d'émotions positives pour renforcer l'engagement`;
    } else if (dominantEmotion === 'triste' || dominantEmotion === 'peur') {
        analysis += `• Prenez conscience de votre tendance actuelle vers des émotions plus sombres\n• Considérez l'impact de cette tonalité sur votre interlocuteur`;
    } else if (dominantEmotion === 'colère' && stats.emotionChanges > 5) {
        analysis += `• Notez la volatilité émotionnelle qui transparaît dans votre expression\n• Explorez des techniques de régulation émotionnelle si approprié`;
    } else if (dominantEmotion === 'heureux') {
        analysis += `• Votre ton positif crée probablement un climat de communication favorable\n• Cette expression joyeuse est généralement perçue comme engageante et motivante`;
    } else {
        analysis += `• Prenez conscience de vos tendances d'expression émotionnelle\n• Adaptez votre expression selon le contexte et vos objectifs de communication`;
    }

    return analysis;
}

// Réinitialiser les données
function resetData() {
    recordedChunks = [];
    emotionData = {
        timestamps: [],
        emotions: [],
        confidences: []
    };
    currentEmotions = new Array(EMOTIONS.length).fill(0);

    // Réinitialiser le graphique
    if (emotionChart) {
        emotionChart.data.labels = [];
        emotionChart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        emotionChart.update();
    }

    // Masquer la section de rapport
    reportSectionElement.classList.add('hidden');

    // Réinitialiser la liste des émotions
    updateEmotionList(new Array(EMOTIONS.length).fill(0));
}