import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView, 
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { ThemeContext } from '../context/ThemeContext';
import { getDriveMetrics } from '../utils/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getAIFeedback } from '../utils/gptApi';

const { width, height } = Dimensions.get('window');

function aggregateDistractionsByTimeframe(drives, timeframe) {
  const toLocalDayKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const now = new Date();
  const labels = [];
  const data = [];

  if (timeframe === 1) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let h = 0; h < 24; h++) {
      const hour = new Date(start);
      hour.setHours(start.getHours() + h);

      const hourTotal = drives
        .filter(item => {
          const dt = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
          return (
            dt.getFullYear() === hour.getFullYear() &&
            dt.getMonth() === hour.getMonth() &&
            dt.getDate() === hour.getDate() &&
            dt.getHours() === hour.getHours()
          );
        })
        .reduce((sum, item) => sum + Number(item.distracted || 0), 0);

      data.push(hourTotal);

      if (h % 4 === 0) {
        const hr = hour.getHours();
        const hr12 = hr % 12 === 0 ? 12 : hr % 12;
        const ampm = hr < 12 ? "AM" : "PM";
        labels.push(`${hr12} ${ampm}`);
      } else {
        labels.push("");
      }
    }

    return { labels, data };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - (timeframe - 1));

  const totalsByDay = {};
  for (const item of drives) {
    const dt = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
    if (dt < start || dt > now) continue; 
    const key = toLocalDayKey(dt);
    totalsByDay[key] = (totalsByDay[key] || 0) + Number(item.distracted || 0);
  }

  const labelInterval = timeframe <= 7 ? 1 : 5; 
  for (let i = 0; i < timeframe; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const key = toLocalDayKey(day);
    const value = totalsByDay[key] !== undefined ? totalsByDay[key] : 0;
    data.push(value);

    const month = day.getMonth() + 1;
    const dayNum = day.getDate();
    labels.push(i % labelInterval === 0 ? `${month}/${dayNum}` : "");
  }


  return { labels, data };
}

function formatTotalDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
  } else if (hours > 0 && remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
}

function interpolateColor(percent) {
  const p = Math.min(Math.max(percent, 0), 75) / 75;

  const start = { r: 12, g: 250, b: 0 };
  const end = { r: 250, g: 0, b: 0 };

  const r = Math.round(start.r + (end.r - start.r) * p);
  const g = Math.round(start.g + (end.g - start.g) * p);
  const b = Math.round(start.b + (end.b - start.b) * p);

  return `rgb(${r},${g},${b})`;
}

