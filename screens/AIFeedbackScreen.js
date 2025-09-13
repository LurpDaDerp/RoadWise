import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Animated } from "react-native";
import { getAIFeedback } from "../utils/gptApi";
import { getAuth } from "firebase/auth";
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from "lottie-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: width, height: height } = Dimensions.get("window");

function interpolateColor(percent) {
  const p = Math.min(Math.max(percent, 0), 100) / 100;

  const start = { r: 255, g: 0, b: 0 };
  const mid   = { r: 255, g: 255, b: 0 }; 
  const end   = { r: 0, g: 225, b: 0 };   

  let r, g, b;

  if (p < 0.5) {
    const t = p / 0.5;
    r = Math.round(start.r + (mid.r - start.r) * t);
    g = Math.round(start.g + (mid.g - start.g) * t);
    b = Math.round(start.b + (mid.b - start.b) * t);
  } else {
    const t = (p - 0.5) / 0.5;
    r = Math.round(mid.r + (end.r - mid.r) * t);
    g = Math.round(mid.g + (end.g - mid.g) * t);
    b = Math.round(mid.b + (end.b - mid.b) * t);
  }

  return `rgb(${r},${g},${b})`;
}

function normalizeInput(stats) {
  const { generatedAt, ...rest } = stats; 
  return rest;
}

export default function AIFeedbackScreen({ route }) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing data...");

  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (feedback !== null) return;

    const controller = new AbortController();

    const messages = [
      "Processing Data...",
      "Analyzing Distractions...",
      "Analyzing Speed Data...",
      "Analyzing Braking Behavior...",
      "Analyzing Acceleration Behavior...",
      "Generating Response..."
    ];

    let index = 0;
    setLoadingMessage(messages[index]);

    let timeoutId;

    const showNextMessage = () => {
      index++;
      if (index < messages.length) {
        const randomDelay = Math.floor(Math.random() * 1800) + 750;

        timeoutId = setTimeout(() => {
          setLoadingMessage(messages[index]);
          showNextMessage(); 
        }, randomDelay);
      } 
    };

    showNextMessage();

    const fetchFeedback = async () => {
        try {
            const user = getAuth().currentUser;
            if (!user) {
            if (!controller.signal.aborted) {
                setFeedback({ summary: "No user logged in.", score: 0, tips: [] });
                setLoading(false);
            }
            return;
            }

            const { statsJSON } = route.params;

            const normalizedInput = normalizeInput(statsJSON);

           let cache = [];
           try {
             const storedCache = await AsyncStorage.getItem("feedbackCache");
             if (storedCache) cache = JSON.parse(storedCache);
           } catch (err) {
             console.error("Error loading cache:", err);
           }
        
           const match = cache.find(entry => 
             JSON.stringify(entry.input) === JSON.stringify(normalizedInput)
           );
           if (match) {
             setFeedback(match.response);
             setLoading(false);
             return;
           }

            const aiResponse = await getAIFeedback(statsJSON, controller.signal);

            if (!controller.signal.aborted) {
                if (!aiResponse) {
                    setFeedback({ summary: "No feedback received.", score: 0, tips: [] });
                } else {
                    setFeedback(aiResponse);

                    try {
                        await AsyncStorage.setItem("safetyScore", aiResponse.score.toString());
                    } catch (err) {
                        console.error("Error saving safety score:", err);
                    }

                    try {
                        const newEntry = { input: normalizedInput, response: aiResponse };
                        const updatedCache = [newEntry, ...cache].slice(0, 10);
                        await AsyncStorage.setItem("feedbackCache", JSON.stringify(updatedCache));
                    } catch (err) {
                        console.error("Error updating cache:", err);
                    }
                }
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                console.error(err);
                setFeedback({ summary: "Error getting AI feedback.", score: 0, tips: [] });
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                clearTimeout(timeoutId);

                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 1500, 
                  useNativeDriver: true,
                }).start();
            }
        }
        };

    fetchFeedback();

    return () => {
        controller.abort();
        clearTimeout(timeoutId);
    };
  }, []);


const renderHeatBar = (score) => {
  const markerSize = 28; 
  const barWidth = width - 40 - 20; 
  const margin = 14; 
  const usableWidth = barWidth - 2 * margin; 
  const markerLeft = margin + (usableWidth * score) / 100 - markerSize / 2;

  return (
    <View style={styles.heatBarBox}>
      <View style={styles.heatBarContainer}>

      <LinearGradient
        colors={['rgba(255,0,0,1)', 'rgba(255,255,0,1)', 'rgba(0, 221, 0, 1)']}
        locations={[0, 0.5, 1]} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heatBarBackground}
      />
            
      <View style={styles.markerScore}>
      <Text
        style={[
            styles.heatBarScore,
            {
            left: markerLeft + markerSize / 2,
            width: 50,  
            marginLeft: -25, 
            textAlign: 'center', 
            color: interpolateColor(score),
            },
        ]}
        >
        {score}
      </Text>

      <View
        style={[
          styles.heatBarMarker,
          { left: markerLeft },
        ]}
      />
      </View>
      </View>
    </View>
  );
};
``
  return (
    <LinearGradient
      colors={['#00071aff', '#2b003bff']}
      style={styles.gradientBackground}
    >
    <View style={styles.container}>
      {loading ? (
        <View style={[styles.loadingContainer, {marginBottom: height/14}]}>
            <LottieView
            source={require("../assets/loader.json")} 
            autoPlay
            loop
            style={{ width: 1.3*width, height: 1.3*width }}
            />
            <Text style={{ color: "#fff", marginTop: height/7, fontSize: 18, position: "absolute", fontFamily: "Arial Rounded MT Bold"}}>
              {loadingMessage}
            </Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView style = {{paddingHorizontal: width/15}}>
          {feedback && (
            <>
              <Text style={styles.title}>My Feedback</Text>
              <Text style={styles.sectionTitle}>Overall Safety Rating:</Text>
              {renderHeatBar(feedback.score)}
              <Text style={styles.summaryText}>{feedback.summary}</Text>

              <Text style={styles.sectionTitle}>Driving Tips & Suggestions</Text>
              <View style={styles.bulletBox}>
                {feedback.tips.map((tip, idx) => (
                    <Text key={idx} style={styles.bulletPoint}>
                    • {tip}
                    </Text>
                ))}
              </View>
            </>
          )}
        </ScrollView>
        </Animated.View>
      )}
    </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: width / 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    fontFamily: "Arial Rounded MT Bold",
    color: "#fff",
    marginTop: 15,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    textAlign: "center",
    fontWeight: "bold",
    fontFamily: "Arial Rounded MT Bold",
    color: "#fff",
    marginTop: height / (667/50),
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 16,
    color: "#fff",
    lineHeight: 24,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: "#ddd",
    lineHeight: 20,
    marginBottom: 6,
  },
  bulletBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 12,
    padding: 12,
    marginBottom: height/25,
  },
  heatBarContainer: {
    height: 50, 
  },
  markerScore: {
    alignContent: "center",
    alignItems: "center",
    position: "absolute"
  },
  heatBarBox: {
    marginTop: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    position: 'relative',
    height: 75, 
  },
  heatBarBackground: {
    height: 20,
    borderRadius: 10,
    width: '100%',
    position: 'absolute',
    top: 28,
    
  },
  heatBarMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 28 - (28-20)/2, 
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 6,
  },
  heatBarScore: {
    position: 'absolute',
    fontWeight: 'bold',
    top: -4,
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
  },
});