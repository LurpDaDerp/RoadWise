import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../utils/firebase';
import { ImageBackground } from 'expo-image';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const scale = screenWidth / 375;

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserPlacement, setCurrentUserPlacement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid || null;
        setCurrentUserId(currentUid);

        const leaderboardRef = collection(db, 'users');
        const leaderboardQuery = query(
          leaderboardRef,
          orderBy('points', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(leaderboardQuery);

        const topResults = [];
        let isCurrentUserInTop10 = false;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;

          const user = {
            id,
            name: data.username || 'N/A',
            points: data.points || 0,
          };

          if (id === currentUid) isCurrentUserInTop10 = true;

          topResults.push(user);
        });

        setLeaderboard(topResults);

        if (!isCurrentUserInTop10 && currentUid) {
          const allSnapshot = await getDocs(
            query(leaderboardRef, orderBy('points', 'desc'))
          );

          let rank = 1;
          for (const doc of allSnapshot.docs) {
            if (doc.id === currentUid) {
              const data = doc.data();
              setCurrentUserPlacement({
                id: doc.id,
                name: data.username || 'You',
                points: data.points || 0,
                rank,
              });
              break;
            }
            rank++;
          }
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <ImageBackground
      source={require('../assets/leaderboardback.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Text style={styles.title}>Leaderboard</Text>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {Array.from({ length: 10 }, (_, index) => {
              const user = leaderboard[index];
              const isCurrentUser = user?.id === currentUserId;

              return (
                <View
                  key={index}
                  style={[styles.row, isCurrentUser && styles.currentUserRow]}
                >
                  <Text
                    style={[styles.name, isCurrentUser && styles.currentUserText]}
                  >
                    {index + 1}. {user ? user.name : 'N/A'}
                  </Text>
                  <Text
                    style={[styles.points, isCurrentUser && styles.currentUserText]}
                  >
                    {user ? user.points : ''}
                  </Text>
                </View>
              );
            })}

            {currentUserPlacement && (
              <>
                <View style={{ height: 20 * scale }} />
                <View style={[styles.row, styles.currentUserRow]}>
                  <Text style={[styles.name, styles.currentUserText]}>
                    {currentUserPlacement.rank}. {currentUserPlacement.name}
                  </Text>
                  <Text style={[styles.points, styles.currentUserText]}>
                    {currentUserPlacement.points}
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    padding: 24 * scale,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  title: {
    paddingTop: 40 * scale,
    fontSize: 36 * scale,
    fontWeight: 'bold',
    marginBottom: 20 * scale,
    textAlign: 'center',
    color: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10 * scale,
    paddingHorizontal: 25 * scale,
    borderBottomWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  name: {
    fontSize: 18 * scale,
    color: 'white',
  },
  points: {
    fontSize: 18 * scale,
    fontWeight: 'bold',
    color: 'white',
  },
  currentUserRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderColor: '#4CAF50',
    borderWidth: 2,
    borderRadius: 15 * scale,
  },
  currentUserText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});