export default function AIScreen({ route, navigation }) {
  const [timeframe, setTimeframe] = useState(7);
  const [gridLines, setGridLines] = useState(7);
  const [drives, setDrives] = useState([]);
  const [uid, setUid] = useState(null);
  const [stats, setStats] = useState({
    avgSpeedingMargin: 0,
    suddenAccelerations: 0,
    suddenStops: 0,
    avgSpeed: 0,
    totalDistance: 0,
  });

  const [percentDistracted, setPercentDistracted] = useState(0);
  const [percentColor, setPercentColor] = useState(interpolateColor(0));
  const [distractedCount, setDistractedCount] = useState(0);
  const [undistractedCount, setUndistractedCount] = useState(0);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const backgroundColor = isDark ? '#161616ff' : '#fff';
  const chartBackground = isDark ? '#000' : '#eeeeeeff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#333' : '#eeeeeeff';
  const altTextColor = isDark ? '#aaa' : '#555';
  const chartLineColor = isDark ? `rgba(132, 87, 255, 0.5)` : `rgba(38, 0, 255, 0.5)`;
  const buttonColor = isDark ? `rgba(108, 55, 255, 1)` : `rgba(99, 71, 255, 1)`;
  /* const chartShadingColor */
  
  const generateStatsJSON = () => {

    const totalDistractions = data.reduce((sum, val) => sum + (val || 0), 0);

    return {
      totalPhoneDistractions: totalDistractions,
      numberOfDistractedDrives: distractedCount,
      numberOfUndistractedDrives: undistractedCount,
      percentDistracted: percentDistracted,
      averageSpeedingMargin: stats.avgSpeedingMargin,
      averageSpeed: stats.avgSpeed,
      suddenStops: stats.suddenStops,
      suddenAccelerations: stats.suddenAccelerations,
      totalDurationDriving: stats.totalDuration,
      totalDistanceTraveled: stats.totalDistance,
      timeframeDays: timeframe,
      generatedAt: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) setUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;
    const fetchMetrics = async () => {
      const metrics = await getDriveMetrics(uid, timeframe);
      setDrives(metrics);

      if (!metrics || metrics.length === 0) {
        setStats({
          avgSpeedingMargin: 0,
          suddenAccelerations: 0,
          suddenStops: 0,
          avgSpeed: 0,
          totalDistance: 0,
          totalDuration: 0
        });
        return;
      }

      let drivesToUse = metrics;
      if (timeframe === 1) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        drivesToUse = metrics.filter(drive => {
          const dt = drive.timestamp?.toDate ? drive.timestamp.toDate() : new Date(drive.timestamp);
          return dt >= startOfToday;
        });
      }

      let totalSpeedingMargin = 0;
      let totalSuddenAccels = 0;
      let totalSuddenStops = 0;
      let totalDistance = 0;
      let totalWeightedSpeed = 0;
      let totalDuration = 0;

      drivesToUse.forEach(drive => {
        const duration = drive.duration || 0; 
        totalWeightedSpeed += (drive.avgSpeed || 0) * duration; 
        totalSpeedingMargin += (drive.avgSpeedingMargin || 0) * duration; 
        totalSuddenAccels += drive.suddenAccelerations || 0;
        totalSuddenStops += drive.suddenStops || 0;
        totalDistance += drive.totalDistance || 0;
        totalDuration += duration;
      })

      setStats({
        avgSpeedingMargin: totalDuration > 0 ? (totalSpeedingMargin / totalDuration).toFixed(1) : 0,
        suddenAccelerations: totalSuddenAccels,
        suddenStops: totalSuddenStops,
        avgSpeed: totalDuration > 0 ? (totalWeightedSpeed / totalDuration).toFixed(1) : 0,
        totalDistance: totalDistance.toFixed(1),
        totalDuration: formatTotalDuration(totalDuration),
      });

      const distractedCountVal = drivesToUse.reduce((sum, d) => sum + (d.distracted > 0 ? 1 : 0), 0);
      const totalDrives = drivesToUse.length;
      const undistractedCountVal = totalDrives - distractedCountVal;

      setDistractedCount(distractedCountVal);
      setUndistractedCount(undistractedCountVal);

      const percent = totalDrives > 0 ? Math.round((distractedCountVal / totalDrives) * 10000) / 100 : 0;
      setPercentDistracted(percent);
      setPercentColor(interpolateColor(percent));

    };
    fetchMetrics();
  }, [uid, timeframe]);


  const { labels, data } = aggregateDistractionsByTimeframe(drives, timeframe);
  const maxDistractions = data.length > 0 ? Math.max(...data) : 1;
  const segments = Math.min(maxDistractions, 10);

  const StatBox = ({ label, value, textColor: valueColor }) => (
    <View style={{
      backgroundColor: moduleBackground,
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 4,
    }}>
      <Text style={{
        fontSize: 16,
        fontWeight: 'bold',
        color: valueColor || textColor,
      }}>{value}</Text>
      <Text style={{
        fontSize: 12,
        color: altTextColor,
        textAlign: 'center',
        marginTop: 4,
      }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: backgroundColor, padding: width / (375/10), paddingTop: height / (667/70)}}>
      <Text style={{ 
        fontSize: 28, 
        fontWeight: "bold", 
        textAlign: "center", 
        color: titleColor,
        marginTop: 8,
        marginBottom: 10,
      }}>
        My Driver Report</Text>
      
      

      <ScrollView
        style={{ flex: 1, backgroundColor: backgroundColor, padding: width / (375/10) }}
        contentContainerStyle={{ paddingBottom: height / (667/40) }}
      >
      
      <TouchableOpacity
        onPress={() => {
          const statsJSON = generateStatsJSON();
          console.log(statsJSON);
          navigation.navigate("AIFeedback", { statsJSON });
        }}
        style={{
          borderRadius: 10,
          overflow: 'hidden', 
          marginHorizontal: 5,
          marginBottom: 20,
        }}
      >
        <LinearGradient
          colors={['#a300e4ff', '#2a00c0ff']} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: "#fff" }}>
            ✦ Get AI Feedback
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <SegmentedControl
        values={['1D', '7D', '30D']}
        selectedIndex={timeframe === 1 ? 0 : timeframe === 7 ? 1 : 2}
        onChange={(event) => {
          const index = event.nativeEvent.selectedSegmentIndex;
          if (index === 0) {
            setTimeframe(1);
            setGridLines(4);
          } else if (index === 1) {
            setTimeframe(7);
            setGridLines(1);
          } else {
            setTimeframe(30);
            setGridLines(5);
          }
        }}
        style={{ marginBottom: 10, marginTop: 10, marginHorizontal: 5 }}
      />

      <Text style={{ 
        fontSize: 18, 
        fontWeight: "bold", 
        textAlign: "center", 
        color: titleColor,
        marginTop: 8,
        marginBottom: 8 
      }}>
        Phone Distractions
      </Text>

      {labels.length > 0 ? (
        <LineChart
          data={{ labels, datasets: [{ data }] }}
          width={width * 7/8}
          height={height/3}
          fromZero
          yAxisLabel=""
          yAxisInterval={gridLines}
          segments={segments} 
          chartConfig={{
            backgroundGradientFrom: chartBackground, 
            backgroundGradientTo: chartBackground, 
            decimalPlaces: 0,
            color: (opacity = 1) => chartLineColor,
            labelColor: (opacity = 1) => textColor,
            style: { borderRadius: 8 },
            propsForDots: ({ value }) => ({
              r: value !== undefined && value !== null ? "4" : "0",
              strokeWidth: value !== undefined && value !== null ? "2" : "0",
              stroke: "#5900ffff",
            }),
            propsForBackgroundLines: { stroke: "#444" },
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 8 }}
        />
      ) : (
        <Text style={{ color: altTextColor, textAlign: 'center', marginTop: 20 }}>No data for selected timeframe.</Text>
      )}


      <View style={styles.statsRow}>
        <StatBox label="Distracted Drives" value={distractedCount} />
        <StatBox label="Undistracted Drives" value={undistractedCount} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="of Drives are Distracted" value={`${percentDistracted}%`} textColor={percentColor} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Avg Speeding Margin" value={`${stats.avgSpeedingMargin} mph`} />
        <StatBox label="Avg Speed" value={`${stats.avgSpeed} mph`} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Sudden Stops" value={stats.suddenStops} />
        <StatBox label="Sudden Accelerations" value={stats.suddenAccelerations} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Total Distance" value={`${stats.totalDistance} mi`} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Total Time Driving" value={`${stats.totalDuration}`} />
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: buttonColor, 
          paddingVertical: 12,
          marginHorizontal: 5,
          borderRadius: 10,
          marginTop: 20,
          alignItems: 'center',
        }}
        onPress={() => navigation.navigate('MyDrives')}
      >
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: "#fff" }}>
          View All Drives
        </Text>
      </TouchableOpacity>

            </ScrollView>
          </View>
        );
      }

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
});
